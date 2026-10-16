import Link from "next/link";
import { TextSizeControl } from "./text-size";

/** 모든 화면 공통 헤더 (로그인 여부와 무관하게 정적으로 그린다) */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white">
      <div className="bg-navy-900 px-4 py-1.5 text-white">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-xs font-medium">
            <span className="h-2 w-2 animate-pulse rounded-full bg-brand-400" aria-hidden />
            복지관 신청 기간을 전화와 문자로 알려 드려요
          </span>
          <TextSizeControl />
        </div>
      </div>
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="group flex items-center gap-3 text-ink">
          <span
            aria-hidden
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 text-2xl font-black text-white shadow-md shadow-brand-600/20 transition-transform group-hover:scale-105"
          >
            孝
          </span>
          <span className="flex flex-col leading-tight">
            <span className="flex items-center gap-2 text-xl font-black tracking-tight">
              복지관 효도알림
              <span className="hidden rounded-md bg-brand-100 px-2 py-0.5 text-xs font-bold text-brand-600 sm:inline">
                SilverBell
              </span>
            </span>
            <span className="text-sm font-medium text-muted">신청 시기가 먼저 전화로 찾아오는 서비스</span>
          </span>
        </Link>
        <nav aria-label="바로가기" className="flex items-center gap-2">
          <Link
            href="/home"
            className="inline-flex min-h-12 items-center rounded-xl bg-[#EFEFF2] px-4 text-base font-bold text-ink hover:bg-[#E5E5EA]"
          >
            내 알림
          </Link>
          <Link
            href="/settings"
            className="inline-flex min-h-12 items-center rounded-xl px-3 text-base font-bold text-muted hover:text-ink"
          >
            설정
          </Link>
        </nav>
      </div>
    </header>
  );
}
