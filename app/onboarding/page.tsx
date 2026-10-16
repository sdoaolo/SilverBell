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
    <Page title="보호자의 이름을 알려 주세요">
      <p className="text-xl leading-relaxed">
        내가 어르신이나 가족을 등록하면, 그분께 가는 확인 문자에 &ldquo;○○○ 님이 등록하려고 해요&rdquo;처럼 이 이름이 나와요.
      </p>
      <NameForm />
    </Page>
  );
}
