import { ok, serverError } from "@/lib/api";
import { adminGuard, pageParam } from "@/lib/admin-api";
import { listAudit } from "@/lib/members";

/** 감사 기록 (최근 순, 50개씩) */
export async function GET(req: Request) {
  const g = await adminGuard("audit.read");
  if ("response" in g) return g.response;
  try {
    return ok(await listAudit(pageParam(new URL(req.url))));
  } catch (e) {
    return serverError(e);
  }
}
