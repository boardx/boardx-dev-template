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

// ================= 批次 2（P2 招募页 + W6 治理台）=================
// ⚠️ 同头部声明：p30 UI 先行 mock，feature 实现时替换；不得被真实数据路径 import。

// ---------------- P2 /projects/:slug 项目公开主页（招募页，UC-03 访客视角） ----------------
// D3：公开层页面不依赖 Access 注入 header——本页 mock 未登录态，无任何身份假设。

export interface MockPublicProject {
  slug: string;
  name: string;
  tagline: string;
  /** README 摘要（自动截取，mock） */
  readmeSummary: readonly string[];
  /** 近 12 周合并数（火花线数据，自动生成自 GitHub） */
  mergeSparkline: readonly number[];
  /** flow-time 中位（认领→合并，小时） */
  flowTimeMedianH: number;
  /** andon 响应中位（分钟） */
  andonResponseMedianMin: number;
  /** 审批 SLA 兑现记录 */
  approvalSla: { promiseH: number; last30dMedianH: number; kept: number; total: number };
  /** 👤/🤖 计数（分开，UC-03） */
  humans: number;
  agents: number;
  /** 成员头像墙（mock：handle 首字母渲染） */
  memberWall: readonly { handle: string; kind: "human" }[];
  agentWall: readonly { id: string; kind: "agent" }[];
  /** 需要帮助的模块 */
  helpWanted: readonly { module: string; need: string; goodFirst: number }[];
}

export const MOCK_PUBLIC_PROJECT: MockPublicProject = {
  slug: "boardx",
  name: "BoardX",
  tagline: "AI 协作白板——人与 agent 车队在同一块板上交付软件",
  readmeSummary: [
    "BoardX 是一个 agentic 开发的实验场：真实产品（白板/协作/AI 对话）由人类工程师带着 agent 车队持续交付。",
    "仓库即唯一事实来源；功能清单权威（feature_list.json）；一切完成必须有可执行验证与证据。",
    "新成员从 good-first-issue 起步，前 3 个 PR 强制人工 review（Probation），之后逐级解锁。",
  ],
  mergeSparkline: [4, 7, 5, 9, 12, 8, 11, 14, 10, 16, 13, 18],
  flowTimeMedianH: 9,
  andonResponseMedianMin: 23,
  approvalSla: { promiseH: 24, last30dMedianH: 6, kept: 11, total: 12 },
  humans: 3,
  agents: 9,
  memberWall: [
    { handle: "usamshen", kind: "human" },
    { handle: "lichen", kind: "human" },
    { handle: "kaiwei", kind: "human" },
  ],
  agentWall: [
    { id: "@usamshen/coord-main", kind: "agent" },
    { id: "@usamshen/feature-implementer-a", kind: "agent" },
    { id: "@usamshen/feature-implementer-b", kind: "agent" },
    { id: "@lichen/module-collab", kind: "agent" },
    { id: "@kaiwei/starter", kind: "agent" },
  ],
  helpWanted: [
    { module: "collab", need: "实时协作 e2e 基线不稳，需要有 WebSocket 排障经验的人", goodFirst: 2 },
    { module: "survey", need: "问卷诊断 UI 刚过验收，需要接手迭代打磨", goodFirst: 3 },
    { module: "devportal", need: "平台化重设计（p30）进行中，UI 工程师优先", goodFirst: 1 },
  ],
};

/** UC-04 加入向导：可选角色与模块（mock） */
export const JOIN_ROLES = ["contributor", "approver", "maintainer"] as const;
export type JoinRole = (typeof JOIN_ROLES)[number];
export const JOIN_MODULES = ["collab", "survey", "devportal", "board", "canvas", "其他"] as const;

// ---------------- W6 /p/:slug/settings 治理台（UC-02 owner 视角） ----------------

/** 唯一管理员与 coord-agent 绑定（repo admin 已校验，UC-02） */
export const MOCK_GOVERNANCE_BINDING = {
  adminHandle: "usamshen",
  adminName: "Usam Shen",
  adminVerified: true,
  coordAgentId: "@usamshen/coord-main",
  coordHeartbeat: "fresh" as FleetHeartbeat,
  boundAt: "2026-06-02T09:00:00Z",
} as const;

