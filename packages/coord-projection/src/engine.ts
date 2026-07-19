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
    }
  | {
      // p30/F09：intent.* 事件的 GitHub issue 双写（每条意图消息一条评论，非幂等覆盖——
      // 与 commit_status/check_run 不同，重投会产生重复评论；游标推进模型下这是可接受的
      // at-least-once-but-may-under-deliver 取舍，见 apply.ts 顶部注释与 intents.md）。
      kind: "issue_comment";
      issue_number: number;
      body: string;
    };

// 活跃租约快照（RepoHub GET /claims 的行）：lease check 的状态对账输入（#723-2）
export interface ActiveLease {
  lease_id: string;
  resource_id: string;
  agent_id: string;
  claimed_at: string;
  expires_at: string;
}

export interface ProjectionInput {
  events: ProjectionEvent[];
  openPrs: OpenPr[];
  andon: AndonState;
  /** 当前活跃租约快照；缺省 []（老调用方兼容）。用于 lease check 的每 tick 对账补投。 */
  leases?: ActiveLease[];
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

const INTENT_EMOJI: Record<string, string> = {
  "intent.assign": "📨",
  "intent.accept": "✅",
  "intent.progress": "🔄",
  "intent.blocker": "🚧",
  "intent.escalate": "🆙",
  "intent.decide": "⚖️",
};

// scoped agent 完全掌控 payload 里的自由文本字段（summary/reason/note/...，甚至能塞
// 任意 key，validateIntentRequest 只检查必填字段存在，不禁止多余字段）以及 agent_id
// 本身（受 token 身份绑定但格式不限）。这些值原样拼进 GitHub 评论 Markdown 会让
// scoped agent 靠换行 + markdown 语法伪造出一条看起来像"人类已拍板/新事件"的假评论，
// 还能借 @mention/#issue 引用触发真实 GitHub 通知——独立安全审 #772 阻断项，修复：
// 剥离换行（防止注入的文本另起一行伪造新的评论结构）+ 反引号包裹成行内代码
// （GitHub 在代码 span 内不解析 @mention/#引用/**加粗** 等 markdown，从根上失效）。
function sanitizeInline(v: string): string {
  const collapsed = v.replace(/\r\n|\r|\n/g, " ").trim();
  // 反引号包裹前转义内部反引号，防止提前闭合代码 span 后剩余内容又被当 markdown 解析
  const escaped = collapsed.replace(/`/g, "'");
  return escaped.length > 0 ? `\`${escaped}\`` : "`(空)`";
}

// intent.* 事件 → 结构化 GitHub issue 评论正文（p30/F09，events.md §Intents）。
// 纯格式化，无 IO；payload 字段直接铺开，devportal talk tab 与 GitHub 镜像看到同一份内容。
// 除固定的 emoji/type/at 外，其余一切来自请求方的内容（agent_id、payload 的 key 与
// value）在拼接前一律经 sanitizeInline——type 是校验过的封闭枚举，at 是服务端生成的
// ISO 时间戳，两者可信，不需要转义。
function intentCommentBody(ev: ProjectionEvent): string {
  const emoji = INTENT_EMOJI[ev.type] ?? "💬";
  const lines = [`${emoji} **${ev.type}** · ${sanitizeInline(ev.agent_id)} · ${ev.at}`, ""];
  for (const [k, v] of Object.entries(ev.payload)) {
    if (v === null || v === undefined || v === "") continue;
    lines.push(`- ${sanitizeInline(k)}: ${sanitizeInline(String(v))}`);
  }
  lines.push("", `<sub>coord intent · event_id=${sanitizeInline(ev.event_id)}</sub>`);
  return lines.join("\n");
}

export function project(input: ProjectionInput): GithubCall[] {
  const { events, openPrs, andon, leases, now } = input;
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

  // ---- lease 对账：状态驱动补投（#723-2，对齐 andon 的模式）----
  // 事件路径是 at-least-once 但游标无条件推进：apply 失败（GitHub 瞬断等）后
  // 事件不会重来，纯事件驱动会永久漏投。这里按活跃租约快照每 tick 重投
  // claimed check（GitHub check_run 按 name 幂等覆盖，重投无害），漏投在下一
  // tick 自愈。放在事件循环之后覆盖：快照是当前真值，批内 stale 事件不得回退它。
  // 残留边界：released/expired 是结束态、无状态快照可对账，仍仅事件驱动——
  // 其 apply 失败会残留 stale success，直到该 issue 下一次租约活动才被覆盖；
  // coord/lease 是信息性 check、不阻断合并，接受此残留（PR body 有取舍说明）。
  for (const lease of leases ?? []) {
    const m = lease.resource_id.match(/^issue:(\d+)$/);
    if (!m) continue; // 与事件路径同口径：非 issue 租约无 PR 锚点
    const remainMin = Math.max(0, Math.round((Date.parse(lease.expires_at) - now) / 60000));
    for (const pr of prsForIssue(openPrs, Number(m[1]))) {
      if (!pr.head_sha) continue;
      checkBySha.set(pr.head_sha, {
        kind: "check_run", head_sha: pr.head_sha, name: "coord/lease",
        conclusion: "success",
        title: `持有者 ${lease.agent_id} · TTL 剩余 ${remainMin}m`,
        summary: `租约 ${lease.lease_id} 于 ${lease.claimed_at} 认领 ${lease.resource_id}。`,
      });
    }
  }

  // ---- intent.* 双写：issue:N 锚定的意图消息 → 该 issue 一条评论 ----
  // 与 andon/lease 不同：每个事件产生独立评论，不按 sha/issue 去重覆盖——
  // 一条意图消息 = 一条历史记录，覆盖会丢消息。resource_id 非 issue:N（feature:/module:/
  // custom: 锚定）的意图 v1 无 PR/issue 可挂，不双写（events 本身仍是权威历史）。
  const intentCalls: GithubCall[] = [];
  for (const ev of events) {
    if (!ev.type.startsWith("intent.")) continue;
    const m = ev.resource_id.match(/^issue:(\d+)$/);
    if (!m) continue;
    intentCalls.push({ kind: "issue_comment", issue_number: Number(m[1]), body: intentCommentBody(ev) });
  }

  return [...statusBySha.values(), ...checkBySha.values(), ...intentCalls];
}
