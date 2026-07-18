// ⚠️ p30 UI 先行 mock，feature 实现时替换（ADR-003：本文件只服务 ui-signoff 原型，
// 不得被任何真实数据路径 import）。三个界面（M1 /me、M2 /me/agents、W5 /p/:slug/people）
// 的全部数据都集中在这里，方便人类核对与后续删除。
//
// 三色体系（N6，全站一致）：👤 人类 = tag-blue；🤖 agent = tag-purple；项目 = tag-green。
export const TRI_COLOR = {
  human: "bg-tag-blue text-foreground",
  agent: "bg-tag-purple text-foreground",
  project: "bg-tag-green text-foreground",
} as const;

/** 当前登录者（mock）：@usamshen。D6：agent 标识 = @handle/agent-name。 */
export const MOCK_ME = { handle: "usamshen", name: "Usam Shen" } as const;

// ---------------- M1 /me 跨项目工作台 ----------------

export interface MockProjectPulse {
  slug: string;
  name: string;
  /** 一行式脉搏叙述（mock） */
  pulseLine: string;
  /** 侧栏切换器红点计数（只计最高级通知，UC-18） */
  badgeCount: number;
  openPrs: number;
  activeAgents: number;
  andon: boolean;
}

export interface MockDecision {
  id: string;
  projectSlug: string;
  title: string;
  /** SLA 剩余小时（排序键，越小越靠前） */
  slaHoursLeft: number;
  /** 发起者（agent 全名 @handle/name） */
  from: string;
  kind: "decide" | "raise-concern";
  /** 展开区「为什么需要我?」——agent 推理（UC-09） */
  why: string[];
}

export interface MockStuckPr {
  id: string;
  number: number;
  projectSlug: string;
  title: string;
  ageHours: number;
  waitingOn: string;
}

export interface MockAgentAnomaly {
  id: string;
  agentId: string;
  projectSlug: string;
  kind: "heartbeat-lost" | "stale-lease" | "token-expiring";
  sinceMin: number;
  detail: string;
}

export interface MockMorningBrief {
  narrative: string;
  from: string;
  generatedAt: string;
}

export const MOCK_PROJECTS: readonly MockProjectPulse[] = [
  {
    slug: "boardx",
    name: "BoardX",
    pulseLine: "6 个 PR 在队列（2 个全绿待合）· 4 个 agent 在干活 · sprint p30/01 完成 62%",
    badgeCount: 3,
    openPrs: 6,
    activeAgents: 4,
    andon: false,
  },
  {
    slug: "acme-crm",
    name: "Acme CRM",
    pulseLine: "1 个 andon 拉停（数据迁移脚本）· 2 个 agent 暂停等待 · 今日 0 合并",
    badgeCount: 2,
    openPrs: 2,
    activeAgents: 1,
    andon: true,
  },
] as const;

export const MOCK_BRIEF: MockMorningBrief = {
  from: "@usamshen/coord-main",
  generatedAt: "2026-07-18T08:00:00Z",
  narrative:
    "早上好。今天你只需要管 3 件事：BoardX 有 2 项决策等你拍板（其中 auth 中间件选型已卡住 2 个 agent）；" +
    "Acme CRM 的 andon 拉停需要你解除或升级；你的 @usamshen/feature-implementer-b 心跳丢失 42 分钟。" +
    "其余 11 项巡检事项我已代为处理并归档。",
};

