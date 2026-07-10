// portal 文档阅读 — GET /api/portal/doc?name=<key>（#523 Track A 补：学习页真渲染）
// 白名单制：只暴露 onboarding 相关文档，不做任意路径读取（防把 PAT 变成任意仓库
// 内容的公开代理）。内容随 main 更新（Contents API 读 main 分支）。
import { NextResponse } from "next/server";
import { accessUser } from "@/lib/access";
import { readRepoFile } from "@/lib/repo-files";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const DOC_WHITELIST: Record<string, { path: string; title: string }> = {
  "human-onboarding": { path: ".harness/instructions/human-developer-onboarding.md", title: "人类开发者上手指南" },
  "agent-bootstrap": { path: ".harness/instructions/agent-bootstrap.md", title: "Agent Bootstrap（接入执行书）" },
  "agent-checklist": { path: ".harness/instructions/agent-onboarding-checklist.md", title: "Agent 接入规则清单" },
  "work-cycle": { path: ".harness/instructions/work-cycle-proposal.md", title: "3 小时工作周期与 flow time" },
};

const CACHE_TTL_MS = 5 * 60_000;
const cache = new Map<string, { markdown: string; expiresAt: number }>();

export async function GET(req: Request) {
  const user = await accessUser(req.headers);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const name = new URL(req.url).searchParams.get("name") ?? "";
  const doc = DOC_WHITELIST[name];
  if (!doc) return NextResponse.json({ error: "unknown_doc" }, { status: 404 });

  const hit = cache.get(name);
  if (hit && hit.expiresAt > Date.now()) {
    return NextResponse.json({ title: doc.title, markdown: hit.markdown });
  }
  const markdown = await readRepoFile(doc.path);
  if (!markdown) return NextResponse.json({ error: "doc_unavailable" }, { status: 502 });
  cache.set(name, { markdown, expiresAt: Date.now() + CACHE_TTL_MS });
  return NextResponse.json({ title: doc.title, markdown });
}
