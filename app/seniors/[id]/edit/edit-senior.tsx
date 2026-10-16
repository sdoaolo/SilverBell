"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Choices, ConfirmAction, SavedText, useSaved } from "@/components/forms";
import { Button, ErrorText, Field, LinkButton, TextInput } from "@/components/ui";
import { callApi } from "@/lib/client-api";
import { CHANNEL_LABEL } from "@/lib/messages";

type SeniorChannel = "voice" | "sms" | "both";
type GuardianChannel = SeniorChannel | "none";

const SENIOR_OPTIONS = (["voice", "sms", "both"] as const).map((v) => ({ value: v, label: CHANNEL_LABEL[v] }));
const MY_OPTIONS = (["sms", "voice", "both", "none"] as const).map((v) => ({ value: v, label: CHANNEL_LABEL[v] }));

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t-2 border-line pt-6">
      <h2 className="text-2xl font-bold">{title}</h2>
      {children}
    </section>
  );
}

/** 저장 버튼 + 오류 + "저장했어요" 2초 */
function useSave() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, markSaved] = useSaved();
  async function run(fn: () => ReturnType<typeof callApi>) {
    setBusy(true);
    setError("");
    const res = await fn();
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return null;
    }
    markSaved();
    return res;
  }
  return { busy, error, saved, run };
}

export function EditSenior({
  seniorId,
  initial,
  isOwner,
  subscriptions,
}: {
  seniorId: string;
  initial: { name: string; phone: string; seniorChannel: SeniorChannel; myChannel: GuardianChannel; verified: boolean };
  isOwner: boolean;
  subscriptions: { centerId: string; name: string }[];
}) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [phone, setPhone] = useState("");
  const [seniorChannel, setSeniorChannel] = useState<SeniorChannel | null>(initial.seniorChannel);
  const [myChannel, setMyChannel] = useState<GuardianChannel | null>(initial.myChannel);
  const [subs, setSubs] = useState(subscriptions);

  const nameSave = useSave();
  const phoneSave = useSave();
  const channelSave = useSave();
  const mySave = useSave();
  const url = `/api/seniors/${seniorId}`;

  return (
    <div className="flex flex-col gap-6">
      <Section title="이름">
        <Field label="어르신 이름">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} maxLength={30} />
        </Field>
        <ErrorText>{nameSave.error}</ErrorText>
        <SavedText show={nameSave.saved} />
        <Button
          disabled={nameSave.busy || !name.trim()}
          onClick={async () => {
            await nameSave.run(() => callApi(url, "PATCH", { name }));
            router.refresh();
          }}
        >
          이름 저장
        </Button>
      </Section>

      <Section title="휴대폰 번호">
        <p className="text-xl">
          지금 번호: {initial.phone} {initial.verified ? "(확인 완료)" : "(확인 필요)"}
        </p>
        <Field label="새 번호로 바꾸기" hint="번호를 바꾸면 새 번호로 다시 확인해야 알림이 가요">
          <TextInput
            type="tel"
            inputMode="numeric"
            placeholder="010-1234-5678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </Field>
        <ErrorText>{phoneSave.error}</ErrorText>
        <Button
          disabled={phoneSave.busy || phone.replace(/\D/g, "").length < 10}
          onClick={async () => {
            const res = await phoneSave.run(() => callApi<{ needsVerify: boolean }>(url, "PATCH", { phone }));
            if (!res) return;
            if ((res.data as { needsVerify: boolean }).needsVerify) router.push(`/seniors/${seniorId}/verify`);
            else router.refresh();
          }}
        >
          번호 바꾸기
        </Button>
      </Section>

      <Section title="어르신 알림 방법">
        <Choices value={seniorChannel} onChange={setSeniorChannel} options={SENIOR_OPTIONS} />
        <ErrorText>{channelSave.error}</ErrorText>
        <SavedText show={channelSave.saved} />
        <Button
          disabled={channelSave.busy}
          onClick={() => channelSave.run(() => callApi(url, "PATCH", { seniorChannel }))}
        >
          어르신 알림 방법 저장
        </Button>
      </Section>

      <Section title="내 알림 방법">
        <Choices value={myChannel} onChange={setMyChannel} options={MY_OPTIONS} />
        <ErrorText>{mySave.error}</ErrorText>
        <SavedText show={mySave.saved} />
        <Button
          disabled={mySave.busy}
          onClick={() => mySave.run(() => callApi(`${url}/my-channel`, "PATCH", { channel: myChannel }))}
        >
          내 알림 방법 저장
        </Button>
      </Section>

      <Section title="알림 받는 복지관">
        {subs.length === 0 && <p className="text-xl">고른 복지관이 없어요.</p>}
        {subs.map((s) => (
          <div key={s.centerId} className="flex flex-col gap-3 rounded-xl bg-brand-50 p-3">
            <p className="text-xl font-bold">{s.name}</p>
            <ConfirmAction
              trigger="그만 받기"
              confirmLabel="그만 받기"
              message={`${s.name} 알림을 그만 받을까요? 이후로 이 복지관 알림이 가지 않아요.`}
              onConfirm={async () => {
                const res = await callApi(`${url}/subscriptions`, "DELETE", { centerId: s.centerId });
                if (!res.ok) return res.error;
                setSubs(subs.filter((x) => x.centerId !== s.centerId));
              }}
            />
          </div>
        ))}
        <LinkButton href={`/seniors/${seniorId}/centers`} variant="secondary">
          복지관 더 고르기
        </LinkButton>
      </Section>

      {isOwner && (
        <Section title="등록 삭제">
          <p className="text-xl">어르신 정보와 구독, 발송 기록, 보호자 연결이 모두 지워져요.</p>
          <ConfirmAction
            trigger="등록 삭제"
            message="정말 삭제할까요? 이후로 알림이 가지 않아요"
            onConfirm={async () => {
              const res = await callApi(url, "DELETE");
              if (!res.ok) return res.error;
              router.replace("/home");
              router.refresh();
            }}
          />
        </Section>
      )}

      <LinkButton href="/home" variant="secondary">
        홈으로
      </LinkButton>
    </div>
  );
}
