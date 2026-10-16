import "server-only";
import { MAX_GUARDIANS_PER_SENIOR, PAGE_SIZE } from "./config";
import { decryptPhone, phoneColumns, phoneHash } from "./crypto/phone";
import { db, isUniqueViolation } from "./db";
import { effectiveEnd, periodPhase, remindDate, todaySeoul, type PeriodPhase } from "./dates";
import { ERR, smsGuardianInvite, smsSeniorVerify } from "./messages";
import { sendOtp, verifyOtp } from "./otp";
import { findOrCreateUser } from "./users";

export type SeniorChannel = "sms" | "voice" | "both";
export type GuardianChannel = SeniorChannel | "none";
type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const now = () => new Date().toISOString();

// ───────────────────────── 어르신 ─────────────────────────

export async function createSenior(params: {
  userId: string;
  userName: string;
  isSelf: boolean;
  name: string;
  phone: string | null; // isSelf면 null (계정 번호 사용)
  seniorChannel: SeniorChannel;
  guardianChannel: GuardianChannel;
}): Promise<Result<{ id: string; needsVerify: boolean; sendError?: string }>> {
  const { data: user, error: userError } = await db()
    .from("users")
    .select("phone_hash, phone_enc, phone_last4, key_version")
    .eq("id", params.userId)
    .single();
  if (userError) throw userError;

  // 본인이거나, 입력한 번호가 내 계정 번호와 같으면 이미 로그인으로 확인된 번호
  const isSelf = params.isSelf || (!!params.phone && phoneHash(params.phone) === user.phone_hash);
  const phoneCols = isSelf ? user : phoneColumns(params.phone as string);

  const { data: senior, error } = await db()
    .from("seniors")
    .insert({
      name: params.name,
      ...phoneCols,
      self_user_id: isSelf ? params.userId : null,
      senior_channel: params.seniorChannel,
      verified_at: isSelf ? now() : null,
      agreed_at: now(),
      created_by: params.userId,
    })
    .select("id")
    .single();
  if (error) throw error;

  // 등록한 사람은 owner. 로그인으로 번호가 확인됐으므로 verified_at = 생성 시각.
  // 본인이면 어르신으로서 받으므로 보호자 알림은 끔 (같은 번호 중복 방지)
  const { error: linkError } = await db().from("senior_guardians").insert({
    senior_id: senior.id,
    user_id: params.userId,
    relation: "owner",
    channel: isSelf ? "none" : params.guardianChannel,
    verified_at: now(),
    added_by: params.userId,
  });
  if (linkError) {
    await db().from("seniors").delete().eq("id", senior.id);
    throw linkError;
  }

  if (isSelf) return { ok: true, id: senior.id, needsVerify: false };
  const sent = await sendOtp(params.phone as string, "senior_verify", (code) =>
    smsSeniorVerify(params.userName, params.name, code),
  );
  // 문자 실패해도 등록은 유지 → 확인 화면에서 다시 받기
  return { ok: true, id: senior.id, needsVerify: true, ...(sent.ok ? {} : { sendError: sent.error }) };
}

