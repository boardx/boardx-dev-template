import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 公开分享只读会话。无需鉴权（公开分享入口）。
// STUB: 内存样例数据按 id 索引；真实实现应从 thread/shareToken 解析公开内容。
// 已知 id（如 "demo"）返回样例消息；未知 id → 404。私有内容不可通过此入口访问。
type ShareMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

type SharedThread = {
  id: string;
  title: string;
  agent?: { name: string; description: string };
  messages: ShareMessage[];
};

const SAMPLE_THREADS: Record<string, SharedThread> = {
  demo: {
    id: "demo",
    title: "Q3 launch planning",
    agent: { name: "AVA", description: "Your AI workspace assistant" },
    messages: [
      { id: "m1", role: "user", text: "帮我梳理一下 Q3 发布的关键里程碑。" },
      {
        id: "m2",
        role: "assistant",
        text: "好的，Q3 发布建议分三个阶段：1) 内测与反馈收集；2) 文档与发布物料准备；3) 正式上线与公告。每个阶段都设一个负责人和验收标准。",
      },
      { id: "m3", role: "user", text: "内测阶段大概需要多久？" },
      {
        id: "m4",
        role: "assistant",
        text: "通常 2-3 周比较合理：第 1 周邀请核心用户，第 2 周修复高优问题，第 3 周做回归与签收。",
      },
    ],
  },
  empty: {
    id: "empty",
    title: "Untitled chat",
    messages: [],
  },
};

export function GET(_req: Request, { params }: { params: { id: string } }) {
  const thread = SAMPLE_THREADS[params.id];
  if (!thread) {
    return NextResponse.json({ error: "分享不存在或链接已失效" }, { status: 404 });
  }
  return NextResponse.json({ thread });
}
