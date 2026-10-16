import { Suspense } from "react";
import Link from "next/link";
import { LinkButton, Loading, Page } from "@/components/ui";
import { can } from "@/lib/authz";
import { DAILY_SEND_TIME_KST } from "@/lib/config";
import { maskPhone } from "@/lib/crypto/phone";
import { koMonthDay, slashMonthDay, todaySeoul } from "@/lib/dates";
import { CHANNEL_LABEL, hasValue } from "@/lib/messages";
import { requirePageActor } from "@/lib/page-guard";
import { getHomeData, type HomeCenter, type HomeSenior } from "@/lib/seniors";

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
    <Page title={`${actor.name} 님`}>
      {isAdmin && (
        <LinkButton href="/admin" variant="secondary">
          관리자 화면
        </LinkButton>
      )}
      {seniors.length === 0 && (
        <p className="text-xl leading-relaxed">아직 등록한 어르신이 없어요. 아래 버튼을 눌러 등록해 주세요.</p>
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
    <section className="flex flex-col gap-4 rounded-2xl border-2 border-gray-800 p-4">
      <header>
        <h2 className="text-2xl font-bold">{s.isSelf ? `${s.name} 님 (본인)` : `${s.name} 님`}</h2>
        <p className="text-lg text-gray-700">
          {maskPhone(s.phoneLast4)} · {CHANNEL_LABEL[s.seniorChannel]}로 알림
        </p>
      </header>

      {!s.verified && (
        <div className="flex flex-col gap-3 rounded-xl bg-amber-100 p-3">
          <p className="text-xl font-bold">어르신 번호 확인이 필요해요. 확인 전에는 알림이 가지 않아요.</p>
          <LinkButton href={`/seniors/${s.id}/verify`}>번호 확인하기</LinkButton>
        </div>
      )}

      {s.centers.length === 0 ? (
        <p className="text-xl">아직 고른 복지관이 없어요.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {s.centers.map((c) => (
            <CenterRow key={c.centerId} c={c} />
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-3">
        <LinkButton href={`/seniors/${s.id}/centers`} variant="secondary">
          복지관 고르기
        </LinkButton>
        <LinkButton href={`/seniors/${s.id}/guardians`} variant="secondary">
          보호자 {s.guardianCount}명
        </LinkButton>
        <Link href={`/seniors/${s.id}/edit`} className="py-2 text-center text-xl font-bold text-blue-800 underline">
          정보 수정·삭제
        </Link>
      </div>
    </section>
  );
}

function CenterRow({ c }: { c: HomeCenter }) {
  const p = c.period;
  if (!p) {
    return (
      <li className="rounded-xl bg-gray-100 p-3">
        <p className="text-xl font-bold">{c.centerName}</p>
        <p className="text-lg">아직 확정된 신청 기간이 없어요. 공지가 올라오면 알려 드릴게요.</p>
      </li>
    );
  }
  const today = todaySeoul();
  const schedule = (date: string, sent: boolean) =>
    sent ? "보냈어요" : date < today ? "지났어요" : `${slashMonthDay(date)} ${DAILY_SEND_TIME_KST} 예정`;

  return (
    <li className="flex flex-col gap-1 rounded-xl bg-gray-100 p-3 text-lg">
      <p className="text-xl font-bold">{c.centerName}</p>
      {p.phase === "open" ? (
        <p className="w-fit rounded-lg bg-green-700 px-3 py-1 text-xl font-bold text-white">신청 기간이에요</p>
      ) : (
        <p className="w-fit rounded-lg bg-blue-700 px-3 py-1 text-xl font-bold text-white">곧 신청 시작</p>
      )}
      <p>
        {p.label} 신청: {koMonthDay(p.applyStart)}
        {p.applyEnd ? ` ~ ${koMonthDay(p.applyEnd)}` : ""}
      </p>
      {hasValue(p.method) && <p>신청 방법: {p.method}</p>}
      <p>3일 전 알림: {schedule(p.remindAt, p.remindSent)}</p>
      <p>시작일 알림: {schedule(p.applyStart, p.startSent)}</p>
    </li>
  );
}