export const MOCK_DECISIONS: readonly MockDecision[] = [
  {
    id: "d1",
    projectSlug: "boardx",
    title: "auth 中间件选型：继续自研 vs 引入 NestJS Guard",
    slaHoursLeft: 3,
    from: "@usamshen/coord-main",
    kind: "decide",
    why: [
      "F14 与 F17 两个 feature 都依赖这条中间件链，已各有 1 个 agent 持租约等待。",
      "ADR-015 曾评估过 NestJS 并决定不换——本次若引入 Guard 属于推翻既有 ADR，超出 agent 决策权限。",
      "两个方案验证命令都已备好，拍板后 10 分钟内可恢复开发。",
    ],
  },
  {
    id: "d2",
    projectSlug: "acme-crm",
    title: "解除 andon：数据迁移脚本已补幂等保护，申请恢复流水线",
    slaHoursLeft: 9,
    from: "@lichen/coord-crm",
    kind: "decide",
    why: [
      "拉停原因是迁移脚本无幂等保护，重跑会重复插入；已补 upsert + 事务回滚并附测试证据。",
      "andon 解除权限是 maintainer+（D5），agent 无权自行解除。",
    ],
  },
  {
    id: "d3",
    projectSlug: "boardx",
    title: "✋ 举手：e2e 基线里 3 条 spec 长期 flaky，建议隔离出主门禁",
    slaHoursLeft: 21,
    from: "@kaiwei/module-collab",
    kind: "raise-concern",
    why: [
      "近 7 天这 3 条 spec 的失败均与被测 feature 无关（网络抖动），已导致 4 次误报重跑。",
      "✋ 不阻断（D5）：24 小时无回应会自动升级为待拍板。",
    ],
  },
] as const;

export const MOCK_STUCK_PRS: readonly MockStuckPr[] = [
  {
    id: "pr1",
    number: 741,
    projectSlug: "boardx",
    title: "feat(collab): 光标广播节流 + 断线重连补偿",
    ageHours: 26,
    waitingOn: "等 review：@lichen（已提醒 1 次）",
  },
  {
    id: "pr2",
    number: 88,
    projectSlug: "acme-crm",
    title: "fix(pipeline): 商机阶段回退时清理残留提醒",
    ageHours: 51,
    waitingOn: "CI 全绿，等 merge 队列（andon 拉停中）",
  },
] as const;

export const MOCK_ANOMALIES: readonly MockAgentAnomaly[] = [
  {
    id: "a1",
    agentId: "@usamshen/feature-implementer-b",
    projectSlug: "boardx",
    kind: "heartbeat-lost",
    sinceMin: 42,
    detail: "最后心跳前正持有 F17 租约；租约将在 18 分钟后被 dispatcher 起草回收。",
  },
  {
    id: "a2",
    agentId: "@usamshen/crm-migrator",
    projectSlug: "acme-crm",
    kind: "token-expiring",
    sinceMin: 0,
    detail: "scoped token 将于 3 天后到期，建议在车队管理台轮换。",
  },
] as const;

// ---------------- M2 /me/agents 车队管理台 ----------------

export type FleetHeartbeat = "fresh" | "aging" | "stale";
export type FleetLifecycle = "active" | "paused" | "retired";

export interface MockFleetAgent {
  /** 完整标识 @handle/agent-name（D6；sub 用点号延伸） */
  id: string;
  runtime: "Claude Code" | "Codex" | "Gemini CLI" | "自研";
  heartbeat: FleetHeartbeat;
  heartbeatMin: number;
  lifecycle: FleetLifecycle;
  /** 当前项目 slug；空闲 = null */
  projectSlug: string | null;
  lease: string | null;
  tokenStatus: "健康" | "3 天后到期" | "已吊销";
  lastEvent: string;
}

export const MOCK_FLEET: readonly MockFleetAgent[] = [
  {
    id: "@usamshen/coord-main",
    runtime: "Claude Code",
    heartbeat: "fresh",
    heartbeatMin: 1,
    lifecycle: "active",
    projectSlug: "boardx",
    lease: "coordination lease #352",
    tokenStatus: "健康",
    lastEvent: "2 分钟前 · 广播 assign F21 → module-collab",
  },
  {
    id: "@usamshen/coord-main.reviewer",
    runtime: "Claude Code",
    heartbeat: "fresh",
    heartbeatMin: 3,
    lifecycle: "active",
    projectSlug: "boardx",
    lease: null,
    tokenStatus: "健康",
    lastEvent: "8 分钟前 · 完成 PR #739 初审（sub-agent，归属沿 parent 追溯）",
  },
  {
    id: "@usamshen/feature-implementer-a",
    runtime: "Claude Code",
    heartbeat: "aging",
    heartbeatMin: 12,
    lifecycle: "active",
    projectSlug: "boardx",
    lease: "F21 实现租约",
    tokenStatus: "健康",
    lastEvent: "12 分钟前 · progress：F21 组件拆分完成，开始接验证",
  },
  {
    id: "@usamshen/feature-implementer-b",
    runtime: "Codex",
    heartbeat: "stale",
    heartbeatMin: 42,
    lifecycle: "active",
    projectSlug: "boardx",
    lease: "F17 实现租约（将被回收）",
    tokenStatus: "健康",
    lastEvent: "42 分钟前 · 心跳丢失 ⚠ 最后动作：跑 verify 挂起",
  },
  {
    id: "@usamshen/crm-migrator",
    runtime: "Gemini CLI",
    heartbeat: "aging",
    heartbeatMin: 18,
    lifecycle: "paused",
    projectSlug: "acme-crm",
    lease: null,
    tokenStatus: "3 天后到期",
    lastEvent: "1 小时前 · 因 andon 拉停被暂停",
  },
] as const;

