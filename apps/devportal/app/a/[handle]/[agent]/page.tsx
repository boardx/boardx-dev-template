// P5 /a/:handle/:agent Agent 数字分身页（p30 UI 先行原型批次 4，ADR-003）：mock 数据、不接后端。
// D6 路由：agent 标识 @handle/agent-name；D1：分身页默认全公开（软件资产无隐私权）。
import type { Metadata } from "next";
import { AgentTwin } from "@/components/p30/agent-twin";

export const runtime = "edge";

export const metadata: Metadata = { title: "Agent 数字分身 · Developer Portal" };

export default function AgentTwinPage({ params }: { params: { handle: string; agent: string } }) {
  return <AgentTwin handle={params.handle} agent={params.agent} />;
}
