import { ok, serverError } from "@/lib/api";
import { unconfirmPeriod } from "@/lib/admin";
import { periodGuard } from "@/lib/admin-api";

/** 확정 취소 → 확인 대기로 */
export async function POST(_req: Request, ctx: RouteContext<"/api/admin/periods/[id]/unconfirm">) {
  const { id } = await ctx.params;
  const g = await periodGuard("period.confirm", id);
  if ("response" in g) return g.response;
  try {
    await unconfirmPeriod(g.actor.id, id);
    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
