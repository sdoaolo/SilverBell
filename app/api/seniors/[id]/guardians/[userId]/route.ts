import { z } from "zod";
import { notFound, ok, parseJson, requireActor, serverError } from "@/lib/api";
import { can, isUuid, type Actor } from "@/lib/authz";
import { guardianChannelField } from "@/lib/schemas";
import { getGuardianLink, removeGuardian, setGuardianChannel } from "@/lib/seniors";

/** owner는 모든 보호자, 각 보호자는 자기 자신만 */
async function allowed(actor: Actor, seniorId: string, userId: string): Promise<boolean> {
  if (!isUuid(userId)) return false;
  if (actor.id === userId) return can(actor, "senior.read", { seniorId });
  return can(actor, "guardian.manage", { seniorId });
}

const Patch = z.object({ channel: guardianChannelField });

/** 알림 방법 변경 */
export async function PATCH(req: Request, ctx: RouteContext<"/api/seniors/[id]/guardians/[userId]">) {
  const auth = await requireActor();
  if ("response" in auth) return auth.response;
  const { id, userId } = await ctx.params;
  if (!(await allowed(auth.actor, id, userId))) return notFound();
  const parsed = await parseJson(req, Patch);
  if ("response" in parsed) return parsed.response;
  try {
    if (!(await getGuardianLink(id, userId))) return notFound();
    await setGuardianChannel(id, userId, parsed.data.channel);
    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}

/** 해제(owner) · 나가기(본인). owner 승계, 남은 보호자가 없으면 어르신 삭제 */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/seniors/[id]/guardians/[userId]">) {
  const auth = await requireActor();
  if ("response" in auth) return auth.response;
  const { id, userId } = await ctx.params;
  if (!(await allowed(auth.actor, id, userId))) return notFound();
  try {
    if (!(await getGuardianLink(id, userId))) return notFound();
    const result = await removeGuardian(id, userId);
    return ok(result);
  } catch (e) {
    return serverError(e);
  }
}
