"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ErrorText, Field, TextInput } from "@/components/ui";
import { callApi } from "@/lib/client-api";

export function NameForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const res = await callApi("/api/me", "PATCH", { name });
        if (!res.ok) {
          setBusy(false);
          return setError(res.error);
        }
        router.replace("/home");
      }}
    >
      <Field label="내 이름">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} maxLength={30} autoFocus required />
      </Field>
      <ErrorText>{error}</ErrorText>
      <Button type="submit" disabled={busy || !name.trim()}>
        {busy ? "저장 중…" : "다음"}
      </Button>
    </form>
  );
}
