import { describe, expect, it } from "vitest";
import { parseAnalyzeOutput } from "@/lib/analyze-parse";

const valid = {
  isRecruitment: true,
  periods: [{ label: "2026년 하반기", applyStart: "2026-10-20", applyEnd: "2026-10-24", method: "방문 접수" }],
  confidence: 0.9,
};

describe("parseAnalyzeOutput", () => {
  it("parses plain JSON", () => {
    expect(parseAnalyzeOutput(JSON.stringify(valid))).toEqual(valid);
  });

  it("parses a ```json code block with surrounding text", () => {
    const text = "결과입니다.\n```json\n" + JSON.stringify(valid, null, 2) + "\n```\n끝";
    expect(parseAnalyzeOutput(text).periods[0].applyStart).toBe("2026-10-20");
  });

  it("accepts nulls", () => {
    const r = parseAnalyzeOutput(
      JSON.stringify({ ...valid, periods: [{ label: "1차", applyStart: "2026-11-02", applyEnd: null, method: null }] }),
    );
    expect(r.periods[0].applyEnd).toBeNull();
  });

  it("drops an end date before the start date", () => {
    const r = parseAnalyzeOutput(
      JSON.stringify({ ...valid, periods: [{ label: "x", applyStart: "2026-11-02", applyEnd: "2026-11-01", method: null }] }),
    );
    expect(r.periods[0].applyEnd).toBeNull();
  });

  it("rejects invalid dates and shapes", () => {
    expect(() =>
      parseAnalyzeOutput(JSON.stringify({ ...valid, periods: [{ label: "x", applyStart: "10월 20일", applyEnd: null, method: null }] })),
    ).toThrow();
    expect(() => parseAnalyzeOutput(JSON.stringify({ ...valid, confidence: 3 }))).toThrow();
    expect(() => parseAnalyzeOutput("모르겠어요")).toThrow();
  });
});
