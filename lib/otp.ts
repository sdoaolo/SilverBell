import "server-only";
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { isPhoneAllowed } from "./allow-phones";
import {
  OTP_COOLDOWN_MS,
  OTP_HOURLY_LIMIT,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MS,
} from "./config";
import { phoneHash } from "./crypto/phone";
import { db } from "./db";
import { ERR } from "./messages";
import { deliver } from "./notify/provider";
import { solapiProvider } from "./notify/solapi";

export type OtpPurpose = "login" | "senior_verify" | "guardian_invite";

type Result = { ok: true } | { ok: false; error: string };

// sha256(번호 + 코드 + OTP_PEPPER). 번호 자리에는 phone_hash를 쓴다
// → 어르신·보호자 확인 코드를 검증할 때 저장된 번호를 복호화하지 않아도 된다.
function codeHash(hashOfPhone: string, code: string): string {
  const pepper = process.env.OTP_PEPPER;
  if (!pepper) throw new Error("OTP_PEPPER를 설정하세요");
  return createHash("sha256").update(hashOfPhone + code + pepper).digest("hex");
}

/**
 * 6자리 코드를 만들어 저장하고 문자로 보낸다. phone은 normalizePhone을 거친 숫자.
 * 번호당 60초 쿨다운, 1시간 5회 제한. 코드 원문은 저장·출력하지 않는다.
 */
export async function sendOtp(
  phone: string,
  purpose: OtpPurpose,
  makeText: (code: string) => string,
): Promise<Result> {
  if (!isPhoneAllowed(phone)) return { ok: false, error: ERR.phoneNotAllowed };

  const hash = phoneHash(phone);
  const hourAgo = new Date(Date.now() - 60 * 60_000).toISOString();
  const { data: recent, error } = await db()
    .from("otp_codes")
    .select("created_at")
    .eq("phone_hash", hash)
    .gte("created_at", hourAgo)
    .order("created_at", { ascending: false });
  if (error) throw error;

  if (recent.length > 0 && Date.now() - new Date(recent[0].created_at).getTime() < OTP_COOLDOWN_MS) {
    return { ok: false, error: ERR.otpCooldown };
  }
  if (recent.length >= OTP_HOURLY_LIMIT) return { ok: false, error: ERR.otpTooMany };

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const { data: row, error: insertError } = await db()
    .from("otp_codes")
    .insert({
      phone_hash: hash,
      purpose,
      code_hash: codeHash(hash, code),
      expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
    })
    .select("id")
    .single();
  if (insertError) throw insertError;

  // 확인 코드는 DEMO_MODE와 상관없이 실제 문자로 보낸다 (코드를 콘솔에 찍지 않기 위해, ALLOW_PHONES 검사는 유지)
  const sent = await deliver("sms", phone, makeText(code), solapiProvider);
  if (sent.status === "failed" || sent.status === "skipped") {
    // 보내지 못한 코드는 지워서 쿨다운·횟수에 넣지 않는다
    await db().from("otp_codes").delete().eq("id", row.id);
    return { ok: false, error: sent.error ?? "문자를 보내지 못했어요. 잠시 후 다시 해 주세요" };
  }
  return { ok: true };
}

/**
 * 최신 미사용 코드와 비교. 실패하면 시도 횟수 +1, 성공하면 used_at 기록.
 * hashOfPhone은 phoneHash(번호) 값 (users·seniors의 phone_hash 그대로 사용 가능).
 */
export async function verifyOtp(hashOfPhone: string, purpose: OtpPurpose, code: string): Promise<Result> {
  if (!/^\d{6}$/.test(code)) return { ok: false, error: ERR.otpWrong };

  const { data: row, error } = await db()
    .from("otp_codes")
    .select("id, code_hash, expires_at, attempts")
    .eq("phone_hash", hashOfPhone)
    .eq("purpose", purpose)
    .is("used_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!row || new Date(row.expires_at).getTime() < Date.now() || row.attempts >= OTP_MAX_ATTEMPTS) {
    return { ok: false, error: ERR.otpExpired };
  }

  const expected = Buffer.from(row.code_hash, "hex");
  const actual = Buffer.from(codeHash(hashOfPhone, code), "hex");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    await db().from("otp_codes").update({ attempts: row.attempts + 1 }).eq("id", row.id);
    return { ok: false, error: ERR.otpWrong };
  }

  // 동시에 두 번 검증돼도 한 번만 성공하도록 used_at이 비어 있을 때만 기록
  const { data: used, error: useError } = await db()
    .from("otp_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("id", row.id)
    .is("used_at", null)
    .select("id");
  if (useError) throw useError;
  if (!used || used.length === 0) return { ok: false, error: ERR.otpExpired };
  return { ok: true };
}
