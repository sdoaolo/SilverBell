import { z } from "zod";
import { fail, notFound, ok, parseJson, requireActor, serverError } from "@/lib/api";
import { can, isUuid } from "@/lib/authz";
import { MANUAL_NOTIFY_COOLDOWN_MS } from "@/lib/config";
import { db } from "@/lib/db";
import { ERR } from "@/lib/messages";
import { loadPeriodForSend, sendToSeniors } from "@/lib/notify/send";
import { getSenior, subscribedCenterIds } from "@/lib/seniors";

const Body = z.object({
  seniorId: z.string().refine(isUuid, ERR.notFound),
  periodId: z.string().refine(isUuid, ERR.notFound),
});

/** 보호자 "지금 한 번 더 알리기" — 구독한 복지관만, 어르신당 1분 1회 */
export async function POST(req: Request) {
  const auth = await requireActor();
  if ("response" in auth) return auth.response;
  const parsed = await parseJson(req, Body);
  if ("response" in parsed) return parsed.response;
  const { seniorId, periodId } = parsed.data;
  if (!(await can(auth.actor, "senior.notify", { seniorId }))) return notFound();

  try {
    const senior = await getSenior(seniorId);
    if (!senior) return notFound();
    if (!senior.verified_at) return fail("어르신 번호를 확인한 뒤에 보낼 수 있어요");

    const period = await loadPeriodForSend(periodId);
    if (!period || !(await subscribedCenterIds(seniorId)).includes(period.centerId)) {
      return fail("지금 보낼 수 있는 신청 기간이 아니에요", 404);
    }

    const since = new Date(Date.now() - MANUAL_NOTIFY_COOLDOWN_MS).toISOString();
    const { count, error } = await db()
      .from("notification_logs")
      .select("id", { count: "exact", head: true })
      .eq("senior_id", seniorId)
      .eq("kind", "manual")
      .gte("created_at", since);
    if (error) throw error;
    if ((count ?? 0) > 0) return fail("방금 보냈어요. 1분 뒤에 다시 눌러 주세요", 429);

    const summary = await sendToSeniors(period, "manual", [seniorId]);
    return ok(summary);
  } catch (e) {
    return serverError(e);
  }
}
