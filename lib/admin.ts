import "server-only";
// 관리자 화면 데이터: 복지관·기간 CRUD, 확정(+따라잡기), 발송 내역, 테스트·수동 발송.
// 권한 확인은 호출부(API 라우트)에서 can()으로 먼저 한다.
import { randomBytes } from "node:crypto";
import type { AnalyzeResult } from "./analyze";
import { logAudit } from "./audit";
import { JOB_TIME_BUDGET_MS, PAGE_SIZE, SEND_BATCH } from "./config";
import { decryptPhone, maskPhone } from "./crypto/phone";
import { db, isUniqueViolation } from "./db";
import { catchUpKind, effectiveEnd, periodPhase, todaySeoul } from "./dates";
import { smsPeriod, voiceBefore, voiceOpen } from "./messages";
import { deliver, getProvider, type Channel } from "./notify/provider";
import { addSummary, emptySummary, loadPeriodForSend, sendToSeniors, sendToSubscribers, type SendSummary } from "./notify/send";

const range = (page: number) => [page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1] as const;

// ───────────────────────── 복지관 ─────────────────────────

export interface CenterInput {
  name: string;
  slug?: string;
  sido?: string | null;
  sigungu?: string | null;
  phone?: string | null;
  homepage?: string | null;
  notice_url?: string | null;
  is_active?: boolean;
}

export async function listCenters(q: string, page: number, onlyIds: string[] | null) {
  let query = db()
    .from("centers")
    .select("id, slug, name, sido, sigungu, phone, homepage, notice_url, is_active, last_checked_at, last_check_error", {
      count: "exact",
    })
    .order("name")
    .range(...range(page));
  const term = q.replace(/[,()*%\\]/g, " ").trim();
  if (term) query = query.or(`name.ilike.*${term}*,sido.ilike.*${term}*,sigungu.ilike.*${term}*`);
  if (onlyIds) query = query.in("id", onlyIds.length ? onlyIds : ["00000000-0000-0000-0000-000000000000"]);
  const { data, count, error } = await query;
  if (error) throw error;
  const counts = await subscriberCounts(data.map((c) => c.id));
  return {
    items: data.map((c) => ({ ...c, subscribers: counts.get(c.id) ?? 0 })),
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
  };
}

/** 복지관별 구독 어르신 수 */
export async function subscriberCounts(centerIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  await Promise.all(
    [...new Set(centerIds)].map(async (id) => {
      const { count, error } = await db()
        .from("subscriptions")
        .select("senior_id", { count: "exact", head: true })
        .eq("center_id", id);
      if (error) throw error;
      map.set(id, count ?? 0);
    }),
  );
  return map;
}

export async function createCenter(actorId: string, input: CenterInput) {
  const slug = input.slug?.trim() || `c-${randomBytes(4).toString("hex")}`;
  const { data, error } = await db()
    .from("centers")
    .insert({ ...input, slug })
    .select("id")
    .single();
  if (error) {
    if (isUniqueViolation(error)) return { ok: false as const, error: "같은 slug의 복지관이 이미 있어요" };
    throw error;
  }
  await logAudit(actorId, "center.create", { type: "center", id: data.id }, { name: input.name });
  return { ok: true as const, id: data.id as string };
}

export async function updateCenter(actorId: string, id: string, input: Partial<CenterInput>) {
  const { error } = await db().from("centers").update(input).eq("id", id);
  if (error) {
    if (isUniqueViolation(error)) return { ok: false as const, error: "같은 slug의 복지관이 이미 있어요" };
    throw error;
  }
  if (input.is_active !== undefined) {
    await logAudit(actorId, input.is_active ? "center.activate" : "center.deactivate", { type: "center", id });
  }
  return { ok: true as const };
}

export async function deleteCenter(actorId: string, id: string) {
  const { data: c, error: getError } = await db().from("centers").select("name").eq("id", id).maybeSingle();
  if (getError) throw getError;
  if (!c) return false;
  const subscribers = (await subscriberCounts([id])).get(id) ?? 0;
  const { error } = await db().from("centers").delete().eq("id", id);
  if (error) throw error;
  await logAudit(actorId, "center.delete", { type: "center", id }, { name: c.name, subscribers });
  return true;
}