export interface MockMemberApplication {
  id: string;
  handle: string;
  name: string;
  role: JoinRole;
  modules: readonly string[];
  intro: string;
  submittedAt: string;
  /** 审批 SLA 剩余小时（倒计时徽章） */
  slaHoursLeft: number;
}

export const MOCK_APPROVAL_QUEUE: readonly MockMemberApplication[] = [
  {
    id: "app1",
    handle: "mzhao",
    name: "Ming Zhao",
    role: "contributor",
    modules: ["collab"],
    intro: "8 年前端，做过多人协同编辑器，想带一个 Claude Code agent 参与 collab 模块。",
    submittedAt: "2026-07-17T22:10:00Z",
    slaHoursLeft: 14,
  },
  {
    id: "app2",
    handle: "tanaka-dev",
    name: "Yuki Tanaka",
    role: "approver",
    modules: ["survey", "devportal"],
    intro: "QA 背景，擅长写端到端验证；申请 approver 帮项目守 review 门禁。",
    submittedAt: "2026-07-18T06:40:00Z",
    slaHoursLeft: 3,
  },
] as const;

export interface MockActiveAndon {
  id: string;
  pulledBy: string;
  reason: string;
  scope: string;
  sinceMin: number;
}

/** 当前活跃 andon（mock 一条，UC-13） */
export const MOCK_ACTIVE_ANDON: MockActiveAndon = {
  id: "andon-31",
  pulledBy: "@lichen/module-collab",
  reason: "collab e2e 基线连续 3 次红——疑似 WS 网关回归，先停 merge 队列排查",
  scope: "阻断性 commit status：merge 队列已拉停",
  sinceMin: 37,
};

/** D5：per-person andon 授权名单（owner 可授予/移除，全部入审计） */
export interface MockAndonGrant {
  handle: string;
  name: string;
  role: RosterMember["role"];
  grantedAt: string;
  grantedBy: string;
}

export const MOCK_ANDON_GRANTS: readonly MockAndonGrant[] = [
  { handle: "kaiwei", name: "Kai Wei", role: "contributor", grantedAt: "2026-07-10T08:00:00Z", grantedBy: "@usamshen" },
] as const;

/** 可加入授权名单的候选（mock：花名册里 maintainer+ 之外的成员） */
export const MOCK_GRANT_CANDIDATES: readonly { handle: string; name: string; role: RosterMember["role"] }[] = [
  { handle: "mzhao", name: "Ming Zhao", role: "contributor" },
] as const;

/** ✋ 举手事件（D5：人人可发、琥珀色、不阻断） */
export interface MockRaiseHand {
  id: string;
  from: string;
  fromKind: "human" | "agent";
  text: string;
  ageH: number;
  /** 24h 无回应自动升级 */
  escalateInH: number;
  status: "open" | "answered";
}

export const MOCK_RAISE_HANDS: readonly MockRaiseHand[] = [
  {
    id: "rh1",
    from: "@kaiwei/module-collab",
    fromKind: "agent",
    text: "e2e 基线 3 条 spec 长期 flaky，建议隔离出主门禁",
    ageH: 3,
    escalateInH: 21,
    status: "open",
  },
  {
    id: "rh2",
    from: "@kaiwei",
    fromKind: "human",
    text: "onboarding 第 3 步的花名册链接 404（已有人跟进）",
    ageH: 26,
    escalateInH: 0,
    status: "answered",
  },
] as const;

/** token 审计表（mock 最近 mint/revoke 事件，N5：一切授权动作入只增审计） */
export interface MockTokenAudit {
  id: string;
  at: string;
  action: "mint" | "rotate" | "revoke";
  agentId: string;
  actor: string;
  note: string;
}

export const MOCK_TOKEN_AUDIT: readonly MockTokenAudit[] = [
  { id: "t1", at: "2026-07-18T07:52:00Z", action: "mint", agentId: "@mzhao/collab-dev", actor: "@mzhao", note: "enroll 首发（成员批准后自动生效，D2）" },
  { id: "t2", at: "2026-07-17T15:20:00Z", action: "rotate", agentId: "@usamshen/crm-migrator", actor: "@usamshen", note: "到期前轮换；旧 token 即时 401" },
  { id: "t3", at: "2026-07-16T11:05:00Z", action: "revoke", agentId: "@usamshen/legacy-syncer", actor: "@usamshen", note: "agent 退役，吊销即时生效" },
  { id: "t4", at: "2026-07-15T09:30:00Z", action: "mint", agentId: "@kaiwei/starter", actor: "@kaiwei", note: "onboarding 第 2 步 enroll" },
] as const;

