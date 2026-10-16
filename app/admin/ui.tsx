"use client";
// 관리자 화면용 작은 UI 조각 (어르신 화면보다 촘촘하게)
import { useState, type ComponentProps, type ReactNode } from "react";

export function AButton({
  tone = "default",
  className = "",
  ...props
}: ComponentProps<"button"> & { tone?: "default" | "primary" | "danger" }) {
  const tones = {
    default: "border border-gray-500 bg-white text-gray-900 hover:bg-gray-50",
    primary: "bg-blue-700 text-white hover:bg-blue-800",
    danger: "bg-red-700 text-white hover:bg-red-800",
  };
  return (
    <button
      className={`min-h-10 rounded-lg px-3 text-sm font-semibold disabled:opacity-50 ${tones[tone]} ${className}`}
      {...props}
    />
  );
}

export function AInput(props: ComponentProps<"input">) {
  return <input className="min-h-10 w-full rounded-lg border border-gray-500 px-3 text-sm" {...props} />;
}

export function ALabel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-semibold">{label}</span>
      {children}
    </label>
  );
}

export function AError({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p className="text-sm font-semibold text-red-700">{children}</p>;
}

export function ANote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p className="text-sm font-semibold text-green-800">{children}</p>;
}

/** 확인 창 버튼: 누르면 문구 + 확인/취소 */
export function AConfirm({
  label,
  message,
  confirmLabel = "확인",
  tone = "danger",
  onConfirm,
}: {
  label: string;
  message: ReactNode;
  confirmLabel?: string;
  tone?: "primary" | "danger";
  onConfirm: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!open) {
    return (
      <AButton tone={tone === "danger" ? "default" : "primary"} onClick={() => setOpen(true)}>
        {label}
      </AButton>
    );
  }
  return (
    <div role="alertdialog" className="flex w-full flex-col gap-2 rounded-lg border-2 border-amber-600 bg-amber-50 p-3">
      <p className="text-sm font-semibold">{message}</p>
      <div className="flex gap-2">
        <AButton
          tone={tone}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onConfirm();
            setBusy(false);
            setOpen(false);
          }}
        >
          {busy ? "처리 중…" : confirmLabel}
        </AButton>
        <AButton disabled={busy} onClick={() => setOpen(false)}>
          취소
        </AButton>
      </div>
    </div>
  );
}

export function Pager({
  page,
  total,
  pageSize,
  onPage,
}: {
  page: number;
  total: number;
  pageSize: number;
  onPage: (p: number) => void;
}) {
  const last = Math.max(0, Math.ceil(total / pageSize) - 1);
  if (last === 0) return null;
  return (
    <div className="flex items-center gap-2 text-sm">
      <AButton disabled={page === 0} onClick={() => onPage(page - 1)}>
        이전
      </AButton>
      <span>
        {page + 1} / {last + 1} (총 {total}개)
      </span>
      <AButton disabled={page >= last} onClick={() => onPage(page + 1)}>
        다음
      </AButton>
    </div>
  );
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
