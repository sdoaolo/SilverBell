import { fail, ok, parseJson, serverError } from "@/lib/api";
import { deletePeriod, updatePeriod } from "@/lib/admin";
import { periodGuard, PeriodBody } from "@/lib/admin-api";

/** 확정 전후 수정 */
export async function PATCH(req: Request, ctx: RouteContext<"/api/admin/periods/[id]">) {
  const { id } = await ctx.params;
  const g = await periodGuard("period.update", id);
  if ("response" in g) return g.response;
  const parsed = await parseJson(req, PeriodBody);
  if ("response" in parsed) return parsed.response;
  try {
    const result = await updatePeriod(id, parsed.data);
    if (!result.ok) return fail(result.error);
    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/admin/periods/[id]">) {
  const { id } = await ctx.params;
  const g = await periodGuard("period.delete", id);
  if ("response" in g) return g.response;
  try {
    await deletePeriod(g.actor.id, id);
    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
