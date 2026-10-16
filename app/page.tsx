import Link from "next/link";
import { ListenButton } from "@/components/listen-button";
import { MAX_GUARDIANS_PER_SENIOR } from "@/lib/config";
import { voiceOpen } from "@/lib/messages";

// 실제로 나가는 ARS 문구와 같은 함수로 만든 예시
const SAMPLE_VOICE = voiceOpen({
  centerName: "시립중랑노인복지관",
  label: "2026년 하반기",
  applyStart: "2026-10-20",
  applyEnd: null,
  method: null,
  centerPhone: null,
});

const primaryCta =
  "inline-flex min-h-16 w-full items-center justify-center rounded-2xl px-8 text-xl font-black transition-all sm:w-auto";

function SectionTitle({ eyebrow, title, desc }: { eyebrow?: string; title: string; desc?: string }) {
  return (
    <div className="flex flex-col gap-2">
      {eyebrow && (
        <span className="w-fit rounded-md bg-brand-100 px-2.5 py-1 text-sm font-bold text-brand-600">{eyebrow}</span>
      )}
      <h2 className="text-3xl font-black tracking-tight sm:text-4xl">{title}</h2>
      {desc && <p className="text-xl text-muted">{desc}</p>}
    </div>
  );
}

function Box({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[28px] border border-line bg-white p-6 shadow-xs sm:p-9 ${className}`}>{children}</div>
  );
}

export default function Landing() {
  return (
    <>
      <main id="top" className="mx-auto flex w-full max-w-[1240px] flex-1 flex-col gap-12 px-4 py-8 sm:px-6 md:gap-16 md:py-12">
        {/* 히어로 */}
        <section className="relative flex flex-wrap items-center gap-8 overflow-hidden rounded-[32px] bg-gradient-to-r from-brand-500 to-[#4A7360] p-6 text-white shadow-2xl shadow-brand-700/20 sm:p-10 md:p-14">
          <div className="pointer-events-none absolute -top-20 -right-20 h-80 w-80 rounded-full bg-white/5 blur-3xl" aria-hidden />
          <div className="z-10 flex min-w-[260px] flex-1 flex-col gap-5">
            <p className="text-lg font-bold text-[#E2ECE5]">어르신 전용 안심 알림 서비스</p>
            <h1 className="text-[2rem] leading-[1.25] font-black tracking-tight sm:text-5xl">
              복지관 신청 날짜,
              <br />
              이제 전화로 먼저 알려드려요
            </h1>
            <p className="text-xl leading-relaxed font-medium text-[#EAF2ED]">
              날짜를 따로 적어 두지 않으셔도 돼요. 신청 3일 전과 신청 첫날 아침, 어르신께 전화로 알려 드려요.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link href="/login" className={`${primaryCta} bg-white text-[#4A7360] shadow-lg hover:bg-brand-50`}>
                전화번호로 시작하기
              </Link>
              <a
                href="#how"
                className={`${primaryCta} border-2 border-white/75 text-white hover:border-white hover:bg-white/10`}
              >
                어떻게 알려 주나요?
              </a>
            </div>
            <ul className="flex flex-wrap gap-2 pt-1 text-base text-[#D3E4DA]">
              {["버튼 없이 듣기만 하면 끝", "보호자에게 같은 내용 문자", "어르신 번호 확인 후에만 발송"].map((t) => (
                <li key={t} className="inline-flex items-center gap-2 rounded-full bg-black/15 px-3 py-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-300" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* 걸려 온 전화 미리보기 */}
          <div className="z-10 flex w-full shrink-0 flex-col gap-4 rounded-3xl border border-white/35 bg-white/15 p-6 shadow-xl backdrop-blur-md lg:w-[360px]">
            <div className="flex items-center justify-between text-base font-medium text-white/90">
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 animate-ping rounded-full bg-emerald-400" aria-hidden />
                걸려 온 전화
              </span>
              <span>오전 9:00</span>
            </div>
            <p className="text-2xl font-black">복지관 효도알림</p>
            <blockquote className="rounded-2xl border border-white/80 bg-white p-5 text-xl leading-relaxed font-semibold text-ink shadow-inner">
              &ldquo;{SAMPLE_VOICE}&rdquo;
            </blockquote>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-base text-white/90">한 번 읽고 바로 끊겨요</span>
              <ListenButton
                text={SAMPLE_VOICE}
                className="min-h-12 rounded-xl bg-white px-4 text-base font-bold text-[#4A7360] hover:bg-brand-50"
              />
            </div>
          </div>
        </section>

        {/* 알림 방법 */}
        <section id="how" className="flex scroll-mt-32 flex-col gap-6">
          <SectionTitle title="알림을 어떻게 받으실래요?" desc="어르신과 보호자가 각자 편한 방법을 고를 수 있어요." />
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {[
              { icon: "☎", title: "전화 (음성 안내)", body: "정해진 날 아침 9시에 전화가 와서 안내를 읽어 드려요. 버튼을 누를 필요가 없어요." },
              { icon: "✉", title: "문자", body: "복지관 이름, 신청 기간, 신청 방법, 문의 전화를 문자로 보내 드려요." },
              { icon: "★", title: "전화와 문자 둘 다", body: "전화로 듣고, 날짜는 문자로 다시 확인할 수 있어요. 가장 확실해요." },
            ].map((c) => (
              <Box key={c.title} className="flex flex-col gap-3">
                <span aria-hidden className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-3xl text-brand-600">
                  {c.icon}
                </span>
                <h3 className="text-2xl font-black">{c.title}</h3>
                <p className="text-xl leading-relaxed text-muted">{c.body}</p>
              </Box>
            ))}
          </div>
        </section>

        {/* 알림 일정 예시 */}
        <section className="flex flex-col gap-6">
          <SectionTitle eyebrow="예시" title="이렇게 알려 드려요" desc="다니시는 복지관의 다음 신청 기간을 미리 챙겨 드려요." />
          <Box className="flex flex-col gap-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-lg text-muted">○○노인복지관</p>
                <h3 className="text-3xl font-black tracking-tight">2026년 하반기 프로그램 신청</h3>
              </div>
              <span className="inline-flex min-h-11 items-center rounded-full border border-[#C3D2EA] bg-[#E8EEF8] px-4 text-lg font-bold text-[#1E3A6B]">
                신청 알림 예약됨
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="flex flex-col gap-1 rounded-2xl border border-zinc-100 bg-[#F8F8FA] p-5">
                <span className="text-lg font-medium text-muted">신청 기간</span>
                <span className="text-2xl font-black">10월 20일 ~ 10월 24일</span>
              </div>
              <div className="flex flex-col gap-1 rounded-2xl border border-zinc-100 bg-[#F8F8FA] p-5">
                <span className="text-lg font-medium text-muted">신청 방법</span>
                <span className="text-2xl font-black">복지관 방문 접수</span>
              </div>
              <div className="flex flex-col gap-1.5 rounded-2xl border border-brand-200 bg-brand-50 p-5">
                <span className="text-lg font-bold text-brand-700">알림 일정</span>
                <span className="text-xl font-black">✓ 10월 17일 · 3일 전 전화</span>
                <span className="text-xl font-black">✓ 10월 20일 · 신청 첫날 전화</span>
              </div>
            </div>
          </Box>
        </section>

        {/* 보호자 */}
        <section id="guardian" className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Box className="flex flex-col justify-between gap-6">
            <div className="flex flex-col gap-4">
              <p className="text-lg font-bold text-brand-700">보호자(자녀)분께</p>
              <h2 className="text-3xl leading-tight font-black tracking-tight sm:text-4xl">
                한 번 등록하면
                <br />
                부모님 일정은 저희가 챙겨요
              </h2>
              <p className="text-xl leading-relaxed text-ink/80">
                어머니께는 전화가, 자녀분께는 같은 내용의 문자가 갑니다. 형제자매가 함께 받을 수도 있어요 (어르신 한 분당
                보호자 {MAX_GUARDIANS_PER_SENIOR}명까지).
              </p>
              <ul className="flex flex-col gap-2 text-lg text-muted">
                <li>✓ 신청일을 놓쳐 다음 모집까지 6개월을 기다리지 않도록</li>
                <li>✓ 바빠서 깜빡해도 정해진 날 자동으로 알려 드려요</li>
                <li>✓ 광고 없이 복지관 신청 일정만 전해 드려요</li>
              </ul>
            </div>
            <Link href="/login" className={`${primaryCta} bg-brand-600 text-white shadow-sm hover:bg-brand-700 sm:w-full`}>
              부모님 알림 등록하기
            </Link>
          </Box>
          <Box className="flex flex-col justify-center gap-6">
            <span className="w-fit rounded-md bg-brand-100 px-3 py-1 text-base font-bold text-brand-600">간단한 3단계</span>
            <ol className="flex flex-col gap-6">
              {[
                ["전화번호로 시작", "문자로 받은 6자리 번호만 입력하면 가입 끝"],
                ["부모님 성함과 번호 등록", "부모님 휴대폰으로 간 확인 번호를 입력"],
                ["다니시는 복지관 고르기", "이름이나 지역으로 찾아서 누르면 끝"],
              ].map(([title, desc], i) => (
                <li key={title} className="flex items-start gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-navy-900 text-xl font-black text-white">
                    {i + 1}
                  </span>
                  <span className="flex flex-col">
                    <strong className="text-2xl font-black">{title}</strong>
                    <span className="text-lg text-muted">{desc}</span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="rounded-2xl border border-zinc-200 bg-[#F8F8FA] p-4 text-lg text-muted">
              어르신 본인이 직접 등록하실 때도 똑같이 간편해요.
            </p>
          </Box>
        </section>

        {/* 안심 운영 */}
        <section id="trust" className="flex flex-col gap-6">
          <SectionTitle title="안심하고 쓰실 수 있어요" />
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {[
              ["사람이 한 번 더 확인", "복지관 공지에서 찾은 날짜는 담당자가 원문과 대조해 확정한 뒤에만 알림이 나가요."],
              ["어르신 번호 확인", "어르신 휴대폰으로 간 확인 번호가 맞아야 알림이 시작돼요. 잘못된 번호로 전화가 가지 않아요."],
              ["언제든 그만 받기", "이름과 번호만 받고, 등록을 삭제하거나 탈퇴하면 정보가 바로 지워져요."],
            ].map(([title, body]) => (
              <Box key={title} className="flex flex-col gap-3">
                <span aria-hidden className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-2xl font-black text-brand-600">
                  ✓
                </span>
                <h3 className="text-2xl font-black">{title}</h3>
                <p className="text-xl leading-relaxed text-muted">{body}</p>
              </Box>
            ))}
          </div>
        </section>

        {/* 마무리 */}
        <section className="flex flex-col items-center gap-5 rounded-[32px] bg-navy-900 p-8 text-center text-white sm:p-12">
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl">다음 모집은 놓치지 마세요</h2>
          <p className="text-xl text-zinc-300">전화번호만 있으면 1분이면 등록할 수 있어요.</p>
          <Link href="/login" className={`${primaryCta} bg-brand-600 text-white hover:bg-brand-500`}>
            전화번호로 시작하기
          </Link>
        </section>
      </main>

      <footer className="border-t border-line bg-white px-4 py-8 text-center text-base text-muted">
        <p className="font-bold text-ink">복지관 효도알림 · SilverBell</p>
        <p>복지관 신청 기간을 어르신과 보호자에게 전화와 문자로 알려 드리는 서비스</p>
      </footer>
    </>
  );
}