export async function getCenterId(table: "centers" | "periods", id: string): Promise<string | null> {
  if (table === "centers") {
    const { data, error } = await db().from("centers").select("id").eq("id", id).maybeSingle();
    if (error) throw error;
    return data?.id ?? null;
  }
  const { data, error } = await db().from("periods").select("center_id").eq("id", id).maybeSingle();
  if (error) throw error;
  return data?.center_id ?? null;
}

// ───────────────────────── 기간 ─────────────────────────

export interface PeriodInput {
  label: string;
  apply_start: string;
  apply_end: string | null;
  method: string | null;
}

/** 확인 대기(pending) / 확정(confirmed) 목록 + 화면에 필요한 부가 정보 */
export async function listPeriods(status: "pending" | "confirmed", page: number, onlyCenterIds: string[] | null) {
  const today = todaySeoul();
  let query = db()
    .from("periods")
    .select("id, center_id, notice_id, label, apply_start, apply_end, method, status, confidence, confirmed_at, created_at", {
      count: "exact",
    })
    .eq("status", status)
    .order(status === "pending" ? "created_at" : "apply_start", { ascending: status !== "pending" })
    .range(...range(page));
  if (onlyCenterIds) query = query.in("center_id", onlyCenterIds.length ? onlyCenterIds : ["00000000-0000-0000-0000-000000000000"]);
  const { data, count, error } = await query;
  if (error) throw error;

  const centerIds = [...new Set(data.map((p) => p.center_id as string))];
  const noticeIds = data.map((p) => p.notice_id).filter(Boolean) as string[];
  const periodIds = data.map((p) => p.id as string);
  const [centers, notices, counts, logs] = await Promise.all([
    centerIds.length ? db().from("centers").select("id, name, is_active").in("id", centerIds) : { data: [], error: null },
    noticeIds.length ? db().from("notices").select("id, url, title, source").in("id", noticeIds) : { data: [], error: null },
    subscriberCounts(centerIds),
    status === "confirmed" && periodIds.length
      ? db()
          .from("notification_logs")
          .select("period_id, kind, status, sent_at")
          .in("period_id", periodIds)
          .in("kind", ["d-3", "d-day"])
          .in("status", ["sent", "demo"])
      : { data: [], error: null },
  ]);
  if (centers.error) throw centers.error;
  if (notices.error) throw notices.error;
  if (logs.error) throw logs.error;

  const firstSent = (periodId: string, kind: string) =>
    (logs.data ?? [])
      .filter((l) => l.period_id === periodId && l.kind === kind && l.sent_at)
      .map((l) => l.sent_at as string)
      .sort()[0] ?? null;

  return {
    items: data.map((p) => {
      const center = (centers.data ?? []).find((c) => c.id === p.center_id);
      const notice = (notices.data ?? []).find((n) => n.id === p.notice_id);
      return {
        ...p,
        centerName: center?.name ?? "",
        centerActive: center?.is_active ?? false,
        notice: notice ? { url: notice.url, title: notice.title, source: notice.source } : null,
        subscribers: counts.get(p.center_id) ?? 0,
        phase: periodPhase(today, p.apply_start, p.apply_end),
        catchUp: catchUpKind(today, p.apply_start, p.apply_end),
        d3SentAt: firstSent(p.id, "d-3"),
        ddaySentAt: firstSent(p.id, "d-day"),
      };
    }),
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
  };
}

export async function createPeriod(actorId: string, centerId: string, input: PeriodInput) {
  const { data, error } = await db()
    .from("periods")
    .insert({ center_id: centerId, ...input, status: "pending" })
    .select("id")
    .single();
  if (error) {
    if (isUniqueViolation(error)) return { ok: false as const, error: "같은 복지관·시작일·이름의 기간이 이미 있어요" };
    throw error;
  }
  await logAudit(actorId, "period.create", { type: "period", id: data.id }, { centerId, label: input.label });
  return { ok: true as const, id: data.id as string };
}

