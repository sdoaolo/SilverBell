import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Loading, Page } from "@/components/ui";
import { maskPhone } from "@/lib/crypto/phone";
import { requireSeniorAccess } from "@/lib/page-guard";
import { getGuardianLink, getSenior, listSubscriptions } from "@/lib/seniors";
import { EditSenior } from "./edit-senior";

export default function EditPage(props: PageProps<"/seniors/[id]/edit">) {
  return (
    <Suspense fallback={<Loading />}>
      <Edit {...props} />
    </Suspense>
  );
}

async function Edit({ params }: PageProps<"/seniors/[id]/edit">) {
  const { id } = await params;
  const actor = await requireSeniorAccess(id, "senior.read");
  const [senior, link, subscriptions] = await Promise.all([
    getSenior(id),
    getGuardianLink(id, actor.id),
    listSubscriptions(id),
  ]);
  if (!senior || !link) notFound();

  return (
    <Page title={`${senior.name} 님 정보`}>
      <EditSenior
        seniorId={id}
        initial={{
          name: senior.name,
          phone: maskPhone(senior.phone_last4),
          seniorChannel: senior.senior_channel,
          myChannel: link.channel,
          verified: !!senior.verified_at,
        }}
        isOwner={link.relation === "owner"}
        subscriptions={subscriptions}
      />
    </Page>
  );
}
