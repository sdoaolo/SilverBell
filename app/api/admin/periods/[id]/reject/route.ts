import { ok, serverError } from "@/lib/api";
import { rejectPeriod } from "@/lib/admin";
import { periodGuard } from "@/lib/admin-api";

/** 무시 (공지는 남겨 재분석 방지) */
export async function POST(_req: Request, ctx: RouteContext<"/api/admin/periods/[id]/reject">) {
  const { id } = await ctx.params;
  const g = await periodGuard("period.confirm", id);
  if ("response" in g) return g.response;
  try {
    await rejectPeriod(g.actor.id, id);
    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
