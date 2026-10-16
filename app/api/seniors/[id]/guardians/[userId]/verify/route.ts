import { fail, notFound, ok, parseJson, requireActor, serverError } from "@/lib/api";
import { can, isUuid } from "@/lib/authz";
import { codeOrResend } from "@/lib/schemas";
import { getGuardianLink, resendGuardianCode, verifyGuardian } from "@/lib/seniors";

/** {code} → 보호자 연결 확인 / {resend:true} → 코드 다시 보내기 — owner만 */
export async function POST(req: Request, ctx: RouteContext<"/api/seniors/[id]/guardians/[userId]/verify">) {
  const auth = await requireActor();
  if ("response" in auth) return auth.response;
  const { id, userId } = await ctx.params;
  if (!isUuid(userId) || !(await can(auth.actor, "guardian.manage", { seniorId: id }))) return notFound();
  const parsed = await parseJson(req, codeOrResend);
  if ("response" in parsed) return parsed.response;
  try {
    const link = await getGuardianLink(id, userId);
    if (!link) return notFound();
    if (link.verified_at) return ok({ ok: true });
    const result =
      "code" in parsed.data
        ? await verifyGuardian(id, userId, parsed.data.code)
        : await resendGuardianCode(id, userId, auth.actor.name ?? "");
    if (!result.ok) return fail(result.error);
    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
