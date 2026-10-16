import { fail, ok, serverError } from "@/lib/api";
import { savePendingPeriods } from "@/lib/admin";
import { centerGuard } from "@/lib/admin-api";
import { analyzeNotice, describeAnthropicError, type AnalyzeInput } from "@/lib/analyze";
import { isUuid } from "@/lib/authz";
import { MAX_ANALYZE_IMAGES, MAX_ANALYZE_TEXT_CHARS, MAX_IMAGE_BYTES } from "@/lib/config";
import { db } from "@/lib/db";
import { sniffImage } from "@/lib/image-sniff";

export const maxDuration = 60;

/**
 * 본문 붙여넣기 분석: multipart (centerId, text, images[] jpg/png/webp 최대 4장).
 * 업로드 이미지는 분석에만 쓰고 저장하지 않는다. 결과는 확인 대기에 추가.
 */
export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("입력값을 다시 확인해 주세요");
  }
  const centerId = String(form.get("centerId") ?? "");
  if (!isUuid(centerId)) return fail("복지관을 골라 주세요");
  const g = await centerGuard("notice.check", centerId);
  if ("response" in g) return g.response;

  const text = String(form.get("text") ?? "").slice(0, MAX_ANALYZE_TEXT_CHARS * 2).trim();
  const files = form.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > MAX_ANALYZE_IMAGES) return fail(`이미지는 ${MAX_ANALYZE_IMAGES}장까지 올릴 수 있어요`);

  const images: NonNullable<AnalyzeInput["images"]> = [];
  for (const f of files) {
    if (f.size > MAX_IMAGE_BYTES) return fail("이미지 한 장은 5MB까지 올릴 수 있어요");
    const data = Buffer.from(await f.arrayBuffer());
    const mediaType = sniffImage(data);
    if (!mediaType || mediaType === "image/gif") return fail("jpg, png, webp 이미지만 올릴 수 있어요");
    images.push({ mediaType, data });
  }
  if (!text && images.length === 0) return fail("공지 글을 붙여넣거나 이미지를 올려 주세요");

  try {
    const { data: center, error } = await db().from("centers").select("name").eq("id", centerId).single();
    if (error) throw error;
    let result;
    try {
      result = await analyzeNotice({ centerName: center.name, text, images });
    } catch (e) {
      return fail(describeAnthropicError(e), 502);
    }
    const created = await savePendingPeriods(centerId, null, result);
    return ok({ result, created: created.length });
  } catch (e) {
    return serverError(e);
  }
}
