// W6 /p/:slug/settings 治理台（p30 UI 先行原型批次 2，ADR-003）：mock 数据、不接后端。
// owner 视角；无权限态由页内 mock 视角开关演示（N1 第四态）。
import type { Metadata } from "next";
import { GovernanceConsole } from "@/components/p30/governance-console";

export const runtime = "edge";

export const metadata: Metadata = { title: "治理台 · Developer Portal" };

export default function ProjectSettingsPage({ params }: { params: { slug: string } }) {
  return <GovernanceConsole slug={params.slug} />;
}
