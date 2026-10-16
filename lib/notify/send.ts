import "server-only";
// 기간·종류를 받아 대상 계산 → 로그 선점(queued) → 발송 → 결과 기록.
// 자동 발송(d-3, d-day)은 notification_once unique 인덱스로 같은 사람에게 한 번만 간다.
// 번호 복호화는 실제 발송 직전에 여기서만 한다.
import { SEND_BATCH } from "../config";
import { decryptPhone } from "../crypto/phone";
import { db, isUniqueViolation } from "../db";
import { periodPhase, todaySeoul } from "../dates";
import { smsPeriod, voiceBefore, voiceOpen, type PeriodMessageInput } from "../messages";
import { deliver, getProvider, type Channel } from "./provider";
import { computeRecipients, type GuardianForSend, type Recipient, type SeniorForSend } from "./recipients";

export type SendKind = "d-3" | "d-day" | "manual";

export interface SendSummary {
  sent: number;
  failed: number;
  skipped: number;
  demo: number;
  already: number; // 이미 보낸 자동 발송 (중복 방지로 건너뜀)
}

export const emptySummary = (): SendSummary => ({ sent: 0, failed: 0, skipped: 0, demo: 0, already: 0 });

export function addSummary(a: SendSummary, b: SendSummary): SendSummary {
  return {
    sent: a.sent + b.sent,
    failed: a.failed + b.failed,
    skipped: a.skipped + b.skipped,
    demo: a.demo + b.demo,
    already: a.already + b.already,
  };
}

export interface PeriodForSend extends PeriodMessageInput {
  id: string;
  centerId: string;
}

/** 보낼 수 있는 기간인지 확인하고 문구에 필요한 값 로드. 확정 안 됨·끝남·비활성 복지관이면 null */
export async function loadPeriodForSend(periodId: string): Promise<PeriodForSend | null> {
  const { data: p, error } = await db()
    .from("periods")
    .select("id, center_id, label, apply_start, apply_end, method, status")
    .eq("id", periodId)
    .maybeSingle();
  if (error) throw error;
  if (!p || p.status !== "confirmed") return null;
  if (periodPhase(todaySeoul(), p.apply_start, p.apply_end) === "ended") return null;
  const { data: c, error: centerError } = await db()
    .from("centers")
    .select("name, phone, is_active")
    .eq("id", p.center_id)
    .single();
  if (centerError) throw centerError;
  if (!c.is_active) return null;
  return {
    id: p.id,
    centerId: p.center_id,
    centerName: c.name,
    centerPhone: c.phone,
    label: p.label,
    applyStart: p.apply_start,
    applyEnd: p.apply_end,
    method: p.method,
  };
}

function voiceText(period: PeriodForSend, kind: SendKind): string {
  const open =
    kind === "d-day" ||
    (kind === "manual" && periodPhase(todaySeoul(), period.applyStart, period.applyEnd) === "open");
  return open ? voiceOpen(period) : voiceBefore(period);
}

/** 어르신 여러 명의 발송 대상 로드 (쿼리 3번) */
async function loadRecipients(seniorIds: string[]): Promise<Map<string, { name: string; recipients: Recipient[] }>> {
  const result = new Map<string, { name: string; recipients: Recipient[] }>();
  if (seniorIds.length === 0) return result;
  const [seniors, links] = await Promise.all([
    db()
      .from("seniors")
      .select("id, name, phone_hash, phone_enc, key_version, senior_channel, verified_at")
      .in("id", seniorIds),
    db()
      .from("senior_guardians")
      .select("senior_id, user_id, channel, verified_at")
      .in("senior_id", seniorIds)
      .order("created_at"),
  ]);
  if (seniors.error) throw seniors.error;
  if (links.error) throw links.error;
  const userIds = [...new Set(links.data.map((l) => l.user_id as string))];
  const users = userIds.length
    ? await db().from("users").select("id, phone_hash, phone_enc, key_version").in("id", userIds)
    : { data: [], error: null };
  if (users.error) throw users.error;

  for (const s of seniors.data as SeniorForSend[]) {
    const guardians: GuardianForSend[] = links.data
      .filter((l) => l.senior_id === s.id)
      .flatMap((l) => {
        const u = users.data!.find((x) => x.id === l.user_id);
        return u ? [{ ...l, phone_hash: u.phone_hash, phone_enc: u.phone_enc, key_version: u.key_version }] : [];
      });
    result.set(s.id, { name: s.name, recipients: computeRecipients(s, guardians) });
  }
  return result;
}

