// /p/:slug/talk 路由化（p30-F03：路由 + 服务端成员鉴权；数据接入见 F09 三层意图协议）。
import type { Metadata } from "next";
import { renderWorkspaceTabPage } from "@/components/p30/workspace-placeholder";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "对话流 · Developer Portal" };

export default async function ProjectTalkPage({ params }: { params: { slug: string } }) {
  return renderWorkspaceTabPage("talk", params.slug);
}
