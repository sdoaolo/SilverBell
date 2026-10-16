import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Supabase 클라이언트는 이 파일에서만 만든다. 서버 전용, service role key 사용.
// service role key는 NEXT_PUBLIC_ 이름으로 절대 읽지 않는다.

let client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 설정하세요");
  }
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

/** Postgres unique 위반 (중복 발송 방지 등에 사용) */
export function isUniqueViolation(error: { code?: string } | null | undefined): boolean {
  return error?.code === "23505";
}
