import type { Metadata } from "next";
import { Noto_Sans_SC } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Navbar } from "@/components/layout/Navbar";

const notoSansSC = Noto_Sans_SC({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-noto-sc",
});

export const metadata: Metadata = {
  title: "SEO 分析器 - 网站诊断与优化",
  description:
    "抓取站点页面、SEO 打分、关键词与问题清单、趋势与 PDF 报告，一站式完成基础 SEO 自检。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${notoSansSC.variable} h-full antialiased`}
    >
      <body
        className={`${notoSansSC.className} min-h-full flex flex-col bg-slate-50 text-slate-900`}
      >
        <Providers>
          <Navbar />
          <main className="flex-1">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