// ================= 批次 3（P1 目录·探索页 + P3 项目接入向导）=================
// ⚠️ 同头部声明：p30 UI 先行 mock，feature 实现时替换；不得被真实数据路径 import。

// ---------------- P1 /explore 项目目录·探索页（UC-03 目录侧，访客可见，D3） ----------------
// 公开层：零身份读取、零 Access header 依赖——任何访客看到的都一样。

export type ExploreActivity = "high" | "medium" | "low";

export interface MockExploreProject {
  slug: string;
  name: string;
  tagline: string;
  /** 语言徽章（来自 GitHub linguist，mock） */
  languages: readonly string[];
  /** 活跃度档（由合并火花线自动分档，不可自填） */
  activity: ExploreActivity;
  /** 近 12 周合并火花线数据（自动生成自 GitHub） */
  sparkline: readonly number[];
  /** 是否开放招募（UC-03） */
  recruiting: boolean;
  /** 需要帮助的模块 chips */
  helpModules: readonly string[];
  /** 👤/🤖 分开计数（UC-03） */
  humans: number;
  agents: number;
}

export const EXPLORE_ACTIVITY_LABEL: Record<ExploreActivity, string> = {
  high: "高活跃",
  medium: "中活跃",
  low: "低活跃",
};

export const MOCK_EXPLORE_PROJECTS: readonly MockExploreProject[] = [
  {
    slug: "boardx",
    name: "BoardX",
    tagline: "AI 协作白板——人与 agent 车队在同一块板上交付软件",
    languages: ["TypeScript"],
    activity: "high",
    sparkline: [4, 7, 5, 9, 12, 8, 11, 14, 10, 16, 13, 18],
    recruiting: true,
    helpModules: ["collab", "survey", "devportal"],
    humans: 3,
    agents: 9,
  },
  {
    slug: "acme-crm",
    name: "Acme CRM",
    tagline: "中小团队销售流水线——商机、报表与自动跟进",
    languages: ["TypeScript", "Python"],
    activity: "medium",
    sparkline: [3, 5, 4, 6, 2, 5, 7, 4, 6, 3, 5, 4],
    recruiting: true,
    helpModules: ["pipeline", "reports"],
    humans: 2,
    agents: 5,
  },
  {
    slug: "pixel-forge",
    name: "Pixel Forge",
    tagline: "浏览器端 2D 渲染引擎——WebGL 批渲染与素材管线",
    languages: ["TypeScript", "Go"],
    activity: "high",
    sparkline: [8, 11, 9, 13, 15, 12, 14, 17, 13, 16, 19, 21],
    recruiting: true,
    helpModules: ["renderer", "assets"],
    humans: 4,
    agents: 11,
  },
  {
    slug: "ledgerly",
    name: "Ledgerly",
    tagline: "开源复式记账内核——面向 SaaS 的可嵌入账本",
    languages: ["Python"],
    activity: "medium",
    sparkline: [2, 4, 3, 5, 4, 6, 3, 4, 5, 3, 4, 6],
    recruiting: false,
    helpModules: [],
    humans: 2,
    agents: 3,
  },
  {
    slug: "orbit-docs",
    name: "Orbit Docs",
    tagline: "从代码注释生成可交互 API 文档站",
    languages: ["Rust"],
    activity: "low",
    sparkline: [1, 0, 2, 1, 0, 1, 2, 0, 1, 1, 0, 1],
    recruiting: false,
    helpModules: [],
    humans: 1,
    agents: 2,
  },
] as const;

/** 目录筛选项（本地过滤即可） */
export const EXPLORE_LANGUAGES = ["TypeScript", "Python", "Go", "Rust"] as const;

// ---------------- P3 /onboard 项目接入向导（UC-01，发起人 = repo admin 视角） ----------------
// 三步：① 安装 GitHub App → ② 选 repo → ③ 自动体检（警告不阻塞）。目标耗时 ≤5 分钟。

/** ① 安装回执（mock）：GitHub App 安装成功后的确认信息 */
export const MOCK_GH_INSTALL = {
  installationId: 4821,
  account: "usamshen",
  permissions: ["仓库只读镜像", "webhook 事件", "commit status 写入"],
  installedAt: "2026-07-18T09:12:00Z",
} as const;

