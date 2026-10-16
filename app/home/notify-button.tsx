"use client";

import { useState } from "react";
import { Button, ErrorText } from "@/components/ui";
import { callApi } from "@/lib/client-api";

interface Summary {
  sent: number;
  failed: number;
  skipped: number;
  demo: number;
}

export function NotifyButton({ seniorId, periodId }: { seniorId: string; periodId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");

  return (
    <div className="mt-2 flex flex-col gap-2">
      <Button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          setResult("");
          const res = await callApi<Summary>("/api/notify", "POST", { seniorId, periodId });
          setBusy(false);
          if (!res.ok) return setError(res.error);
          const s = res.data;
          const done = s.sent + s.demo;
          const parts = [`${done}건 보냈어요`];
          if (s.demo) parts.push("(시연 모드라 실제로는 가지 않았어요)");
          if (s.failed) parts.push(`${s.failed}건 실패`);
          if (s.skipped) parts.push(`${s.skipped}건 제외`);
          setResult(parts.join(" "));
        }}
      >
        {busy ? "보내는 중…" : "지금 한 번 더 알리기"}
      </Button>
      <ErrorText>{error}</ErrorText>
      {result && (
        <p role="status" className="text-xl font-bold text-green-800">
          {result}
        </p>
      )}
    </div>
  );
}
