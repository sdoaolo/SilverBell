import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Loading, Page } from "@/components/ui";
import { getActor } from "@/lib/authz";
import { NameForm } from "./name-form";

export default function OnboardingPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Onboarding />
    </Suspense>
  );
}

async function Onboarding() {
  const actor = await getActor();
  if (!actor) redirect("/login");
  // 첫 로그인일 때만 (이미 이름이 있으면 홈으로)
  if (actor.name) redirect("/home");
  return (
    <Page title="반가워요">
      <p className="text-xl leading-relaxed">알림 문자에 보낸 사람으로 표시할 이름을 알려 주세요.</p>
      <NameForm />
    </Page>
  );
}
