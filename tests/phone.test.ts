import { beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import {
  decryptPhone,
  encryptPhone,
  last4,
  maskPhone,
  normalizePhone,
  phoneHash,
} from "@/lib/crypto/phone";

beforeAll(() => {
  process.env.PHONE_ENC_KEY = randomBytes(32).toString("base64");
  process.env.PHONE_HASH_KEY = randomBytes(32).toString("base64");
});

describe("phone crypto", () => {
  it("normalizes and validates", () => {
    expect(normalizePhone("010-1234-5678")).toBe("01012345678");
    expect(normalizePhone("011 123 4567")).toBe("0111234567");
    expect(normalizePhone("02-123-4567")).toBeNull();
    expect(normalizePhone("0101234")).toBeNull();
  });

  it("round-trips encryption", () => {
    const enc = encryptPhone("01012345678");
    expect(enc).not.toContain("01012345678");
    expect(decryptPhone(enc, 1)).toBe("01012345678");
  });

  it("produces different ciphertext each time", () => {
    expect(encryptPhone("01012345678")).not.toBe(encryptPhone("01012345678"));
  });

  it("hashes the same number to the same value", () => {
    expect(phoneHash("01012345678")).toBe(phoneHash("01012345678"));
    expect(phoneHash("01012345678")).not.toBe(phoneHash("01012345679"));
  });

  it("rejects tampered ciphertext", () => {
    const buf = Buffer.from(encryptPhone("01012345678"), "base64");
    buf[buf.length - 1] ^= 1;
    expect(() => decryptPhone(buf.toString("base64"), 1)).toThrow();
  });

  it("masks", () => {
    expect(maskPhone(last4("01012345678"))).toBe("010-****-5678");
  });
});
