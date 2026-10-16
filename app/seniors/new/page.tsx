"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Choices } from "@/components/forms";
import { Button, ErrorText, Field, Page, TextInput } from "@/components/ui";
import { callApi } from "@/lib/client-api";
import { CHANNEL_LABEL } from "@/lib/messages";

type SeniorChannel = "voice" | "sms" | "both";
type GuardianChannel = SeniorChannel | "none";

const SENIOR_OPTIONS: { value: SeniorChannel; label: string }[] = [
  { value: "voice", label: CHANNEL_LABEL.voice },
  { value: "sms", label: CHANNEL_LABEL.sms },
  { value: "both", label: CHANNEL_LABEL.both },
];
const GUARDIAN_OPTIONS: { value: GuardianChannel; label: string }[] = [
  { value: "sms", label: CHANNEL_LABEL.sms },
  { value: "voice", label: CHANNEL_LABEL.voice },
  { value: "both", label: CHANNEL_LABEL.both },
  { value: "none", label: "저는 받지 않을게요" },
];

type Step = "who" | "info" | "seniorChannel" | "myChannel" | "agree";

export default function NewSeniorPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("who");
  const [isSelf, setIsSelf] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [seniorChannel, setSeniorChannel] = useState<SeniorChannel | null>("voice");
  const [myChannel, setMyChannel] = useState<GuardianChannel | null>("sms");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const go = (s: Step) => {
    setError("");
    setStep(s);
  };

  async function submit() {
    setBusy(true);
    setError("");
    const body = isSelf
      ? { isSelf: true, name, seniorChannel, agreed }
      : { isSelf: false, name, phone, seniorChannel, guardianChannel: myChannel, agreed };
    const res = await callApi<{ id: string; needsVerify: boolean; sendError?: string }>("/api/seniors", "POST", body);
    if (!res.ok) {
      setBusy(false);
      return setError(res.error);
    }
    const { id, needsVerify, sendError } = res.data;
    router.replace(needsVerify ? `/seniors/${id}/verify${sendError ? "?sent=0" : ""}` : `/seniors/${id}/centers`);
  }

  const back = (s: Step) => (
    <Button type="button" variant="secondary" onClick={() => go(s)}>
      이전
    </Button>
  );

  if (step === "who") {
    return (
      <Page title="누구를 등록할까요?">
        <Button
          onClick={() => {
            setIsSelf(true);
            go("info");
          }}
        >
          제가 어르신 본인이에요
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setIsSelf(false);
            go("info");
          }}
        >
          부모님 등 가족을 등록할게요
        </Button>
      </Page>
    );
  }

  if (step === "info") {
    const phoneOk = isSelf || /^01[016789]\d{7,8}$/.test(phone.replace(/\D/g, ""));
    return (
      <Page title={isSelf ? "제 이름" : "어르신 정보"}>
        <form
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            go("seniorChannel");
          }}
        >
          <Field label={isSelf ? "이름" : "어르신 이름"}>
            <TextInput value={name} onChange={(e) => setName(e.target.value)} maxLength={30} autoFocus required />
          </Field>
          {!isSelf && (
            <Field label="어르신 휴대폰 번호" hint="이 번호로 확인 번호를 보내요. 확인해야 알림이 가요">
              <TextInput
                type="tel"
                inputMode="numeric"
                placeholder="010-1234-5678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </Field>
          )}
          <Button type="submit" disabled={!name.trim() || !phoneOk}>
            다음
          </Button>
          {back("who")}
        </form>
      </Page>
    );
  }

  if (step === "seniorChannel") {
    return (
      <Page title={isSelf ? "어떻게 알려 드릴까요?" : "어르신께 어떻게 알려 드릴까요?"}>
        <Choices value={seniorChannel} onChange={setSeniorChannel} options={SENIOR_OPTIONS} />
        <Button disabled={!seniorChannel} onClick={() => go(isSelf ? "agree" : "myChannel")}>
          다음
        </Button>
        {back("info")}
      </Page>
    );
  }

  if (step === "myChannel") {
    return (
      <Page title="보호자님도 알림을 받을까요?">
        <Choices value={myChannel} onChange={setMyChannel} options={GUARDIAN_OPTIONS} />
        <Button disabled={!myChannel} onClick={() => go("agree")}>
          다음
        </Button>
        {back("seniorChannel")}
      </Page>
    );
  }

  return (
    <Page title="개인정보 수집·이용 동의">
      <dl className="flex flex-col gap-3 rounded-xl bg-brand-50 p-4 text-xl leading-relaxed">
        <div>
          <dt className="font-bold">수집 항목</dt>
          <dd>이름, 전화번호</dd>
        </div>
        <div>
          <dt className="font-bold">목적</dt>
          <dd>복지관 신청 기간 알림 (전화·문자)</dd>
        </div>
        <div>
          <dt className="font-bold">보관 기간</dt>
          <dd>탈퇴하거나 등록을 삭제할 때까지. 삭제하면 바로 지워져요</dd>
        </div>
      </dl>
      <label className="flex min-h-14 items-center gap-4 rounded-2xl border-2 border-line bg-white px-4 text-xl font-bold">
        <input type="checkbox" className="h-7 w-7" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        동의합니다
      </label>
      <ErrorText>{error}</ErrorText>
      <Button disabled={!agreed || busy} onClick={submit}>
        {busy ? "등록 중…" : "등록하기"}
      </Button>
      {back(isSelf ? "seniorChannel" : "myChannel")}
    </Page>
  );
}