export interface MockOnboardRepo {
  fullName: string;
  slug: string;
  description: string;
  language: string;
  /** 发起人是否 GitHub admin（UC-01 前置；非 admin 禁用） */
  isAdmin: boolean;
  private: boolean;
}

export const MOCK_ONBOARD_REPOS: readonly MockOnboardRepo[] = [
  { fullName: "usamshen/pixel-forge", slug: "pixel-forge", description: "浏览器端 2D 渲染引擎", language: "TypeScript", isAdmin: true, private: false },
  { fullName: "usamshen/ledgerly", slug: "ledgerly", description: "开源复式记账内核", language: "Python", isAdmin: true, private: false },
  { fullName: "usamshen/home-lab", slug: "home-lab", description: "个人 homelab 配置（私有）", language: "Shell", isAdmin: true, private: true },
  { fullName: "acme-inc/crm-core", slug: "crm-core", description: "Acme CRM 主仓（你是 write，非 admin）", language: "TypeScript", isAdmin: false, private: true },
  { fullName: "oss-guild/orbit-docs", slug: "orbit-docs", description: "API 文档生成器（你是 read，非 admin）", language: "Rust", isAdmin: false, private: false },
] as const;

/** ③ 自动体检项（UC-01：webhook / 镜像种子 / CODEOWNERS·CONTRIBUTING / 分支保护；警告不阻塞） */
export interface MockCheckupItem {
  id: string;
  label: string;
  /** 校验结果：ok = ✅；warn = ⚠️ 琥珀（不阻塞） */
  result: "ok" | "warn";
  /** 完成后的明细行（ok 的证据 / warn 的说明） */
  detail: string;
  /** warn 项的补救指引（「稍后在治理台补」） */
  remedy?: string;
  /** mock 动画时长（ms）：逐项实时校验的节奏 */
  durationMs: number;
}

export const MOCK_CHECKUP_ITEMS: readonly MockCheckupItem[] = [
  {
    id: "webhook",
    label: "webhook 连通",
    result: "ok",
    detail: "PING → 回执 214ms · push / pull_request / issues / status 四类事件已订阅",
    durationMs: 1400,
  },
  {
    id: "mirror-seed",
    label: "issues · PR 镜像种子",
    result: "ok",
    detail: "已灌入 128 条 issues + 37 条 PR（含 CI·review·mergeable 快照）",
    durationMs: 2600,
  },
  {
    id: "modules-init",
    label: "CODEOWNERS · CONTRIBUTING 模块划分初始化",
    result: "warn",
    detail: "未找到 CODEOWNERS——模块划分暂以顶层目录代替（renderer/assets/docs）",
    remedy: "稍后在治理台补：settings → 模块划分，补文件后自动重扫",
    durationMs: 1800,
  },
  {
    id: "branch-protection",
    label: "分支保护检查",
    result: "warn",
    detail: "main 未开启 required reviews——agent PR 将无人工门禁",
    remedy: "稍后在治理台补：一键生成推荐保护规则（需 repo admin 在 GitHub 确认）",
    durationMs: 1200,
  },
] as const;

/** 完成横幅（mock）：目标耗时 ≤5 分钟（UC-01） */
export const MOCK_ONBOARD_DONE = {
  banner: "项目已成为租户，coord-agent 归属已确立",
  elapsed: "3m42s",
  target: "≤5 分钟",
} as const;
// ================= 批次 4（P4 公开档案 + P5 Agent 分身页 + UC-17 调度中心）=================
// ⚠️ 同头部声明：p30 UI 先行 mock，feature 实现时替换；不得被真实数据路径 import。

// ---------------- P4 /u/:handle 工程师公开档案（UC-16，D1） ----------------
// D1：贡献事实默认公开；聚合指标 opt-in 且区间化；D3：公开层零身份假设（演示开关除外）。

export interface MockProfileProject {
  slug: string;
  name: string;
  role: RosterMember["role"];
  /** 参与起始（ISO 日期） */
  since: string;
  prsMerged: number;
  modules: readonly string[];
}

export interface MockMergeEvent {
  id: string;
  projectSlug: string;
  prNumber: number;
  title: string;
  mergedAt: string;
}

