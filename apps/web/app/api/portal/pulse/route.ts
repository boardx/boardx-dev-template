// portal 数据接入层 — GET /api/portal/pulse（p23/F02）
// 聚合三个互不拖垮的数据源（任一源失败只降级自己的字段，不 5xx 整个响应）：
//  1. phases：本仓 phases/*/feature_list.json（本地文件，永远可用）
//  2. coord：coord-service 公开 GET /status（COORD_SERVICE_URL 未配置 → configured:false）
//  3. github：近 24h 合并 PR 的 flow-time（GITHUB_TOKEN/GITHUB_REPO 未配置 → configured:false）
// 门禁：登录可见（非 SysAdmin 专属——门户面向全体开发者，use-cases N1）。
import { NextResponse } from "next/server";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REPO_ROOT = path.join(process.cwd(), "..", "..");
const UPSTREAM_TIMEOUT_MS = 5_000;
const CACHE_TTL_MS = 30_000;

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

/** 缓存键含配置指纹：环境变量变化（含测试间切换）即自然失效，不吃旧配置的缓存。 */
function cacheKey(): string {
  return [process.env["COORD_SERVICE_URL"] ?? "", process.env["GITHUB_TOKEN"] ? "t" : "", process.env["GITHUB_REPO"] ?? ""].join("|");
}

async function readPhases(): Promise<PulsePayload["phases"]> {
  const phasesDir = path.join(REPO_ROOT, "phases");
  const entries = await readdir(phasesDir, { withFileTypes: true });
  const items: PhasePulse[] = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    try {
      const raw = await readFile(path.join(phasesDir, e.name, "feature_list.json"), "utf8");
      const doc = JSON.parse(raw) as { phase?: string; features?: Array<{ status?: string }> };
      const features = doc.features ?? [];
      items.push({
        id: doc.phase ?? e.name,
        name: e.name.replace(/^phase-[^-]+-/, ""),
        passing: features.filter((f) => f.status === "passing").length,
        total: features.length,
      });
    } catch {
      // 单个 phase 文件损坏不拖垮整个聚合
    }
  }
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
      `https://api.github.com/search/issues?q=repo:${repo}+is:pr+is:merged+merged:>=${since.slice(0, 10)}&per_page=50`,
      {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "boardx-portal" },
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        cache: "no-store",
      }
    );
    if (!res.ok) return { configured: true, error: `upstream_${res.status}` };
    const body = (await res.json()) as { items?: Array<{ created_at: string; closed_at: string }> };
    const durations = (body.items ?? [])
      .map((pr) => (new Date(pr.closed_at).getTime() - new Date(pr.created_at).getTime()) / 3600_000)
      .filter((h) => Number.isFinite(h) && h >= 0)
      .sort((a, b) => a - b);
    const median = durations.length === 0 ? null : durations[Math.floor(durations.length / 2)]!;
    return { configured: true, merged_last_24h: durations.length, flow_hours_median: median === null ? null : Math.round(median * 10) / 10 };
  } catch {
    return { configured: true, error: "unreachable" };
  }
}

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const key = cacheKey();
  if (cache && cache.key === key && cache.expiresAt > Date.now()) return NextResponse.json(cache.payload);

  // 三源并行、互不拖垮：Promise.all 中每个源各自 catch 成降级值，绝不整体抛
  const [phases, coord, github] = await Promise.all([readPhases(), readCoord(), readGithub()]);
  const payload: PulsePayload = { phases, coord, github, generated_at: new Date().toISOString() };
  cache = { key, payload, expiresAt: Date.now() + CACHE_TTL_MS };
  return NextResponse.json(payload);
}
