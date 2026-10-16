import { z } from "zod";
import { fail, ok, parseJson, requireActor, serverError } from "@/lib/api";
import { ERR } from "@/lib/messages";
import { guardianChannelField, nameField, phoneField, seniorChannelField } from "@/lib/schemas";
import { createSenior } from "@/lib/seniors";

const Body = z.discriminatedUnion("isSelf", [
  z.object({
    isSelf: z.literal(true),
    name: nameField,
    seniorChannel: seniorChannelField,
    agreed: z.literal(true, { error: ERR.agreeRequired }),
  }),
  z.object({
    isSelf: z.literal(false),
    name: nameField,
    phone: phoneField,
    seniorChannel: seniorChannelField,
    guardianChannel: guardianChannelField,
    agreed: z.literal(true, { error: ERR.agreeRequired }),
  }),
]);

/** 어르신 등록(+owner 연결) → 본인이 아니면 어르신 폰으로 확인 코드 */
export async function POST(req: Request) {
  const auth = await requireActor();
  if ("response" in auth) return auth.response;
  const parsed = await parseJson(req, Body);
  if ("response" in parsed) return parsed.response;
  const { actor } = auth;
  const input = parsed.data;
  if (!actor.name) return fail("먼저 이름을 등록해 주세요");
  try {
    const result = await createSenior({
      userId: actor.id,
      userName: actor.name,
      isSelf: input.isSelf,
      name: input.name,
      phone: input.isSelf ? null : input.phone,
      seniorChannel: input.seniorChannel,
      guardianChannel: input.isSelf ? "none" : input.guardianChannel,
    });
    if (!result.ok) return fail(result.error);
    return ok({ id: result.id, needsVerify: result.needsVerify, sendError: result.sendError });
  } catch (e) {
    return serverError(e);
  }
}
