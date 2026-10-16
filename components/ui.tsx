// 어르신·보호자 화면 공통: 글자 20px 이상, 버튼 높이 56px 이상·가로 전체, 흰 바탕 + 진한 글자
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function Page({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 py-8">
      {title && <h1 className="text-3xl font-bold leading-snug">{title}</h1>}
      {children}
    </main>
  );
}

const base =
  "flex min-h-14 w-full items-center justify-center rounded-xl px-4 text-xl font-bold disabled:opacity-50";
const variants = {
  primary: "bg-blue-700 text-white",
  secondary: "border-2 border-gray-800 bg-white text-gray-900",
  danger: "bg-red-700 text-white",
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
      {hint && <span className="text-lg text-gray-700">{hint}</span>}
    </label>
  );
}

export function TextInput(props: ComponentProps<"input">) {
  return (
    <input
      className="min-h-14 w-full rounded-xl border-2 border-gray-800 px-4 text-2xl"
      {...props}
    />
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-xl font-bold text-red-700">
      {children}
    </p>
  );
}

export function Loading() {
  return <p className="px-5 py-8 text-xl">불러오는 중이에요…</p>;
}
