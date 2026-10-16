import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { Loading } from "@/components/ui";
import { can, getActor } from "@/lib/authz";
import { maskPhone } from "@/lib/crypto/phone";

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

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-8 text-base">
      <h1 className="text-2xl font-bold">관리자 화면</h1>
      <p className="mt-2">
        {actor.name ?? "이름 없음"} ({maskPhone(actor.phoneLast4)}) ·{" "}
        {actor.roles.map((r) => ROLE_LABEL[r.role]).join(", ")}
      </p>
    </main>
  );
}
