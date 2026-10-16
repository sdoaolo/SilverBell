import { fail, ok, serverError } from "@/lib/api";
import { confirmPeriod } from "@/lib/admin";
import { periodGuard } from "@/lib/admin-api";

export const maxDuration = 60;

/** 확정 (+늦게 확정한 경우 따라잡기 발송) */
export async function POST(_req: Request, ctx: RouteContext<"/api/admin/periods/[id]/confirm">) {
  const { id } = await ctx.params;
  const g = await periodGuard("period.confirm", id);
  if ("response" in g) return g.response;
  try {
    const result = await confirmPeriod(g.actor.id, id);
    if (!result.ok) return fail(result.error);
    return ok(result);
  } catch (e) {
    return serverError(e);
  }
}
