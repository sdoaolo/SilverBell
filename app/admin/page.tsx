import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Loading } from "@/components/ui";
import { latestJobRun } from "@/lib/admin";
import { can, getActor } from "@/lib/authz";
import { maskPhone } from "@/lib/crypto/phone";
import { formatSeoulDateTime } from "@/lib/dates";
import { AdminDashboard } from "./dashboard";

const ROLE_LABEL = { super_admin: "최고 관리자", admin: "관리자", center_manager: "복지관 담당자" } as const;

export default function AdminPage() {
  return (
    <Suspense fallback={<Loading />}>
      <AdminHome />
    </Suspense>
  );
}

async function AdminHome() {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (!(await can(actor, "admin.access"))) notFound();

  const [canCreateCenter, canDeleteCenter, canManageAdmins, canReadAudit, lastJob] = await Promise.all([
    can(actor, "center.create"),
    can(actor, "center.delete", { centerId: null }),
    can(actor, "admin.manage"),
    can(actor, "audit.read"),
    latestJobRun(),
  ]);
  // center.delete는 담당자에게 없으므로 복지관 지정 없이 판단해도 된다
  const s = (lastJob?.summary ?? null) as Record<string, number | boolean> | null;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 text-base">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">관리자 화면</h1>
          <p className="text-sm text-gray-700">
            {actor.name ?? "이름 없음"} ({maskPhone(actor.phoneLast4)}) ·{" "}
            {actor.roles.map((r) => ROLE_LABEL[r.role]).join(", ")}
          </p>
        </div>
        <nav className="flex flex-wrap gap-3 text-sm font-semibold text-blue-800 underline">
          {canManageAdmins && <Link href="/admin/members">관리자 관리</Link>}
          {canReadAudit && <Link href="/admin/audit">감사 기록</Link>}
          <Link href="/home">내 홈</Link>
        </nav>
      </header>

      <section className="rounded-xl border border-gray-400 p-4 text-sm">
        <h2 className="mb-1 font-bold">마지막 자동 작업</h2>
        {lastJob ? (
          <p>
            {formatSeoulDateTime(lastJob.started_at)} ({lastJob.triggered_by === "cron" ? "자동" : "수동"}) ·{" "}
            {lastJob.error
              ? `오류: ${lastJob.error}`
              : s
                ? `발송 성공 ${s.sent ?? 0} · 실패 ${s.failed ?? 0} · 확인한 복지관 ${s.centersChecked ?? 0} · 새 공지 ${s.newNotices ?? 0}${s.hasMore ? " · 남은 작업 있음" : ""}`
                : "진행 중"}
          </p>
        ) : (
          <p>아직 실행 기록이 없어요.</p>
        )}
      </section>

      <AdminDashboard canCreateCenter={canCreateCenter} canDeleteCenter={canDeleteCenter} />
    </main>
  );
}
