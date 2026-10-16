import "server-only";
import { cache } from "react";
import { logAudit } from "./audit";
import { maskPhone } from "./crypto/phone";
import { db } from "./db";
import {
  isAdminAction,
  rolesAllow,
  type Action,
  type Resource,
  type RoleGrant,
} from "./permissions";
import { getSessionUserId } from "./session";

export type { Action, Resource, Role, RoleGrant } from "./permissions";

export interface Actor {
  id: string;
  name: string | null;
  phoneLast4: string;
  roles: RoleGrant[];
}

/** user_roles 조회 (같은 요청 안에서는 캐시) */
export const getRoles = cache(async (userId: string): Promise<RoleGrant[]> => {
  const { data, error } = await db().from("user_roles").select("role, center_id").eq("user_id", userId);
  if (error) throw error;
  return data.map((r) => ({ role: r.role, centerId: r.center_id }));
});

/** 로그인한 사용자 + 역할. 세션이 없거나 계정이 지워졌으면 null */
export const getActor = cache(async (): Promise<Actor | null> => {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const { data: user, error } = await db()
    .from("users")
    .select("id, name, phone_last4")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!user) return null;
  return { id: user.id, name: user.name, phoneLast4: user.phone_last4, roles: await getRoles(user.id) };
});

/** 인증된 보호자인지 (확인 전 보호자는 권한 없음) */
export const isGuardianOf = cache(async (userId: string, seniorId: string): Promise<boolean> => {
  const { data, error } = await db()
    .from("senior_guardians")
    .select("relation")
    .eq("senior_id", seniorId)
    .eq("user_id", userId)
    .not("verified_at", "is", null)
    .maybeSingle();
  if (error) throw error;
  return !!data;
});

export const isOwnerOf = cache(async (userId: string, seniorId: string): Promise<boolean> => {
  const { data, error } = await db()
    .from("senior_guardians")
    .select("relation")
    .eq("senior_id", seniorId)
    .eq("user_id", userId)
    .eq("relation", "owner")
    .maybeSingle();
  if (error) throw error;
  return !!data;
});

/**
 * 모든 권한 판단은 여기를 거친다.
 * - 관리 행동: user_roles (center_manager는 resource.centerId가 담당 복지관일 때만)
 * - 어르신 관련: senior_guardians 연결 (삭제·보호자 관리는 owner만)
 */
export async function can(actor: Actor | null, action: Action, resource?: Resource): Promise<boolean> {
  if (!actor) return false;
  if (isAdminAction(action)) return rolesAllow(actor.roles, action, resource);
  if (!resource?.seniorId || !isUuid(resource.seniorId)) return false;
  switch (action) {
    case "senior.read":
    case "senior.update":
    case "senior.notify":
      return isGuardianOf(actor.id, resource.seniorId);
    case "senior.delete":
    case "guardian.manage":
      return isOwnerOf(actor.id, resource.seniorId);
  }
}

export function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

/**
 * 부트스트랩: BOOTSTRAP_SUPER_ADMIN_PHONES에 있는 번호가 로그인하면 super_admin 부여.
 * 환경변수에서 번호를 지워도 이미 부여된 역할은 남는다 (DB가 기준).
 */
export async function ensureBootstrapAdmin(userId: string, phone: string): Promise<void> {
  const list = (process.env.BOOTSTRAP_SUPER_ADMIN_PHONES ?? "")
    .split(",")
    .map((p) => p.replace(/\D/g, ""))
    .filter(Boolean);
  if (!list.includes(phone)) return;

  const { data: existing, error } = await db()
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (error) throw error;
  if (existing) return;

  const { error: insertError } = await db().from("user_roles").insert({ user_id: userId, role: "super_admin" });
  if (insertError && insertError.code !== "23505") throw insertError;
  if (!insertError) {
    await logAudit(null, "admin.bootstrap", { type: "user", id: userId }, {
      role: "super_admin",
      phone: maskPhone(phone.slice(-4)),
    });
  }
}
