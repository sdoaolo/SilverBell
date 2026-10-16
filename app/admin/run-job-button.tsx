"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { callApi } from "@/lib/client-api";
import { AConfirm, AError, ANote } from "./ui";

interface RunResult {
  summary: {
    sent: number;
    demo: number;
    failed: number;
    skipped: number;
    already: number;
    periods: { label: string; kind: string }[];
    hasMore: boolean;
  };
}

export function RunJobButton() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  return (
    <div className="flex flex-col gap-2">
      <AConfirm
        label="오늘 자동 작업 지금 실행"
        tone="primary"
        confirmLabel="실행"
        message="오늘 보낼 3일 전·시작일 알림을 지금 보내요. 이미 받은 사람에게는 다시 가지 않아요."
        onConfirm={async () => {
          setError("");
          setNote("");
          const res = await callApi<RunResult>("/api/admin/jobs/daily", "POST");
          if (!res.ok) return setError(res.error);
          const s = res.data.summary;
          const targets = s.periods.map((p) => `${p.label}(${p.kind === "d-day" ? "시작일" : "3일 전"})`).join(", ");
          setNote(
            `대상: ${targets || "오늘 보낼 기간 없음"} · 보냄 ${s.sent + s.demo}${s.demo ? "(시연)" : ""} · 실패 ${s.failed} · 제외 ${s.skipped} · 이미 보냄 ${s.already}${s.hasMore ? " · 남은 작업 있음(한 번 더 실행)" : ""}`,
          );
          router.refresh();
        }}
      />
      <AError>{error}</AError>
      <ANote>{note}</ANote>
    </div>
  );
}
