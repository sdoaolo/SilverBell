import "server-only";
// 매일 자동 작업. Vercel Cron과 관리자 "지금 실행"이 같은 함수를 부른다.
// 멱등: 자동 발송은 unique 인덱스로 한 번만 가므로 여러 번 돌려도 된다.
// 시간 예산(JOB_TIME_BUDGET_MS)을 넘기면 멈추고 hasMore=true → 다음 실행이 이어서 처리.
import { logAudit } from "../audit";
import { JOB_TIME_BUDGET_MS } from "../config";
import { db } from "../db";
import { addDays, dailyKind, todaySeoul } from "../dates";
import { addSummary, emptySummary, loadPeriodForSend, sendToSubscribers, type SendSummary } from "../notify/send";

export interface DailySummary extends SendSummary {
  today: string;
  periods: { periodId: string; label: string; kind: "d-3" | "d-day" }[];
  centersChecked: number;
  newNotices: number;
  newPeriods: number;
  crawl: string;
  hasMore: boolean;
}

// 기간 중 따라잡기 대상을 찾을 때 얼마나 이전 시작일까지 볼지 (종료일 판정은 dailyKind가 한다)
const LOOKBACK_DAYS = 120;

export async function runDaily(triggeredBy: string): Promise<{ id: string; summary: DailySummary }> {
  const started = Date.now();
  const deadline = started + JOB_TIME_BUDGET_MS;
  const today = todaySeoul();

  const { data: run, error } = await db()
    .from("job_runs")
    .insert({ job: "daily", triggered_by: triggeredBy })
    .select("id")
    .single();
  if (error) throw error;

  const summary: DailySummary = {
    ...emptySummary(),
    today,
    periods: [],
    centersChecked: 0,
    newNotices: 0,
    newPeriods: 0,
    crawl: "게시판 자동 확인은 아직 꺼져 있어요",
    hasMore: false,
  };

  try {
    // 1) 자동 발송 먼저 (시간이 정해진 일이므로 우선)
    const { data: periods, error: pError } = await db()
      .from("periods")
      .select("id, label, apply_start, apply_end")
      .eq("status", "confirmed")
      .gte("apply_start", addDays(today, -LOOKBACK_DAYS))
      .lte("apply_start", addDays(today, 3))
      .order("apply_start");
    if (pError) throw pError;

    for (const p of periods) {
      const kind = dailyKind(today, p.apply_start, p.apply_end);
      if (!kind) continue;
      if (Date.now() >= deadline) {
        summary.hasMore = true;
        break;
      }
      const period = await loadPeriodForSend(p.id); // 비활성 복지관·끝난 기간 제외
      if (!period) continue;
      const result = await sendToSubscribers(period, kind, deadline);
      Object.assign(summary, addSummary(summary, result));
      summary.periods.push({ periodId: p.id, label: `${period.centerName} ${p.label}`, kind });
      if (result.hasMore) {
        summary.hasMore = true;
        break;
      }
    }

    // 2) 공지 확인 (8단계: lib/crawl.ts가 생기면 남은 시간 안에서 CRAWL_BATCH개씩)

    await db()
      .from("job_runs")
      .update({ finished_at: new Date().toISOString(), summary })
      .eq("id", run.id);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db()
      .from("job_runs")
      .update({ finished_at: new Date().toISOString(), summary, error: message })
      .eq("id", run.id);
    throw e;
  }

  if (triggeredBy.startsWith("user:")) {
    await logAudit(triggeredBy.slice(5), "job.run", { type: "job_run", id: run.id }, {
      sent: summary.sent,
      failed: summary.failed,
      hasMore: summary.hasMore,
    });
  }
  return { id: run.id, summary };
}
