// portal 数据接入层 — GET /api/portal/pulse（p23/F02 的 Cloudflare 版，#523 Track A）
// 与产品面 apps/web 版本同一聚合契约（三源互不拖垮），差异只有两点：
//  1. phases 源从本地文件系统改为 GitHub Contents API（Workers 无文件系统）；
//  2. 门禁从产品 currentUser 改为 Cloudflare Access（accessUser）。
import { NextResponse } from "next/server";
import { accessUser } from "@/lib/access";
import { readRepoFile, listRepoDirs, githubConfigured } from "@/lib/repo-files";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const UPSTREAM_TIMEOUT_MS = 5_000;
const CACHE_TTL_MS = 60_000;

interface PhasePulse {
  id: string;
  name: string;
  passing: number;
  total: number;
}

type CoordClaim = { resource_id: string; agent_id: string; last_heartbeat_at: string; ttl_seconds: number };

interface PulsePayload {
  phases: { items: PhasePulse[]; totals: { passing: number; total: number } };
  coord:
    | { configured: false }
    | { configured: true; active_claims: CoordClaim[] }
    | { configured: true; error: string };
  github:
    | { configured: false }
    | { configured: true; merged_last_24h: number; flow_hours_median: number | null }
    | { configured: true; error: string };
  generated_at: string;
}

let cache: { key: string; payload: PulsePayload; expiresAt: number } | null = null;

function cacheKey(): string {
  return [process.env["COORD_SERVICE_URL"] ?? "", process.env["GITHUB_TOKEN"] ? "t" : "", process.env["GITHUB_REPO"] ?? ""].join("|");
}

async function readPhases(): Promise<PulsePayload["phases"]> {
  // GitHub 未配置时退回空列表形状（不是 configured:false）：pulse-tab 的契约里
  // phases 源"永远可用"（产品面它是本地文件）；空列表 = 尚未接线的诚实空态。
  if (!githubConfigured()) return { items: [], totals: { passing: 0, total: 0 } };
  const dirs = await listRepoDirs("phases");
  const items: PhasePulse[] = [];
  await Promise.all(
    dirs.map(async (dir) => {
      const raw = await readRepoFile(`phases/${dir}/feature_list.json`);
      if (!raw) return; // 无 feature_list 的 phase（纯 requirements 期）跳过，单个损坏不拖垮
      try {
        const doc = JSON.parse(raw) as { phase?: string; features?: Array<{ status?: string }> };
        const features = doc.features ?? [];
        items.push({
          id: doc.phase ?? dir,
          name: dir.replace(/^phase-[^-]+-/, ""),
          passing: features.filter((f) => f.status === "passing").length,
          total: features.length,
        });
      } catch {
        /* 单个 phase 损坏不拖垮聚合 */
      }
    })
  );
  items.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  const totals = items.reduce((a, p) => ({ passing: a.passing + p.passing, total: a.total + p.total }), { passing: 0, total: 0 });
  return { items, totals };
}

async function readCoord(): Promise<PulsePayload["coord"]> {
  const baseUrl = process.env["COORD_SERVICE_URL"];
  if (!baseUrl) return { configured: false };
  try {
    const res = await fetch(`${baseUrl}/status`, { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS), cache: "no-store" });
    if (!res.ok) return { configured: true, error: `upstream_${res.status}` };
    const body = (await res.json()) as { active_claims?: CoordClaim[] };
    return { configured: true, active_claims: body.active_claims ?? [] };
  } catch {
    return { configured: true, error: "unreachable" };
  }
}

async function readGithub(): Promise<PulsePayload["github"]> {
  const token = process.env["GITHUB_TOKEN"];
  const repo = process.env["GITHUB_REPO"];
  if (!token || !repo) return { configured: false };
  try {
    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    const res = await fetch(
      `https://api.github.com/search/issues?q=repo:${repo}+is:pr+is:merged+merged:>${since.slice(0, 10)}&per_page=100`,
      {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "boardx-devportal" },
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        cache: "no-store",
      }
    );
    if (!res.ok) return { configured: true, error: `upstream_${res.status}` };
    const body = (await res.json()) as { items?: Array<{ created_at: string; pull_request?: { merged_at?: string | null } }> };
    const merged = (body.items ?? []).filter((i) => i.pull_request?.merged_at);
    const flows = merged
      .map((i) => (new Date(i.pull_request!.merged_at!).getTime() - new Date(i.created_at).getTime()) / 3600_000)
      .sort((a, b) => a - b);
    const median = flows.length ? flows[Math.floor(flows.length / 2)]! : null;
    return { configured: true, merged_last_24h: merged.length, flow_hours_median: median === null ? null : Math.round(median * 10) / 10 };
  } catch {
    return { configured: true, error: "unreachable" };
  }
}

export async function GET(req: Request) {
  const user = await accessUser(req.headers);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const key = cacheKey();
  if (cache && cache.key === key && cache.expiresAt > Date.now()) return NextResponse.json(cache.payload);

  const [phases, coord, github] = await Promise.all([readPhases(), readCoord(), readGithub()]);
  const payload: PulsePayload = { phases, coord, github, generated_at: new Date().toISOString() };
  cache = { key, payload, expiresAt: Date.now() + CACHE_TTL_MS };
  return NextResponse.json(payload);
}