/** enroll 向导可选运行时（UC-06，供应商中立） */
export const ENROLL_RUNTIMES = ["Claude Code", "Codex", "Gemini CLI", "自研"] as const;
export type EnrollRuntime = (typeof ENROLL_RUNTIMES)[number];

/** mock 一次性 token（mint-on-reveal 样式演示用，非真实凭据格式） */
export const MOCK_ONE_TIME_TOKEN = "bxa_live_mk7Q…w2Xf（示例，关闭后不可找回）";

export function mockInstallCommand(agentId: string): string {
  return `npx boardx-agent connect --agent ${agentId} --token <一次性token>`;
}

// ---------------- W5 /p/:slug/people 花名册 ----------------

export interface RosterAgentNode {
  /** 完整标识 @handle/agent-name（点号 = sub-agent） */
  id: string;
  doing: string;
  heartbeat: FleetHeartbeat;
  subs: readonly RosterAgentNode[];
}

export interface RosterMember {
  handle: string;
  name: string;
  role: "owner" | "maintainer" | "approver" | "contributor";
  trust: "Core" | "Trusted" | "Probation";
  doing: string;
  agents: readonly RosterAgentNode[];
}

export const MOCK_ROSTER_PROJECT = { slug: "boardx", name: "BoardX" } as const;

export const MOCK_ROSTER: readonly RosterMember[] = [
  {
    handle: "usamshen",
    name: "Usam Shen",
    role: "owner",
    trust: "Core",
    doing: "在处理 2 项待拍板 · 持有 coord-agent",
    agents: [
      {
        id: "@usamshen/coord-main",
        doing: "派工仲裁中 · 租约 #352",
        heartbeat: "fresh",
        subs: [
          { id: "@usamshen/coord-main.reviewer", doing: "PR #739 初审", heartbeat: "fresh", subs: [] },
          { id: "@usamshen/coord-main.triage", doing: "issue 分诊队列（空闲）", heartbeat: "aging", subs: [] },
        ],
      },
      { id: "@usamshen/feature-implementer-a", doing: "F21 实现中", heartbeat: "aging", subs: [] },
      { id: "@usamshen/feature-implementer-b", doing: "⚠ 心跳丢失 42 分钟", heartbeat: "stale", subs: [] },
    ],
  },
  {
    handle: "lichen",
    name: "Li Chen",
    role: "maintainer",
    trust: "Trusted",
    doing: "review PR #741 · 模块：collab",
    agents: [
      {
        id: "@lichen/module-collab",
        doing: "光标广播节流验证中",
        heartbeat: "fresh",
        subs: [{ id: "@lichen/module-collab.e2e", doing: "跑 collab e2e 基线", heartbeat: "fresh", subs: [] }],
      },
    ],
  },
  {
    handle: "kaiwei",
    name: "Kai Wei",
    role: "contributor",
    trust: "Probation",
    doing: "onboarding 第 4 步：认领 good-first-issue",
    agents: [{ id: "@kaiwei/starter", doing: "等待首个派工", heartbeat: "fresh", subs: [] }],
  },
] as const;

/** 花名册 👤/🤖 分开计数（UC-03） */
export function rosterCounts(roster: readonly RosterMember[]): { humans: number; agents: number } {
  const countAgents = (nodes: readonly RosterAgentNode[]): number =>
    nodes.reduce((sum, n) => sum + 1 + countAgents(n.subs), 0);
  return {
    humans: roster.length,
    agents: roster.reduce((sum, m) => sum + countAgents(m.agents), 0),
  };
}
