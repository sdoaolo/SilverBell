import Link from "next/link";

export default function Landing() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-5 py-10">
      <h1 className="text-3xl font-bold leading-snug">복지관 신청기간 알림</h1>
      <p className="text-xl leading-relaxed">
        다니시는 복지관의 신청 기간이 되면 어르신과 보호자에게 전화와 문자로 알려 드려요.
      </p>
      <Link
        href="/login"
        className="flex min-h-14 w-full items-center justify-center rounded-xl bg-blue-700 px-4 text-xl font-bold text-white"
      >
        전화번호로 시작하기
      </Link>
    </main>
  );
}
