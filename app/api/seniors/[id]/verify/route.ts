import { fail, notFound, ok, parseJson, requireActor, serverError } from "@/lib/api";
import { can } from "@/lib/authz";
import { codeOrResend } from "@/lib/schemas";
import { resendSeniorCode, verifySenior } from "@/lib/seniors";

/** {code} → 어르신 번호 확인 완료 / {resend:true} → 코드 다시 보내기 */
export async function POST(req: Request, ctx: RouteContext<"/api/seniors/[id]/verify">) {
  const auth = await requireActor();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  if (!(await can(auth.actor, "senior.update", { seniorId: id }))) return notFound();
  const parsed = await parseJson(req, codeOrResend);
  if ("response" in parsed) return parsed.response;
  try {
    const result =
      "code" in parsed.data
        ? await verifySenior(id, parsed.data.code)
        : await resendSeniorCode(id, auth.actor.name ?? "");
    if (!result.ok) return fail(result.error);
    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
