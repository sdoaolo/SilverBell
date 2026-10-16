// 어르신 1명 → 수신자 목록 계산.
// 어르신 본인(senior_channel) + 확인된 보호자 각자(channel != none). 같은 번호는 한 번만.
// 번호 확인 전 어르신은 통째로 제외.
import type { Channel } from "./provider";

export interface SeniorForSend {
  id: string;
  name: string;
  phone_hash: string;
  phone_enc: string;
  key_version: number;
  senior_channel: "sms" | "voice" | "both";
  verified_at: string | null;
}

export interface GuardianForSend {
  user_id: string;
  channel: "sms" | "voice" | "both" | "none";
  verified_at: string | null;
  phone_hash: string;
  phone_enc: string;
  key_version: number;
}

export interface Recipient {
  type: "senior" | "guardian";
  key: string; // 'senior:<id>' | 'user:<id>'
  channels: Channel[];
  phoneEnc: string;
  keyVersion: number;
}

function expand(channel: "sms" | "voice" | "both"): Channel[] {
  return channel === "both" ? ["voice", "sms"] : [channel];
}

export function computeRecipients(senior: SeniorForSend, guardians: GuardianForSend[]): Recipient[] {
  if (!senior.verified_at) return [];
  const seen = new Set<string>([senior.phone_hash]);
  const list: Recipient[] = [
    {
      type: "senior",
      key: `senior:${senior.id}`,
      channels: expand(senior.senior_channel),
      phoneEnc: senior.phone_enc,
      keyVersion: senior.key_version,
    },
  ];
  for (const g of guardians) {
    if (g.channel === "none" || !g.verified_at || seen.has(g.phone_hash)) continue;
    seen.add(g.phone_hash);
    list.push({
      type: "guardian",
      key: `user:${g.user_id}`,
      channels: expand(g.channel),
      phoneEnc: g.phone_enc,
      keyVersion: g.key_version,
    });
  }
  return list;
}
