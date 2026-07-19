// /p/:slug/work 路由化（p30-F03：路由 + 服务端成员鉴权；数据接入见 F04/F18）。
import type { Metadata } from "next";
import { renderWorkspaceTabPage } from "@/components/p30/workspace-placeholder";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "需求与 sprint · Developer Portal" };

export default async function ProjectWorkPage({ params }: { params: { slug: string } }) {
  return renderWorkspaceTabPage("work", params.slug);
}