export async function updatePeriod(id: string, input: Partial<PeriodInput>) {
  const { error } = await db().from("periods").update(input).eq("id", id);
  if (error) {
    if (isUniqueViolation(error)) return { ok: false as const, error: "같은 복지관·시작일·이름의 기간이 이미 있어요" };
    throw error;
  }
  return { ok: true as const };
}

export async function deletePeriod(actorId: string, id: string) {
  const { error } = await db().from("periods").delete().eq("id", id);
  if (error) throw error;
  await logAudit(actorId, "period.delete", { type: "period", id });
}

/**
 * 확정. 늦게 확정한 경우 따라잡기:
 * 오늘이 신청 기간 중이면 d-day, 시작 3일 전~전날이면 d-3을 바로 보낸다 (이미 받은 사람은 unique로 제외).
 */
export async function confirmPeriod(actorId: string, id: string) {
  const { data: p, error } = await db()
    .from("periods")
    .select("label, apply_start, apply_end, center_id")
    .eq("id", id)
    .single();
  if (error) throw error;
  if (effectiveEnd(p.apply_start, p.apply_end) < todaySeoul()) {
    return { ok: false as const, error: "이미 끝난 기간은 확정할 수 없어요" };
  }
  const { error: updateError } = await db()
    .from("periods")
    .update({ status: "confirmed", confirmed_by: actorId, confirmed_at: new Date().toISOString() })
    .eq("id", id);
  if (updateError) throw updateError;

  const kind = catchUpKind(todaySeoul(), p.apply_start, p.apply_end);
  let sent: (SendSummary & { hasMore: boolean }) | null = null;
  if (kind) {
    const period = await loadPeriodForSend(id);
    if (period) sent = await sendToSubscribers(period, kind, Date.now() + JOB_TIME_BUDGET_MS);
  }
  await logAudit(actorId, "period.confirm", { type: "period", id }, { label: p.label, catchUp: kind, sent });
  return { ok: true as const, catchUp: kind, sent };
}

export async function unconfirmPeriod(actorId: string, id: string) {
  const { error } = await db()
    .from("periods")
    .update({ status: "pending", confirmed_by: null, confirmed_at: null })
    .eq("id", id);
  if (error) throw error;
  await logAudit(actorId, "period.unconfirm", { type: "period", id });
}

/** 무시: rejected로 남겨 두어 같은 공지를 다시 분석해도 다시 올라오지 않게 한다 */
export async function rejectPeriod(actorId: string, id: string) {
  const { error } = await db().from("periods").update({ status: "rejected" }).eq("id", id);
  if (error) throw error;
  await logAudit(actorId, "period.reject", { type: "period", id });
}

/** AI 분석 결과를 확인 대기로 저장 (unique 충돌은 무시). 새로 생긴 기간 id 목록 반환 */
export async function savePendingPeriods(
  centerId: string,
  noticeId: string | null,
  result: AnalyzeResult,
): Promise<string[]> {
  const created: string[] = [];
  if (!result.isRecruitment) return created;
  for (const p of result.periods) {
    const { data, error } = await db()
      .from("periods")
      .insert({
        center_id: centerId,
        notice_id: noticeId,
        label: p.label,
        apply_start: p.applyStart,
        apply_end: p.applyEnd,
        method: p.method,
        status: "pending",
        confidence: result.confidence,
      })
      .select("id")
      .single();
    if (error) {
      if (isUniqueViolation(error)) continue;
      throw error;
    }
    created.push(data.id);
  }
  return created;
}

// ───────────────────────── 발송 ─────────────────────────

