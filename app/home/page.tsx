import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { LinkButton, Loading, Page } from "@/components/ui";
import { can, getActor } from "@/lib/authz";

export default function HomePage() {
  return (
    <Suspense fallback={<Loading />}>
      <Home />
    </Suspense>
  );
}

async function Home() {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (!actor.name) redirect("/onboarding");
  const isAdmin = await can(actor, "admin.access");

  return (
    <Page title={`${actor.name} 님`}>
      {isAdmin && (
        <LinkButton href="/admin" variant="secondary">
          관리자 화면
        </LinkButton>
      )}
      <p className="text-xl">등록한 어르신이 아직 없어요.</p>
      <LogoutButton />
    </Page>
  );
}
