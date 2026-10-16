import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Loading, Page } from "@/components/ui";
import { MAX_GUARDIANS_PER_SENIOR } from "@/lib/config";
import { maskPhone } from "@/lib/crypto/phone";
import { requireSeniorAccess } from "@/lib/page-guard";
import { getSenior, listGuardians } from "@/lib/seniors";
import { GuardianManager } from "./guardian-manager";

export default function GuardiansPage(props: PageProps<"/seniors/[id]/guardians">) {
  return (
    <Suspense fallback={<Loading />}>
      <Guardians {...props} />
    </Suspense>
  );
}

async function Guardians({ params }: PageProps<"/seniors/[id]/guardians">) {
  const { id } = await params;
  const actor = await requireSeniorAccess(id, "senior.read");
  const [senior, guardians] = await Promise.all([getSenior(id), listGuardians(id)]);
  if (!senior) notFound();
  const me = guardians.find((g) => g.userId === actor.id);
  if (!me) notFound();

  return (
    <Page title={`${senior.name} 님의 보호자`}>
      <GuardianManager
        seniorId={id}
        isOwner={me.relation === "owner"}
        maxGuardians={MAX_GUARDIANS_PER_SENIOR}
        guardians={guardians.map(({ phoneLast4, ...g }) => ({
          ...g,
          phone: maskPhone(phoneLast4),
          isMe: g.userId === actor.id,
        }))}
      />
    </Page>
  );
}
