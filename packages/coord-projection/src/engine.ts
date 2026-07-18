// 纯函数投影引擎（F06）：事件批次 + 镜像 open PRs + 当前 andon 状态 →
// GitHub API 调用描述列表。不做任何 IO——可注入、可表驱动测试；
// 真正发请求在 apply.ts。语义权威：events.md §Andon 与 feature F06。

export interface ProjectionEvent {
  event_id: string;
  type: string;
  resource_id: string;
  agent_id: string;
  at: string;
  payload: Record<string, unknown>;
}

export interface OpenPr {
  number: number;
  title: string;
  body: string | null;
  head_sha: string | null;
}

export interface AndonState {
  active: boolean;
  andons: Array<{ scope: string; reason: string; raised_by: string; raised_at: string }>;
}

export type GithubCall =
  | {
      kind: "commit_status";
      sha: string;
      state: "success" | "failure";
      context: "coord/andon";
      description: string;
    }
  | {
      kind: "check_run";
      head_sha: string;
      name: "coord/lease";
      conclusion: "success" | "neutral";
      title: string;
      summary: string;
    };

export interface ProjectionInput {
  events: ProjectionEvent[];
  openPrs: OpenPr[];
  andon: AndonState;
  now: number; // 注入时钟：TTL 剩余可确定性计算
}

const DESC_MAX = 140; // commit status description 上限（GitHub 硬限制附近留余量）

function truncate(s: string, max = DESC_MAX): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

// issue:N → 关联 PR：title/body 含 "#N"（词边界，防 #12 命中 #123）
function prsForIssue(openPrs: OpenPr[], issueNumber: number): OpenPr[] {
  const re = new RegExp(`#${issueNumber}(?!\\d)`);
  return openPrs.filter((pr) => re.test(pr.title) || (pr.body !== null && re.test(pr.body)));
}

function leaseCheck(ev: ProjectionEvent, now: number): { conclusion: "success" | "neutral"; title: string; summary: string } {
  const p = ev.payload;
  if (ev.type === "lease.claimed") {
    const ttl = typeof p["ttl_seconds"] === "number" ? (p["ttl_seconds"] as number) : null;
    const remainMin = ttl === null ? null : Math.max(0, Math.round((Date.parse(ev.at) + ttl * 1000 - now) / 60000));
    return {
      conclusion: "success",
      title: `持有者 ${ev.agent_id}${remainMin === null ? "" : ` · TTL 剩余 ${remainMin}m`}`,
      summary: `租约 ${String(p["lease_id"] ?? "?")} 于 ${ev.at} 认领 ${ev.resource_id}。`,
    };
  }
  const note = typeof p["handoff_note"] === "string" ? (p["handoff_note"] as string) : "（无交接说明）";
  if (ev.type === "lease.released") {
    return {
      conclusion: "neutral",
      title: `租约已释放（${ev.agent_id}）`,
      summary: `交接说明：${note}`,
    };
  }
  return {
    conclusion: "neutral",
    title: `租约已过期（${ev.agent_id}）`,
    summary: `TTL 到期机械回收，资源可重新认领。交接说明：${note}`,
  };
}

export function project(input: ProjectionInput): GithubCall[] {
  const { events, openPrs, andon, now } = input;
  // 同一目标（status 同 sha / check 同 sha）多次触发时后者覆盖前者——按事件序保序去重
  const statusBySha = new Map<string, GithubCall>();
  const checkBySha = new Map<string, GithubCall>();

  // ---- andon：状态驱动 + 每 tick 对账 ----
  // active → 所有 open PR 补投 failure（覆盖停线期间新 mirror 进来的 PR）；
  // 非 active 且本批含 andon.cleared → 恢复 success。
  const cleared = events.filter((e) => e.type === "andon.cleared");
  if (andon.active) {
    const head = andon.andons[0];
    const desc = truncate(`停线（${head?.scope ?? "repo"}）：${head?.reason ?? ""}`);
    for (const pr of openPrs) {
      if (!pr.head_sha) continue;
      statusBySha.set(pr.head_sha, {
        kind: "commit_status", sha: pr.head_sha, state: "failure", context: "coord/andon", description: desc,
      });
    }
  } else if (cleared.length > 0) {
    const last = cleared[cleared.length - 1]!;
    const desc = truncate(`停线已解除：${String(last.payload["reason"] ?? "")}`);
    for (const pr of openPrs) {
      if (!pr.head_sha) continue;
      statusBySha.set(pr.head_sha, {
        kind: "commit_status", sha: pr.head_sha, state: "success", context: "coord/andon", description: desc,
      });
    }
  }

  // ---- lease：issue:N 事件 → 关联 open PR 的 coord/lease check ----
  for (const ev of events) {
    if (ev.type !== "lease.claimed" && ev.type !== "lease.released" && ev.type !== "lease.expired") continue;
    const m = ev.resource_id.match(/^issue:(\d+)$/);
    if (!m) continue; // feature:/role:/module: 租约无 PR 锚点，v0 不投影
    const spec = leaseCheck(ev, now);
    for (const pr of prsForIssue(openPrs, Number(m[1]))) {
      if (!pr.head_sha) continue;
      checkBySha.set(pr.head_sha, {
        kind: "check_run", head_sha: pr.head_sha, name: "coord/lease",
        conclusion: spec.conclusion, title: spec.title, summary: spec.summary,
      });
    }
  }

  return [...statusBySha.values(), ...checkBySha.values()];
}
