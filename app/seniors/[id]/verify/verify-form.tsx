"use client";

import { useRouter } from "next/navigation";
import { CodeForm } from "@/components/forms";
import { LinkButton } from "@/components/ui";

export function VerifyForm({ seniorId, sentFailed }: { seniorId: string; sentFailed: boolean }) {
  const router = useRouter();
  return (
    <>
      {sentFailed && (
        <p className="text-xl font-bold text-red-700">문자를 보내지 못했어요. 아래 &ldquo;다시 받기&rdquo;를 눌러 주세요.</p>
      )}
      <CodeForm
        url={`/api/seniors/${seniorId}/verify`}
        hint="어르신 휴대폰 문자에 온 6자리 숫자"
        initialCooldown={sentFailed ? 0 : 60}
        onDone={() => router.replace(`/seniors/${seniorId}/centers`)}
      />
      <LinkButton href="/home" variant="secondary">
        나중에 할게요
      </LinkButton>
    </>
  );
}
