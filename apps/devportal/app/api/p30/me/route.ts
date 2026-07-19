// GET /api/p30/me — p30/F08「/me 三栏真数据」聚合端点。
//
// 身份：会话层（lib/session.ts，getSessionUser，只读——不碰其签发/验签逻辑）；
// 未登录 401（正常路径不会到这里，middleware.ts 已在边缘拦截 /me）。
//
// 数据源三态契约（ADR-006，与 my-home/pulse 同款）：
//   - 待拍板@我：coord-gateway /events（lib/p30-decisions.ts 适配层，F09 落地前的
//     过渡实现，见该文件头注）。
//   - 我卡住的 PR：GitHub Search + Pulls API（GITHUB_TOKEN 只读 PAT，author:me）。
//   - 我的 agent 异常：registry.yaml（owner=我）+ coord-gateway /claims 心跳新鲜度。
//   - 项目/切换器：p30/F04（工作区多租户分片）尚未合并（#768 open）——降级为
//     GITHUB_REPO 单项目（当前部署形态本就是单仓门户）；F04 合并后把这里换成
//     真实的跨项目聚合，payload 契约（ProjectInfo[]）预留了扩展位。
//   - 无权限态（无项目成员资格）：p30/F01 平台目录（已合并）memberships 行——
//     只有当目录里存在这个 engineer_handle 且其在本项目没有 active/pending
//     membership 时才判定拒绝；查无该 engineer 视为「尚未纳入目录」（引导期），
//     不误伤——避免把「目录还没数据」误判成「明确没有资格」。
import { NextResponse } from "next/server";
import { parse } from "yaml";
import { getSessionUser } from "@/lib/session";
import { readRepoFile } from "@/lib/repo-files";
import { fetchActiveClaims, fetchDirectoryMemberships, fetchRecentEvents } from "@/lib/coord-gateway";
import { buildDecisionSignals } from "@/lib/p30-decisions";
import type { AgentAnomalyItem, MeApiPayload, StuckPrItem } from "@/lib/p30-me-types";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const UPSTREAM_TIMEOUT_MS = 8_000;
const STALE_HOURS = 3; // 一个工作周期，沿用 my-home 同款阈值
const MAX_PR_DETAIL_CALLS = 10;

interface RegistryAgent {
  id: string;
  owner?: string;
  active?: boolean;
}

function projectFromRepo(): { slug: string; name: string } | null {
  const repo = process.env["GITHUB_REPO"];
  if (!repo) return null;
  const name = repo.split("/")[1] ?? repo;
  return { slug: name, name };
}

async function loadMyRegistryAgents(login: string): Promise<RegistryAgent[]> {
  const raw = await readRepoFile(".harness/agents/registry.yaml");
  if (!raw) return [];
  try {
    const doc = parse(raw) as { agents?: RegistryAgent[] };
    return (doc.agents ?? []).filter((a) => a.active !== false && (a.owner ?? "").toLowerCase() === login.toLowerCase());
  } catch {
    return [];
  }
}

async function loadAnomalies(login: string): Promise<{ degraded: boolean; items: AgentAnomalyItem[] }> {
  const mine = await loadMyRegistryAgents(login);
  if (mine.length === 0) return { degraded: false, items: [] };
  const claims = await fetchActiveClaims();
  if (!claims.configured) return { degraded: false, items: [] }; // 未配置 ≠ 故障，空态而非降级
  if ("error" in claims) return { degraded: true, items: [] };

  const byAgent = new Map(claims.claims.map((c) => [c.agent_id, c] as const));
  const now = Date.now();
  const items: AgentAnomalyItem[] = [];
  for (const a of mine) {
    const claim = byAgent.get(a.id);
    if (!claim) continue; // 无活跃租约 = 当前空闲，不是异常（无法判定心跳）
    const ageMin = (now - new Date(claim.last_heartbeat_at).getTime()) / 60_000;
    const ttlMin = (claim.ttl_seconds ?? 10_800) / 60;
    if (ageMin >= ttlMin) {
      items.push({
        id: `${a.id}-${claim.resource_id}`,
        agentId: a.id,
        kind: "heartbeat-lost",
        sinceMin: Math.round(ageMin - ttlMin),
        detail: `租约 ${claim.resource_id} 已超过 TTL（${Math.round(ttlMin)}min）未见心跳。`,
      });
    }
  }
  return { degraded: false, items };
}

interface GhSearchItem {
  number: number;
  title: string;
  html_url: string;
  created_at: string;
  draft?: boolean;
}

interface GhPrDetail {
  mergeable_state?: string;
  requested_reviewers?: unknown[];
}

