import { fail, ok, parseJson, serverError } from "@/lib/api";
import { createCenter, listCenters } from "@/lib/admin";
import { adminGuard, CenterBody, pageParam, scopeOf } from "@/lib/admin-api";

export async function GET(req: Request) {
  const g = await adminGuard("center.read");
  if ("response" in g) return g.response;
  const url = new URL(req.url);
  try {
    return ok(await listCenters((url.searchParams.get("q") ?? "").slice(0, 50), pageParam(url), scopeOf(g.actor)));
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request) {
  const g = await adminGuard("center.create");
  if ("response" in g) return g.response;
  const parsed = await parseJson(req, CenterBody);
  if ("response" in parsed) return parsed.response;
  try {
    const result = await createCenter(g.actor.id, parsed.data);
    if (!result.ok) return fail(result.error);
    return ok({ id: result.id });
  } catch (e) {
    return serverError(e);
  }
}
