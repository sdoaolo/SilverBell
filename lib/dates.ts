// 날짜 판정은 전부 Asia/Seoul 기준. 날짜는 'YYYY-MM-DD' 문자열로 다룬다.
import { REMIND_DAYS_BEFORE } from "./config";

export const TIME_ZONE = "Asia/Seoul";

const ymdFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** 한국 기준 오늘 날짜 */
export function todaySeoul(now: Date = new Date()): string {
  return ymdFormatter.format(now);
}

function parseYmd(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** 날짜 문자열에 일수 더하기 (달력 계산이라 시간대 영향 없음) */
export function addDays(ymd: string, days: number): string {
  return new Date(parseYmd(ymd) + days * 86_400_000).toISOString().slice(0, 10);
}

/** b - a (일) */
export function diffDays(a: string, b: string): number {
  return Math.round((parseYmd(b) - parseYmd(a)) / 86_400_000);
}

export function isYmd(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return new Date(parseYmd(s)).toISOString().slice(0, 10) === s;
}

/**
 * 종료일이 없으면 시작일 하루만 신청 기간으로 본다
 * (마감을 모를 때 계속 알림이 가지 않도록 보수적으로).
 */
export function effectiveEnd(start: string, end: string | null): string {
  return end ?? start;
}

export type PeriodPhase = "before" | "open" | "ended";

export function periodPhase(today: string, start: string, end: string | null): PeriodPhase {
  if (today < start) return "before";
  if (today > effectiveEnd(start, end)) return "ended";
  return "open";
}

export type AutoKind = "d-3" | "d-day";

/** 매일 자동 작업: 오늘 보낼 종류 (d-day는 기간 중 따라잡기 포함) */
export function dailyKind(today: string, start: string, end: string | null): AutoKind | null {
  if (periodPhase(today, start, end) === "open") return "d-day";
  if (today === addDays(start, -REMIND_DAYS_BEFORE)) return "d-3";
  return null;
}

/** 관리자가 늦게 확정했을 때 바로 보낼 종류 */
export function catchUpKind(today: string, start: string, end: string | null): AutoKind | null {
  const phase = periodPhase(today, start, end);
  if (phase === "open") return "d-day";
  if (phase === "before" && today >= addDays(start, -REMIND_DAYS_BEFORE)) return "d-3";
  return null;
}

/** 자동 알림 예정일 */
export function remindDate(start: string): string {
  return addDays(start, -REMIND_DAYS_BEFORE);
}

/** TTS용: "10월 20일" */
export function koMonthDay(ymd: string): string {
  const [, m, d] = ymd.split("-").map(Number);
  return `${m}월 ${d}일`;
}

/** 문자용: "10/20" */
export function slashMonthDay(ymd: string): string {
  const [, m, d] = ymd.split("-").map(Number);
  return `${m}/${d}`;
}

const dateTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: TIME_ZONE,
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** 화면용: "10/15 09:00" */
export function formatSeoulDateTime(value: string | Date): string {
  const parts = dateTimeFormatter.formatToParts(new Date(value));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("month")}/${get("day")} ${get("hour")}:${get("minute")}`;
}
