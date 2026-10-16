import { z } from "zod";
import { fail, ok, parseJson, serverError } from "@/lib/api";
import { normalizePhone } from "@/lib/crypto/phone";
import { ERR, smsLoginCode } from "@/lib/messages";
import { sendOtp } from "@/lib/otp";

const Body = z.object({ phone: z.string({ error: ERR.phoneInvalid }) });

export async function POST(req: Request) {
  const parsed = await parseJson(req, Body);
  if ("response" in parsed) return parsed.response;
  const phone = normalizePhone(parsed.data.phone);
  if (!phone) return fail(ERR.phoneInvalid);
  try {
    const result = await sendOtp(phone, "login", smsLoginCode);
    if (!result.ok) return fail(result.error, 429);
    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
