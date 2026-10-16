// 어르신·보호자 화면 공통: 글자 20px 이상, 버튼 높이 56px 이상·가로 전체, 흰 카드 + 진한 글자
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function Page({ title, eyebrow, children }: { title?: string; eyebrow?: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8">
      {(title || eyebrow) && (
        <header className="flex flex-col gap-2">
          {eyebrow && (
            <span className="w-fit rounded-md bg-brand-100 px-2.5 py-0.5 text-sm font-bold text-brand-700">{eyebrow}</span>
          )}
          {title && <h1 className="text-3xl font-black leading-snug tracking-tight">{title}</h1>}
        </header>
      )}
      {children}
    </main>
  );
}

/** 흰 카드 */
export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <section className={`flex flex-col gap-4 rounded-3xl border border-line bg-white p-5 shadow-xs sm:p-6 ${className}`}>
      {children}
    </section>
  );
}

const base =
  "inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl px-5 text-xl font-black transition-colors disabled:opacity-50";
const variants = {
  primary: "bg-brand-600 text-white shadow-sm hover:bg-brand-700",
  secondary: "border-2 border-line bg-white text-ink hover:bg-brand-50",
  dark: "bg-navy-900 text-white shadow-sm hover:bg-navy-800",
  danger: "bg-red-700 text-white hover:bg-red-800",
};

type Variant = keyof typeof variants;

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}

export function LinkButton({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={`${base} ${variants[variant]} ${className}`} {...props} />;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-xl font-bold">{label}</span>
      {children}
      {hint && <span className="text-lg text-muted">{hint}</span>}
    </label>
  );
}

export function TextInput(props: ComponentProps<"input">) {
  return (
    <input
      className="min-h-14 w-full rounded-2xl border-2 border-zinc-300 bg-white px-4 text-2xl font-semibold outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-600/15"
      {...props}
    />
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-xl font-bold text-red-800">
      {children}
    </p>
  );
}

export function Loading() {
  return <p className="px-5 py-8 text-xl text-muted">불러오는 중이에요…</p>;
}