/** 聚合指标（D1：opt-in 公开时必须区间化展示，不给精确值） */
export interface MockRangedMetric {
  id: string;
  label: string;
  /** 区间化展示值，如 "6-12h" */
  range: string;
  note: string;
}

export interface MockPublicProfile {
  handle: string;
  name: string;
  joinedAt: string;
  trust: RosterMember["trust"];
  bio: string;
  /** 贡献事实区（默认公开） */
  projects: readonly MockProfileProject[];
  mergeTimeline: readonly MockMergeEvent[];
  /** 聚合指标区（opt-in 且区间化；optInPublic=false 时整区隐藏） */
  optInPublic: boolean;
  rangedMetrics: readonly MockRangedMetric[];
  /** 名下 agents 缩略行（链到 P5） */
  agents: readonly { id: string; heartbeat: FleetHeartbeat; doing: string }[];
}

export const MOCK_PUBLIC_PROFILE: MockPublicProfile = {
  handle: "usamshen",
  name: "Usam Shen",
  joinedAt: "2026-06-02",
  trust: "Core",
  bio: "BoardX owner · 带一支 agent 车队做 agentic 开发的实验场",
  projects: [
    { slug: "boardx", name: "BoardX", role: "owner", since: "2026-06-02", prsMerged: 214, modules: ["devportal", "harness", "collab"] },
    { slug: "acme-crm", name: "Acme CRM", role: "maintainer", since: "2026-07-01", prsMerged: 12, modules: ["pipeline"] },
  ],
  mergeTimeline: [
    { id: "mt1", projectSlug: "boardx", prNumber: 747, title: "fix(coord): 清协调层技术债——DLQ/TTL", mergedAt: "2026-07-18T17:03:00Z" },
    { id: "mt2", projectSlug: "boardx", prNumber: 746, title: "feat(p30/ui): UI 先行第二批——招募页 + 治理台", mergedAt: "2026-07-18T16:29:00Z" },
    { id: "mt3", projectSlug: "boardx", prNumber: 741, title: "chore(p29): sprint-05 verify——p29 收官", mergedAt: "2026-07-18T15:58:00Z" },
    { id: "mt4", projectSlug: "boardx", prNumber: 738, title: "feat(p30): devportal-platform kickoff", mergedAt: "2026-07-18T14:32:00Z" },
    { id: "mt5", projectSlug: "acme-crm", prNumber: 86, title: "fix(pipeline): 商机阶段回退清理提醒", mergedAt: "2026-07-17T11:40:00Z" },
  ],
  optInPublic: true,
  rangedMetrics: [
    { id: "rm1", label: "flow-time 中位（认领→合并）", range: "6-12h", note: "近 30 天，跨全部参与项目" },
    { id: "rm2", label: "拍板响应中位", range: "1-4h", note: "决策请求 @我 → 回应" },
    { id: "rm3", label: "月合并吞吐", range: "40-60 PR", note: "含名下 agent 产出（归因到 owner）" },
    { id: "rm4", label: "andon 响应", range: "<30min", note: "拉停 → 首次处置动作" },
  ],
  agents: [
    { id: "@usamshen/coord-main", heartbeat: "fresh", doing: "BoardX 派工仲裁中" },
    { id: "@usamshen/portal-dev-1", heartbeat: "fresh", doing: "p30 UI 先行第四批实现中" },
    { id: "@usamshen/feature-implementer-b", heartbeat: "stale", doing: "⚠ 心跳丢失 42 分钟" },
  ],
};

// ---------------- P5 /a/:handle/:agent Agent 数字分身页（UC-16，D6） ----------------
// D1：agent 分身页默认全公开——软件资产无隐私权。

export interface MockTwinTreeNode {
  id: string;
  /** 是否当前页主体 */
  self: boolean;
  doing: string;
  heartbeat: FleetHeartbeat;
  subs: readonly MockTwinTreeNode[];
}

export interface MockTwinEnrollment {
  projectSlug: string;
  projectName: string;
  scope: string;
  tokenStatus: MockFleetAgent["tokenStatus"];
  enrolledAt: string;
}

export type TwinEventKind = "lease" | "evidence" | "andon" | "heartbeat" | "enroll";

export interface MockTwinEvent {
  id: string;
  at: string;
  kind: TwinEventKind;
  text: string;
}

