"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmAction, SavedText, useSaved } from "@/components/forms";
import { Button, ErrorText, Field, TextInput } from "@/components/ui";
import { callApi } from "@/lib/client-api";

export function SettingsForm({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, markSaved] = useSaved();

  return (
    <div className="flex flex-col gap-6">
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const res = await callApi("/api/me", "PATCH", { name });
          setBusy(false);
          if (!res.ok) return setError(res.error);
          markSaved();
          router.refresh();
        }}
      >
        <Field label="내 이름">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} maxLength={30} required />
        </Field>
        <ErrorText>{error}</ErrorText>
        <SavedText show={saved} />
        <Button type="submit" disabled={busy || !name.trim()}>
          이름 저장
        </Button>
      </form>

      <section className="flex flex-col gap-3 border-t-2 border-line pt-6">
        <h2 className="text-2xl font-bold">탈퇴</h2>
        <p className="text-xl leading-relaxed">
          내 계정이 지워져요. 내가 유일한 보호자인 어르신은 함께 지워지고, 다른 보호자가 있는 어르신은 연결만 끊겨요.
        </p>
        <ConfirmAction
          trigger="탈퇴하기"
          confirmLabel="탈퇴"
          message="정말 탈퇴할까요? 이후로 알림이 가지 않아요"
          onConfirm={async () => {
            const res = await callApi("/api/me", "DELETE");
            if (!res.ok) return res.error;
            router.replace("/");
            router.refresh();
          }}
        />
      </section>
    </div>
  );
}
