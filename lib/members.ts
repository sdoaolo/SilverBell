import "server-only";
// 관리자 관리 (super_admin 전용). 모든 추가·변경·회수는 감사 기록에 남긴다.
import { logAudit } from "./audit";
import { PAGE_SIZE } from "./config";
import { maskPhone } from "./crypto/phone";
import { db, isUniqueViolation } from "./db";
import { ERR, smsAdminAdded } from "./messages";
import { deliver } from "./notify/provider";
import { checkSuperAdminRemoval, type Role } from "./permissions";
import { findOrCreateUser } from "./users";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function superAdminCount(): Promise<number> {
  const { count, error } = await db()
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("role", "super_admin");
  if (error) throw error;
  return count ?? 0;
}

export async function listMembers(page: number) {
  const { data: roles, count, error } = await db()
    .from("user_roles")
    .select("id, user_id, role, center_id, granted_by, created_at", { count: "exact" })
    .order("created_at")
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
  if (error) throw error;
  const userIds = [...new Set(roles.flatMap((r) => [r.user_id, r.granted_by].filter(Boolean) as string[]))];
  const centerIds = [...new Set(roles.map((r) => r.center_id).filter(Boolean) as string[])];
  const [users, centers] = await Promise.all([
    userIds.length
      ? db().from("users").select("id, name, phone_last4, last_login_at").in("id", userIds)
      : { data: [], error: null },
    centerIds.length ? db().from("centers").select("id, name").in("id", centerIds) : { data: [], error: null },
  ]);
  if (users.error) throw users.error;
  if (centers.error) throw centers.error;
  const user = (id: string | null) => (users.data ?? []).find((u) => u.id === id);
  return {
    items: roles.map((r) => {
      const u = user(r.user_id);
      return {
        id: r.id as string,
        userId: r.user_id as string,
        name: (u?.name ?? null) as string | null,
        phone: u ? maskPhone(u.phone_last4) : "",
        role: r.role as Role,
        centerName: (centers.data ?? []).find((c) => c.id === r.center_id)?.name ?? null,
        grantedBy: user(r.granted_by)?.name ?? null,
        createdAt: r.created_at as string,
        lastLoginAt: (u?.last_login_at ?? null) as string | null,
      };
    }),
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
  };
}

/** 번호로 관리자 추가. 계정이 없으면 이름 없이 만들어 두고 역할을 붙인 뒤 안내 문자 1건 */
export async function addMember(
  actorId: string,
  input: { phone: string; role: Role; centerId?: string | null },
): Promise<Result<{ smsStatus: string }>> {
  if (input.role === "center_manager" && !input.centerId) return { ok: false, error: "담당 복지관을 골라 주세요" };
  const user = await findOrCreateUser(input.phone);
  const { data, error } = await db()
    .from("user_roles")
    .insert({
      user_id: user.id,
      role: input.role,
      center_id: input.role === "center_manager" ? input.centerId : null,
      granted_by: actorId,
    })
    .select("id")
    .single();
  if (error) {
    if (isUniqueViolation(error)) return { ok: false, error: ERR.alreadyAdmin };
    throw error;
  }
  const sms = await deliver("sms", input.phone, smsAdminAdded());
  await logAudit(actorId, "admin.grant", { type: "user_role", id: data.id }, {
    userId: user.id,
    role: input.role,
    centerId: input.centerId ?? null,
    phone: maskPhone(input.phone.slice(-4)),
    sms: sms.status,
  });
  return { ok: true, smsStatus: sms.status === "skipped" || sms.status === "failed" ? `${sms.status}: ${sms.error}` : sms.status };
}

async function getRole(roleId: string) {
  const { data, error } = await db().from("user_roles").select("id, user_id, role, center_id").eq("id", roleId).maybeSingle();
  if (error) throw error;
  return data;
}

/** 역할 변경. super_admin에서 내려가는 경우 안전장치 적용 */
export async function changeRole(
  actorId: string,
  roleId: string,
  next: { role: Role; centerId?: string | null },
): Promise<Result> {
  const current = await getRole(roleId);
  if (!current) return { ok: false, error: ERR.notFound };
  if (next.role === "center_manager" && !next.centerId) return { ok: false, error: "담당 복지관을 골라 주세요" };
  if (current.role === "super_admin" && next.role !== "super_admin") {
    const check = checkSuperAdminRemoval({ actorId, targetUserId: current.user_id, superAdminCount: await superAdminCount() });
    if (!check.ok) return check;
  }
  const { error } = await db()
    .from("user_roles")
    .update({ role: next.role, center_id: next.role === "center_manager" ? next.centerId : null })
    .eq("id", roleId);
  if (error) {
    if (isUniqueViolation(error)) return { ok: false, error: ERR.alreadyAdmin };
    throw error;
  }
  await logAudit(actorId, "admin.change", { type: "user_role", id: roleId }, {
    userId: current.user_id,
    from: current.role,
    to: next.role,
    centerId: next.centerId ?? null,
  });
  return { ok: true };
}

/** 회수 */
export async function revokeRole(actorId: string, roleId: string): Promise<Result> {
  const current = await getRole(roleId);
  if (!current) return { ok: false, error: ERR.notFound };
  if (current.role === "super_admin") {
    const check = checkSuperAdminRemoval({ actorId, targetUserId: current.user_id, superAdminCount: await superAdminCount() });
    if (!check.ok) return check;
  }
  const { error } = await db().from("user_roles").delete().eq("id", roleId);
  if (error) throw error;
  await logAudit(actorId, "admin.revoke", { type: "user_role", id: roleId }, {
    userId: current.user_id,
    role: current.role,
  });
  return { ok: true };
}

export async function listAudit(page: number) {
  const { data, count, error } = await db()
    .from("audit_logs")
    .select("id, actor_id, action, target_type, target_id, detail, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
  if (error) throw error;
  const actorIds = [...new Set(data.map((a) => a.actor_id).filter(Boolean) as string[])];
  const { data: users, error: usersError } = actorIds.length
    ? await db().from("users").select("id, name, phone_last4").in("id", actorIds)
    : { data: [], error: null };
  if (usersError) throw usersError;
  return {
    items: data.map((a) => {
      const u = (users ?? []).find((x) => x.id === a.actor_id);
      return {
        ...a,
        actor: a.actor_id ? (u ? `${u.name ?? "이름 없음"} ${maskPhone(u.phone_last4)}` : "삭제된 계정") : "시스템",
      };
    }),
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
  };
}
