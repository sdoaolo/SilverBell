"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ErrorText, Field, Page, TextInput } from "@/components/ui";
import { callApi } from "@/lib/client-api";

const RESEND_SECONDS = 60;

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendCode() {
    setBusy(true);
    setError("");
    const res = await callApi("/api/otp/send", "POST", { phone });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setStep("code");
    setCode("");
    setCooldown(RESEND_SECONDS);
  }

  async function verify() {
    setBusy(true);
    setError("");
    const res = await callApi<{ next: string }>("/api/otp/verify", "POST", { phone, code });
    if (!res.ok) {
      setBusy(false);
      return setError(res.error);
    }
    router.replace(res.data.next);
  }

  if (step === "phone") {
    return (
      <Page title="전화번호로 시작하기">
        <form
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            sendCode();
          }}
        >
          <Field label="휴대폰 번호" hint="이 번호로 확인 번호 6자리를 문자로 보내 드려요">
            <TextInput
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="010-1234-5678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </Field>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" disabled={busy || phone.replace(/\D/g, "").length < 10}>
            {busy ? "보내는 중…" : "확인 번호 받기"}
          </Button>
        </form>
      </Page>
    );
  }

  return (
    <Page title="확인 번호 입력">
      <form
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          verify();
        }}
      >
        <Field label="문자로 받은 6자리 번호" hint={`${phone} 번호로 보냈어요`}>
          <TextInput
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            pattern="\d{6}"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            autoFocus
            required
          />
        </Field>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" disabled={busy || code.length !== 6}>
          {busy ? "확인 중…" : "확인"}
        </Button>
        <Button type="button" variant="secondary" disabled={busy || cooldown > 0} onClick={sendCode}>
          {cooldown > 0 ? `다시 받기 (${cooldown}초 후)` : "확인 번호 다시 받기"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setStep("phone");
            setError("");
          }}
        >
          번호 다시 입력하기
        </Button>
      </form>
    </Page>
  );
}
