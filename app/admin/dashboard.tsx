"use client";

import { useCallback, useEffect, useState } from "react";
import { callApi } from "@/lib/client-api";
import { AButton, AConfirm, AError, AInput, ALabel, ANote, Pager, type Paged } from "./ui";

// ───────────────────────── 타입 ─────────────────────────

interface Center {
  id: string;
  slug: string;
  name: string;
  sido: string | null;
  sigungu: string | null;
  phone: string | null;
  homepage: string | null;
  notice_url: string | null;
  is_active: boolean;
  last_checked_at: string | null;
  last_check_error: string | null;
  subscribers: number;
}

interface Period {
  id: string;
  center_id: string;
  label: string;
  apply_start: string;
  apply_end: string | null;
  method: string | null;
  status: string;
  confidence: number | null;
  centerName: string;
  centerActive: boolean;
  notice: { url: string; title: string | null; source: string | null } | null;
  subscribers: number;
  phase: "before" | "open" | "ended";
  catchUp: "d-3" | "d-day" | null;
  d3SentAt: string | null;
  ddaySentAt: string | null;
}

interface LogRow {
  id: string;
  recipient: string;
  recipientType: string;
  channel: string;
  kind: string;
  status: string;
  error: string | null;
  createdAt: string;
}

const SOURCE_LABEL: Record<string, string> = { text: "글", image: "이미지", mixed: "글+이미지", pdf: "PDF" };
const STATUS_LABEL: Record<string, string> = {
  queued: "대기",
  sent: "보냄",
  failed: "실패",
  demo: "시연(안 보냄)",
  skipped: "제외",
};
const KIND_LABEL: Record<string, string> = {
  "d-3": "3일 전",
  "d-day": "시작일",
  manual: "수동",
  "admin-alert": "관리자 알림",
  test: "테스트",
};

const fmtDate = (ymd: string) => {
  const [, m, d] = ymd.split("-").map(Number);
  return `${m}/${d}`;
};
const fmtDateTime = (iso: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
const addDays = (ymd: string, n: number) => new Date(Date.parse(ymd) + n * 864e5).toISOString().slice(0, 10);
const range = (p: { apply_start: string; apply_end: string | null }) =>
  `${fmtDate(p.apply_start)} ~ ${p.apply_end ? fmtDate(p.apply_end) : "마감일 모름"}`;

function usePaged<T>(url: string) {
  const [page, setPage] = useState(0);
  const [data, setData] = useState<Paged<T> | null>(null);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    const sep = url.includes("?") ? "&" : "?";
    const res = await callApi<Paged<T>>(`${url}${sep}page=${page}`, "GET");
    if (!res.ok) return setError(res.error);
    setError("");
    setData(res.data);
  }, [url, page]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { data, error, page, setPage, reload };
}

// ───────────────────────── 대시보드 ─────────────────────────

type Tab = "pending" | "confirmed" | "centers" | "paste";

export function AdminDashboard({ canCreateCenter, canDeleteCenter }: { canCreateCenter: boolean; canDeleteCenter: boolean }) {
  const [tab, setTab] = useState<Tab>("pending");
  const tabs: { id: Tab; label: string }[] = [
    { id: "pending", label: "확인 대기" },
    { id: "confirmed", label: "확정된 기간" },
    { id: "centers", label: "복지관" },
    { id: "paste", label: "본문 붙여넣기" },
  ];
  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" className="flex flex-wrap gap-2 border-b border-gray-300 pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-4 py-2 text-sm font-bold ${tab === t.id ? "bg-blue-700 text-white" : "bg-gray-100"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "pending" && <PeriodList status="pending" />}
      {tab === "confirmed" && <PeriodList status="confirmed" />}
      {tab === "centers" && <CentersPanel canCreate={canCreateCenter} canDelete={canDeleteCenter} />}
      {tab === "paste" && <PastePanel onDone={() => setTab("pending")} />}
    </div>
  );
}

// ───────────────────────── 기간 목록 ─────────────────────────

function PeriodList({ status }: { status: "pending" | "confirmed" }) {
  const { data, error, page, setPage, reload } = usePaged<Period>(`/api/admin/periods?status=${status}`);
  const [adding, setAdding] = useState(false);
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">{status === "pending" ? "확인 대기" : "확정된 기간"}</h2>
        {!adding && <AButton onClick={() => setAdding(true)}>직접 추가</AButton>}
      </div>
      {adding && (
        <PeriodForm
          onCancel={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            reload();
          }}
        />
      )}
      <AError>{error}</AError>
      {data?.items.length === 0 && (
        <p className="text-sm text-gray-700">{status === "pending" ? "확인할 기간이 없어요." : "확정된 기간이 없어요."}</p>
      )}
      {data?.items.map((p) => (
        <PeriodCard key={p.id} p={p} onChange={reload} />
      ))}
      {data && <Pager page={page} total={data.total} pageSize={data.pageSize} onPage={setPage} />}
    </section>
  );
}

