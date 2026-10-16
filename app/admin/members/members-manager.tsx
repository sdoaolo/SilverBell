"use client";

import { useCallback, useEffect, useState } from "react";
import { callApi } from "@/lib/client-api";
import { CenterSelect } from "../dashboard";
import { AButton, AConfirm, AError, AInput, ALabel, ANote, Pager, type Paged } from "../ui";

type Role = "super_admin" | "admin" | "center_manager";
const ROLE_LABEL: Record<Role, string> = {
  super_admin: "최고 관리자",
  admin: "관리자",
  center_manager: "복지관 담당자",
};

interface Member {
  id: string;
  userId: string;
  name: string | null;
  phone: string;
  role: Role;
  centerName: string | null;
  grantedBy: string | null;
  createdAt: string;
  lastLoginAt: string | null;
}

const fmt = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("ko-KR", {
        timeZone: "Asia/Seoul",
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(iso))
    : "-";

function RolePicker({
  role,
  centerId,
  onRole,
  onCenter,
}: {
  role: Role;
  centerId: string;
  onRole: (r: Role) => void;
  onCenter: (id: string) => void;
}) {
  return (
    <>
      <ALabel label="역할">
        <select
          className="min-h-10 rounded-lg border border-zinc-300 px-2 text-sm"
          value={role}
          onChange={(e) => onRole(e.target.value as Role)}
        >
          <option value="admin">관리자</option>
          <option value="super_admin">최고 관리자</option>
          <option value="center_manager">복지관 담당자</option>
        </select>
      </ALabel>
      {role === "center_manager" && <CenterSelect value={centerId} onChange={onCenter} />}
    </>
  );
}

export function MembersManager({ myUserId }: { myUserId: string }) {
  const [page, setPage] = useState(0);
  const [data, setData] = useState<Paged<Member> | null>(null);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    const res = await callApi<Paged<Member>>(`/api/admin/members?page=${page}`, "GET");
    if (!res.ok) return setError(res.error);
    setError("");
    setData(res.data);
  }, [page]);
  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <div className="flex flex-col gap-4 text-sm">
      <AddMember onAdded={reload} />
      <AError>{error}</AError>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[48rem] text-left">
          <thead>
            <tr className="border-b">
              <th className="py-2">이름</th>
              <th>번호</th>
              <th>역할</th>
              <th>추가한 사람</th>
              <th>추가일</th>
              <th>마지막 로그인</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((m) => (
              <MemberRow key={m.id} m={m} isMe={m.userId === myUserId} onChange={reload} />
            ))}
          </tbody>
        </table>
      </div>
      {data && <Pager page={page} total={data.total} pageSize={data.pageSize} onPage={setPage} />}
    </div>
  );
}

function MemberRow({ m, isMe, onChange }: { m: Member; isMe: boolean; onChange: () => void }) {
  const [editing, setEditing] = useState(false);
  const [role, setRole] = useState<Role>(m.role);
  const [centerId, setCenterId] = useState("");
  const [error, setError] = useState("");

  return (
    <tr className="border-b align-top">
      <td className="py-2">
        {m.name ?? <span className="text-muted">아직 로그인 전</span>}
        {isMe && " (나)"}
      </td>
      <td>{m.phone}</td>
      <td>
        {ROLE_LABEL[m.role]}
        {m.centerName && ` · ${m.centerName}`}
      </td>
      <td>{m.grantedBy ?? "-"}</td>
      <td>{fmt(m.createdAt)}</td>
      <td>{fmt(m.lastLoginAt)}</td>
      <td className="flex flex-col gap-2 py-2">
        {editing ? (
          <div className="flex w-64 flex-col gap-2">
            <RolePicker role={role} centerId={centerId} onRole={setRole} onCenter={setCenterId} />
            <div className="flex gap-2">
              <AButton
                tone="primary"
                onClick={async () => {
                  setError("");
                  const res = await callApi(`/api/admin/members/${m.id}`, "PATCH", {
                    role,
                    centerId: role === "center_manager" ? centerId : null,
                  });
                  if (!res.ok) return setError(res.error);
                  setEditing(false);
                  onChange();
                }}
              >
                저장
              </AButton>
              <AButton onClick={() => setEditing(false)}>취소</AButton>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <AButton onClick={() => setEditing(true)}>역할 변경</AButton>
            <AConfirm
              label="회수"
              confirmLabel="회수"
              message={`${m.name ?? m.phone}의 ${ROLE_LABEL[m.role]} 역할을 회수할까요? 바로 관리자 화면에 들어올 수 없게 돼요.`}
              onConfirm={async () => {
                setError("");
                const res = await callApi(`/api/admin/members/${m.id}`, "DELETE");
                if (!res.ok) return setError(res.error);
                onChange();
              }}
            />
          </div>
        )}
        <AError>{error}</AError>
      </td>
    </tr>
  );
}

function AddMember({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<Role>("admin");
  const [centerId, setCenterId] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <div className="flex flex-col gap-2">
        <ANote>{note}</ANote>
        <AButton tone="primary" className="w-fit" onClick={() => setOpen(true)}>
          관리자 추가
        </AButton>
      </div>
    );
  }
  return (
    <form
      className="flex flex-col gap-3 rounded-lg bg-brand-50 p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const res = await callApi<{ smsStatus: string }>("/api/admin/members", "POST", {
          phone,
          role,
          centerId: role === "center_manager" ? centerId : null,
        });
        setBusy(false);
        if (!res.ok) return setError(res.error);
        setNote(`추가했어요. 안내 문자: ${res.data.smsStatus}`);
        setPhone("");
        setOpen(false);
        onAdded();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <ALabel label="전화번호">
          <AInput
            type="tel"
            inputMode="numeric"
            placeholder="010-1234-5678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </ALabel>
        <RolePicker role={role} centerId={centerId} onRole={setRole} onCenter={setCenterId} />
      </div>
      <p className="text-xs text-muted">
        추가한 번호로 &ldquo;관리자로 추가되었어요&rdquo; 문자가 가요. 시연 중에는 그 번호가 ALLOW_PHONES에 있어야 로그인할 수 있어요.
      </p>
      <AError>{error}</AError>
      <div className="flex gap-2">
        <AButton tone="primary" type="submit" disabled={busy || phone.replace(/\D/g, "").length < 10}>
          {busy ? "추가 중…" : "추가"}
        </AButton>
        <AButton type="button" onClick={() => setOpen(false)}>
          취소
        </AButton>
      </div>
    </form>
  );
}
