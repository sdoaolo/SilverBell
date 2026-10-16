import "server-only";
// API 라우트 공통 도우미.
// 참고: Next 16 + cacheComponents에서는 route에 `export const runtime = "nodejs"`를 쓰면 빌드가 실패한다.
// 기본 런타임이 nodejs이므로 선언하지 않는다.
import { NextResponse } from "next/server";
import type { z } from "zod";
import { getActor, type Actor } from "./authz";
import { ERR } from "./messages";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

/** 권한 없거나 없는 id → 404 */
export function notFound() {
  return fail(ERR.notFound, 404);
}

export async function parseJson<S extends z.ZodType>(
  req: Request,
  schema: S,
): Promise<{ data: z.infer<S> } | { response: NextResponse }> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { response: fail(ERR.badInput) };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { response: fail(parsed.error.issues[0]?.message || ERR.badInput) };
  }
  return { data: parsed.data };
}

/** 로그인 필요. 없으면 401 */
export async function requireActor(): Promise<{ actor: Actor } | { response: NextResponse }> {
  const actor = await getActor();
  if (!actor) return { response: fail(ERR.loginRequired, 401) };
  return { actor };
}

/** 예상하지 못한 오류는 기록하고 쉬운 문구로 */
export function serverError(e: unknown) {
  console.error(e);
  return fail("잠시 후 다시 시도해 주세요", 500);
}