function PeriodCard({ p, onChange }: { p: Period; onChange: () => void }) {
  const [editing, setEditing] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  async function act(url: string, body?: unknown, done?: (data: Record<string, unknown>) => string) {
    setError("");
    setNote("");
    const res = await callApi<Record<string, unknown>>(url, "POST", body);
    if (!res.ok) return setError(res.error);
    if (done) setNote(done(res.data));
    onChange();
  }

  const summaryText = (s: Record<string, unknown>) =>
    `보냄 ${Number(s.sent ?? 0) + Number(s.demo ?? 0)} · 실패 ${s.failed ?? 0} · 제외 ${s.skipped ?? 0}${
      Number(s.demo ?? 0) > 0 ? " (시연 모드)" : ""
    }`;

  const confirmMessage = p.catchUp
    ? `확정하면 구독자 ${p.subscribers}명에게 지금 바로 ${p.catchUp === "d-day" ? "시작일" : "3일 전"} 알림이 가요.`
    : `확정하면 3일 전·시작일에 구독자 ${p.subscribers}명에게 자동으로 알림이 가요.`;

  const remind = addDays(p.apply_start, -3);

  return (
    <article className="flex flex-col gap-2 rounded-xl border border-gray-400 p-4 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-bold">
          {p.centerName} · {p.label}
        </h3>
        <span className="text-gray-700">
          {p.phase === "open" ? "신청 기간 중" : p.phase === "before" ? "시작 전" : "끝남"}
          {!p.centerActive && " · 비활성 복지관"}
        </span>
      </div>
      <p>
        신청 {range(p)} · 방법: {p.method || "모름"}
      </p>
      {p.status === "pending" && (
        <p className="text-gray-700">
          AI가 읽은 것: {p.notice?.source ? SOURCE_LABEL[p.notice.source] : "직접 입력·붙여넣기"}
          {p.confidence !== null && ` · 신뢰도 ${Math.round(p.confidence * 100)}%`}
          {p.notice && (
            <>
              {" · "}
              <a href={p.notice.url} target="_blank" rel="noreferrer" className="text-blue-800 underline">
                원문 보기{p.notice.title ? `: ${p.notice.title}` : ""}
              </a>
            </>
          )}
        </p>
      )}
      {p.status === "confirmed" && (
        <ul className="text-gray-800">
          <li>
            3일 전 알림:{" "}
            {p.d3SentAt ? `보냄 ${fmtDateTime(p.d3SentAt)}` : `${fmtDate(remind)} 09:00 예정`}
          </li>
          <li>
            시작일 알림:{" "}
            {p.ddaySentAt ? `보냄 ${fmtDateTime(p.ddaySentAt)}` : `${fmtDate(p.apply_start)} 09:00 예정`}
          </li>
          <li>구독 어르신 {p.subscribers}명</li>
        </ul>
      )}

      <AError>{error}</AError>
      <ANote>{note}</ANote>

      {editing ? (
        <PeriodForm
          period={p}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            onChange();
          }}
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          {p.status === "pending" && (
            <>
              <AConfirm
                label="확정"
                tone="primary"
                confirmLabel="확정"
                message={confirmMessage}
                onConfirm={() =>
                  act(`/api/admin/periods/${p.id}/confirm`, undefined, (d) => {
                    const sent = d.sent as Record<string, unknown> | null;
                    return sent ? `확정했어요. 따라잡기 발송: ${summaryText(sent)}` : "확정했어요";
                  })
                }
              />
              <AConfirm
                label="무시"
                confirmLabel="무시"
                message="이 기간을 무시할까요? 같은 공지를 다시 확인해도 올라오지 않아요."
                onConfirm={() => act(`/api/admin/periods/${p.id}/reject`)}
              />
            </>
          )}
          <AButton onClick={() => setEditing(true)}>수정</AButton>
          {p.status === "confirmed" && (
            <>
              <AButton
                onClick={() =>
                  act("/api/admin/test-send", { periodId: p.id }, (d) => `테스트: 전화 ${d.voice}, 문자 ${d.sms}`)
                }
              >
                내 폰으로 테스트 발송
              </AButton>
              <AConfirm
                label="지금 다시 보내기(수동)"
                tone="primary"
                confirmLabel="보내기"
                message={`구독자 ${p.subscribers}명과 보호자에게 지금 바로 전화·문자를 보낼까요?`}
                onConfirm={() => act("/api/admin/send-now", { periodId: p.id }, summaryText)}
              />
              <AConfirm
                label="확정 취소"
                confirmLabel="확정 취소"
                message="확정을 취소하면 자동 알림이 가지 않아요. 확인 대기로 돌아가요."
                onConfirm={() => act(`/api/admin/periods/${p.id}/unconfirm`)}
              />
              <AButton onClick={() => setShowLogs(!showLogs)}>{showLogs ? "발송 내역 닫기" : "발송 내역"}</AButton>
            </>
          )}
          <AConfirm
            label="삭제"
            confirmLabel="삭제"
            message="이 기간을 삭제할까요? 발송 내역도 함께 지워져요."
            onConfirm={async () => {
              const res = await callApi(`/api/admin/periods/${p.id}`, "DELETE");
              if (!res.ok) return setError(res.error);
              onChange();
            }}
          />
        </div>
      )}
      {showLogs && <PeriodLogs periodId={p.id} />}
    </article>
  );
}

