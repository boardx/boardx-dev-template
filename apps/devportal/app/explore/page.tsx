// P1 /explore 项目目录·探索页（p30 UI 先行原型批次 3，ADR-003）：mock 数据、不接后端。
// 平台公开层（D3）：不依赖 Access 注入 header 的任何假设——本页无身份读取，访客即所见。
import type { Metadata } from "next";
import { ExploreDirectory } from "@/components/p30/explore-directory";

export const runtime = "edge";

export const metadata: Metadata = { title: "项目目录 · Developer Portal" };

export default function ExplorePage() {
  return <ExploreDirectory />;
}
