import { z } from "zod";
import { ok, parseJson, requireActor, serverError } from "@/lib/api";
import { maskPhone } from "@/lib/crypto/phone";
import { db } from "@/lib/db";

export async function GET() {
  const auth = await requireActor();
  if ("response" in auth) return auth.response;
  const { actor } = auth;
  return ok({
    id: actor.id,
    name: actor.name,
    phone: maskPhone(actor.phoneLast4),
    roles: actor.roles,
  });
}

const Patch = z.object({
  name: z.string().trim().min(1, "이름을 입력해 주세요").max(30, "이름은 30자까지 쓸 수 있어요"),
});

export async function PATCH(req: Request) {
  const auth = await requireActor();
  if ("response" in auth) return auth.response;
  const parsed = await parseJson(req, Patch);
  if ("response" in parsed) return parsed.response;
  try {
    const { error } = await db().from("users").update({ name: parsed.data.name }).eq("id", auth.actor.id);
    if (error) throw error;
    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
