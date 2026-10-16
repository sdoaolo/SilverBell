import { ok, parseJson, serverError } from "@/lib/api";
import { testSend } from "@/lib/admin";
import { PeriodIdBody, periodGuard } from "@/lib/admin-api";

/** 내 폰으로 테스트 발송 (음성 1건 + 문자 1건) */
export async function POST(req: Request) {
  const parsed = await parseJson(req, PeriodIdBody);
  if ("response" in parsed) return parsed.response;
  const g = await periodGuard("period.send", parsed.data.periodId);
  if ("response" in g) return g.response;
  try {
    return ok(await testSend(g.actor.id, parsed.data.periodId));
  } catch (e) {
    return serverError(e);
  }
}
