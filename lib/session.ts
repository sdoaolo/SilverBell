import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE, SESSION_MAX_AGE_SEC, signSession, verifySession } from "./session-token";

/** Route Handler / Server Action에서만 호출 (쿠키 쓰기) */
export async function startSession(userId: string): Promise<void> {
  const token = await signSession(userId);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE_SEC,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/** 로그인한 사용자 id. 없으면 null */
export async function getSessionUserId(): Promise<string | null> {
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  return session?.userId ?? null;
}
