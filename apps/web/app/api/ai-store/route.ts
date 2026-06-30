import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// AI Store 浏览数据源：最小内存样本，不引入 DB 表（UC 主流程只读浏览/筛选）。
// 字段对齐 V1 设计 STORE 卡片：类型 / 标签 / 作者 / 浏览量 / 喜欢数 / featured。
export type StoreType = "agent" | "ai-tool" | "image-tool" | "template";

export interface StoreItem {
  id: string;
  name: string;
  description: string;
  type: StoreType;
  tags: string[];
  author: string;
  likes: number;
  views: number;
  featured: boolean;
}

const ITEMS: StoreItem[] = [
  { id: "research-agent", name: "Research Agent", description: "Multi-step web research with cited summaries.", type: "agent", tags: ["research", "featured"], author: "BoardX", likes: 312, views: 4810, featured: true },
  { id: "meeting-notes-agent", name: "Meeting Notes Agent", description: "Turns transcripts into structured action items.", type: "agent", tags: ["meetings", "productivity"], author: "BoardX", likes: 198, views: 3120, featured: false },
  { id: "planner-agent", name: "Sprint Planner", description: "Breaks goals into sprints and tasks on the board.", type: "agent", tags: ["productivity"], author: "Acme Labs", likes: 87, views: 1540, featured: false },
  { id: "summarize-tool", name: "Summarize", description: "Condense long docs into key points.", type: "ai-tool", tags: ["writing", "featured"], author: "BoardX", likes: 421, views: 7600, featured: true },
  { id: "translate-tool", name: "Translate", description: "Translate selected text across 30+ languages.", type: "ai-tool", tags: ["writing"], author: "BoardX", likes: 156, views: 2890, featured: false },
  { id: "rewrite-tool", name: "Rewrite", description: "Rephrase text for tone and clarity.", type: "ai-tool", tags: ["writing"], author: "Acme Labs", likes: 64, views: 980, featured: false },
  { id: "image-generate", name: "Image Generate", description: "Create illustrations from a text prompt.", type: "image-tool", tags: ["design", "featured"], author: "BoardX", likes: 530, views: 9100, featured: true },
  { id: "image-upscale", name: "Image Upscale", description: "Enhance and upscale board images.", type: "image-tool", tags: ["design"], author: "PixelWorks", likes: 142, views: 2010, featured: false },
  { id: "retro-template", name: "Retro Template", description: "Start, stop, continue retrospective board.", type: "template", tags: ["meetings", "productivity"], author: "BoardX", likes: 276, views: 5300, featured: false },
  { id: "brainstorm-template", name: "Brainstorm Template", description: "Diverge and converge ideation canvas.", type: "template", tags: ["productivity"], author: "Acme Labs", likes: 188, views: 3400, featured: false },
  { id: "user-journey-template", name: "User Journey Map", description: "Map stages, actions, and pain points.", type: "template", tags: ["design", "research"], author: "BoardX", likes: 233, views: 4120, featured: false },
];

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? "";
  const tag = url.searchParams.get("tag") ?? "";
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();

  let items = ITEMS;
  if (type && type !== "all") items = items.filter((it) => it.type === type);
  if (tag) items = items.filter((it) => it.tags.includes(tag));
  if (q) items = items.filter((it) => it.name.toLowerCase().includes(q) || it.description.toLowerCase().includes(q));

  return NextResponse.json({ items });
}
