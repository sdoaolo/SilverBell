import { describe, expect, it } from "vitest";
import {
  addDays,
  catchUpKind,
  dailyKind,
  formatSeoulDateTime,
  koMonthDay,
  periodPhase,
  slashMonthDay,
  todaySeoul,
} from "@/lib/dates";

describe("todaySeoul", () => {
  it("uses KST near midnight", () => {
    // UTC 10/15 15:30 = KST 10/16 00:30
    expect(todaySeoul(new Date("2026-10-15T15:30:00Z"))).toBe("2026-10-16");
    // UTC 10/15 14:59 = KST 10/15 23:59
    expect(todaySeoul(new Date("2026-10-15T14:59:00Z"))).toBe("2026-10-15");
  });
});

describe("period logic", () => {
  const start = "2026-10-20";
  const end = "2026-10-25";

  it("addDays crosses months", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("phase", () => {
    expect(periodPhase("2026-10-19", start, end)).toBe("before");
    expect(periodPhase("2026-10-20", start, end)).toBe("open");
    expect(periodPhase("2026-10-25", start, end)).toBe("open");
    expect(periodPhase("2026-10-26", start, end)).toBe("ended");
    // 종료일 없으면 시작일 하루만
    expect(periodPhase("2026-10-20", start, null)).toBe("open");
    expect(periodPhase("2026-10-21", start, null)).toBe("ended");
  });

  it("daily kind", () => {
    expect(dailyKind("2026-10-17", start, end)).toBe("d-3");
    expect(dailyKind("2026-10-18", start, end)).toBeNull();
    expect(dailyKind("2026-10-20", start, end)).toBe("d-day");
    expect(dailyKind("2026-10-23", start, end)).toBe("d-day");
    expect(dailyKind("2026-10-26", start, end)).toBeNull();
  });

  it("catch-up kind", () => {
    expect(catchUpKind("2026-10-16", start, end)).toBeNull();
    expect(catchUpKind("2026-10-17", start, end)).toBe("d-3");
    expect(catchUpKind("2026-10-19", start, end)).toBe("d-3");
    expect(catchUpKind("2026-10-22", start, end)).toBe("d-day");
    expect(catchUpKind("2026-10-26", start, end)).toBeNull();
  });
});

describe("formatting", () => {
  it("formats for TTS and SMS", () => {
    expect(koMonthDay("2026-10-05")).toBe("10월 5일");
    expect(slashMonthDay("2026-10-05")).toBe("10/5");
  });

  it("formats datetime in KST", () => {
    expect(formatSeoulDateTime("2026-10-15T00:00:00Z")).toBe("10/15 09:00");
  });
});
