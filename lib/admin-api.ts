import "server-only";
// /api/admin/* 공통: 맨 앞에서 can(). 실패하면 404.
import { z } from "zod";
import { notFound, requireActor } from "./api";
import { can, isUuid, type Action, type Actor } from "./authz";
import { getCenterId } from "./admin";
import { isYmd } from "./dates";
import { visibleCenterIds } from "./permissions";
import type { NextResponse } from "next/server";

type Guarded = { actor: Actor } | { response: NextResponse };

/** 로그인 + 관리 권한. 로그인 안 했으면 401, 권한 없으면 404 */
export async function adminGuard(action: Action, resource?: { centerId?: string | null }): Promise<Guarded> {
  const auth = await requireActor();
  if ("response" in auth) return auth;
  if (!(await can(auth.actor, action, resource))) return { response: notFound() };
  return auth;
}

/** 기간 id로 복지관을 찾아 권한 확인 (center_manager는 담당 복지관만) */
export async function periodGuard(action: Action, periodId: string): Promise<Guarded & { centerId?: string }> {
  if (!isUuid(periodId)) return { response: notFound() };
  const auth = await requireActor();
  if ("response" in auth) return auth;
  const centerId = await getCenterId("periods", periodId);
  if (!centerId || !(await can(auth.actor, action, { centerId }))) return { response: notFound() };
  return { ...auth, centerId };
}

export async function centerGuard(action: Action, centerId: string): Promise<Guarded> {
  if (!isUuid(centerId)) return { response: notFound() };
  const auth = await requireActor();
  if ("response" in auth) return auth;
  if (!(await getCenterId("centers", centerId)) || !(await can(auth.actor, action, { centerId }))) {
    return { response: notFound() };
  }
  return auth;
}

export function scopeOf(actor: Actor): string[] | null {
  return visibleCenterIds(actor.roles);
}

export function pageParam(url: URL): number {
  return Math.max(0, Number.parseInt(url.searchParams.get("page") ?? "0", 10) || 0);
}

// ───── 입력 스키마 ─────

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

/** 비어 있으면 null, 'TODO'는 그대로, 그 밖에는 http(s) 주소만 */
const urlField = optionalText(500).refine(
  (v) => v === null || v.toUpperCase() === "TODO" || /^https?:\/\//i.test(v),
  "주소는 http:// 또는 https://로 시작해야 해요",
);

export const CenterBody = z.object({
  name: z.string().trim().min(1, "복지관 이름을 입력하세요").max(100),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]*$/, "slug는 영어 소문자·숫자·-만 쓸 수 있어요")
    .max(50)
    .optional()
    .transform((v) => v || undefined), // 비우면 생성 시 자동, 수정 시 그대로 둠
  sido: optionalText(30),
  sigungu: optionalText(30),
  phone: optionalText(30),
  homepage: urlField,
  notice_url: urlField,
  is_active: z.boolean().optional(),
});

const ymd = z.string().refine(isYmd, "날짜는 YYYY-MM-DD 형식이에요");

export const PeriodBody = z
  .object({
    label: z.string().trim().min(1, "기간 이름을 입력하세요").max(60),
    apply_start: ymd,
    apply_end: z.preprocess((v) => (v === "" ? null : v), ymd.nullish()).transform((v) => v ?? null),
    method: optionalText(200),
  })
  .refine((p) => !p.apply_end || p.apply_end >= p.apply_start, "마감일이 시작일보다 빨라요");

export const RoleBody = z.object({
  role: z.enum(["super_admin", "admin", "center_manager"], { error: "역할을 골라 주세요" }),
  centerId: z.string().refine(isUuid, "담당 복지관을 골라 주세요").nullish(),
});

export const PeriodIdBody =z.object({ periodId: z.string().refine(isUuid, "기간을 찾을 수 없어요") });
