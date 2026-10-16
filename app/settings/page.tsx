import { Suspense } from "react";
import { LogoutButton } from "@/components/logout-button";
import { LinkButton, Loading, Page } from "@/components/ui";
import { can } from "@/lib/authz";
import { maskPhone } from "@/lib/crypto/phone";
import { requirePageActor } from "@/lib/page-guard";
import { SettingsForm } from "./settings-form";

export default function SettingsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Settings />
    </Suspense>
  );
}

async function Settings() {
  const actor = await requirePageActor();
  const isAdmin = await can(actor, "admin.access");
  return (
    <Page title="내 설정">
      <p className="text-xl">내 번호: {maskPhone(actor.phoneLast4)}</p>
      {isAdmin && (
        <LinkButton href="/admin" variant="secondary">
          관리자 화면
        </LinkButton>
      )}
      <SettingsForm initialName={actor.name} />
      <LogoutButton />
      <LinkButton href="/home" variant="secondary">
        홈으로
      </LinkButton>
    </Page>
  );
}
