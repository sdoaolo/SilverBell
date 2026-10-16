// 발송 문구는 모두 여기에 모은다.
import { koMonthDay, slashMonthDay } from "./dates";

const SMS_PREFIX = "[복지관 알림]";
const ADMIN_SMS_PREFIX = "[복지관 알림 관리자]";

/** 값이 없거나 TODO로 남은 항목은 문구에서 뺀다 */
export function hasValue(v: string | null | undefined): v is string {
  if (!v) return false;
  const t = v.trim();
  return t.length > 0 && !t.toUpperCase().startsWith("TODO");
}

/** TTS가 읽기 쉽게: 괄호·특수문자·URL 제거 */
export function ttsSafe(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[()[\]{}<>]/g, " ")
    .replace(/[^\p{L}\p{N}\s.,]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface PeriodMessageInput {
  centerName: string;
  label: string;
  applyStart: string;
  applyEnd: string | null;
  method: string | null;
  centerPhone: string | null;
}

/** 음성: 신청 기간 중 */
export function voiceOpen(p: PeriodMessageInput): string {
  return ttsSafe(`${p.centerName} ${p.label} 신청기간이니 신청하시기 바랍니다.`);
}

/** 음성: 시작 전 */
export function voiceBefore(p: PeriodMessageInput): string {
  return ttsSafe(
    `${p.centerName} ${p.label} 신청이 ${koMonthDay(p.applyStart)}부터 시작됩니다. 잊지 말고 신청하시기 바랍니다.`,
  );
}

/** 문자: 보호자에게는 seniorName을 넘겨 앞에 "{어르신 이름} 님 안내: "를 붙인다 */
export function smsPeriod(p: PeriodMessageInput, seniorName?: string): string {
  const range = `${slashMonthDay(p.applyStart)}~${p.applyEnd ? slashMonthDay(p.applyEnd) : ""}`;
  const parts = [`${SMS_PREFIX} ${p.centerName} ${p.label} 신청 ${range}.`];
  if (hasValue(p.method)) parts.push(`신청방법: ${p.method}.`);
  if (hasValue(p.centerPhone)) parts.push(`문의 ${p.centerPhone}`);
  const body = parts.join(" ");
  return seniorName ? `${seniorName} 님 안내: ${body}` : body;
}

export function smsLoginCode(code: string): string {
  return `${SMS_PREFIX} 로그인 확인 번호 ${code}`;
}

export function smsSeniorVerify(requesterName: string, seniorName: string, code: string): string {
  return `${SMS_PREFIX} ${requesterName} 님이 ${seniorName} 님의 복지관 신청기간 알림을 등록하려고 해요. 확인 번호 ${code}`;
}

export function smsGuardianInvite(adderName: string, seniorName: string, code: string): string {
  return `${SMS_PREFIX} ${adderName} 님이 ${seniorName} 님의 보호자로 추가하려고 해요. 확인 번호 ${code}`;
}

export function smsAdminAdded(): string {
  return `${SMS_PREFIX} 관리자로 추가되었어요. 전화번호로 로그인해 주세요.`;
}

export function smsAdminNewPeriod(p: Pick<PeriodMessageInput, "centerName" | "label" | "applyStart" | "applyEnd">): string {
  const range = `${slashMonthDay(p.applyStart)}~${p.applyEnd ? slashMonthDay(p.applyEnd) : ""}`;
  return `${ADMIN_SMS_PREFIX} ${p.centerName} 새 모집 공지: ${p.label} 신청 ${range}. 관리자 화면에서 확인해 주세요.`;
}

export function smsTest(): string {
  return `${SMS_PREFIX} 테스트 문자예요.`;
}

export function voiceTest(): string {
  return "복지관 알림 테스트 전화입니다.";
}

// 화면·API 오류 문구
export const ERR = {
  phoneInvalid: "전화번호를 다시 확인해 주세요",
  phoneNotAllowed: "시연용 번호만 사용할 수 있어요",
  sameAsSender: "발신번호와 같은 번호에는 보낼 수 없어요",
  otpCooldown: "잠시 후 다시 보내 주세요",
  otpTooMany: "1시간 동안 너무 많이 요청했어요. 나중에 다시 해 주세요",
  otpWrong: "확인 번호가 맞지 않아요",
  otpExpired: "확인 번호가 만료되었어요. 다시 받아 주세요",
  notFound: "찾을 수 없어요",
  badInput: "입력값을 다시 확인해 주세요",
  loginRequired: "다시 로그인해 주세요",
} as const;
