"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button, ErrorText, Field, TextInput } from "./ui";
import { callApi } from "@/lib/client-api";

/** 큰 선택 버튼 목록 (라디오) */
export function Choices<T extends string>({
  value,
  onChange,
  options,
  legend,
}: {
  value: T | null;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  legend?: string;
}) {
  return (
    <fieldset className="flex flex-col gap-3">
      {legend && <legend className="mb-2 text-xl font-bold">{legend}</legend>}
      {options.map((o) => {
        const selected = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={`flex min-h-14 w-full items-center gap-3 rounded-xl border-2 px-4 text-left text-xl font-bold ${
              selected ? "border-brand-600 bg-brand-50 text-brand-800" : "border-line bg-white text-ink"
            }`}
          >
            <span aria-hidden className="text-2xl">
              {selected ? "●" : "○"}
            </span>
            {o.label}
          </button>
        );
      })}
    </fieldset>
  );
}

/** "저장했어요"를 2초간 보여 준다 */
export function useSaved(): [boolean, () => void] {
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 2000);
    return () => clearTimeout(t);
  }, [saved]);
  return [saved, () => setSaved(true)];
}

export function SavedText({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <p role="status" className="text-xl font-bold text-brand-700">
      저장했어요
    </p>
  );
}

/** 삭제·회수 확인 창: 큰 "삭제" / "취소" */
export function ConfirmAction({
  trigger,
  message,
  confirmLabel = "삭제",
  onConfirm,
}: {
  trigger: string;
  message: ReactNode;
  confirmLabel?: string;
  onConfirm: () => Promise<string | void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!open) {
    return (
      <Button variant="secondary" className="border-red-300 text-red-800" onClick={() => setOpen(true)}>
        {trigger}
      </Button>
    );
  }
  return (
    <div role="alertdialog" className="flex flex-col gap-4 rounded-3xl border-4 border-red-600 bg-white p-4">
      <p className="text-xl font-bold leading-relaxed">{message}</p>
      <ErrorText>{error}</ErrorText>
      <Button
        variant="danger"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          const err = await onConfirm();
          setBusy(false);
          if (err) setError(err);
          else setOpen(false);
        }}
      >
        {busy ? "처리 중…" : confirmLabel}
      </Button>
      <Button variant="secondary" disabled={busy} onClick={() => setOpen(false)}>
        취소
      </Button>
    </div>
  );
}

const RESEND_SECONDS = 60;

/** 6자리 확인 코드 입력 + 다시 받기 (url에 {code} / {resend:true}를 POST) */
export function CodeForm({
  url,
  hint,
  onDone,
  initialCooldown = RESEND_SECONDS,
}: {
  url: string;
  hint: string;
  onDone: () => void;
  initialCooldown?: number;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(initialCooldown);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        setInfo("");
        const res = await callApi(url, "POST", { code });
        setBusy(false);
        if (!res.ok) return setError(res.error);
        onDone();
      }}
    >
      <Field label="확인 번호 6자리" hint={hint}>
        <TextInput
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          autoFocus
        />
      </Field>
      <ErrorText>{error}</ErrorText>
      {info && <p className="text-xl text-brand-700">{info}</p>}
      <Button type="submit" disabled={busy || code.length !== 6}>
        {busy ? "확인 중…" : "확인"}
      </Button>
      <Button
        type="button"
        variant="secondary"
        disabled={busy || cooldown > 0}
        onClick={async () => {
          setBusy(true);
          setError("");
          const res = await callApi(url, "POST", { resend: true });
          setBusy(false);
          if (!res.ok) return setError(res.error);
          setInfo("확인 번호를 다시 보냈어요");
          setCooldown(RESEND_SECONDS);
        }}
      >
        {cooldown > 0 ? `다시 받기 (${cooldown}초 후)` : "확인 번호 다시 받기"}
      </Button>
    </form>
  );
}
