// 삭제 동작 확인 (실제 DB, 가짜 번호 사용 — 문자는 보내지 않음)
// 실행: npx tsx --conditions=react-server scripts/cascade-check.mts
//  1) owner가 나가면 가장 먼저 추가된 보호자가 owner로 승계
//  2) 어르신 삭제 시 구독·발송 기록·보호자 연결 함께 삭제
//  3) 탈퇴: 유일한 보호자인 어르신은 삭제, 다른 보호자가 있으면 연결만 끊김
import { existsSync } from "node:fs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const { db } = await import("../lib/db.ts");
const { phoneColumns } = await import("../lib/crypto/phone.ts");
const { removeGuardian, deleteSenior, withdrawUser } = await import("../lib/seniors.ts");

const FAKE = ["01000000901", "01000000902", "01000000903"];
let failures = 0;
function check(label: string, cond: boolean) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) failures++;
}

async function makeUser(phone: string, name: string) {
  const { data, error } = await db().from("users").insert({ ...phoneColumns(phone), name }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

async function makeSenior(name: string, guardians: string[]) {
  const { data, error } = await db()
    .from("seniors")
    .insert({ name, ...phoneColumns(FAKE[2]), verified_at: new Date().toISOString(), agreed_at: new Date().toISOString() })
    .select("id")
    .single();
  if (error) throw error;
  for (const [i, uid] of guardians.entries()) {
    const r = await db().from("senior_guardians").insert({
      senior_id: data.id,
      user_id: uid,
      relation: i === 0 ? "owner" : "member",
      verified_at: new Date(Date.now() + i * 1000).toISOString(),
      created_at: new Date(Date.now() + i * 1000).toISOString(),
    });
    if (r.error) throw r.error;
  }
  return data.id as string;
}

async function count(table: string, column: string, value: string) {
  const { count, error } = await db().from(table).select("*", { count: "exact", head: true }).eq(column, value);
  if (error) throw error;
  return count ?? 0;
}

const userIds: string[] = [];
try {
  const { data: period } = await db().from("periods").select("id, center_id").limit(1).single();
  const u1 = await makeUser(FAKE[0], "테스트1");
  const u2 = await makeUser(FAKE[1], "테스트2");
  userIds.push(u1, u2);

  // 1) owner 승계
  const s1 = await makeSenior("승계테스트", [u1, u2]);
  await removeGuardian(s1, u1);
  const { data: link } = await db().from("senior_guardians").select("relation").eq("senior_id", s1).eq("user_id", u2).single();
  check("owner가 나가면 다음 보호자가 owner가 됨", link?.relation === "owner");
  await removeGuardian(s1, u2);
  check("마지막 보호자가 나가면 어르신 삭제", (await count("seniors", "id", s1)) === 0);

  // 2) 어르신 삭제 cascade
  const s2 = await makeSenior("삭제테스트", [u1]);
  await db().from("subscriptions").insert({ senior_id: s2, center_id: period!.center_id });
  await db().from("notification_logs").insert({
    senior_id: s2, period_id: period!.id, recipient_type: "senior", recipient_key: `senior:${s2}`,
    channel: "sms", kind: "test", status: "demo",
  });
  check("준비: 구독 1건", (await count("subscriptions", "senior_id", s2)) === 1);
  check("준비: 발송 기록 1건", (await count("notification_logs", "senior_id", s2)) === 1);
  await deleteSenior(s2);
  check("어르신 삭제 → 구독 삭제", (await count("subscriptions", "senior_id", s2)) === 0);
  check("어르신 삭제 → 발송 기록 삭제", (await count("notification_logs", "senior_id", s2)) === 0);
  check("어르신 삭제 → 보호자 연결 삭제", (await count("senior_guardians", "senior_id", s2)) === 0);

  // 3) 탈퇴
  const solo = await makeSenior("단독", [u1]);
  const shared = await makeSenior("공동", [u1, u2]);
  const w = await withdrawUser(u1);
  check("탈퇴 성공", w.ok);
  check("탈퇴 → 계정 삭제", (await count("users", "id", u1)) === 0);
  check("탈퇴 → 유일한 보호자인 어르신 삭제", (await count("seniors", "id", solo)) === 0);
  check("탈퇴 → 공동 어르신은 남음", (await count("seniors", "id", shared)) === 1);
  const { data: l2 } = await db().from("senior_guardians").select("relation").eq("senior_id", shared).eq("user_id", u2).single();
  check("탈퇴 → 남은 보호자가 owner 승계", l2?.relation === "owner");
  await deleteSenior(shared);
} finally {
  if (userIds.length) await db().from("users").delete().in("id", userIds);
}

console.log(failures ? `\n${failures}건 실패` : "\n모두 통과");
process.exit(failures ? 1 : 0);
