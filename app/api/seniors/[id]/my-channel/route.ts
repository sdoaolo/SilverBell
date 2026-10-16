import { z } from "zod";
import { notFound, ok, parseJson, requireActor, serverError } from "@/lib/api";
import { can } from "@/lib/authz";
import { guardianChannelField } from "@/lib/schemas";
import { setGuardianChannel } from "@/lib/seniors";

const Body = z.object({ channel: guardianChannelField });

/** 내 알림 방법 변경 */
export async function PATCH(req: Request, ctx: RouteContext<"/api/seniors/[id]/my-channel">) {
  const auth = await requireActor();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  if (!(await can(auth.actor, "senior.read", { seniorId: id }))) return notFound();
  const parsed = await parseJson(req, Body);
  if ("response" in parsed) return parsed.response;
  try {
    await setGuardianChannel(id, auth.actor.id, parsed.data.channel);
    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
