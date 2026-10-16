// 로그인 필요 경로 보호. 여기서는 세션 쿠키 검증만 하고 역할은 확인하지 않는다
// (역할·소유권은 서버 컴포넌트/API에서 can()으로 확인).
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "./lib/session-token";

export async function proxy(request: NextRequest) {
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/home", "/onboarding", "/settings", "/seniors/:path*", "/admin/:path*"],
};
