import { timingSafeEqual } from "node:crypto";
import { fail, ok, serverError } from "@/lib/api";
import { runDaily } from "@/lib/jobs/daily";

export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(req.headers.get("authorization") ?? "");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Vercel Cron (하루 1회, 한국 오전 9시). Authorization: Bearer ${CRON_SECRET} */
export async function GET(req: Request) {
  if (!authorized(req)) return fail("unauthorized", 401);
  try {
    return ok(await runDaily("cron"));
  } catch (e) {
    return serverError(e);
  }
}