function PeriodLogs({ periodId }: { periodId: string }) {
  const { data, error, page, setPage } = usePaged<LogRow>(`/api/admin/periods/${periodId}/logs`);
  return (
    <div className="flex flex-col gap-2 overflow-x-auto">
      <AError>{error}</AError>
      {data?.items.length === 0 && <p className="text-gray-700">발송 내역이 없어요.</p>}
      {data && data.items.length > 0 && (
        <table className="w-full min-w-[36rem] text-left text-xs">
          <thead>
            <tr className="border-b">
              <th className="py-1">시각</th>
              <th>받는 사람</th>
              <th>방법</th>
              <th>종류</th>
              <th>결과</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((l) => (
              <tr key={l.id} className="border-b align-top">
                <td className="py-1">{fmtDateTime(l.createdAt)}</td>
                <td>
                  {l.recipient} ({l.recipientType === "senior" ? "어르신" : l.recipientType === "guardian" ? "보호자" : "관리자"})
                </td>
                <td>{l.channel === "voice" ? "전화" : "문자"}</td>
                <td>{KIND_LABEL[l.kind] ?? l.kind}</td>
                <td className={l.status === "failed" ? "text-red-700" : ""}>
                  {STATUS_LABEL[l.status] ?? l.status}
                  {l.error && ` — ${l.error}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {data && <Pager page={page} total={data.total} pageSize={data.pageSize} onPage={setPage} />}
    </div>
  );
}

/** 기간 추가(복지관 선택) / 수정 */
function PeriodForm({ period, onSaved, onCancel }: { period?: Period; onSaved: () => void; onCancel: () => void }) {
  const [centerId, setCenterId] = useState(period?.center_id ?? "");
  const [label, setLabel] = useState(period?.label ?? "");
  const [start, setStart] = useState(period?.apply_start ?? "");
  const [end, setEnd] = useState(period?.apply_end ?? "");
  const [method, setMethod] = useState(period?.method ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="flex flex-col gap-3 rounded-lg bg-gray-50 p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const body = { label, apply_start: start, apply_end: end || null, method: method || null };
        const res = period
          ? await callApi(`/api/admin/periods/${period.id}`, "PATCH", body)
          : await callApi("/api/admin/periods", "POST", { centerId, period: body });
        setBusy(false);
        if (!res.ok) return setError(res.error);
        onSaved();
      }}
    >
      {!period && <CenterSelect value={centerId} onChange={setCenterId} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <ALabel label="기간 이름">
          <AInput value={label} onChange={(e) => setLabel(e.target.value)} placeholder="2026년 하반기" required />
        </ALabel>
        <ALabel label="신청 방법">
          <AInput value={method} onChange={(e) => setMethod(e.target.value)} placeholder="방문 접수(신분증 지참)" />
        </ALabel>
        <ALabel label="신청 시작일">
          <AInput type="date" value={start} onChange={(e) => setStart(e.target.value)} required />
        </ALabel>
        <ALabel label="마감일 (모르면 비움)">
          <AInput type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </ALabel>
      </div>
      {!period && <p className="text-xs text-gray-700">직접 추가한 기간은 확인 대기로 들어가요. 확정해야 알림이 가요.</p>}
      <AError>{error}</AError>
      <div className="flex gap-2">
        <AButton tone="primary" type="submit" disabled={busy || (!period && !centerId)}>
          {busy ? "저장 중…" : "저장"}
        </AButton>
        <AButton type="button" onClick={onCancel}>
          취소
        </AButton>
      </div>
    </form>
  );
}

function CenterSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [centers, setCenters] = useState<Center[]>([]);
  useEffect(() => {
    const t = setTimeout(async () => {
      const res = await callApi<Paged<Center>>(`/api/admin/centers?q=${encodeURIComponent(q)}`, "GET");
      if (res.ok) setCenters(res.data.items);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <ALabel label="복지관 찾기">
        <AInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="이름·지역" />
      </ALabel>
      <ALabel label="복지관">
        <select
          className="min-h-10 rounded-lg border border-gray-500 px-2 text-sm"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
        >
          <option value="">골라 주세요</option>
          {centers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.is_active ? "" : " (비활성)"}
            </option>
          ))}
        </select>
      </ALabel>
    </div>
  );
}

// ───────────────────────── 복지관 ─────────────────────────

function CentersPanel({ canCreate, canDelete }: { canCreate: boolean; canDelete: boolean }) {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const { data, error, page, setPage, reload } = usePaged<Center>(
    `/api/admin/centers?q=${encodeURIComponent(query)}`,
  );
  const [adding, setAdding] = useState(false);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <form
          className="flex flex-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(0);
            setQuery(q.trim());
          }}
        >
          <AInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="이름·지역 검색" />
          <AButton type="submit">찾기</AButton>
        </form>
        {canCreate && !adding && (
          <AButton tone="primary" onClick={() => setAdding(true)}>
            복지관 추가
          </AButton>
        )}
      </div>
      {adding && (
        <CenterForm
          onCancel={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            reload();
          }}
        />
      )}
      <AError>{error}</AError>
      {data?.items.length === 0 && <p className="text-sm text-gray-700">복지관이 없어요.</p>}
      {data?.items.map((c) => (
        <CenterCard key={c.id} c={c} canDelete={canDelete} onChange={reload} />
      ))}
      {data && <Pager page={page} total={data.total} pageSize={data.pageSize} onPage={setPage} />}
    </section>
  );
}

function CenterCard({ c, canDelete, onChange }: { c: Center; canDelete: boolean; onChange: () => void }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");

  async function patch(body: Partial<Center>) {
    setError("");
    const res = await callApi(`/api/admin/centers/${c.id}`, "PATCH", body);
    if (!res.ok) return setError(res.error);
    onChange();
  }

  return (
    <article className="flex flex-col gap-2 rounded-xl border border-gray-400 p-4 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-bold">
          {c.name} {!c.is_active && <span className="text-red-700">(비활성)</span>}
        </h3>
        <span className="text-gray-700">
          {[c.sido, c.sigungu].filter(Boolean).join(" ")} · 구독 {c.subscribers}명
        </span>
      </div>
      <p className="break-all text-gray-700">
        공지 게시판: {c.notice_url || "없음"} · 전화: {c.phone || "없음"}
      </p>
      <p className="text-gray-700">
        마지막 확인: {c.last_checked_at ? fmtDateTime(c.last_checked_at) : "아직 없음"}
        {c.last_check_error && <span className="text-red-700"> · {c.last_check_error}</span>}
      </p>
      <AError>{error}</AError>
      {editing ? (
        <CenterForm
          center={c}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            onChange();
          }}
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          <AButton onClick={() => setEditing(true)}>수정</AButton>
          {c.is_active ? (
            <AConfirm
              label="비활성"
              confirmLabel="비활성으로"
              message="비활성으로 바꾸면 이 복지관은 확인·발송 대상에서 빠지고 사용자 목록에서도 숨겨져요. 언제든 다시 켤 수 있어요."
              onConfirm={() => patch({ is_active: false })}
            />
          ) : (
            <AButton onClick={() => patch({ is_active: true })}>다시 활성</AButton>
          )}
          {canDelete && (
            <AConfirm
              label="삭제"
              confirmLabel="삭제"
              message={`구독 중인 어르신 ${c.subscribers}명의 알림이 끊겨요. 신청 기간과 발송 기록도 함께 지워져요. 실수 방지를 위해 먼저 "비활성"을 권장해요.`}
              onConfirm={async () => {
                const res = await callApi(`/api/admin/centers/${c.id}`, "DELETE");
                if (!res.ok) return setError(res.error);
                onChange();
              }}
            />
          )}
        </div>
      )}
    </article>
  );
}

function CenterForm({ center, onSaved, onCancel }: { center?: Center; onSaved: () => void; onCancel: () => void }) {
  const [f, setF] = useState({
    name: center?.name ?? "",
    slug: center?.slug ?? "",
    sido: center?.sido ?? "",
    sigungu: center?.sigungu ?? "",
    phone: center?.phone ?? "",
    homepage: center?.homepage ?? "",
    notice_url: center?.notice_url ?? "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const field = (key: keyof typeof f, label: string, placeholder = "") => (
    <ALabel label={label}>
      <AInput value={f[key]} placeholder={placeholder} onChange={(e) => setF({ ...f, [key]: e.target.value })} />
    </ALabel>
  );

  return (
    <form
      className="flex flex-col gap-3 rounded-lg bg-gray-50 p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const res = center
          ? await callApi(`/api/admin/centers/${center.id}`, "PATCH", f)
          : await callApi("/api/admin/centers", "POST", f);
        setBusy(false);
        if (!res.ok) return setError(res.error);
        onSaved();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {field("name", "이름", "시립중랑노인복지관")}
        {field("slug", "slug (영어, 비우면 자동)", "jungnang")}
        {field("sido", "시·도", "서울특별시")}
        {field("sigungu", "시·군·구", "중랑구")}
        {field("phone", "전화", "02-000-0000")}
        {field("homepage", "홈페이지", "https://")}
      </div>
      {field("notice_url", "공지사항 게시판 목록 주소", "https://")}
      <AError>{error}</AError>
      <div className="flex gap-2">
        <AButton tone="primary" type="submit" disabled={busy || !f.name.trim()}>
          {busy ? "저장 중…" : "저장"}
        </AButton>
        <AButton type="button" onClick={onCancel}>
          취소
        </AButton>
      </div>
    </form>
  );
}

// ───────────────────────── 본문 붙여넣기 ─────────────────────────

function PastePanel({ onDone }: { onDone: () => void }) {
  const [centerId, setCenterId] = useState("");
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <section className="flex flex-col gap-3 text-sm">
      <p className="text-gray-700">
        게시판을 자동으로 읽지 못할 때, 공지 글을 붙여넣거나 포스터 이미지(jpg·png·webp, 최대 4장)를 올리면 AI가 신청
        기간을 뽑아 확인 대기에 넣어요. 올린 이미지는 저장하지 않아요.
      </p>
      <CenterSelect value={centerId} onChange={setCenterId} />
      <ALabel label="공지 글">
        <textarea
          className="min-h-48 rounded-lg border border-gray-500 p-3 text-sm"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="공지 본문을 붙여넣으세요"
        />
      </ALabel>
      <ALabel label="이미지">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 4))}
        />
      </ALabel>
      {files.length > 0 && <p>{files.length}장 선택됨</p>}
      <AError>{error}</AError>
      <ANote>{note}</ANote>
      <div className="flex gap-2">
        <AButton
          tone="primary"
          disabled={busy || !centerId || (!text.trim() && files.length === 0)}
          onClick={async () => {
            setBusy(true);
            setError("");
            setNote("");
            const form = new FormData();
            form.set("centerId", centerId);
            form.set("text", text);
            for (const f of files) form.append("images", f);
            try {
              const res = await fetch("/api/admin/analyze", { method: "POST", body: form });
              const json = await res.json().catch(() => ({}));
              if (!res.ok) return setError(json.error ?? "분석하지 못했어요");
              const r = json.result as { isRecruitment: boolean; periods: unknown[]; confidence: number };
              if (!r.isRecruitment || r.periods.length === 0) {
                setNote("모집 공지가 아니거나 신청 기간을 찾지 못했어요.");
              } else {
                setNote(
                  `기간 ${r.periods.length}개를 찾았어요 (새로 추가 ${json.created}개, 신뢰도 ${Math.round(r.confidence * 100)}%). 확인 대기에서 확인해 주세요.`,
                );
                setText("");
                setFiles([]);
              }
            } catch {
              setError("인터넷 연결을 확인해 주세요");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "분석 중… (최대 1분)" : "분석하기"}
        </AButton>
        {note && <AButton onClick={onDone}>확인 대기 보기</AButton>}
      </div>
    </section>
  );
}
