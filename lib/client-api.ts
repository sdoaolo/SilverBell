// 브라우저에서 우리 API를 부를 때 쓰는 작은 도우미. 실패하면 서버가 준 한국어 문구를 돌려준다.
export async function callApi<T = unknown>(
  url: string,
  method: "GET" | "POST" | "PATCH" | "DELETE" = "POST",
  body?: unknown,
): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number }> {
  try {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: json.error ?? "잠시 후 다시 시도해 주세요", status: res.status };
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, error: "인터넷 연결을 확인해 주세요", status: 0 };
  }
}