export interface MockAgentTwin {
  /** 完整标识 @handle/agent-name（D6：owner 命名空间唯一，内部主键 ULID 不可变） */
  id: string;
  ulid: string;
  runtime: MockFleetAgent["runtime"];
  createdAt: string;
  lifecycle: FleetLifecycle;
  heartbeat: FleetHeartbeat;
  heartbeatMin: number;
  owner: { handle: string; name: string };
  /** parent 为 null = 顶层 agent；sub 用点号延伸 */
  parentId: string | null;
  tree: MockTwinTreeNode;
  enrollments: readonly MockTwinEnrollment[];
  perf: { attainmentPct: number; throughputPerWeek: number; anomalies30d: number };
  events: readonly MockTwinEvent[];
}

export const MOCK_AGENT_TWIN: MockAgentTwin = {
  id: "@usamshen/portal-dev-1",
  ulid: "01J2ZK8Q4WPTX0N9V3E5H7MRSD",
  runtime: "Claude Code",
  createdAt: "2026-07-02",
  lifecycle: "active",
  heartbeat: "fresh",
  heartbeatMin: 2,
  owner: { handle: "usamshen", name: "Usam Shen" },
  parentId: null,
  tree: {
    id: "@usamshen/portal-dev-1",
    self: true,
    doing: "p30 UI 先行第四批实现中（持 F31 租约）",
    heartbeat: "fresh",
    subs: [
      { id: "@usamshen/portal-dev-1.reviewer", self: false, doing: "PR 自审：typecheck + 对照 signoff 清单", heartbeat: "fresh", subs: [] },
      {
        id: "@usamshen/portal-dev-1.e2e",
        self: false,
        doing: "跑 devportal 冒烟基线（空闲）",
        heartbeat: "aging",
        subs: [{ id: "@usamshen/portal-dev-1.e2e.shooter", self: false, doing: "Playwright 截图流水线", heartbeat: "aging", subs: [] }],
      },
    ],
  },
  enrollments: [
    { projectSlug: "boardx", projectName: "BoardX", scope: "coord.read work.claim evidence.write", tokenStatus: "健康", enrolledAt: "2026-07-02" },
    { projectSlug: "acme-crm", projectName: "Acme CRM", scope: "coord.read", tokenStatus: "3 天后到期", enrolledAt: "2026-07-10" },
  ],
  perf: { attainmentPct: 92, throughputPerWeek: 11, anomalies30d: 1 },
  events: [
    { id: "te1", at: "2026-07-19T08:41:00Z", kind: "lease", text: "取得 F31 实现租约（boardx，TTL 2h，自动续约中）" },
    { id: "te2", at: "2026-07-19T08:12:00Z", kind: "evidence", text: "F30 证据落盘：typecheck + build 输出 + 5 张截图" },
    { id: "te3", at: "2026-07-19T07:55:00Z", kind: "heartbeat", text: "心跳恢复（此前渐旧 11 分钟：本地网络抖动）" },
    { id: "te4", at: "2026-07-18T22:30:00Z", kind: "andon", text: "遵从 andon：boardx merge 队列拉停期间挂起合并请求" },
    { id: "te5", at: "2026-07-10T09:00:00Z", kind: "enroll", text: "enroll 进 Acme CRM（scope: coord.read，只读观察）" },
  ],
};

export const TWIN_EVENT_ICON: Record<TwinEventKind, string> = {
  lease: "🔒",
  evidence: "📎",
  andon: "🅰️",
  heartbeat: "💓",
  enroll: "🪪",
};

// ---------------- /platform/dispatcher 调度中心（UC-17，平台 admin 视角） ----------------
// @platform/dispatcher：只做跨项目巡检 + 事实定位并路由给各项目 coord-agent，
// 永不直接改项目内状态——所以「已采取动作」全部是起草/通知类。

export interface MockDispatcherLoop {
  id: string;
  /** 周期展示值："1m" | "5m" | "15m" | "1h" | "24h" */
  cadence: string;
  name: string;
  desc: string;
  lastRunMinAgo: number;
  /** 下次运行倒计时（秒，mock 静态起点） */
  nextInSec: number;
  /** 上一轮扫过的对象数 */
  scanned: number;
  /** 上一轮产出的定位问题数 */
  found: number;
}

