import "server-only";
import { db } from "./db";

/** 관리 행동 기록. detail에 전화번호는 마스킹된 값만 넣는다. 기록 실패가 본 작업을 막지 않게 한다. */
export async function logAudit(
  actorId: string | null,
  action: string,
  target?: { type: string; id: string },
  detail?: Record<string, unknown>,
): Promise<void> {
  const { error } = await db().from("audit_logs").insert({
    actor_id: actorId,
    action,
    target_type: target?.type ?? null,
    target_id: target?.id ?? null,
    detail: detail ?? null,
  });
  if (error) console.error("audit log failed", action, error.message);
}
