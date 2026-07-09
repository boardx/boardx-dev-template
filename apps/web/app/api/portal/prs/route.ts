// portal 数据接入层 — GET /api/portal/prs（p23/F04）
// open PR 队列：GitHub REST /repos/{repo}/pulls?state=open 单源聚合。
// GITHUB_TOKEN/GITHUB_REPO 未配置 → {configured:false}（合法部署中间态，前端渲染
// unconfigured 而非报错）；上游失败 → {configured:true, error}（降级不 5xx）——
// 与 /api/portal/pulse、/api/portal/discussions 同一降级哲学，互不拖垮。
// 门禁：登录可见（门户面向全体开发者）。
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPSTREAM_TIMEOUT_MS = 5_000;
const CACHE_TTL_MS = 30_000;

export interface PrItem {
  number: number;
  title: string;
  url: string;
  draft: boolean;
  created_at: string;
  updated_at: string;
}

type PrsPayload =
  | { configured: false }
  | { configured: true; error: string }
  | { configured: true; items: PrItem[]; generated_at: string };

let cache: { key: string; payload: PrsPayload; expiresAt: number } | null = null;

/** 缓存键含配置指纹：环境变量变化（含测试间切换）即自然失效，不吃旧配置的缓存。 */
function cacheKey(): string {
  return [process.env["GITHUB_TOKEN"] ? "t" : "", process.env["GITHUB_REPO"] ?? ""].join("|");
}

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const token = process.env["GITHUB_TOKEN"];
  const repo = process.env["GITHUB_REPO"];
  if (!token || !repo) return NextResponse.json({ configured: false } satisfies PrsPayload);

  const key = cacheKey();
  if (cache && cache.key === key && cache.expiresAt > Date.now()) return NextResponse.json(cache.payload);

  let payload: PrsPayload;
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/pulls?state=open&per_page=50&sort=created&direction=asc`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "boardx-portal" },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) {
      payload = { configured: true, error: `upstream_${res.status}` };
    } else {
      const body = (await res.json()) as Array<{
        number: number;
        title: string;
        html_url: string;
        draft?: boolean;
        created_at: string;
        updated_at: string;
      }>;
      payload = {
        configured: true,
        items: (Array.isArray(body) ? body : []).map((pr) => ({
          number: pr.number,
          title: pr.title,
          url: pr.html_url,
          draft: pr.draft === true,
          created_at: pr.created_at,
          updated_at: pr.updated_at,
        })),
        generated_at: new Date().toISOString(),
      };
    }
  } catch {
    payload = { configured: true, error: "unreachable" };
  }
  cache = { key, payload, expiresAt: Date.now() + CACHE_TTL_MS };
  return NextResponse.json(payload);
}
