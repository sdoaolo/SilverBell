import { Suspense } from "react";
import Link from "next/link";
import { LinkButton, Loading, Page } from "@/components/ui";
import { can } from "@/lib/authz";
import { DAILY_SEND_TIME_KST } from "@/lib/config";
import { maskPhone } from "@/lib/crypto/phone";
import { koMonthDay, todaySeoul } from "@/lib/dates";
import { CHANNEL_LABEL, hasValue } from "@/lib/messages";
import { requirePageActor } from "@/lib/page-guard";
import { getHomeData, type HomeCenter, type HomeSenior } from "@/lib/seniors";
import { NotifyButton } from "./notify-button";

export default function HomePage() {
  return (
    <Suspense fallback={<Loading />}>
      <Home />
    </Suspense>
  );
}

async function Home() {
  const actor = await requirePageActor();
  const [isAdmin, seniors] = await Promise.all([can(actor, "admin.access"), getHomeData(actor.id)]);

  return (
    <Page eyebrow="내 알림" title={`${actor.name} 님, 안녕하세요`}>
      {isAdmin && (
        <LinkButton href="/admin" variant="dark">
          관리자 화면
        </LinkButton>
      )}
      {seniors.length === 0 && (
        <section className="flex flex-col gap-3 rounded-3xl border border-line bg-white p-6 shadow-xs">
          <h2 className="text-2xl font-black">아직 등록한 어르신이 없어요</h2>
          <p className="text-xl leading-relaxed text-muted">
            어르신을 등록하고 다니시는 복지관을 고르면, 신청 3일 전과 신청 첫날 아침에 알려 드려요.
          </p>
        </section>
      )}
      {seniors.map((s) => (
        <SeniorCard key={s.id} senior={s} />
      ))}
      <LinkButton href="/seniors/new">{seniors.length ? "어르신 더 등록하기" : "어르신 등록하기"}</LinkButton>
      <LinkButton href="/settings" variant="secondary">
        내 설정
      </LinkButton>
    </Page>
  );
}

function SeniorCard({ senior: s }: { senior: HomeSenior }) {
  return (
    <section className="flex flex-col gap-5 rounded-[28px] border border-line bg-white p-5 shadow-xs sm:p-6">
      <header className="flex flex-col gap-1">
        <h2 className="text-2xl font-black tracking-tight">{s.isSelf ? `${s.name} 님 (본인)` : `${s.name} 님`}</h2>
        <p className="text-lg text-muted">
          {maskPhone(s.phoneLast4)} · {CHANNEL_LABEL[s.seniorChannel]}로 알림 · 보호자 {s.guardianCount}명
        </p>
      </header>

      {!s.verified && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-xl font-bold">어르신 번호 확인이 필요해요. 확인 전에는 알림이 가지 않아요.</p>
          <LinkButton href={`/seniors/${s.id}/verify`}>번호 확인하기</LinkButton>
        </div>
      )}

      {s.centers.length === 0 ? (
        <p className="rounded-2xl bg-[#F8F8FA] p-4 text-xl text-muted">아직 고른 복지관이 없어요.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {s.centers.map((c) => (
            <CenterCard key={c.centerId} c={c} seniorId={s.id} canNotify={s.verified} />
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-3">
        <LinkButton href={`/seniors/${s.id}/centers`} variant="secondary">
          복지관 고르기
        </LinkButton>
        <LinkButton href={`/seniors/${s.id}/guardians`} variant="secondary">
          보호자 {s.guardianCount}명 관리
        </LinkButton>
        <Link href={`/seniors/${s.id}/edit`} className="py-2 text-center text-xl font-bold text-brand-700 underline">
          정보 수정·삭제
        </Link>
      </div>
    </section>
  );
}

function StatusBadge({ phase }: { phase: "before" | "open" | "ended" }) {
  if (phase === "open") {
    return (
      <span className="inline-flex min-h-11 w-fit items-center gap-2 rounded-full bg-brand-600 px-4 text-xl font-bold text-white">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-200" aria-hidden />
        신청 기간이에요
      </span>
    );
  }
  return (
    <span className="inline-flex min-h-11 w-fit items-center rounded-full border border-[#C3D2EA] bg-[#E8EEF8] px-4 text-xl font-bold text-[#1E3A6B]">
      신청 알림 예약됨
    </span>
  );
}

function CenterCard({ c, seniorId, canNotify }: { c: HomeCenter; seniorId: string; canNotify: boolean }) {
  const p = c.period;
  if (!p) {
    return (
      <li className="flex flex-col gap-1 rounded-2xl border border-zinc-100 bg-[#F8F8FA] p-4">
        <p className="text-xl font-black">{c.centerName}</p>
        <p className="text-lg text-muted">아직 확정된 신청 기간이 없어요. 공지가 올라오면 알려 드릴게요.</p>
      </li>
    );
  }
  const today = todaySeoul();
  const schedule = (date: string, sent: boolean, what: string) =>
    sent
      ? `${koMonthDay(date)} · ${what} 보냈어요`
      : date < today
        ? `${koMonthDay(date)} · ${what} (지났어요)`
        : `${koMonthDay(date)} ${DAILY_SEND_TIME_KST} · ${what}`;

  return (
    <li className="flex flex-col gap-4 rounded-3xl border border-line p-4 sm:p-5">
      <div className="flex flex-col gap-2">
        <p className="text-lg text-muted">{c.centerName}</p>
        <h3 className="text-2xl font-black tracking-tight">{p.label} 신청</h3>
        <StatusBadge phase={p.phase} />
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div className="flex flex-col gap-1 rounded-2xl border border-zinc-100 bg-[#F8F8FA] p-4">
          <span className="text-lg font-medium text-muted">신청 기간</span>
          <span className="text-2xl font-black">
            {koMonthDay(p.applyStart)}
            {p.applyEnd ? ` ~ ${koMonthDay(p.applyEnd)}` : ""}
          </span>
        </div>
        {hasValue(p.method) && (
          <div className="flex flex-col gap-1 rounded-2xl border border-zinc-100 bg-[#F8F8FA] p-4">
            <span className="text-lg font-medium text-muted">신청 방법</span>
            <span className="text-2xl font-black">{p.method}</span>
          </div>
        )}
        <div className="flex flex-col gap-1.5 rounded-2xl border border-brand-200 bg-brand-50 p-4">
          <span className="text-lg font-bold text-brand-700">알림 일정</span>
          <span className="text-xl font-black">✓ {schedule(p.remindAt, p.remindSent, "3일 전 알림")}</span>
          <span className="text-xl font-black">✓ {schedule(p.applyStart, p.startSent, "신청 첫날 알림")}</span>
        </div>
      </div>

      {canNotify && <NotifyButton seniorId={seniorId} periodId={p.id} />}
    </li>
  );
}
