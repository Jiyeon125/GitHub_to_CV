import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "GitHub 개발 활동 리포트",
  description: "GitHub 저장소 데이터를 분석해 개발자 활동 리포트를 생성하는 MVP 서비스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="light">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
