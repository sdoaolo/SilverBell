import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Loading, Page } from "@/components/ui";
import { requireSeniorAccess } from "@/lib/page-guard";
import { getSenior, subscribedCenterIds } from "@/lib/seniors";
import { CenterPicker } from "./center-picker";

export default function CentersPage(props: PageProps<"/seniors/[id]/centers">) {
  return (
    <Suspense fallback={<Loading />}>
      <Centers {...props} />
    </Suspense>
  );
}

async function Centers({ params }: PageProps<"/seniors/[id]/centers">) {
  const { id } = await params;
  await requireSeniorAccess(id, "senior.update");
  const senior = await getSenior(id);
  if (!senior) notFound();
  const subscribed = await subscribedCenterIds(id);

  return (
    <Page title="복지관 고르기">
      <p className="text-xl leading-relaxed">{senior.name} 님이 알림을 받을 복지관을 골라 주세요. 여러 곳을 골라도 돼요.</p>
      <CenterPicker seniorId={id} initialSubscribed={subscribed} />
    </Page>
  );
}
