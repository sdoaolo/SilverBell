// 발송 수단 인터페이스. 호출부는 deliver()만 쓰고, 구현(Solapi·데모·나중에 알림톡)은 이 뒤에 둔다.
import { isPhoneAllowed } from "../allow-phones";
import { ERR } from "../messages";
import { demoProvider } from "./demo";
import { solapiProvider } from "./solapi";

export type Channel = "sms" | "voice";

export interface SendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

export interface MessageProvider {
  name: string;
  sendSms(to: string, text: string): Promise<SendResult>;
  sendVoice(to: string, text: string): Promise<SendResult>;
}

export type DeliveryStatus = "sent" | "failed" | "demo" | "skipped";

export interface Delivery {
  provider: string;
  status: DeliveryStatus;
  messageId?: string;
  error?: string;
}

export function getProvider(): MessageProvider {
  return process.env.DEMO_MODE === "true" ? demoProvider : solapiProvider;
}

/**
 * 한 건 발송. 예외를 밖으로 던지지 않는다 (한 명 실패가 전체 발송을 멈추지 않게).
 * 화이트리스트·발신번호 같은 번호는 보내지 않고 skipped.
 */
export async function deliver(
  channel: Channel,
  to: string,
  text: string,
  provider: MessageProvider = getProvider(),
): Promise<Delivery> {
  const phone = to.replace(/\D/g, "");
  if (!isPhoneAllowed(phone)) {
    return { provider: provider.name, status: "skipped", error: ERR.phoneNotAllowed };
  }
  const sender = (process.env.SOLAPI_SENDER ?? "").replace(/\D/g, "");
  if (sender && sender === phone) {
    return { provider: provider.name, status: "skipped", error: ERR.sameAsSender };
  }
  try {
    const result =
      channel === "voice" ? await provider.sendVoice(phone, text) : await provider.sendSms(phone, text);
    if (!result.ok) {
      return { provider: provider.name, status: "failed", messageId: result.messageId, error: result.error };
    }
    return {
      provider: provider.name,
      status: provider.name === demoProvider.name ? "demo" : "sent",
      messageId: result.messageId,
    };
  } catch (e) {
    return { provider: provider.name, status: "failed", error: e instanceof Error ? e.message : String(e) };
  }
}
