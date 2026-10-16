// 파일 앞부분 바이트로 이미지 형식 판별 (확장자·content-type만 믿지 않기 위해)
import type { ImageMediaType } from "./analyze";

export function sniffImage(buf: Buffer): ImageMediaType | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (buf.length >= 6 && /^GIF8[79]a$/.test(buf.subarray(0, 6).toString("ascii"))) return "image/gif";
  if (buf.length >= 12 && buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") {
    return "image/webp";
  }
  return null;
}

export function isPdf(buf: Buffer): boolean {
  return buf.length >= 5 && buf.subarray(0, 5).toString("ascii") === "%PDF-";
}
