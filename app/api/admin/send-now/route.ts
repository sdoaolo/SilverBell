import { fail, ok, parseJson, serverError } from "@/lib/api";
import { sendNow } from "@/lib/admin";
import { PeriodIdBody, periodGuard } from "@/lib/admin-api";

export const maxDuration = 60;

/** 지금 다시 보내기(수동): 구독자 전원 */
export async function POST(req: Request) {
  const parsed = await parseJson(req, PeriodIdBody);
  if ("response" in parsed) return parsed.response;
  const g = await periodGuard("period.send", parsed.data.periodId);
  if ("response" in g) return g.response;
  try {
    const result = await sendNow(g.actor.id, parsed.data.periodId);
    if (!result.ok) return fail(result.error);
    return ok(result.summary);
  } catch (e) {
    return serverError(e);
  }
}
