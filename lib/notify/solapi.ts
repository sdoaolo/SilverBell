// Solapi 구현 (solapi 6.x: SolapiMessageService.send)
import { SolapiMessageService } from "solapi";
import { VOICE_MAX_BYTES } from "../config";
import type { MessageProvider, SendResult } from "./provider";

let service: SolapiMessageService | null = null;

function getService(): SolapiMessageService {
  if (service) return service;
  const key = process.env.SOLAPI_API_KEY;
  const secret = process.env.SOLAPI_API_SECRET;
  if (!key || !secret) throw new Error("SOLAPI_API_KEY와 SOLAPI_API_SECRET을 설정하세요");
  service = new SolapiMessageService(key, secret);
  return service;
}

function sender(): string {
  const from = (process.env.SOLAPI_SENDER ?? "").replace(/\D/g, "");
  if (!from) throw new Error("SOLAPI_SENDER(발신번호)를 설정하세요");
  return from;
}

/** Solapi 바이트 기준(한글 2바이트)으로 근사 */
function byteLength(text: string): number {
  let n = 0;
  for (const ch of text) n += ch.charCodeAt(0) > 0x7f ? 2 : 1;
  return n;
}

function errorText(e: unknown): string {
  if (e && typeof e === "object") {
    const err = e as { failedMessageList?: ReadonlyArray<{ statusCode?: string; statusMessage?: string }>; message?: string };
    const failed = err.failedMessageList?.[0];
    if (failed) return `${failed.statusCode ?? ""} ${failed.statusMessage ?? ""}`.trim();
    if (err.message) return err.message;
  }
  return String(e);
}

async function send(message: Parameters<SolapiMessageService["send"]>[0]): Promise<SendResult> {
  try {
    const res = await getService().send(message, { showMessageList: true });
    const failed = res.failedMessageList?.[0];
    if (failed) {
      return { ok: false, messageId: failed.messageId, error: `${failed.statusCode} ${failed.statusMessage}` };
    }
    return { ok: true, messageId: res.messageList?.[0]?.messageId ?? res.groupInfo.groupId };
  } catch (e) {
    return { ok: false, error: errorText(e) };
  }
}

export const solapiProvider: MessageProvider = {
  name: "solapi",
  async sendSms(to, text) {
    // type 생략: 길이에 따라 SMS/LMS 자동
    return send({ to, from: sender(), text });
  },
  async sendVoice(to, text) {
    if (byteLength(text) > VOICE_MAX_BYTES) {
      return { ok: false, error: `음성 문구가 너무 길어요 (${VOICE_MAX_BYTES}바이트 초과)` };
    }
    // 안내 후 바로 끊기게: headerMessage·tailMessage·replyRange·counselorNumber 넣지 않음
    return send({ to, from: sender(), text, type: "VOICE", voiceOptions: { voiceType: "FEMALE" } });
  },
};
