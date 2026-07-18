// P4 /u/:handle 工程师公开档案（p30 UI 先行原型批次 4，ADR-003）：mock 数据、不接后端。
// D1：贡献事实默认公开；聚合指标 opt-in 且区间化。D3：公开层零身份假设（页内演示开关除外）。
import type { Metadata } from "next";
import { PublicProfile } from "@/components/p30/public-profile";

export const runtime = "edge";

export const metadata: Metadata = { title: "工程师公开档案 · Developer Portal" };

export default function PublicProfilePage({ params }: { params: { handle: string } }) {
  return <PublicProfile handle={params.handle} />;
}
