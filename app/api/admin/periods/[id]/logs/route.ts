import { ok, serverError } from "@/lib/api";
import { periodLogs } from "@/lib/admin";
import { pageParam, periodGuard } from "@/lib/admin-api";

/** 발송 내역 (번호 마스킹, 50개씩) */
export async function GET(req: Request, ctx: RouteContext<"/api/admin/periods/[id]/logs">) {
  const { id } = await ctx.params;
  const g = await periodGuard("period.read", id);
  if ("response" in g) return g.response;
  try {
    return ok(await periodLogs(id, pageParam(new URL(req.url))));
  } catch (e) {
    return serverError(e);
  }
}
