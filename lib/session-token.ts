// 세션 JWT 서명·검증. proxy.ts에서도 쓰므로 next/headers나 DB에 의존하지 않는다.
// 페이로드는 userId만 (역할은 매 요청 DB에서 확인 → 회수 즉시 반영).
import { jwtVerify, SignJWT } from "jose";
import { SESSION_DAYS } from "./config";

export const SESSION_COOKIE = "session";
export const SESSION_MAX_AGE_SEC = SESSION_DAYS * 24 * 60 * 60;

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET을 32자 이상으로 설정하세요");
  return new TextEncoder().encode(secret);
}

export async function signSession(userId: string): Promise<string> {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());
}

export async function verifySession(token: string | undefined): Promise<{ userId: string } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    return typeof payload.userId === "string" ? { userId: payload.userId } : null;
  } catch {
    return null;
  }
}
