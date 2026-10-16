import { z } from "zod";
import { fail, ok, parseJson, serverError } from "@/lib/api";
import { createPeriod, listPeriods } from "@/lib/admin";
import { adminGuard, centerGuard, pageParam, PeriodBody, scopeOf } from "@/lib/admin-api";
import { isUuid } from "@/lib/authz";

/** ?status=pending|confirmed&page= */
export async function GET(req: Request) {
  const g = await adminGuard("period.read");
  if ("response" in g) return g.response;
  const url = new URL(req.url);
  const status = url.searchParams.get("status") === "confirmed" ? "confirmed" : "pending";
  try {
    return ok(await listPeriods(status, pageParam(url), scopeOf(g.actor)));
  } catch (e) {
    return serverError(e);
  }
}

const CreateBody = z.object({
  centerId: z.string().refine(isUuid, "복지관을 골라 주세요"),
  period: PeriodBody,
});

/** 직접 추가 → 확인 대기 */
export async function POST(req: Request) {
  const parsed = await parseJson(req, CreateBody);
  if ("response" in parsed) return parsed.response;
  const g = await centerGuard("period.create", parsed.data.centerId);
  if ("response" in g) return g.response;
  try {
    const result = await createPeriod(g.actor.id, parsed.data.centerId, parsed.data.period);
    if (!result.ok) return fail(result.error);
    return ok({ id: result.id });
  } catch (e) {
    return serverError(e);
  }
}
