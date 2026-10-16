// ALLOW_PHONES 화이트리스트: OTP와 모든 발송에 적용.
// 비어 있으면 전부 거부(fail-closed), '*'일 때만 전체 허용.

export function isPhoneAllowed(phone: string): boolean {
  const raw = (process.env.ALLOW_PHONES ?? "").trim();
  if (raw === "*") return true;
  if (!raw) return false;
  const digits = phone.replace(/\D/g, "");
  return raw
    .split(",")
    .map((p) => p.replace(/\D/g, ""))
    .some((p) => p.length > 0 && p === digits);
}