async function loadStuckPrs(login: string): Promise<{ degraded: boolean; items: StuckPrItem[] }> {
  const token = process.env["GITHUB_TOKEN"];
  const repo = process.env["GITHUB_REPO"];
  if (!token || !repo) return { degraded: false, items: [] };
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "boardx-devportal" };
  const now = Date.now();

  let searchItems: GhSearchItem[];
  try {
    const res = await fetch(
      `https://api.github.com/search/issues?q=repo:${repo}+is:pr+is:open+author:${login}&per_page=20`,
      { headers, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS), cache: "no-store" },
    );
    if (!res.ok) return { degraded: true, items: [] };
    const body = (await res.json()) as { items?: GhSearchItem[] };
    searchItems = (body.items ?? []).filter((p) => !p.draft);
  } catch {
    return { degraded: true, items: [] };
  }

  const candidates = searchItems.filter((p) => (now - new Date(p.created_at).getTime()) / 3_600_000 >= STALE_HOURS);
  const items: StuckPrItem[] = [];
  for (const p of candidates.slice(0, MAX_PR_DETAIL_CALLS)) {
    const ageHours = (now - new Date(p.created_at).getTime()) / 3_600_000;
    let waitingOn = "超过一个工作周期未推进";
    try {
      const detailRes = await fetch(`https://api.github.com/repos/${repo}/pulls/${p.number}`, {
        headers, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS), cache: "no-store",
      });
      if (detailRes.ok) {
        const detail = (await detailRes.json()) as GhPrDetail;
        if (detail.mergeable_state === "dirty") waitingOn = "存在合并冲突，需要你解决";
        else if (detail.mergeable_state === "blocked") waitingOn = "被 required check 阻塞（等待 CI/Review）";
        else if (detail.mergeable_state === "behind") waitingOn = "落后目标分支，需要 rebase/更新";
        else if ((detail.requested_reviewers ?? []).length > 0) waitingOn = "等待 review";
      }
    } catch {
      /* 详情不可达时保留默认 waitingOn，不拖垮整个列表 */
    }
    items.push({
      id: `pr-${p.number}`,
      number: p.number,
      title: p.title,
      url: p.html_url,
      ageHours: Math.round(ageHours * 10) / 10,
      waitingOn,
    });
  }
  return { degraded: false, items };
}

async function loadDecisions(projectSlug: string, login: string): Promise<{ degraded: boolean; items: ReturnType<typeof buildDecisionSignals> }> {
  const result = await fetchRecentEvents(200);
  if (!result.configured) return { degraded: false, items: [] };
  if ("error" in result) return { degraded: true, items: [] };
  return { degraded: false, items: buildDecisionSignals(result.events, projectSlug, login) };
}

/** 无权限态判定：目录里存在这个 handle 但在本项目没有 active/pending membership。
 *  目录未配置/不可达/查无该 handle → 不拒绝（引导期，宁可放过不可错杀，见文件头注）。 */
async function checkAccessDenied(login: string, projectSlug: string | undefined): Promise<{ denied: boolean; reason?: string }> {
  if (!projectSlug) return { denied: false };
  const result = await fetchDirectoryMemberships();
  if (!result.configured || "error" in result) return { denied: false };
  const mine = result.memberships.filter((m) => m.engineer_handle.toLowerCase() === login.toLowerCase());
  if (mine.length === 0) return { denied: false }; // 目录未纳入此人，视为引导期未迁移
  const forProject = mine.filter((m) => m.project_slug === projectSlug);
  if (forProject.length === 0) return { denied: false }; // 有目录身份但项目未建档，同样不误伤
  const hasAccess = forProject.some((m) => m.status === "active" || m.status === "pending");
  return hasAccess ? { denied: false } : { denied: true, reason: "membership_suspended" };
}

export async function GET(req: Request) {
  const user = await getSessionUser(req.headers);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const project = projectFromRepo();
  const access = await checkAccessDenied(user.login, project?.slug);

  if (access.denied) {
    const payload: MeApiPayload = {
      login: user.login,
      access: "denied",
      accessReason: access.reason,
      project: project ? { ...project, badgeCount: 0 } : null,
      decisions: { state: "ready", items: [] },
      stuckPrs: { state: "ready", items: [] },
      anomalies: { state: "ready", items: [] },
      generatedAt: new Date().toISOString(),
    };
    return NextResponse.json(payload);
  }

  const [decisions, stuckPrs, anomalies] = await Promise.all([
    loadDecisions(project?.slug ?? "unknown", user.login),
    loadStuckPrs(user.login),
    loadAnomalies(user.login),
  ]);

  // UC-18：侧栏红点只计最高级——待拍板 > agent 异常 > 卡住的 PR。
  const badgeCount = decisions.items.length || anomalies.items.length || stuckPrs.items.length;

  const payload: MeApiPayload = {
    login: user.login,
    access: "granted",
    project: project ? { ...project, badgeCount } : null,
    decisions: decisions.degraded ? { state: "degraded", items: [] } : { state: "ready", items: decisions.items },
    stuckPrs: stuckPrs.degraded ? { state: "degraded", items: [] } : { state: "ready", items: stuckPrs.items },
    anomalies: anomalies.degraded ? { state: "degraded", items: [] } : { state: "ready", items: anomalies.items },
    generatedAt: new Date().toISOString(),
  };
  return NextResponse.json(payload);
}
