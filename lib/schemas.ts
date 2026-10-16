// API 입력 검증에 공통으로 쓰는 zod 조각
import { z } from "zod";
import { ERR } from "./messages";

const PHONE_RE = /^01[016789]\d{7,8}$/;

/** 숫자만 남겨 형식 검사한 전화번호 */
export const phoneField = z
  .string({ error: ERR.phoneInvalid })
  .transform((v) => v.replace(/\D/g, ""))
  .refine((v) => PHONE_RE.test(v), ERR.phoneInvalid);

export const nameField = z
  .string({ error: "이름을 입력해 주세요" })
  .trim()
  .min(1, "이름을 입력해 주세요")
  .max(30, "이름은 30자까지 쓸 수 있어요");

export const seniorChannelField = z.enum(["sms", "voice", "both"], { error: "알림 방법을 골라 주세요" });
export const guardianChannelField = z.enum(["sms", "voice", "both", "none"], { error: "알림 방법을 골라 주세요" });

/** 확인 코드 입력 또는 다시 받기 */
export const codeOrResend = z.union([
  z.object({ code: z.string().trim().regex(/^\d{6}$/, "6자리 숫자를 입력해 주세요") }),
  z.object({ resend: z.literal(true) }),
]);
