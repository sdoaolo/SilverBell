import { z } from "zod";
import { fail, notFound, ok, parseJson, requireActor, serverError } from "@/lib/api";
import { can } from "@/lib/authz";
import { nameField, phoneField, seniorChannelField } from "@/lib/schemas";
import { deleteSenior, updateSenior } from "@/lib/seniors";

const Patch = z.object({
  name: nameField.optional(),
  phone: phoneField.optional(),
  seniorChannel: seniorChannelField.optional(),
});

/** 수정 (번호 변경 시 재확인) — 연결된 보호자 */
export async function PATCH(req: Request, ctx: RouteContext<"/api/seniors/[id]">) {
  const auth = await requireActor();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  if (!(await can(auth.actor, "senior.update", { seniorId: id }))) return notFound();
  const parsed = await parseJson(req, Patch);
  if ("response" in parsed) return parsed.response;
  try {
    const result = await updateSenior(
      id,
      { id: auth.actor.id, name: auth.actor.name ?? "" },
      parsed.data,
    );
    if (!result.ok) return fail(result.error);
    return ok({ needsVerify: result.needsVerify });
  } catch (e) {
    return serverError(e);
  }
}

/** 등록 삭제 — owner만 */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/seniors/[id]">) {
  const auth = await requireActor();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  if (!(await can(auth.actor, "senior.delete", { seniorId: id }))) return notFound();
  try {
    await deleteSenior(id);
    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
