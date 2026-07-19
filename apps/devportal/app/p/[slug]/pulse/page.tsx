// /p/:slug/pulse 路由化（p30-F03：路由 + 服务端成员鉴权；数据接入见 F04）。
import type { Metadata } from "next";
import { renderWorkspaceTabPage } from "@/components/p30/workspace-placeholder";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "脉搏与进度 · Developer Portal" };

export default async function ProjectPulsePage({ params }: { params: { slug: string } }) {
  return renderWorkspaceTabPage("pulse", params.slug);
}
