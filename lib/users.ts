import "server-only";
import { isUniqueViolation, db } from "./db";
import { phoneColumns, phoneHash } from "./crypto/phone";

/** 번호로 계정을 찾고, 없으면 만든다 (로그인·보호자 추가·관리자 추가에서 공통 사용) */
export async function findOrCreateUser(
  phone: string,
  name?: string | null,
): Promise<{ id: string; name: string | null; created: boolean }> {
  const hash = phoneHash(phone);
  const existing = await db().from("users").select("id, name").eq("phone_hash", hash).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return { ...existing.data, created: false };

  const inserted = await db()
    .from("users")
    .insert({ ...phoneColumns(phone), name: name?.trim() || null })
    .select("id, name")
    .single();
  if (inserted.error) {
    // 동시에 같은 번호로 만들어졌으면 그 행을 쓴다
    if (!isUniqueViolation(inserted.error)) throw inserted.error;
    const again = await db().from("users").select("id, name").eq("phone_hash", hash).single();
    if (again.error) throw again.error;
    return { ...again.data, created: false };
  }
  return { ...inserted.data, created: true };
}
