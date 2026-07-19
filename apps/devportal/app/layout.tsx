import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Newsreader } from "next/font/google";
import "./globals.css";
import { NavShell } from "@/components/portal/nav-shell";

// 设计稿字体三件套（DevPortal-Platform.dc.html）：Inter 正文 / JetBrains Mono 数据 /
// Newsreader 斜体叙事。变量喂给 tailwind fontFamily（font-sans/mono/serif）。
const fontSans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const fontMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap", weight: ["400", "500", "600", "700"] });
const fontSerif = Newsreader({ subsets: ["latin"], variable: "--font-serif", display: "swap", style: ["normal", "italic"], weight: ["500", "600"] });

export const metadata: Metadata = {
  title: "Developer Portal · BoardX",
  description: "BoardX agentic 开发的统一人类入口",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={`${fontSans.variable} ${fontMono.variable} ${fontSerif.variable}`}>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <NavShell>{children}</NavShell>
      </body>
    </html>
  );
}