export async function getSenior(seniorId: string) {
  const { data, error } = await db()
    .from("seniors")
    .select("id, name, phone_last4, senior_channel, verified_at, self_user_id")
    .eq("id", seniorId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** 어르신 폰으로 확인 코드 다시 보내기 (발송 직전에만 번호 복호화) */
export async function resendSeniorCode(seniorId: string, requesterName: string): Promise<Result> {
  const { data: s, error } = await db()
    .from("seniors")
    .select("name, phone_enc, key_version, verified_at")
    .eq("id", seniorId)
    .single();
  if (error) throw error;
  if (s.verified_at) return { ok: true };
  const phone = decryptPhone(s.phone_enc, s.key_version);
  return sendOtp(phone, "senior_verify", (code) => smsSeniorVerify(requesterName, s.name, code));
}

export async function verifySenior(seniorId: string, code: string): Promise<Result> {
  const { data: s, error } = await db().from("seniors").select("phone_hash, verified_at").eq("id", seniorId).single();
  if (error) throw error;
  if (s.verified_at) return { ok: true };
  const result = await verifyOtp(s.phone_hash, "senior_verify", code);
  if (!result.ok) return result;
  const { error: updateError } = await db().from("seniors").update({ verified_at: now() }).eq("id", seniorId);
  if (updateError) throw updateError;
  return { ok: true };
}

/** 이름·알림 방법 수정. 번호를 바꾸면 verified_at을 비우고 새 번호로 다시 확인 */
export async function updateSenior(
  seniorId: string,
  requester: { id: string; name: string },
  patch: { name?: string; phone?: string; seniorChannel?: SeniorChannel },
): Promise<Result<{ needsVerify: boolean }>> {
  const update: Record<string, unknown> = {};
  if (patch.name) update.name = patch.name;
  if (patch.seniorChannel) update.senior_channel = patch.seniorChannel;

  let needsVerify = false;
  if (patch.phone) {
    const current = await db().from("seniors").select("phone_hash").eq("id", seniorId).single();
    if (current.error) throw current.error;
    const newHash = phoneHash(patch.phone);
    if (newHash !== current.data.phone_hash) {
      const me = await db().from("users").select("phone_hash").eq("id", requester.id).single();
      if (me.error) throw me.error;
      const isMine = me.data.phone_hash === newHash;
      Object.assign(update, phoneColumns(patch.phone), {
        verified_at: isMine ? now() : null,
        self_user_id: isMine ? requester.id : null,
      });
      needsVerify = !isMine;
    }
  }

  if (Object.keys(update).length > 0) {
    const { error } = await db().from("seniors").update(update).eq("id", seniorId);
    if (error) throw error;
  }
  if (needsVerify) {
    const name = (patch.name ?? (await getSenior(seniorId))?.name) as string;
    await sendOtp(patch.phone as string, "senior_verify", (code) => smsSeniorVerify(requester.name, name, code));
  }
  return { ok: true, needsVerify };
}

/** 구독·발송 기록·보호자 연결은 on delete cascade로 함께 삭제 */
export async function deleteSenior(seniorId: string): Promise<void> {
  const { error } = await db().from("seniors").delete().eq("id", seniorId);
  if (error) throw error;
}

// ───────────────────────── 보호자 ─────────────────────────

export async function listGuardians(seniorId: string) {
  const { data: links, error } = await db()
    .from("senior_guardians")
    .select("user_id, relation, channel, verified_at, created_at")
    .eq("senior_id", seniorId)
    .order("created_at");
  if (error) throw error;
  if (links.length === 0) return [];
  const { data: users, error: usersError } = await db()
    .from("users")
    .select("id, name, phone_last4")
    .in("id", links.map((l) => l.user_id));
  if (usersError) throw usersError;
  return links.map((l) => {
    const u = users.find((x) => x.id === l.user_id);
    return {
      userId: l.user_id as string,
      name: (u?.name ?? null) as string | null,
      phoneLast4: (u?.phone_last4 ?? "") as string,
      relation: l.relation as "owner" | "member",
      channel: l.channel as GuardianChannel,
      verified: !!l.verified_at,
    };
  });
}

/** owner가 번호로 보호자 추가 → 그 번호로 확인 코드 (확인 전에는 알림 안 감) */
export async function addGuardian(
  seniorId: string,
  owner: { id: string; name: string },
  input: { name: string; phone: string; channel: GuardianChannel },
): Promise<Result<{ userId: string; sendError?: string }>> {
  const { count, error: countError } = await db()
    .from("senior_guardians")
    .select("user_id", { count: "exact", head: true })
    .eq("senior_id", seniorId);
  if (countError) throw countError;
  if ((count ?? 0) >= MAX_GUARDIANS_PER_SENIOR) {
    return { ok: false, error: ERR.tooManyGuardians(MAX_GUARDIANS_PER_SENIOR) };
  }

  const user = await findOrCreateUser(input.phone, input.name);
  const { error } = await db().from("senior_guardians").insert({
    senior_id: seniorId,
    user_id: user.id,
    relation: "member",
    channel: input.channel,
    verified_at: null,
    added_by: owner.id,
  });
  if (error) {
    if (isUniqueViolation(error)) return { ok: false, error: ERR.alreadyGuardian };
    throw error;
  }

  const senior = await getSenior(seniorId);
  const sent = await sendOtp(input.phone, "guardian_invite", (code) =>
    smsGuardianInvite(owner.name, senior?.name ?? "", code),
  );
  return { ok: true, userId: user.id, ...(sent.ok ? {} : { sendError: sent.error }) };
}

export async function resendGuardianCode(seniorId: string, userId: string, ownerName: string): Promise<Result> {
  const { data: u, error } = await db()
    .from("users")
    .select("phone_enc, key_version")
    .eq("id", userId)
    .single();
  if (error) throw error;
  const senior = await getSenior(seniorId);
  const phone = decryptPhone(u.phone_enc, u.key_version);
  return sendOtp(phone, "guardian_invite", (code) => smsGuardianInvite(ownerName, senior?.name ?? "", code));
}

export async function verifyGuardian(seniorId: string, userId: string, code: string): Promise<Result> {
  const { data: u, error } = await db().from("users").select("phone_hash").eq("id", userId).single();
  if (error) throw error;
  const result = await verifyOtp(u.phone_hash, "guardian_invite", code);
  if (!result.ok) return result;
  const { error: updateError } = await db()
    .from("senior_guardians")
    .update({ verified_at: now() })
    .eq("senior_id", seniorId)
    .eq("user_id", userId);
  if (updateError) throw updateError;
  return { ok: true };
}

export async function getGuardianLink(seniorId: string, userId: string) {
  const { data, error } = await db()
    .from("senior_guardians")
    .select("relation, channel, verified_at")
    .eq("senior_id", seniorId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function setGuardianChannel(seniorId: string, userId: string, channel: GuardianChannel) {
  const { error } = await db()
    .from("senior_guardians")
    .update({ channel })
    .eq("senior_id", seniorId)
    .eq("user_id", userId);
  if (error) throw error;
}

/**
 * 보호자 해제·나가기.
 * owner가 나가면 가장 먼저 추가된 (확인된) 보호자가 owner가 된다.
 * 확인된 보호자가 남지 않으면 어르신을 삭제한다.
 */
export async function removeGuardian(seniorId: string, userId: string): Promise<{ seniorDeleted: boolean }> {
  const link = await getGuardianLink(seniorId, userId);
  if (!link) return { seniorDeleted: false };

  const { error } = await db().from("senior_guardians").delete().eq("senior_id", seniorId).eq("user_id", userId);
  if (error) throw error;

  const { data: rest, error: restError } = await db()
    .from("senior_guardians")
    .select("user_id, relation")
    .eq("senior_id", seniorId)
    .not("verified_at", "is", null)
    .order("created_at")
    .limit(1);
  if (restError) throw restError;

  if (rest.length === 0) {
    await deleteSenior(seniorId);
    return { seniorDeleted: true };
  }
  if (link.relation === "owner") {
    const { error: promoteError } = await db()
      .from("senior_guardians")
      .update({ relation: "owner" })
      .eq("senior_id", seniorId)
      .eq("user_id", rest[0].user_id);
    if (promoteError) throw promoteError;
  }
  return { seniorDeleted: false };
}

// ───────────────────────── 탈퇴 ─────────────────────────

/** 내 계정 삭제. 유일한 보호자인 어르신은 삭제, 다른 보호자가 있으면 연결만 끊음 */
export async function withdrawUser(userId: string): Promise<Result> {
  const { data: roles, error: rolesError } = await db()
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin");
  if (rolesError) throw rolesError;
  if (roles.length > 0) {
    const { count, error } = await db()
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "super_admin");
    if (error) throw error;
    if ((count ?? 0) <= 1) return { ok: false, error: ERR.lastSuperAdmin };
  }

  const { data: links, error } = await db().from("senior_guardians").select("senior_id").eq("user_id", userId);
  if (error) throw error;
  for (const l of links) await removeGuardian(l.senior_id, userId);

  const { error: deleteError } = await db().from("users").delete().eq("id", userId);
  if (deleteError) throw deleteError;
  return { ok: true };
}

// ───────────────────────── 구독·복지관 ─────────────────────────

export async function subscribe(seniorId: string, centerId: string, userId: string): Promise<Result> {
  const { data: center, error: centerError } = await db()
    .from("centers")
    .select("id")
    .eq("id", centerId)
    .eq("is_active", true)
    .maybeSingle();
  if (centerError) throw centerError;
  if (!center) return { ok: false, error: ERR.notFound };
  const { error } = await db()
    .from("subscriptions")
    .insert({ senior_id: seniorId, center_id: centerId, created_by: userId });
  if (error && !isUniqueViolation(error)) throw error;
  return { ok: true };
}

export async function unsubscribe(seniorId: string, centerId: string): Promise<void> {
  const { error } = await db().from("subscriptions").delete().eq("senior_id", seniorId).eq("center_id", centerId);
  if (error) throw error;
}

export async function subscribedCenterIds(seniorId: string): Promise<string[]> {
  const { data, error } = await db().from("subscriptions").select("center_id").eq("senior_id", seniorId);
  if (error) throw error;
  return data.map((r) => r.center_id);
}

export async function listSubscriptions(seniorId: string): Promise<{ centerId: string; name: string }[]> {
  const ids = await subscribedCenterIds(seniorId);
  if (ids.length === 0) return [];
  const { data, error } = await db().from("centers").select("id, name").in("id", ids).order("name");
  if (error) throw error;
  return data.map((c) => ({ centerId: c.id, name: c.name }));
}

/** 활성 복지관 검색 (이름·지역), 50개씩 */
export async function searchCenters(q: string, page: number) {
  let query = db()
    .from("centers")
    .select("id, name, sido, sigungu", { count: "exact" })
    .eq("is_active", true)
    .order("name")
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
  // PostgREST or() 문법을 깨는 문자 제거
  const term = q.replace(/[,()*%\\]/g, " ").trim();
  if (term) query = query.or(`name.ilike.*${term}*,sido.ilike.*${term}*,sigungu.ilike.*${term}*`);
  const { data, count, error } = await query;
  if (error) throw error;
  return { items: data, total: count ?? 0, page, pageSize: PAGE_SIZE };
}

// ───────────────────────── 홈 화면 ─────────────────────────

export interface HomeCenter {
  centerId: string;
  centerName: string;
  period: null | {
    id: string;
    label: string;
    applyStart: string;
    applyEnd: string | null;
    method: string | null;
    phase: PeriodPhase;
    remindAt: string; // 3일 전 알림 날짜
    remindSent: boolean;
    startSent: boolean;
  };
}

export interface HomeSenior {
  id: string;
  name: string;
  phoneLast4: string;
  seniorChannel: SeniorChannel;
  verified: boolean;
  isSelf: boolean;
  myRelation: "owner" | "member";
  myChannel: GuardianChannel;
  guardianCount: number;
  centers: HomeCenter[];
}

/** 내가 (확인된) 보호자로 연결된 어르신별 카드 데이터 */
export async function getHomeData(userId: string): Promise<HomeSenior[]> {
  const today = todaySeoul();
  const { data: myLinks, error } = await db()
    .from("senior_guardians")
    .select("senior_id, relation, channel")
    .eq("user_id", userId)
    .not("verified_at", "is", null)
    .order("created_at");
  if (error) throw error;
  if (myLinks.length === 0) return [];
  const seniorIds = myLinks.map((l) => l.senior_id);

  const [seniors, guardians, subs, logs] = await Promise.all([
    db().from("seniors").select("id, name, phone_last4, senior_channel, verified_at, self_user_id").in("id", seniorIds),
    db().from("senior_guardians").select("senior_id").in("senior_id", seniorIds).not("verified_at", "is", null),
    db().from("subscriptions").select("senior_id, center_id, created_at").in("senior_id", seniorIds).order("created_at"),
    db()
      .from("notification_logs")
      .select("senior_id, period_id, kind")
      .in("senior_id", seniorIds)
      .in("kind", ["d-3", "d-day"])
      .in("status", ["sent", "demo"]),
  ]);
  for (const r of [seniors, guardians, subs, logs]) if (r.error) throw r.error;

  const centerIds = [...new Set(subs.data!.map((s) => s.center_id as string))];
  const [centers, periods] = await Promise.all([
    centerIds.length
      ? db().from("centers").select("id, name, is_active").in("id", centerIds)
      : Promise.resolve({ data: [], error: null }),
    centerIds.length
      ? db()
          .from("periods")
          .select("id, center_id, label, apply_start, apply_end, method")
          .eq("status", "confirmed")
          .in("center_id", centerIds)
          .order("apply_start")
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (centers.error) throw centers.error;
  if (periods.error) throw periods.error;

  return myLinks.flatMap((link) => {
    const s = seniors.data!.find((x) => x.id === link.senior_id);
    if (!s) return [];
    const myCenters: HomeCenter[] = subs.data!
      .filter((sub) => sub.senior_id === s.id)
      .flatMap((sub) => {
        const c = (centers.data ?? []).find((x) => x.id === sub.center_id);
        if (!c || !c.is_active) return [];
        // 다음 신청 기간: 아직 끝나지 않은 확정 기간 중 가장 빠른 것
        const p = (periods.data ?? []).find(
          (x) => x.center_id === c.id && effectiveEnd(x.apply_start, x.apply_end) >= today,
        );
        const sentKinds = (kind: string) =>
          !!p && logs.data!.some((l) => l.senior_id === s.id && l.period_id === p.id && l.kind === kind);
        return [
          {
            centerId: c.id,
            centerName: c.name,
            period: p
              ? {
                  id: p.id,
                  label: p.label,
                  applyStart: p.apply_start,
                  applyEnd: p.apply_end,
                  method: p.method,
                  phase: periodPhase(today, p.apply_start, p.apply_end),
                  remindAt: remindDate(p.apply_start),
                  remindSent: sentKinds("d-3"),
                  startSent: sentKinds("d-day"),
                }
              : null,
          },
        ];
      });
    return [
      {
        id: s.id,
        name: s.name,
        phoneLast4: s.phone_last4,
        seniorChannel: s.senior_channel,
        verified: !!s.verified_at,
        isSelf: s.self_user_id === userId,
        myRelation: link.relation,
        myChannel: link.channel,
        guardianCount: guardians.data!.filter((g) => g.senior_id === s.id).length,
        centers: myCenters,
      },
    ];
  });
}
