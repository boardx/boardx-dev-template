// M1 /me 跨项目工作台（p30/F08：真数据落地）。
// D4：登录默认落点（middleware.ts + lib/oauth.ts fallback）；数据源见
// app/api/p30/me/route.ts，UI 结构承自 UI 先行原型（ADR-003：UI 不丢弃，接真逻辑）。
// 侧栏项目切换器（p30-F03）已接真实 membership 数据——
// 服务端查登录者的 active 项目列表并注入，不再是 mock 项目集。
import type { Metadata } from "next";
import { headers } from "next/headers";
import { MeWorkbench } from "@/components/p30/me-workbench";
import { listMyProjects } from "@/lib/workspace-authz";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "我的工作台 · Developer Portal" };

export default async function MePage() {
  const myProjects = await listMyProjects(headers());
  return <MeWorkbench myProjects={myProjects} />;
}