/** 한 수신자·한 방법 발송: 로그 선점 → 발송 → 결과 기록. 예외를 밖으로 던지지 않는다 */
async function sendOne(
  period: PeriodForSend,
  kind: SendKind,
  seniorId: string,
  seniorName: string,
  r: Recipient,
  channel: Channel,
  summary: SendSummary,
): Promise<void> {
  const provider = getProvider();
  const { data: log, error } = await db()
    .from("notification_logs")
    .insert({
      senior_id: seniorId,
      period_id: period.id,
      recipient_type: r.type,
      recipient_key: r.key,
      channel,
      kind,
      provider: provider.name,
      status: "queued",
    })
    .select("id")
    .single();
  if (error) {
    if (isUniqueViolation(error)) summary.already++;
    else {
      console.error("notification log insert failed", error.message);
      summary.failed++;
    }
    return;
  }

  let delivery;
  try {
    const phone = decryptPhone(r.phoneEnc, r.keyVersion);
    const text = channel === "voice" ? voiceText(period, kind) : smsPeriod(period, r.type === "guardian" ? seniorName : undefined);
    delivery = await deliver(channel, phone, text, provider);
  } catch (e) {
    delivery = { provider: provider.name, status: "failed" as const, error: e instanceof Error ? e.message : String(e) };
  }
  summary[delivery.status]++;
  const { error: updateError } = await db()
    .from("notification_logs")
    .update({
      status: delivery.status,
      provider_message_id: delivery.messageId ?? null,
      error: delivery.error ?? null,
      sent_at: delivery.status === "sent" || delivery.status === "demo" ? new Date().toISOString() : null,
    })
    .eq("id", log.id);
  if (updateError) console.error("notification log update failed", updateError.message);
}

/** 지정한 어르신들에게 발송 */
export async function sendToSeniors(period: PeriodForSend, kind: SendKind, seniorIds: string[]): Promise<SendSummary> {
  const summary = emptySummary();
  const targets = await loadRecipients(seniorIds);
  for (const [seniorId, { name, recipients }] of targets) {
    for (const r of recipients) {
      for (const channel of r.channels) {
        await sendOne(period, kind, seniorId, name, r, channel, summary);
      }
    }
  }
  return summary;
}

/**
 * 기간의 구독자 전원에게 자동 발송 (SEND_BATCH명씩, 시간 예산 안에서).
 * 멱등: 이미 보낸 사람은 unique 인덱스로 건너뛰므로 여러 번 돌려도 된다.
 * 시간이 다 되면 hasMore=true로 멈추고, 다음 실행이 이어서 처리한다.
 */
export async function sendToSubscribers(
  period: PeriodForSend,
  kind: "d-3" | "d-day",
  deadline: number,
): Promise<SendSummary & { hasMore: boolean }> {
  let summary = emptySummary();
  let lastSeniorId = "";
  while (true) {
    if (Date.now() >= deadline) return { ...summary, hasMore: true };
    let q = db()
      .from("subscriptions")
      .select("senior_id")
      .eq("center_id", period.centerId)
      .order("senior_id")
      .limit(SEND_BATCH);
    if (lastSeniorId) q = q.gt("senior_id", lastSeniorId);
    const { data, error } = await q;
    if (error) throw error;
    if (data.length === 0) return { ...summary, hasMore: false };
    const ids = data.map((r) => r.senior_id as string);
    summary = addSummary(summary, await sendToSeniors(period, kind, ids));
    lastSeniorId = ids[ids.length - 1];
    if (data.length < SEND_BATCH) return { ...summary, hasMore: false };
  }
}
