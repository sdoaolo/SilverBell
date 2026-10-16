import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { zoomInitScript } from "@/components/text-size";
import "./globals.css";

const noto = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  weight: ["400", "500", "700", "900"],
  subsets: ["latin"],
  preload: false,
  display: "swap",
});

export const metadata: Metadata = {
  title: "복지관 효도알림 — 신청 시기가 먼저 전화로 찾아오는 서비스",
  description: "다니시는 복지관의 신청 기간이 되면 어르신과 보호자에게 전화와 문자로 알려 드려요",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${noto.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: zoomInitScript }} />
      </head>
      <body className="flex min-h-full flex-col font-sans">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
