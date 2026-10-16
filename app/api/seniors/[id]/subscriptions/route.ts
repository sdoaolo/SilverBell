import { z } from "zod";
import { fail, notFound, ok, parseJson, requireActor, serverError } from "@/lib/api";
import { can, isUuid } from "@/lib/authz";
import { ERR } from "@/lib/messages";
import { subscribe, unsubscribe } from "@/lib/seniors";

const Body = z.object({ centerId: z.string().refine(isUuid, ERR.notFound) });

async function guard(ctx: RouteContext<"/api/seniors/[id]/subscriptions">) {
  const auth = await requireActor();
  if ("response" in auth) return auth;
  const { id } = await ctx.params;
  if (!(await can(auth.actor, "senior.update", { seniorId: id }))) return { response: notFound() };
  return { actor: auth.actor, seniorId: id };
}

/** 구독 */
export async function POST(req: Request, ctx: RouteContext<"/api/seniors/[id]/subscriptions">) {
  const g = await guard(ctx);
  if ("response" in g) return g.response;
  const parsed = await parseJson(req, Body);
  if ("response" in parsed) return parsed.response;
  try {
    const result = await subscribe(g.seniorId, parsed.data.centerId, g.actor.id);
    if (!result.ok) return fail(result.error, 404);
    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}

/** 해제 ("그만 받기") */
export async function DELETE(req: Request, ctx: RouteContext<"/api/seniors/[id]/subscriptions">) {
  const g = await guard(ctx);
  if ("response" in g) return g.response;
  const parsed = await parseJson(req, Body);
  if ("response" in parsed) return parsed.response;
  try {
    await unsubscribe(g.seniorId, parsed.data.centerId);
    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
