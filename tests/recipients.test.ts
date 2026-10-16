import { describe, expect, it } from "vitest";
import { computeRecipients, type GuardianForSend, type SeniorForSend } from "@/lib/notify/recipients";

const senior: SeniorForSend = {
  id: "s1",
  name: "김순자",
  phone_hash: "hash-senior",
  phone_enc: "enc-senior",
  key_version: 1,
  senior_channel: "voice",
  verified_at: "2026-10-16T00:00:00Z",
};

const g = (id: string, over: Partial<GuardianForSend> = {}): GuardianForSend => ({
  user_id: id,
  channel: "sms",
  verified_at: "2026-10-16T00:00:00Z",
  phone_hash: `hash-${id}`,
  phone_enc: `enc-${id}`,
  key_version: 1,
  ...over,
});

describe("computeRecipients", () => {
  it("includes senior and every verified guardian", () => {
    const list = computeRecipients(senior, [g("u1"), g("u2", { channel: "both" })]);
    expect(list.map((r) => r.key)).toEqual(["senior:s1", "user:u1", "user:u2"]);
    expect(list[0].channels).toEqual(["voice"]);
    expect(list[2].channels).toEqual(["voice", "sms"]);
  });

  it("excludes unverified senior entirely", () => {
    expect(computeRecipients({ ...senior, verified_at: null }, [g("u1")])).toEqual([]);
  });

  it("excludes guardians with channel none or not verified", () => {
    const list = computeRecipients(senior, [g("u1", { channel: "none" }), g("u2", { verified_at: null }), g("u3")]);
    expect(list.map((r) => r.key)).toEqual(["senior:s1", "user:u3"]);
  });

  it("sends once per phone number", () => {
    const list = computeRecipients(senior, [g("u1", { phone_hash: "hash-senior" }), g("u2")]);
    expect(list.map((r) => r.key)).toEqual(["senior:s1", "user:u2"]);
  });
});