/** 기간별 발송 내역 (번호는 마스킹) */
export async function periodLogs(periodId: string, page: number) {
  const { data, count, error } = await db()
    .from("notification_logs")
    .select("id, senior_id, recipient_type, recipient_key, channel, kind, provider, status, error, created_at, sent_at", {
      count: "exact",
    })
    .eq("period_id", periodId)
    .order("created_at", { ascending: false })
    .range(...range(page));
  if (error) throw error;

  const seniorIds = [...new Set(data.filter((l) => l.recipient_key.startsWith("senior:")).map((l) => l.recipient_key.slice(7)))];
  const userIds = [...new Set(data.filter((l) => l.recipient_key.startsWith("user:")).map((l) => l.recipient_key.slice(5)))];
  const [seniors, users] = await Promise.all([
    seniorIds.length ? db().from("seniors").select("id, name, phone_last4").in("id", seniorIds) : { data: [], error: null },
    userIds.length ? db().from("users").select("id, name, phone_last4").in("id", userIds) : { data: [], error: null },
  ]);
  if (seniors.error) throw seniors.error;
  if (users.error) throw users.error;

  return {
    items: data.map((l) => {
      const [kind, id] = l.recipient_key.split(":");
      const who = (kind === "senior" ? seniors.data : users.data)?.find((x) => x.id === id);
      return {
        id: l.id,
        recipient: who ? `${who.name ?? "이름 없음"} ${maskPhone(who.phone_last4)}` : "삭제된 수신자",
        recipientType: l.recipient_type,
        channel: l.channel,
        kind: l.kind,
        status: l.status,
        error: l.error,
        createdAt: l.created_at,
      };
    }),
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
  };
}

/** 내 폰으로 테스트 발송: 이 기간의 음성·문자 문구를 관리자 본인에게 */
export async function testSend(actorId: string, periodId: string) {
  const { data: p, error } = await db()
    .from("periods")
    .select("id, center_id, label, apply_start, apply_end, method")
    .eq("id", periodId)
    .single();
  if (error) throw error;
  const [{ data: c, error: cError }, { data: u, error: uError }] = await Promise.all([
    db().from("centers").select("name, phone").eq("id", p.center_id).single(),
    db().from("users").select("phone_enc, key_version").eq("id", actorId).single(),
  ]);
  if (cError) throw cError;
  if (uError) throw uError;

  const msg = {
    centerName: c.name,
    centerPhone: c.phone,
    label: p.label,
    applyStart: p.apply_start,
    applyEnd: p.apply_end,
    method: p.method,
  };
  const open = periodPhase(todaySeoul(), p.apply_start, p.apply_end) === "open";
  const phone = decryptPhone(u.phone_enc, u.key_version);
  const provider = getProvider();
  const results: Record<Channel, string> = { voice: "", sms: "" };
  for (const channel of ["voice", "sms"] as Channel[]) {
    const text = channel === "voice" ? (open ? voiceOpen(msg) : voiceBefore(msg)) : smsPeriod(msg);
    const d = await deliver(channel, phone, text, provider);
    await db().from("notification_logs").insert({
      period_id: periodId,
      recipient_type: "admin",
      recipient_key: `user:${actorId}`,
      channel,
      kind: "test",
      provider: d.provider,
      status: d.status,
      provider_message_id: d.messageId ?? null,
      error: d.error ?? null,
      sent_at: d.status === "sent" || d.status === "demo" ? new Date().toISOString() : null,
    });
    results[channel] = d.status === "sent" || d.status === "demo" ? d.status : `${d.status}: ${d.error ?? ""}`;
  }
  return results;
}

/** 지금 다시 보내기(수동): 구독자 전원에게 kind=manual로 발송 */
export async function sendNow(actorId: string, periodId: string) {
  const period = await loadPeriodForSend(periodId);
  if (!period) return { ok: false as const, error: "보낼 수 있는 기간이 아니에요 (확정 전·끝남·비활성 복지관)" };
  let summary = emptySummary();
  let last = "";
  while (true) {
    let q = db().from("subscriptions").select("senior_id").eq("center_id", period.centerId).order("senior_id").limit(SEND_BATCH);
    if (last) q = q.gt("senior_id", last);
    const { data, error } = await q;
    if (error) throw error;
    if (data.length === 0) break;
    summary = addSummary(summary, await sendToSeniors(period, "manual", data.map((r) => r.senior_id)));
    last = data[data.length - 1].senior_id;
    if (data.length < SEND_BATCH) break;
  }
  await logAudit(actorId, "period.send", { type: "period", id: periodId }, { ...summary });
  return { ok: true as const, summary };
}

export async function latestJobRun() {
  const { data, error } = await db()
    .from("job_runs")
    .select("id, job, triggered_by, started_at, finished_at, summary, error")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}
