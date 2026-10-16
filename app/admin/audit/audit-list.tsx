"use client";

import { useEffect, useState } from "react";
import { callApi } from "@/lib/client-api";
import { AError, Pager, type Paged } from "../ui";

interface AuditRow {
  id: string;
  actor: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  detail: Record<string, unknown> | null;
  created_at: string;
}

const ACTION_LABEL: Record<string, string> = {
  "admin.bootstrap": "첫 최고 관리자 부여",
  "admin.grant": "관리자 추가",
  "admin.change": "역할 변경",
  "admin.revoke": "역할 회수",
  "center.create": "복지관 추가",
  "center.delete": "복지관 삭제",
  "center.activate": "복지관 활성",
  "center.deactivate": "복지관 비활성",
  "period.create": "기간 직접 추가",
  "period.confirm": "기간 확정",
  "period.unconfirm": "확정 취소",
  "period.reject": "기간 무시",
  "period.delete": "기간 삭제",
  "period.send": "수동 발송",
  "job.run": "자동 작업 실행",
};

const fmt = (iso: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));

export function AuditList() {
  const [page, setPage] = useState(0);
  const [data, setData] = useState<Paged<AuditRow> | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    callApi<Paged<AuditRow>>(`/api/admin/audit?page=${page}`, "GET").then((res) => {
      if (!res.ok) return setError(res.error);
      setError("");
      setData(res.data);
    });
  }, [page]);

  return (
    <div className="flex flex-col gap-3 text-sm">
      <AError>{error}</AError>
      {data?.items.length === 0 && <p>기록이 없어요.</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[48rem] text-left">
          <thead>
            <tr className="border-b">
              <th className="py-2">시각</th>
              <th>누가</th>
              <th>무엇을</th>
              <th>내용</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((a) => (
              <tr key={a.id} className="border-b align-top">
                <td className="py-2 whitespace-nowrap">{fmt(a.created_at)}</td>
                <td>{a.actor}</td>
                <td>{ACTION_LABEL[a.action] ?? a.action}</td>
                <td className="break-all font-mono text-xs">{a.detail ? JSON.stringify(a.detail) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data && <Pager page={page} total={data.total} pageSize={data.pageSize} onPage={setPage} />}
    </div>
  );
}
