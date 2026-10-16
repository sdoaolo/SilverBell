"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, ErrorText, LinkButton, TextInput } from "@/components/ui";
import { callApi } from "@/lib/client-api";

interface Center {
  id: string;
  name: string;
  sido: string | null;
  sigungu: string | null;
}

interface SearchResult {
  items: Center[];
  total: number;
  page: number;
  pageSize: number;
}

const region = (c: Center) =>
  [c.sido, c.sigungu].filter((v) => v && !v.toUpperCase().startsWith("TODO")).join(" ");

export function CenterPicker({ seniorId, initialSubscribed }: { seniorId: string; initialSubscribed: string[] }) {
  const [subscribed, setSubscribed] = useState(new Set(initialSubscribed));
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await callApi<SearchResult>(
      `/api/centers?q=${encodeURIComponent(query)}&page=${page}`,
      "GET",
    );
    if (!res.ok) return setError(res.error);
    setError("");
    setResult(res.data);
  }, [query, page]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(centerId: string) {
    const on = subscribed.has(centerId);
    setBusyId(centerId);
    const res = await callApi(`/api/seniors/${seniorId}/subscriptions`, on ? "DELETE" : "POST", { centerId });
    setBusyId(null);
    if (!res.ok) return setError(res.error);
    const next = new Set(subscribed);
    if (on) next.delete(centerId);
    else next.add(centerId);
    setSubscribed(next);
  }

  const lastPage = result ? Math.max(0, Math.ceil(result.total / result.pageSize) - 1) : 0;

  return (
    <div className="flex flex-col gap-5">
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(0);
          setQuery(q.trim());
        }}
      >
        <TextInput
          type="search"
          placeholder="복지관 이름이나 지역 (예: 중랑)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="복지관 검색"
        />
        <Button type="submit" variant="secondary">
          찾기
        </Button>
      </form>

      <ErrorText>{error}</ErrorText>
      {!result && <p className="text-xl">불러오는 중이에요…</p>}
      {result && result.items.length === 0 && <p className="text-xl">찾는 복지관이 없어요.</p>}

      <ul className="flex flex-col gap-3">
        {result?.items.map((c) => {
          const on = subscribed.has(c.id);
          return (
            <li key={c.id}>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                disabled={busyId === c.id}
                onClick={() => toggle(c.id)}
                className={`flex min-h-16 w-full items-center justify-between gap-3 rounded-xl border-2 px-4 py-3 text-left ${
                  on ? "border-brand-600 bg-brand-50" : "border-line bg-white"
                }`}
              >
                <span className="flex flex-col">
                  <span className="text-xl font-bold">{c.name}</span>
                  {region(c) && <span className="text-lg text-muted">{region(c)}</span>}
                </span>
                <span className={`shrink-0 text-xl font-bold ${on ? "text-brand-700" : "text-muted"}`}>
                  {on ? "✔ 받는 중" : "받기"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {result && lastPage > 0 && (
        <div className="flex gap-3">
          <Button variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>
            이전 목록
          </Button>
          <Button variant="secondary" disabled={page >= lastPage} onClick={() => setPage(page + 1)}>
            다음 목록
          </Button>
        </div>
      )}

      <LinkButton href="/home">다 골랐어요</LinkButton>
    </div>
  );
}
