import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GitHub 개발 활동 리포트",
  description: "GitHub 공개 저장소 기반 개발자 활동 리포트 MVP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
