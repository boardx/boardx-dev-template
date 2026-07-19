// M1 /me 跨项目工作台（p30/F08：真数据落地）。
// D4：登录默认落点（middleware.ts + lib/oauth.ts fallback）；数据源见
// app/api/p30/me/route.ts，UI 结构承自 UI 先行原型（ADR-003：UI 不丢弃，接真逻辑）。
import type { Metadata } from "next";
import { MeWorkbench } from "@/components/p30/me-workbench";

export const runtime = "edge";

export const metadata: Metadata = { title: "我的工作台 · Developer Portal" };

export default function MePage() {
  return <MeWorkbench />;
}
