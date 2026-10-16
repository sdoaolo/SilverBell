import { fail, notFound, ok, parseJson, serverError } from "@/lib/api";
import { adminGuard, RoleBody } from "@/lib/admin-api";
import { isUuid } from "@/lib/authz";
import { changeRole, revokeRole } from "@/lib/members";

/** 역할 변경 (마지막 super_admin·자기 자신 보호) */
export async function PATCH(req: Request, ctx: RouteContext<"/api/admin/members/[id]">) {
  const g = await adminGuard("admin.manage");
  if ("response" in g) return g.response;
  const { id } = await ctx.params;
  if (!isUuid(id)) return notFound();
  const parsed = await parseJson(req, RoleBody);
  if ("response" in parsed) return parsed.response;
  try {
    const result = await changeRole(g.actor.id, id, parsed.data);
    if (!result.ok) return fail(result.error);
    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}

/** 회수 */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/admin/members/[id]">) {
  const g = await adminGuard("admin.manage");
  if ("response" in g) return g.response;
  const { id } = await ctx.params;
  if (!isUuid(id)) return notFound();
  try {
    const result = await revokeRole(g.actor.id, id);
    if (!result.ok) return fail(result.error);
    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
