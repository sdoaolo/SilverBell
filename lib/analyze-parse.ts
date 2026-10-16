// AI 응답(JSON) 파싱·검증. ```json 코드블록으로 와도 읽는다. (테스트하기 쉽게 SDK와 분리)
import { z } from "zod";
import { isYmd } from "./dates";

const ymd = z.string().refine(isYmd, "날짜 형식은 YYYY-MM-DD");

export const AnalyzeSchema = z.object({
  isRecruitment: z.boolean(),
  periods: z.array(
    z.object({
      label: z.string().trim().min(1).max(60),
      applyStart: ymd,
      applyEnd: ymd.nullable(),
      method: z.string().trim().max(200).nullable(),
    }),
  ),
  confidence: z.number().min(0).max(1),
});

export type AnalyzeResult = z.infer<typeof AnalyzeSchema>;

export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("JSON이 없어요");
  return JSON.parse(body.slice(start, end + 1));
}

export function parseAnalyzeOutput(text: string): AnalyzeResult {
  const result = AnalyzeSchema.parse(extractJson(text));
  // 종료일이 시작일보다 앞서면 종료일을 모르는 것으로 처리
  return {
    ...result,
    periods: result.periods.map((p) => ({
      ...p,
      applyEnd: p.applyEnd && p.applyEnd < p.applyStart ? null : p.applyEnd,
    })),
  };
}
