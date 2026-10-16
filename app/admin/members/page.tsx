import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Loading } from "@/components/ui";
import { can, getActor } from "@/lib/authz";
import { MembersManager } from "./members-manager";

export default function MembersPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Members />
    </Suspense>
  );
}

async function Members() {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (!(await can(actor, "admin.manage"))) notFound();
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6 text-base">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">관리자 관리</h1>
        <Link href="/admin" className="text-sm font-semibold text-brand-700 underline">
          관리자 화면으로
        </Link>
      </header>
      <MembersManager myUserId={actor.id} />
    </main>
  );
}
