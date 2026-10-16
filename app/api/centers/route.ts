import { ok, requireActor, serverError } from "@/lib/api";
import { searchCenters } from "@/lib/seniors";

/** 활성 복지관 검색 ?q=&page= (0부터) */
export async function GET(req: Request) {
  const auth = await requireActor();
  if ("response" in auth) return auth.response;
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").slice(0, 50);
  const page = Math.max(0, Number.parseInt(url.searchParams.get("page") ?? "0", 10) || 0);
  try {
    return ok(await searchCenters(q, page));
  } catch (e) {
    return serverError(e);
  }
}
