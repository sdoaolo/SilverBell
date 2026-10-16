import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { Loading, Page } from "@/components/ui";
import { maskPhone } from "@/lib/crypto/phone";
import { requireSeniorAccess } from "@/lib/page-guard";
import { getSenior } from "@/lib/seniors";
import { VerifyForm } from "./verify-form";

export default function VerifyPage(props: PageProps<"/seniors/[id]/verify">) {
  return (
    <Suspense fallback={<Loading />}>
      <Verify {...props} />
    </Suspense>
  );
}

async function Verify({ params, searchParams }: PageProps<"/seniors/[id]/verify">) {
  const { id } = await params;
  const { sent } = await searchParams;
  await requireSeniorAccess(id, "senior.update");
  const senior = await getSenior(id);
  if (!senior) notFound();
  if (senior.verified_at) redirect(`/seniors/${id}/centers`);

  return (
    <Page title="어르신 번호 확인">
      <p className="text-xl leading-relaxed">
        {senior.name} 님 휴대폰({maskPhone(senior.phone_last4)})으로 확인 번호를 보냈어요. 어르신께 받은 번호를
        여쭤보고 입력해 주세요. 확인 전에는 알림이 가지 않아요.
      </p>
      <VerifyForm seniorId={id} sentFailed={sent === "0"} />
    </Page>
  );
}
