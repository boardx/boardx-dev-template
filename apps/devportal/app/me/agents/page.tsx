// M2 /me/agents 车队管理台（p30 UI 先行原型，ADR-003）：mock 数据、不接后端。
import type { Metadata } from "next";
import { FleetConsole } from "@/components/p30/fleet-console";

export const runtime = "edge";

export const metadata: Metadata = { title: "我的 agent 车队 · Developer Portal" };

export default function MeAgentsPage() {
  return <FleetConsole />;
}
