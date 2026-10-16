import { z } from "zod";
import { fail, ok, parseJson, requireActor, serverError } from "@/lib/api";
import { maskPhone } from "@/lib/crypto/phone";
import { db } from "@/lib/db";
import { nameField } from "@/lib/schemas";
import { withdrawUser } from "@/lib/seniors";
import { endSession } from "@/lib/session";

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

const Patch = z.object({ name: nameField });

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

/** 탈퇴: 내 계정 삭제 (마지막 super_admin은 불가) */
export async function DELETE() {
  const auth = await requireActor();
  if ("response" in auth) return auth.response;
  try {
    const result = await withdrawUser(auth.actor.id);
    if (!result.ok) return fail(result.error);
    await endSession();
    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
