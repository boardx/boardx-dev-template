// portal 数据接入层 — GET /api/portal/discussions（p23/F02）
// 聚合叙述层讨论：GitHub 叙述 issue（PORTAL_NARRATIVE_ISSUES，默认 "323,452"）的
// 最近评论，按作者分类 👤 人类 / 🤖 agent（作者名匹配 registry.yaml 身份表则为 agent），
// 识别"待人类拍板"（needs_human）：正文含约定标记（需要人类批复/待人类拍板/需要人类拍板/
// needs_human）。GITHUB_TOKEN/GITHUB_REPO 未配置 → {configured:false}（合法中间态，
// 前端渲染"未接线"而非报错）——与 coordination/status 代理同一降级哲学。
// 权威在 GitHub：本路由只读聚合，门户不提供评论写入。
import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REPO_ROOT = path.join(process.cwd(), "..", "..");
const UPSTREAM_TIMEOUT_MS = 8_000;
const CACHE_TTL_MS = 60_000;
const NEEDS_HUMAN_RE = /需要人类批复|待人类拍板|需要人类拍板|needs[_\s-]?human/i;

export interface DiscussionItem {
  who: string;
  isAgent: boolean;
  at: string;
  src: string;
  url: string;
  excerpt: string;
  needsHuman: boolean;
}

let agentIdsCache: { ids: Set<string>; expiresAt: number } | null = null;
let cache: { key: string; payload: object; expiresAt: number } | null = null;

/** 缓存键含配置指纹：环境变量变化（含测试间切换）即自然失效。 */
function cacheKey(): string {
  return [process.env["GITHUB_TOKEN"] ? "t" : "", process.env["GITHUB_REPO"] ?? "", process.env["PORTAL_NARRATIVE_ISSUES"] ?? ""].join("|");
}

async function loadAgentIds(): Promise<Set<string>> {
  if (agentIdsCache && agentIdsCache.expiresAt > Date.now()) return agentIdsCache.ids;
  try {
    const raw = await readFile(path.join(REPO_ROOT, ".harness", "agents", "registry.yaml"), "utf8");
    const doc = parse(raw) as { agents?: Array<{ id: string }> };
    const ids = new Set((doc.agents ?? []).map((a) => a.id));
    agentIdsCache = { ids, expiresAt: Date.now() + 5 * 60_000 };
    return ids;
  } catch {
    return new Set();
  }
}

/** 评论正文形如 "【coord-architecture 巡检】…" 或 "module-coordinator-update by:coord-ava …"
 *  时，把真实发言 agent 从正文里识别出来（总线评论都是同一个 GitHub 账号发的，
 *  账号名区分不了 agent——这是 agentic 总线的已知形态）。 */
function classifyAuthor(ghLogin: string, body: string, agentIds: Set<string>): { who: string; isAgent: boolean } {
  const tagMatch = /【(coord-[\w-]+|wrk-[\w-]+|rev-[\w-]+)/.exec(body) ?? /by:(coord-[\w-]+|wrk-[\w-]+|rev-[\w-]+)/.exec(body);
  if (tagMatch && agentIds.has(tagMatch[1]!)) return { who: tagMatch[1]!, isAgent: true };
  if (/^coordinator-heartbeat/.test(body)) return { who: "coord-main", isAgent: true };
  return { who: ghLogin, isAgent: agentIds.has(ghLogin) };
}

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const token = process.env["GITHUB_TOKEN"];
  const repo = process.env["GITHUB_REPO"];
  if (!token || !repo) return NextResponse.json({ configured: false });

  const key = cacheKey();
  if (cache && cache.key === key && cache.expiresAt > Date.now()) return NextResponse.json(cache.payload);

  const issues = (process.env["PORTAL_NARRATIVE_ISSUES"] ?? "323,452").split(",").map((s) => s.trim()).filter(Boolean);
  const agentIds = await loadAgentIds();
  const items: DiscussionItem[] = [];

  for (const issue of issues) {
    try {
      const res = await fetch(`https://api.github.com/repos/${repo}/issues/${issue}/comments?per_page=30&sort=created&direction=desc`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "boardx-portal" },
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        cache: "no-store",
      });
      if (!res.ok) continue; // 单个 issue 失败不拖垮整体
      const comments = (await res.json()) as Array<{ user: { login: string }; created_at: string; body: string; html_url: string }>;
      for (const c of comments) {
        const { who, isAgent } = classifyAuthor(c.user.login, c.body, agentIds);
        items.push({
          who,
          isAgent,
          at: c.created_at,
          src: `#${issue}`,
          url: c.html_url,
          excerpt: c.body.slice(0, 280),
          needsHuman: NEEDS_HUMAN_RE.test(c.body),
        });
      }
    } catch {
      // 网络失败：跳过该 issue，保持互不拖垮
    }
  }
  items.sort((a, b) => (a.at < b.at ? 1 : -1));

  const payload = {
    configured: true,
    items: items.slice(0, 60),
    needs_human_count: items.filter((i) => i.needsHuman).length,
    generated_at: new Date().toISOString(),
  };
  cache = { key, payload, expiresAt: Date.now() + CACHE_TTL_MS };
  return NextResponse.json(payload);
}
