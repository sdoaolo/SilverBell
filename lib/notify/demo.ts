// DEMO_MODE=true용: 실제로 보내지 않고 콘솔에만 출력 (번호는 마스킹)
import type { MessageProvider, SendResult } from "./provider";

function log(kind: string, to: string, text: string): SendResult {
  console.log(`[demo ${kind}] 010-****-${to.slice(-4)}: ${text}`);
  return { ok: true, messageId: `demo-${Date.now()}` };
}

export const demoProvider: MessageProvider = {
  name: "demo",
  async sendSms(to, text) {
    return log("sms", to, text);
  },
  async sendVoice(to, text) {
    return log("voice", to, text);
  },
};
