import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Loading } from "@/components/ui";
import { can, getActor } from "@/lib/authz";
import { AuditList } from "./audit-list";

export default function AuditPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Audit />
    </Suspense>
  );
}

async function Audit() {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (!(await can(actor, "audit.read"))) notFound();
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6 text-base">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">감사 기록</h1>
        <Link href="/admin" className="text-sm font-semibold text-blue-800 underline">
          관리자 화면으로
        </Link>
      </header>
      <AuditList />
    </main>
  );
}
