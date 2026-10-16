import { z } from "zod";
import { fail, ok, parseJson, serverError } from "@/lib/api";
import { ensureBootstrapAdmin } from "@/lib/authz";
import { normalizePhone } from "@/lib/crypto/phone";
import { db } from "@/lib/db";
import { ERR } from "@/lib/messages";
import { verifyOtp } from "@/lib/otp";
import { startSession } from "@/lib/session";
import { findOrCreateUser } from "@/lib/users";

const Body = z.object({
  phone: z.string({ error: ERR.phoneInvalid }),
  code: z.string({ error: ERR.otpWrong }),
});

export async function POST(req: Request) {
  const parsed = await parseJson(req, Body);
  if ("response" in parsed) return parsed.response;
  const phone = normalizePhone(parsed.data.phone);
  if (!phone) return fail(ERR.phoneInvalid);
  try {
    const result = await verifyOtp(phone, "login", parsed.data.code.trim());
    if (!result.ok) return fail(result.error);

    // 처음 통과한 번호면 계정을 만든다 (별도 가입 화면 없음)
    const user = await findOrCreateUser(phone);
    const { error } = await db()
      .from("users")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", user.id);
    if (error) throw error;
    await ensureBootstrapAdmin(user.id, phone);
    await startSession(user.id);

    return ok({ next: user.name ? "/home" : "/onboarding" });
  } catch (e) {
    return serverError(e);
  }
}
