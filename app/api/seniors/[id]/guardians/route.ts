import { z } from "zod";
import { fail, notFound, ok, parseJson, requireActor, serverError } from "@/lib/api";
import { can } from "@/lib/authz";
import { maskPhone } from "@/lib/crypto/phone";
import { guardianChannelField, nameField, phoneField } from "@/lib/schemas";
import { addGuardian, listGuardians } from "@/lib/seniors";

/** 보호자 목록 — 연결된 보호자 */
export async function GET(_req: Request, ctx: RouteContext<"/api/seniors/[id]/guardians">) {
  const auth = await requireActor();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  if (!(await can(auth.actor, "senior.read", { seniorId: id }))) return notFound();
  try {
    const list = await listGuardians(id);
    return ok({
      items: list.map(({ phoneLast4, ...g }) => ({ ...g, phone: maskPhone(phoneLast4), isMe: g.userId === auth.actor.id })),
    });
  } catch (e) {
    return serverError(e);
  }
}

const Body = z.object({ name: nameField, phone: phoneField, channel: guardianChannelField });

/** 보호자 추가(+확인 코드) — owner만 */
export async function POST(req: Request, ctx: RouteContext<"/api/seniors/[id]/guardians">) {
  const auth = await requireActor();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  if (!(await can(auth.actor, "guardian.manage", { seniorId: id }))) return notFound();
  const parsed = await parseJson(req, Body);
  if ("response" in parsed) return parsed.response;
  try {
    const result = await addGuardian(id, { id: auth.actor.id, name: auth.actor.name ?? "" }, parsed.data);
    if (!result.ok) return fail(result.error);
    return ok({ userId: result.userId, sendError: result.sendError });
  } catch (e) {
    return serverError(e);
  }
}
