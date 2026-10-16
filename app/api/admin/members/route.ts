import { fail, ok, parseJson, serverError } from "@/lib/api";
import { adminGuard, pageParam, RoleBody } from "@/lib/admin-api";
import { addMember, listMembers } from "@/lib/members";
import { phoneField } from "@/lib/schemas";

export async function GET(req: Request) {
  const g = await adminGuard("admin.manage");
  if ("response" in g) return g.response;
  try {
    return ok(await listMembers(pageParam(new URL(req.url))));
  } catch (e) {
    return serverError(e);
  }
}

const AddBody = RoleBody.extend({ phone: phoneField });

/** 번호로 관리자 추가 (+안내 문자) */
export async function POST(req: Request) {
  const g = await adminGuard("admin.manage");
  if ("response" in g) return g.response;
  const parsed = await parseJson(req, AddBody);
  if ("response" in parsed) return parsed.response;
  try {
    const result = await addMember(g.actor.id, parsed.data);
    if (!result.ok) return fail(result.error);
    return ok({ smsStatus: result.smsStatus });
  } catch (e) {
    return serverError(e);
  }
}