export const MOCK_DISPATCHER_LOOPS: readonly MockDispatcherLoop[] = [
  { id: "loop-1m", cadence: "1m", name: "心跳 & 租约扫描", desc: "全平台 agent 心跳新鲜度 + 活跃租约 TTL 巡检", lastRunMinAgo: 0, nextInSec: 34, scanned: 23, found: 1 },
  { id: "loop-5m", cadence: "5m", name: "PR · CI 巡检", desc: "各项目 PR 队列等待时长 + CI 红灯聚合", lastRunMinAgo: 2, nextInSec: 154, scanned: 11, found: 2 },
  { id: "loop-15m", cadence: "15m", name: "stale 租约处置", desc: "心跳丢失的持租约 agent → 起草回收请求进待拍板", lastRunMinAgo: 9, nextInSec: 340, scanned: 6, found: 1 },
  { id: "loop-1h", cadence: "1h", name: "SLA 审计 + 性能快照", desc: "审批/拍板 SLA 兑现核对；固化 👤/🤖 性能快照", lastRunMinAgo: 24, nextInSec: 2145, scanned: 4, found: 0 },
  { id: "loop-24h", cadence: "24h", name: "C-cycle 报告", desc: "跨项目日报：吞吐/堵点/异常趋势，投递给各 coord-agent 与 owner", lastRunMinAgo: 502, nextInSec: 34_600, scanned: 2, found: 0 },
] as const;

export type DispatcherSeverity = "critical" | "warning" | "info";

export interface MockDispatcherIssue {
  id: string;
  severity: DispatcherSeverity;
  projectSlug: string;
  loopId: string;
  text: string;
  /** 已采取动作——只能是起草/通知/路由类（dispatcher 永不直接改项目内状态） */
  action: string;
  atMinAgo: number;
  routedTo: string;
}

export const MOCK_DISPATCHER_ISSUES: readonly MockDispatcherIssue[] = [
  {
    id: "di1",
    severity: "critical",
    projectSlug: "boardx",
    loopId: "loop-1m",
    text: "@usamshen/feature-implementer-b 心跳丢失 42 分钟，仍持有 F17 实现租约",
    action: "已起草租约回收请求 → 送 @usamshen/coord-main 待拍板队列；已通知 owner @usamshen",
    atMinAgo: 3,
    routedTo: "@usamshen/coord-main",
  },
  {
    id: "di2",
    severity: "critical",
    projectSlug: "acme-crm",
    loopId: "loop-5m",
    text: "andon 拉停已持续 37 分钟且无处置动作，2 个全绿 PR 被阻塞",
    action: "已向 @lichen/coord-crm 发送处置提醒；同步在 owner 待拍板卡追加「为什么需要我」摘要",
    atMinAgo: 6,
    routedTo: "@lichen/coord-crm",
  },
  {
    id: "di3",
    severity: "warning",
    projectSlug: "boardx",
    loopId: "loop-5m",
    text: "PR #741 等 review 已 26h（超项目阈值 24h），reviewer @lichen 未响应",
    action: "已起草催办评论（草稿）→ 交 @usamshen/coord-main 决定是否发出；未直接评论",
    atMinAgo: 12,
    routedTo: "@usamshen/coord-main",
  },
  {
    id: "di4",
    severity: "warning",
    projectSlug: "acme-crm",
    loopId: "loop-15m",
    text: "@usamshen/crm-migrator scoped token 3 天后到期，无轮换计划",
    action: "已通知 owner @usamshen（车队管理台深链）；到期前 24h 将升级提醒",
    atMinAgo: 41,
    routedTo: "@usamshen",
  },
  {
    id: "di5",
    severity: "info",
    projectSlug: "boardx",
    loopId: "loop-1h",
    text: "审批 SLA 兑现 11/12（30 天），1 例超时已在治理台留痕",
    action: "已写入性能快照；无需人工动作",
    atMinAgo: 24,
    routedTo: "快照存档",
  },
] as const;

export const DISPATCHER_SEVERITY_STYLE: Record<DispatcherSeverity, { label: string; cls: string }> = {
  critical: { label: "严重", cls: "bg-destructive text-destructive-foreground" },
  warning: { label: "警示", cls: "bg-tag-yellow text-foreground" },
  info: { label: "记录", cls: "bg-muted text-muted-foreground" },
};
