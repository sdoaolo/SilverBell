"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Choices, CodeForm, ConfirmAction, SavedText, useSaved } from "@/components/forms";
import { Button, ErrorText, Field, LinkButton, TextInput } from "@/components/ui";
import { callApi } from "@/lib/client-api";
import { CHANNEL_LABEL } from "@/lib/messages";

type Channel = "sms" | "voice" | "both" | "none";
const OPTIONS = (["sms", "voice", "both", "none"] as const).map((v) => ({ value: v, label: CHANNEL_LABEL[v] }));

interface Guardian {
  userId: string;
  name: string | null;
  phone: string;
  relation: "owner" | "member";
  channel: Channel;
  verified: boolean;
  isMe: boolean;
}

export function GuardianManager({
  seniorId,
  isOwner,
  maxGuardians,
  guardians,
}: {
  seniorId: string;
  isOwner: boolean;
  maxGuardians: number;
  guardians: Guardian[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const base = `/api/seniors/${seniorId}/guardians`;

  return (
    <div className="flex flex-col gap-5">
      <p className="text-xl">
        보호자 {guardians.length}명 (최대 {maxGuardians}명)
      </p>
      {guardians.map((g) => (
        <GuardianCard key={g.userId} g={g} base={base} canManage={isOwner || g.isMe} isOwner={isOwner} />
      ))}

      {isOwner && guardians.length < maxGuardians && !adding && (
        <Button onClick={() => setAdding(true)}>보호자 추가</Button>
      )}
      {isOwner && adding && (
        <AddGuardian
          base={base}
          onClose={() => {
            setAdding(false);
            router.refresh();
          }}
        />
      )}
      <LinkButton href="/home" variant="secondary">
        홈으로
      </LinkButton>
    </div>
  );
}

function GuardianCard({ g, base, canManage, isOwner }: { g: Guardian; base: string; canManage: boolean; isOwner: boolean }) {
  const router = useRouter();
  const [channel, setChannel] = useState<Channel | null>(g.channel);
  const [error, setError] = useState("");
  const [saved, markSaved] = useSaved();
  const [entering, setEntering] = useState(false);
  const url = `${base}/${g.userId}`;

  return (
    <section className="flex flex-col gap-3 rounded-3xl border border-line bg-white p-5 shadow-xs">
      <h2 className="text-2xl font-bold">
        {g.name ?? "이름 없음"}
        {g.isMe && " (나)"}
      </h2>
      <p className="text-lg text-muted">
        {g.phone} · {g.relation === "owner" ? "대표 보호자" : "보호자"} · {CHANNEL_LABEL[g.channel]}
      </p>

      {!g.verified && (
        <div className="flex flex-col gap-3 rounded-xl bg-amber-100 p-3">
          <p className="text-xl font-bold">번호 확인 전이에요. 확인 전에는 알림이 가지 않아요.</p>
          {isOwner && !entering && <Button onClick={() => setEntering(true)}>확인 번호 입력하기</Button>}
          {isOwner && entering && (
            <CodeForm
              url={`${url}/verify`}
              hint={`${g.phone} 문자로 간 6자리 숫자`}
              initialCooldown={0}
              onDone={() => router.refresh()}
            />
          )}
        </div>
      )}

      {canManage && (
        <>
          <Choices legend="알림 방법" value={channel} onChange={setChannel} options={OPTIONS} />
          <ErrorText>{error}</ErrorText>
          <SavedText show={saved} />
          <Button
            variant="secondary"
            onClick={async () => {
              setError("");
              const res = await callApi(url, "PATCH", { channel });
              if (!res.ok) return setError(res.error);
              markSaved();
            }}
          >
            알림 방법 저장
          </Button>
          <ConfirmAction
            trigger={g.isMe ? "나가기" : "보호자 해제"}
            confirmLabel={g.isMe ? "나가기" : "해제"}
            message={
              g.isMe
                ? "정말 나갈까요? 이후로 이 어르신 알림이 가지 않아요"
                : `${g.name ?? "이 보호자"} 님을 해제할까요? 이후로 알림이 가지 않아요`
            }
            onConfirm={async () => {
              const res = await callApi(url, "DELETE");
              if (!res.ok) return res.error;
              if (g.isMe) router.replace("/home");
              router.refresh();
            }}
          />
        </>
      )}
    </section>
  );
}

function AddGuardian({ base, onClose }: { base: string; onClose: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [channel, setChannel] = useState<Channel | null>("sms");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState<{ userId: string; sendError?: string } | null>(null);

  if (added) {
    return (
      <section className="flex flex-col gap-4 rounded-2xl border-4 border-brand-600 p-4">
        <h2 className="text-2xl font-bold">{name} 님 번호 확인</h2>
        {added.sendError ? (
          <ErrorText>{added.sendError}</ErrorText>
        ) : (
          <p className="text-xl">{name} 님 휴대폰으로 확인 번호를 보냈어요. 받은 번호를 여쭤보고 입력해 주세요.</p>
        )}
        <CodeForm
          url={`${base}/${added.userId}/verify`}
          hint="보호자 휴대폰 문자에 온 6자리 숫자"
          initialCooldown={added.sendError ? 0 : 60}
          onDone={onClose}
        />
        <Button variant="secondary" onClick={onClose}>
          나중에 입력할게요
        </Button>
      </section>
    );
  }

  return (
    <form
      className="flex flex-col gap-5 rounded-2xl border-4 border-brand-600 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const res = await callApi<{ userId: string; sendError?: string }>(base, "POST", { name, phone, channel });
        setBusy(false);
        if (!res.ok) return setError(res.error);
        setAdded(res.data);
      }}
    >
      <h2 className="text-2xl font-bold">보호자 추가</h2>
      <Field label="보호자 이름">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} maxLength={30} required />
      </Field>
      <Field label="보호자 휴대폰 번호" hint="이 번호로 확인 번호를 보내요">
        <TextInput
          type="tel"
          inputMode="numeric"
          placeholder="010-1234-5678"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />
      </Field>
      <Choices legend="알림 방법" value={channel} onChange={setChannel} options={OPTIONS} />
      <ErrorText>{error}</ErrorText>
      <Button type="submit" disabled={busy || !name.trim() || phone.replace(/\D/g, "").length < 10}>
        {busy ? "보내는 중…" : "확인 번호 보내기"}
      </Button>
      <Button type="button" variant="secondary" onClick={onClose}>
        취소
      </Button>
    </form>
  );
}
