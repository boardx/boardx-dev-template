// portal 数据接入层 — GET /api/portal/discussions（p23/F02 的 Cloudflare 版，#523 Track A）
// 与产品面同一聚合契约（叙述 issue 评论 + 人类/AI 分流 + needs_human 识别）；差异：
// registry.yaml 经 GitHub Contents API 读、门禁走 Cloudflare Access。
import { NextResponse } from "next/server";
import { parse } from "yaml";
import { accessUser } from "@/lib/access";
import { readRepoFile } from "@/lib/repo-files";

export const runtime = "edge";
export const dynamic = "force-dynamic";

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

function cacheKey(): string {
  return [process.env["GITHUB_TOKEN"] ? "t" : "", process.env["GITHUB_REPO"] ?? "", process.env["PORTAL_NARRATIVE_ISSUES"] ?? ""].join("|");
}

async function loadAgentIds(): Promise<Set<string>> {
  if (agentIdsCache && agentIdsCache.expiresAt > Date.now()) return agentIdsCache.ids;
  const raw = await readRepoFile(".harness/agents/registry.yaml");
  if (!raw) return new Set();
  try {
    const doc = parse(raw) as { agents?: Array<{ id: string }> };
    const ids = new Set((doc.agents ?? []).map((a) => a.id));
    agentIdsCache = { ids, expiresAt: Date.now() + 5 * 60_000 };
    return ids;
  } catch {
    return new Set();
  }
}

function classifyAuthor(ghLogin: string, body: string, agentIds: Set<string>): { who: string; isAgent: boolean } {
  const tagMatch = /【(coord-[\w-]+|wrk-[\w-]+|rev-[\w-]+)/.exec(body) ?? /by:(coord-[\w-]+|wrk-[\w-]+|rev-[\w-]+)/.exec(body);
  if (tagMatch && agentIds.has(tagMatch[1]!)) return { who: tagMatch[1]!, isAgent: true };
  if (/^coordinator-heartbeat/.test(body)) return { who: "coord-main", isAgent: true };
  return { who: ghLogin, isAgent: agentIds.has(ghLogin) };
}

export async function GET(req: Request) {
  const user = await accessUser(req.headers);
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
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "boardx-devportal" },
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
