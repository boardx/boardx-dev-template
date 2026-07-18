// P2 /projects/:slug 项目公开主页（招募页，p30 UI 先行原型批次 2，ADR-003）：mock 数据、不接后端。
// 平台公开层（D3）：不依赖 Access 注入 header 的任何假设——本页无身份读取，访客即所见。
import type { Metadata } from "next";
import { ProjectHome } from "@/components/p30/project-home";

export const runtime = "edge";

export const metadata: Metadata = { title: "项目公开主页 · Developer Portal" };

export default function ProjectPublicPage({ params }: { params: { slug: string } }) {
  return <ProjectHome slug={params.slug} />;
}
