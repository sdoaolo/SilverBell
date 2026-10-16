// Solapi 연결 확인: npx tsx scripts/solapi-check.ts 01012345678
// DEMO_MODE와 상관없이 그 번호로 SMS 1건, 음성 1건을 실제로 보낸다 (ALLOW_PHONES 검사는 유지).
import { existsSync } from "node:fs";
import { deliver } from "../lib/notify/provider";
import { solapiProvider } from "../lib/notify/solapi";
import { smsTest, voiceTest } from "../lib/messages";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

async function main() {
  const to = (process.argv[2] ?? "").replace(/\D/g, "");
  if (!/^01[016789]\d{7,8}$/.test(to)) {
    console.error("사용법: npx tsx scripts/solapi-check.ts 01012345678");
    process.exit(1);
  }
  const masked = `010-****-${to.slice(-4)}`;
  const sms = await deliver("sms", to, smsTest(), solapiProvider);
  console.log(`SMS   → ${masked}:`, sms);
  const voice = await deliver("voice", to, voiceTest(), solapiProvider);
  console.log(`VOICE → ${masked}:`, voice);
  if (sms.status !== "sent" || voice.status !== "sent") process.exit(1);
}

main();
