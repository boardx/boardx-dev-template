// portal 数据接入层 — GET /api/portal/prs（p23/F04 的 Cloudflare 版，#523 Track A）
// open PR 队列（GitHub REST 单源）；门禁走 Cloudflare Access。降级契约与产品面一致。
import { NextResponse } from "next/server";
import { accessUser } from "@/lib/access";

export const runtime = "edge";
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

function cacheKey(): string {
  return [process.env["GITHUB_TOKEN"] ? "t" : "", process.env["GITHUB_REPO"] ?? ""].join("|");
}

export async function GET(req: Request) {
  const user = await accessUser(req.headers);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const token = process.env["GITHUB_TOKEN"];
  const repo = process.env["GITHUB_REPO"];
  if (!token || !repo) return NextResponse.json({ configured: false } satisfies PrsPayload);

  // F09：实时事件触发的重拉带 ?fresh=1 绕过 30s 缓存（否则 WS 信号到了数据还是旧的）；
  // 结果仍写回缓存，常规轮询照常受保护。
  const key = cacheKey();
  const fresh = new URL(req.url).searchParams.get("fresh") === "1";
  if (!fresh && cache && cache.key === key && cache.expiresAt > Date.now()) return NextResponse.json(cache.payload);

  let payload: PrsPayload;
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/pulls?state=open&per_page=50&sort=created&direction=asc`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "boardx-devportal" },
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
