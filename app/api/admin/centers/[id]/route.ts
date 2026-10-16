import { fail, notFound, ok, parseJson, serverError } from "@/lib/api";
import { deleteCenter, updateCenter } from "@/lib/admin";
import { CenterBody, centerGuard } from "@/lib/admin-api";

/** 수정 (담당자도 가능) */
export async function PATCH(req: Request, ctx: RouteContext<"/api/admin/centers/[id]">) {
  const { id } = await ctx.params;
  const g = await centerGuard("center.update", id);
  if ("response" in g) return g.response;
  const parsed = await parseJson(req, CenterBody.partial());
  if ("response" in parsed) return parsed.response;
  try {
    const result = await updateCenter(g.actor.id, id, parsed.data);
    if (!result.ok) return fail(result.error);
    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}

/** 삭제 (admin 이상). 구독·기간·발송 기록이 함께 지워진다 */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/admin/centers/[id]">) {
  const { id } = await ctx.params;
  const g = await centerGuard("center.delete", id);
  if ("response" in g) return g.response;
  try {
    if (!(await deleteCenter(g.actor.id, id))) return notFound();
    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
