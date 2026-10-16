import { ok, serverError } from "@/lib/api";
import { adminGuard } from "@/lib/admin-api";
import { runDaily } from "@/lib/jobs/daily";

export const maxDuration = 60;

/** 관리자 "오늘 자동 작업 지금 실행" — Cron과 같은 함수 (CRON_SECRET은 브라우저에 보내지 않음) */
export async function POST() {
  const g = await adminGuard("job.run");
  if ("response" in g) return g.response;
  try {
    return ok(await runDaily(`user:${g.actor.id}`));
  } catch (e) {
    return serverError(e);
  }
}
