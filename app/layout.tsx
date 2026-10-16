import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "복지관 신청기간 알림",
  description: "복지관 신청 기간을 전화와 문자로 알려 드려요",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
