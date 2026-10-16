import "server-only";
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import { CURRENT_PHONE_KEY_VERSION } from "../config";

// 전화번호 컬럼 암호화.
// phone_hash: 검색·중복 방지용 HMAC, phone_enc: 발송할 때만 복호화하는 AES-256-GCM 암호문.
// 복호화는 실제 발송 직전과 본인 정보 수정 화면에서만 쓴다.

const PHONE_RE = /^01[016789]\d{7,8}$/;

/** 숫자만 남기고 형식 검증. 틀리면 null */
export function normalizePhone(raw: string): string | null {
  const digits = String(raw ?? "").replace(/\D/g, "");
  return PHONE_RE.test(digits) ? digits : null;
}

function readKey(name: string): Buffer {
  const value = process.env[name];
  if (!value) throw new Error(`${name}을(를) 설정하세요`);
  const key = Buffer.from(value, "base64");
  if (key.length !== 32) throw new Error(`${name}은(는) 32바이트 base64 값이어야 해요`);
  return key;
}

function encKey(version: number): Buffer {
  if (process.env[`PHONE_ENC_KEY_V${version}`]) return readKey(`PHONE_ENC_KEY_V${version}`);
  if (version === CURRENT_PHONE_KEY_VERSION) return readKey("PHONE_ENC_KEY");
  throw new Error(`전화번호 암호화 키 버전 ${version}을(를) 찾을 수 없어요`);
}

export function phoneHash(phone: string): string {
  return createHmac("sha256", readKey("PHONE_HASH_KEY")).update(phone).digest("hex");
}

/** base64(iv(12) | authTag(16) | ciphertext) */
export function encryptPhone(phone: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encKey(CURRENT_PHONE_KEY_VERSION), iv);
  const ciphertext = Buffer.concat([cipher.update(phone, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64");
}

export function decryptPhone(enc: string, keyVersion: number): string {
  const buf = Buffer.from(enc, "base64");
  const decipher = createDecipheriv("aes-256-gcm", encKey(keyVersion), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
}

export function last4(phone: string): string {
  return phone.slice(-4);
}

/** DB에 넣을 전화번호 컬럼 묶음 */
export function phoneColumns(phone: string) {
  return {
    phone_hash: phoneHash(phone),
    phone_enc: encryptPhone(phone),
    phone_last4: last4(phone),
    key_version: CURRENT_PHONE_KEY_VERSION,
  };
}

/** 화면·로그·감사 기록용: 010-****-5678 */
export function maskPhone(phoneLast4: string): string {
  return `010-****-${phoneLast4}`;
}
