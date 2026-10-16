// 역할별 권한 표 (명세 4-2). DB 없이 판단하는 순수 함수만 둔다 → 테스트하기 쉽게.
// 새 역할이 생기면 이 표와 lib/authz.ts의 can()만 고친다.

export type Role = "super_admin" | "admin" | "center_manager";
export const ROLES: Role[] = ["super_admin", "admin", "center_manager"];

export interface RoleGrant {
  role: Role;
  centerId: string | null;
}

export type AdminAction =
  | "admin.access" // 관리자 화면 들어가기
  | "admin.manage" // 관리자 추가·삭제·역할 변경
  | "audit.read"
  | "job.run"
  | "center.read"
  | "center.create"
  | "center.update"
  | "center.delete"
  | "notice.check" // 공지 확인·분석
  | "period.read"
  | "period.create"
  | "period.update"
  | "period.delete"
  | "period.confirm"
  | "period.send";

export type SeniorAction =
  | "senior.read"
  | "senior.update"
  | "senior.delete"
  | "senior.notify"
  | "guardian.manage";

export type Action = AdminAction | SeniorAction;

export interface Resource {
  centerId?: string | null;
  seniorId?: string;
}

const ALL_ADMIN: AdminAction[] = [
  "admin.access",
  "admin.manage",
  "audit.read",
  "job.run",
  "center.read",
  "center.create",
  "center.update",
  "center.delete",
  "notice.check",
  "period.read",
  "period.create",
  "period.update",
  "period.delete",
  "period.confirm",
  "period.send",
];

const ROLE_ACTIONS: Record<Role, AdminAction[]> = {
  super_admin: ALL_ADMIN,
  admin: ALL_ADMIN.filter((a) => a !== "admin.manage" && a !== "audit.read"),
  // 담당 복지관 한정. 복지관 생성·삭제, 관리자 관리, 자동 작업 실행은 불가
  center_manager: [
    "admin.access",
    "center.read",
    "center.update",
    "notice.check",
    "period.read",
    "period.create",
    "period.update",
    "period.delete",
    "period.confirm",
    "period.send",
  ],
};

// center_manager가 복지관 지정 없이도 할 수 있는 일 (목록은 호출부에서 담당 복지관으로 거른다)
const UNSCOPED_FOR_MANAGER: AdminAction[] = ["admin.access", "center.read", "period.read"];

export function isAdminAction(action: Action): action is AdminAction {
  return !action.startsWith("senior.") && !action.startsWith("guardian.");
}

/** 역할만으로 관리 행동을 할 수 있는지 */
export function rolesAllow(roles: RoleGrant[], action: AdminAction, resource?: Resource): boolean {
  return roles.some((grant) => {
    if (!ROLE_ACTIONS[grant.role].includes(action)) return false;
    if (grant.role !== "center_manager") return true;
    if (resource?.centerId) return resource.centerId === grant.centerId;
    return UNSCOPED_FOR_MANAGER.includes(action);
  });
}

/** center_manager만 가진 경우 볼 수 있는 복지관 id 목록. 전체를 볼 수 있으면 null */
export function visibleCenterIds(roles: RoleGrant[]): string[] | null {
  if (roles.some((r) => r.role === "super_admin" || r.role === "admin")) return null;
  return roles.filter((r) => r.role === "center_manager" && r.centerId).map((r) => r.centerId as string);
}

export function hasAnyRole(roles: RoleGrant[]): boolean {
  return roles.length > 0;
}

/**
 * super_admin 회수·강등 안전장치.
 * - 자기 자신의 super_admin은 회수할 수 없다
 * - 마지막 super_admin은 회수·강등할 수 없다
 */
export function checkSuperAdminRemoval(params: {
  actorId: string;
  targetUserId: string;
  superAdminCount: number;
}): { ok: true } | { ok: false; error: string } {
  if (params.actorId === params.targetUserId) {
    return { ok: false, error: "자기 자신의 최고 관리자 역할은 회수할 수 없어요. 다른 최고 관리자에게 요청해 주세요" };
  }
  if (params.superAdminCount <= 1) {
    return { ok: false, error: "마지막 최고 관리자는 회수할 수 없어요. 먼저 다른 최고 관리자를 지정해 주세요" };
  }
  return { ok: true };
}
