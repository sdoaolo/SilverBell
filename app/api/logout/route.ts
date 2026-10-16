import { ok } from "@/lib/api";
import { endSession } from "@/lib/session";

export async function POST() {
  await endSession();
  return ok({ ok: true });
}
