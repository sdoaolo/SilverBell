import "server-only";
import { notFound, redirect } from "next/navigation";
import { can, getActor, isUuid, type Action, type Actor } from "./authz";

/** 로그인 + 이름 등록까지 된 사용자 (서버 컴포넌트용) */
export async function requirePageActor(): Promise<Actor & { name: string }> {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (!actor.name) redirect("/onboarding");
  return actor as Actor & { name: string };
}

/** 어르신 화면: 권한 없거나 없는 id면 404 */
export async function requireSeniorAccess(seniorId: string, action: Action = "senior.read") {
  const actor = await requirePageActor();
  if (!isUuid(seniorId) || !(await can(actor, action, { seniorId }))) notFound();
  return actor;
}
