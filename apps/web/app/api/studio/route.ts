import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Studio 制品类型。对齐 UC：音频概览 / 演示文稿 / 信息图。
type ArtifactType = "audio" | "slides" | "infographic";

interface Artifact {
  id: string;
  userId: number;
  type: ArtifactType;
  title: string;
  prompt: string;
  config: Record<string, string>;
  status: "ready";
  // NOTE: stub only — 没有接入真实生成服务，这里返回占位结果。
  // 真实实现需向 AI 服务提交 Room/Team/Chat/Files + 配置，详见 UC 主流程 8-10。
  preview: string;
  createdAt: number;
}

// 进程内存储（stub）。重启即清空；非持久化，仅用于演示主流程闭环。
const ARTIFACTS: Artifact[] = [];

const TYPE_LABEL: Record<ArtifactType, string> = {
  audio: "音频概览",
  slides: "演示文稿",
  infographic: "信息图",
};

const TYPE_PREVIEW: Record<ArtifactType, string> = {
  audio: "双主持人对话式音频概览已生成（占位音频附件）。",
  slides: "演示文稿已生成，附带 PPTX 文件与预览页（占位）。",
  infographic: "信息图已生成（占位图片）。",
};

function isType(v: unknown): v is ArtifactType {
  return v === "audio" || v === "slides" || v === "infographic";
}

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const mine = ARTIFACTS.filter((a) => a.userId === user.id).sort((a, b) => b.createdAt - a.createdAt);
  return NextResponse.json({ artifacts: mine });
}

export async function POST(req: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

    const body = (await req.json()) as { type?: unknown; prompt?: unknown; config?: unknown };
    if (!isType(body.type)) {
      return NextResponse.json({ errors: { type: "请选择产物类型" } }, { status: 400 });
    }
    const type = body.type;
    const prompt = String(body.prompt ?? "").trim();
    const rawConfig = (body.config ?? {}) as Record<string, unknown>;
    const config: Record<string, string> = {};
    for (const [k, v] of Object.entries(rawConfig)) config[k] = String(v);

    // STUB 生成：不调用任何真实生成服务，直接返回占位制品。
    const artifact: Artifact = {
      id: `art_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
      userId: user.id,
      type,
      title: `${TYPE_LABEL[type]}`,
      prompt,
      config,
      status: "ready",
      preview: TYPE_PREVIEW[type],
      createdAt: Date.now(),
    };
    ARTIFACTS.push(artifact);
    return NextResponse.json({ artifact }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
