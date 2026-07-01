import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "BoardX 商务问卷平台",
  description: "面向商务调研、问卷设计、受访填写与专业报告生成的 BoardX 问卷系统。",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
