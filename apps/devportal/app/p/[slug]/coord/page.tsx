// /p/:slug/coord 路由化（p30-F03：路由 + 服务端成员鉴权；数据接入见 F04）。
import type { Metadata } from "next";
import { renderWorkspaceTabPage } from "@/components/p30/workspace-placeholder";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "实时协调 · Developer Portal" };

export default async function ProjectCoordPage({ params }: { params: { slug: string } }) {
  return renderWorkspaceTabPage("coord", params.slug);
}
