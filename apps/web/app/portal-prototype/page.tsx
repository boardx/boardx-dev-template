"use client";
// Developer Portal — UI 原型 v2（按 PR #497 coord-main UIUX review 迭代，mock 数据）
// review 落实清单：
//  Top1 待拍板全局化（顶栏通知条 + tab 红点 + 浏览器 title 前缀）
//  Top2 onboarding stepper 加时长/SLA/现实版领凭据（人工发放 + 预填 issue 模板）
//  Top3 六 tab → 五（脉搏+进度合并，phase 点击下钻）
//  Top4 堵点行加行动按钮（催办/认领 review/去 GitHub）
//  Top5 语言统一中文（术语括注）+ 实现注记挪代码注释 + 语义色走 token
//  次优先：谁在干活补"正在做什么"+ 🟢🟡🔴 状态点；裸数字补周变化；讨论流分级降噪
//  （拍板>andon>站会>巡检默认折叠）+ 待拍板问题加粗 + 快捷回应；三态演示开关；
//  窄屏 tab 横滚；未登录访客分流带。
//  战略方向（登录后"我"视角首页）后置为 Phase F，不在本原型。
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ─── mock 数据（取材真实项目状态）──────────────────────────────────────────
const PHASES = [
  { id: "04", name: "identity-and-spaces", passing: 12, total: 14, delta: 0 },
  { id: "p6", name: "board-canvas", passing: 19, total: 21, delta: 2 },
  { id: "p11", name: "ai-store", passing: 5, total: 5, delta: 1 },
  { id: "p14", name: "credits-billing", passing: 4, total: 5, delta: 0 },
  { id: "p17", name: "quality-sweep", passing: 3, total: 4, delta: 1 },
  { id: "p18", name: "ava-ai-realization", passing: 13, total: 13, delta: 4 },
  { id: "p21", name: "platform-hardening", passing: 4, total: 6, delta: 1 },
  { id: "p22", name: "room-ia", passing: 2, total: 5, delta: 2 },
];
const MATRIX: Record<string, { p: number; i: number; b: number; features: string[] }> = {
  p18: { p: 13, i: 0, b: 0, features: ["F01 真实 provider 接入 · passing", "F13 UI 对齐 prototype · passing"] },
  p21: { p: 4, i: 1, b: 1, features: ["F04 计划管理 · in_progress（wrk-payment-1）", "F06 profile 硬化 · blocked（等 p14/F04）"] },
  p22: { p: 2, i: 2, b: 1, features: ["F03 Studio 全屏工作台 · passing", "F04 room 导航重组 · in_progress"] },
  p6: { p: 19, i: 1, b: 1, features: ["F21 多选批量操作 · passing", "F12 文本组件 · in_progress"] },
};
const FLOW_TREND = [2.4, 2.1, 1.8, 1.9, 1.4, 0.9, 1.1];
const ACTIVE_AGENTS = [
  { id: "coord-main", doing: "清合并队列 + p22 分派", hbMin: 0.5 },
  { id: "coord-architecture", doing: "Portal 原型迭代（PR 497）", hbMin: 2 },
  { id: "coord-ava", doing: "p18 结项收尾", hbMin: 41 },
];
const PR_QUEUE = [
  { n: 478, title: "lock/module-lock 续约语义", state: "可合并", age: "9h", stale: true },
  { n: 497, title: "Portal UI 原型（等 ui-signoff）", state: "评审中", age: "1.1h", stale: false },
  { n: 488, title: "p22/F04 room 导航重组", state: "评审中", age: "0.7h", stale: false },
];
type Talk = { who: string; human: boolean; at: string; src: string; text: string; tier: "decide" | "andon" | "cycle" | "patrol"; q?: string };
const DISCUSSIONS: Talk[] = [
  { who: "coord-store-admin", human: false, at: "昨天", src: "#323", tier: "decide", q: "是否引入并发 worktree 上限？", text: "主机资源危机已缓解，但缺根因限流。等人类拍板。" },
  { who: "coord-architecture", human: false, at: "昨天", src: "PR 494", tier: "decide", q: "Portal Phase A/B 何时开工？", text: "IA 与 use case 已合并，等排期与优先级。" },
  { who: "coord-main", human: false, at: "2 天前", src: "#323", tier: "andon", text: "andon-clear：main typecheck 恢复绿，全线恢复 rebase/merge。" },
  { who: "usam.shen", human: true, at: "10:41", src: "#323", tier: "cycle", text: "staging 即生产；27 个 worker token 授权轮换。" },
  { who: "coord-main", human: false, at: "09:47", src: "#452", tier: "cycle", text: "cycle-plan 2026-07-09T09Z：合并队列清空 + p22 分派。" },
  { who: "coord-ava", human: false, at: "10:12", src: "#323", tier: "patrol", text: "AVA 域（p18）13/13 passing，域结项。" },
  { who: "coord-architecture", human: false, at: "10:32", src: "#323", tier: "patrol", text: "巡检：双租约新鲜，无新风险。" },
];
const AGENT_PERF = [
  { id: "coord-ava", kind: "module", flow: "0.8h", commit: "6/6", merged: 13, lease: "role:coord-ava" },
  { id: "coord-board", kind: "module", flow: "1.4h", commit: "4/5", merged: 8, lease: "—" },
  { id: "coord-board.designer-1", kind: "sub-agent", flow: "—", commit: "2/2", merged: 2, lease: "issue:469" },
  { id: "wrk-room-1", kind: "worker", flow: "1.9h", commit: "3/4", merged: 4, lease: "issue:455" },
];
const CYCLES = [
  { id: "2026-07-09T09Z", plans: 3, done: 5, miss: 1, flow: "0.9h", sla: 0 },
  { id: "2026-07-09T06Z", plans: 2, done: 3, miss: 0, flow: "1.1h", sla: 1 },
];
const ONBOARD_STEPS = [
  { t: "登录", cost: "10 秒", need: "GitHub 账号" },
  { t: "选角色", cost: "1 分钟", need: "了解三级 coordinator（可先读教程）" },
  { t: "选模块", cost: "1 分钟", need: "确定负责领域" },
  { t: "等审批", cost: "通常 < 1 个工作周期（3h）", need: "coord-main 或仓库所有者在 issue 上批准" },
  { t: "领凭据", cost: "1 分钟", need: "审批通过通知" },
];

type SimState = "normal" | "loading" | "down";
const TABS = [
  { key: "pulse", label: "脉搏与进度" },
  { key: "coord", label: "实时协调" },
  { key: "talk", label: "讨论流" },
  { key: "join", label: "加入开发" },
  { key: "perf", label: "性能" },
];

function hbDot(min: number) {
  // 语义状态点：<5min 新鲜 / <30min 渐旧 / 其余陈旧（复用 coord-dashboard 阈值）
  if (min < 5) return <span aria-label="心跳新鲜" title="心跳新鲜（<5 分钟）" className="inline-block h-2 w-2 rounded-full bg-success" />;
  if (min < 30) return <span aria-label="心跳渐旧" title="心跳渐旧（<30 分钟）" className="inline-block h-2 w-2 rounded-full bg-tag-yellow ring-1 ring-border" />;
  return <span aria-label="心跳陈旧" title="心跳陈旧（≥30 分钟）" className="inline-block h-2 w-2 rounded-full bg-destructive" />;
}

function Card({ title, children, wide, sim }: { title: string; children: React.ReactNode; wide?: boolean; sim: SimState }) {
  return (
    <div className={`rounded-12 border border-border bg-surface-1 p-5 ${wide ? "md:col-span-2" : ""}`}>
      <h2 className="text-15 font-semibold text-foreground">{title}</h2>
      <div className="mt-4">
        {sim === "loading" ? (
          <div data-testid="card-loading" className="animate-pulse space-y-2">
            {[0, 1, 2].map((i) => <div key={i} className="h-9 rounded-8 bg-muted" />)}
          </div>
        ) : sim === "down" ? (
          <div data-testid="card-degraded" role="alert" className="rounded-8 border border-destructive/30 bg-destructive/5 p-3 text-13 text-destructive">
            数据源暂不可达——显示的是降级态。GitHub 板块与协调板块互不拖垮（此卡依赖的一侧恢复后自动回填）。
          </div>
        ) : children}
      </div>
    </div>
  );
}

function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(...data);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${36 - (v / max) * 32}`).join(" ");
  return (
    <svg viewBox="0 0 100 40" className="h-10 w-full text-foreground" role="img" aria-label="流动时长趋势">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="100" cy={36 - (data[data.length - 1]! / max) * 32} r="3" fill="currentColor" />
    </svg>
  );
}

// ── 板块一：脉搏与进度（review Top3：原①+③合并；phase 点击下钻）─────────────
function PulseTab({ sim }: { sim: SimState }) {
  const [drill, setDrill] = useState<string | null>(null);
  const totals = PHASES.reduce((a, p) => ({ p: a.p + p.passing, t: a.t + p.total, d: a.d + p.delta }), { p: 0, t: 0, d: 0 });
  const m = drill ? MATRIX[drill] : null;
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card sim={sim} title="整体进度">
        <div className="flex items-end justify-between">
          <p className="text-26 font-bold text-foreground">
            {totals.p}<span className="text-15 font-normal text-muted-foreground"> / {totals.t} 项通过</span>
          </p>
          <Badge variant="success" className="text-11">本周 +{totals.d}</Badge>
        </div>
        <div className="mt-3 space-y-2" data-testid="phase-bars">
          {PHASES.map((ph) => (
            <Button key={ph.id} variant="ghost" size="sm" className="h-auto w-full justify-start gap-2 px-1 py-1" onClick={() => setDrill(drill === ph.id ? null : ph.id)}>
              <span className="w-40 truncate text-left text-13 text-foreground">{ph.id} · {ph.name}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-8 bg-muted">
                <span className="block h-full rounded-8 bg-primary" style={{ width: `${(ph.passing / ph.total) * 100}%` }} />
              </span>
              <span className="w-16 text-right text-11 tabular-nums text-muted-foreground">{ph.passing}/{ph.total}{ph.delta > 0 ? ` ↑${ph.delta}` : ""}</span>
            </Button>
          ))}
        </div>
        {m && (
          <div data-testid="phase-drill" className="mt-3 rounded-8 border border-border bg-surface-2 p-3">
            <div className="flex items-center gap-2 text-13">
              <span className="font-medium text-foreground">{drill} 下钻</span>
              <Badge variant="success" className="text-11">通过 {m.p}</Badge>
              <Badge variant="outline" className="text-11">进行中 {m.i}</Badge>
              {m.b > 0 && <Badge variant="destructive" className="text-11">受阻 {m.b}</Badge>}
            </div>
            <ul className="mt-2 space-y-1 text-13 text-foreground">
              {m.features.map((f) => <li key={f}>· {f}</li>)}
            </ul>
          </div>
        )}
      </Card>
      <div className="space-y-4">
        <Card sim={sim} title="流动时长 flow time（PR 开出→合并 中位）">
          <div className="flex items-end justify-between">
            <p className="text-26 font-bold text-foreground">0.9h</p>
            <Badge variant="success" className="text-11">基线 1.8h ↓50%</Badge>
          </div>
          <Sparkline data={FLOW_TREND} />
          <p className="text-11 text-muted-foreground">近 7 天 · 更新于 12 秒前</p>
        </Card>
        <Card sim={sim} title="现在谁在干活">
          <ul className="space-y-1" data-testid="active-agents">
            {ACTIVE_AGENTS.map((a) => (
              <li key={a.id} title={`最后心跳 ${a.hbMin} 分钟前`} className="flex items-center gap-2 rounded-8 px-2 py-1.5 transition-colors duration-200 hover:bg-muted">
                {hbDot(a.hbMin)}
                <span className="text-13 font-medium text-foreground">{a.id}</span>
                <span className="min-w-0 flex-1 truncate text-right text-13 text-muted-foreground">{a.doing}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card sim={sim} title="PR 队列（超 1 个周期未动的高亮，可立即行动）">
          <ul className="space-y-1" data-testid="pr-queue">
            {PR_QUEUE.map((pr) => (
              <li key={pr.n} className={`rounded-8 px-2 py-1.5 transition-colors duration-200 hover:bg-muted ${pr.stale ? "border border-destructive/30 bg-destructive/5" : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-13 text-foreground">PR {pr.n} · {pr.title}</span>
                  <Badge variant={pr.state === "可合并" ? "success" : "outline"} className="shrink-0 text-11">{pr.state}</Badge>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-11 text-muted-foreground">已开 {pr.age}{pr.stale ? " · 超过 1 个周期（3h）" : ""}</span>
                  {pr.stale && (
                    <span className="flex gap-1" data-testid="pr-actions">
                      <Button size="sm" variant="secondary" className="h-6 px-2 text-11">催办</Button>
                      <Button size="sm" variant="secondary" className="h-6 px-2 text-11">认领 review</Button>
                      <Button size="sm" variant="link" className="h-6 px-1 text-11">去 GitHub →</Button>
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

// ── 板块二：实时协调（沿用已上线卡片形态；标题中文 + 术语括注；状态点语义化）──
function CoordTab({ sim }: { sim: SimState }) {
  const claims = [
    { r: "role:coord-main", by: "coord-main", hbMin: 0.5, ttl: "360m" },
    { r: "role:coord-architecture", by: "coord-architecture", hbMin: 2, ttl: "360m" },
    { r: "issue:455", by: "wrk-room-1", hbMin: 41, ttl: "180m" },
  ];
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card sim={sim} title="活跃租约（Active Claims）">
        <ul className="space-y-1">
          {claims.map((c) => (
            <li key={c.r} title={`最后心跳 ${c.hbMin} 分钟前 · ttl ${c.ttl}`} className="flex items-center justify-between gap-2 rounded-8 px-2 py-1.5 transition-colors duration-200 hover:bg-muted">
              <div className="flex min-w-0 items-center gap-2">
                {hbDot(c.hbMin)}
                <div className="min-w-0">
                  <div className="truncate text-13 font-medium text-foreground">{c.r}</div>
                  <div className="text-11 text-muted-foreground">持有者 {c.by}</div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Card>
      <Card sim={sim} title="协调事件（Recent Events）">
        <ul className="space-y-1">
          {[
            { t: "heartbeat", r: "role:coord-main", at: "28 秒前", v: "muted" as const },
            { t: "cycle-plan", r: "cycle:2026-07-09T09Z", at: "44 分钟前", v: "secondary" as const },
            { t: "release", r: "role:credential-rotation", at: "昨天", v: "muted" as const },
            { t: "expire", r: "role:coord-main", at: "昨天", v: "destructive" as const },
          ].map((e, i) => (
            <li key={i} className="flex items-center justify-between gap-2 rounded-8 px-2 py-1.5 transition-colors duration-200 hover:bg-muted">
              <span className="truncate text-13 text-foreground">{e.r}<span className="text-muted-foreground"> · {e.at}</span></span>
              <Badge variant={e.v} className="shrink-0 text-11">{e.t}</Badge>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

// ── 板块三：讨论流（分级降噪：拍板 > andon > 站会 > 巡检默认折叠）────────────
function TalkTab({ sim }: { sim: SimState }) {
  const [filter, setFilter] = useState<"all" | "human" | "ai" | "decide">("all");
  const [showPatrol, setShowPatrol] = useState(false);
  const tierOrder = { decide: 0, andon: 1, cycle: 2, patrol: 3 };
  const list = DISCUSSIONS
    .filter((d) => (filter === "all" ? true : filter === "human" ? d.human : filter === "ai" ? !d.human : d.tier === "decide"))
    .filter((d) => (showPatrol ? true : d.tier !== "patrol"))
    .sort((a, b) => tierOrder[a.tier] - tierOrder[b.tier]);
  const patrolCount = DISCUSSIONS.filter((d) => d.tier === "patrol").length;
  const decideCount = DISCUSSIONS.filter((d) => d.tier === "decide").length;
  return (
    <Card sim={sim} wide title="讨论流（人类 + AI · 权威在 GitHub，此处聚合）">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>全部</Button>
        <Button size="sm" variant={filter === "human" ? "default" : "outline"} onClick={() => setFilter("human")}>👤 人类</Button>
        <Button size="sm" variant={filter === "ai" ? "default" : "outline"} onClick={() => setFilter("ai")}>🤖 AI</Button>
        <Button size="sm" variant={filter === "decide" ? "default" : "outline"} onClick={() => setFilter("decide")}>
          ⚡ 待人类拍板<Badge variant="destructive" className="ml-1 px-1.5 text-11">{decideCount}</Badge>
        </Button>
      </div>
      <ul className="space-y-2" data-testid="talk-stream">
        {list.map((d, i) => (
          <li key={i} className={`rounded-8 border p-3 transition-colors duration-200 hover:bg-muted ${d.tier === "decide" ? "border-destructive/40 bg-destructive/5" : "border-border"}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-13 font-medium text-foreground">{d.human ? "👤" : "🤖"} {d.who}</span>
              <span className="flex items-center gap-2 text-11 text-muted-foreground">
                {d.tier === "andon" && <Badge variant="secondary" className="text-11">andon</Badge>}
                {d.src} · {d.at}
              </span>
            </div>
            {d.tier === "decide" && d.q && (
              <p data-testid="decide-question" className="mt-2 text-15 font-bold text-foreground">{d.q}</p>
            )}
            <p className="mt-1 text-13 text-foreground">{d.text}</p>
            <div className="mt-2 flex items-center gap-2">
              {d.tier === "decide" ? (
                <>
                  <Badge variant="destructive" className="text-11">待人类拍板</Badge>
                  <Button variant="secondary" size="sm" className="h-6 px-2 text-11">快捷回应（预填评论跳 GitHub）</Button>
                </>
              ) : (
                <Button variant="link" size="sm" className="px-0 text-11">去 GitHub 回复 →</Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <Button variant="ghost" size="sm" className="mt-2 text-11 text-muted-foreground" onClick={() => setShowPatrol(!showPatrol)}>
        {showPatrol ? "收起" : "展开"}巡检类低优先条目（{patrolCount}）{showPatrol ? "↑" : "↓"}
      </Button>
    </Card>
  );
}

// ── 板块四：加入开发（review Top2：时长/SLA/现实版领凭据；未登录本页即只读预览）─
function JoinTab({ sim }: { sim: SimState }) {
  const [step, setStep] = useState(1);
  const cur = ONBOARD_STEPS[step - 1]!;
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card sim={sim} title="自助加入开发（未登录也可预览全部步骤）">
        <ol className="mb-2 flex flex-wrap items-center gap-1 text-11" data-testid="onboarding-stepper">
          {ONBOARD_STEPS.map((s, i) => (
            <li key={s.t}>
              <Button size="sm" variant={i + 1 === step ? "default" : "outline"} className="h-7 px-2 text-11" onClick={() => setStep(i + 1)}>
                {i + 1}. {s.t}
              </Button>
            </li>
          ))}
        </ol>
        <p className="mb-3 text-11 text-muted-foreground">本步预计 {cur.cost} · 需要：{cur.need}</p>
        {step === 1 && (
          <div className="space-y-3">
            <p className="text-13 text-muted-foreground">用 GitHub 账号登录，你的 agent 身份会绑定到真实可问责的账号。</p>
            <Button onClick={() => setStep(2)}>用 GitHub 登录</Button>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-3">
            <Label>选择角色</Label>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="角色">
              <Button variant="outline" className="justify-start" onClick={() => setStep(3)}>Module Coordinator<span className="ml-1 text-11 text-muted-foreground">（推荐）</span></Button>
              <Button variant="outline" disabled className="justify-start">Worker<span className="ml-1 text-11">（即将开放）</span></Button>
            </div>
          </div>
        )}
        {step === 3 && (
          <div className="space-y-3">
            <Label>选择模块（灰色 = 已被占用）</Label>
            <div className="flex flex-wrap gap-2">
              {["room", "board", "collab", "ava", "store-admin", "survey", "platform", "studio"].map((mod, i) => (
                <Button key={mod} size="sm" variant="outline" disabled={i < 7} onClick={() => setStep(4)}>{mod}</Button>
              ))}
            </div>
            <Label htmlFor="resp">一句话职责</Label>
            <Input id="resp" placeholder="如：负责 Studio 域的分派与首轮 review" />
            <Button onClick={() => setStep(4)}>提交申请</Button>
          </div>
        )}
        {step === 4 && (
          <div className="space-y-3">
            <p className="text-13 text-foreground">✅ 申请已提交，自动创建了审批 issue：<Button variant="link" size="sm" className="px-0">issue 512 · [onboarding] coord-studio →</Button></p>
            <Badge variant="outline">等待审批 · SLA：通常 &lt; 1 个工作周期（3h）</Badge>
            <p className="text-11 text-muted-foreground">审批人：coord-main 或仓库所有者，在 issue 上一句 approve 即可。</p>
            <Button variant="outline" size="sm" onClick={() => setStep(5)}>（原型演示：跳到已批准）</Button>
          </div>
        )}
        {step === 5 && (
          <div className="space-y-3" data-testid="credential-step">
            <p className="text-13 text-foreground">🎉 已批准。领取凭据（当前为人工发放）：</p>
            <ol className="list-decimal space-y-1 pl-5 text-13 text-foreground">
              <li>仓库所有者按审批 issue 里的预填模板为你的身份 mint token；</li>
              <li>token 写入本机凭据文件 <code className="rounded-8 bg-muted px-1 text-11">.harness/state/.cache/coord-credentials.json</code>；</li>
              <li>你的会话按下方命令自取。</li>
            </ol>
            <div className="rounded-8 border border-border bg-surface-2 p-3 font-mono text-11 text-muted-foreground">
              export COORD_SERVICE_URL=https://coord-service-staging.boardx.workers.dev<br />export COORD_SERVICE_TOKEN=$(jq -r &#39;.tokens[&quot;coord-studio&quot;]&#39; .harness/state/.cache/coord-credentials.json)
            </div>
            <Button size="sm" variant="secondary">复制命令</Button>
            <p className="text-11 text-muted-foreground">网页内一键发放将在自助身份系统（ADR-011 P2/P3）落地后上线——此处如实反映现状。</p>
          </div>
        )}
      </Card>
      <Card sim={sim} title="学习如何参与">
        <ul className="space-y-2 text-13">
          {[
            "开发模式一分钟图解（人类 → 三级 coordinator → 全员登记）",
            "module coordinator 的职责与派子 agent",
            "3 小时工作周期与流动时长（flow time）度量",
            "防断链三原则（每 tick 续约 / 全员登记 / 状态不留会话）",
          ].map((t) => (
            <li key={t} className="flex items-center justify-between rounded-8 px-2 py-1.5 transition-colors duration-200 hover:bg-muted">
              <span className="text-foreground">{t}</span>
              <span className="text-11 text-muted-foreground">阅读 →</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-11 text-muted-foreground">内容渲染自仓库 human-developer-onboarding.md，随 main 更新</p>
      </Card>
    </div>
  );
}

// ── 板块五：性能 ─────────────────────────────────────────────────────────────
function PerfTab({ sim }: { sim: SimState }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card sim={sim} wide title="每个 agent 的表现（含子 agent，按归属树）">
        <div className="overflow-x-auto">
          <table className="w-full text-13">
            <thead>
              <tr className="text-left text-11 uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 font-medium">Agent</th>
                <th className="pb-2 font-medium">类型</th>
                <th className="pb-2 font-medium">流动时长</th>
                <th className="pb-2 font-medium">周期承诺达成</th>
                <th className="pb-2 font-medium">近 7 天合并</th>
                <th className="pb-2 font-medium">当前租约</th>
              </tr>
            </thead>
            <tbody>
              {AGENT_PERF.map((a) => (
                <tr key={a.id} className="border-t border-border transition-colors duration-200 hover:bg-muted">
                  <td className={`py-2 text-foreground ${a.kind === "sub-agent" ? "pl-5" : ""}`}>{a.kind === "sub-agent" ? "└ " : ""}{a.id}</td>
                  <td className="py-2"><Badge variant="outline" className="text-11">{a.kind}</Badge></td>
                  <td className="py-2 tabular-nums text-foreground">{a.flow}</td>
                  <td className="py-2 tabular-nums text-foreground">{a.commit}</td>
                  <td className="py-2 tabular-nums text-foreground">{a.merged}</td>
                  <td className="py-2 text-11 text-muted-foreground">{a.lease}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card sim={sim} wide title="工作周期报告（C-cycle）">
        <div className="overflow-x-auto">
          <table className="w-full text-13">
            <thead>
              <tr className="text-left text-11 uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 font-medium">周期</th>
                <th className="pb-2 font-medium">计划数</th>
                <th className="pb-2 font-medium">完成 / 未完成</th>
                <th className="pb-2 font-medium">流动时长</th>
                <th className="pb-2 font-medium">超 SLA</th>
              </tr>
            </thead>
            <tbody>
              {CYCLES.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="py-2 font-mono text-13 text-foreground">{c.id}</td>
                  <td className="py-2 tabular-nums text-foreground">{c.plans}</td>
                  <td className="py-2 tabular-nums text-foreground">{c.done} / {c.miss}</td>
                  <td className="py-2 tabular-nums text-foreground">{c.flow}</td>
                  <td className="py-2">{c.sla > 0 ? <Badge variant="destructive" className="text-11">{c.sla}</Badge> : <span className="text-11 text-muted-foreground">0</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export default function PortalPrototypePage() {
  const [tab, setTab] = useState("pulse");
  const [sim, setSim] = useState<SimState>("normal");
  const decideCount = DISCUSSIONS.filter((d) => d.tier === "decide").length;

  // review Top1：待拍板进浏览器 title 前缀
  useEffect(() => {
    document.title = decideCount > 0 ? `(${decideCount}) Developer Portal · BoardX` : "Developer Portal · BoardX";
  }, [decideCount]);

  return (
    <div className="mx-auto max-w-content px-9 pb-14 pt-7">
      {/* review 次优先：未登录访客分流带 */}
      <div data-testid="visitor-band" className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-12 border border-border bg-surface-2 px-4 py-2.5">
        <span className="text-13 text-foreground">第一次来？<Button variant="link" size="sm" className="px-1">3 分钟了解这个项目 →</Button></span>
        <span className="text-13 text-foreground">想加入开发？<Button variant="link" size="sm" className="px-1" onClick={() => setTab("join")}>开始 onboarding →</Button></span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-21 font-bold text-foreground">Developer Portal</h1>
          <p className="mt-1 text-13 text-muted-foreground">BoardX agentic 开发的统一人类入口 · GitHub 是底座，coord-service 是 AI 增强</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-11 text-muted-foreground">三态演示：</span>
          {(["normal", "loading", "down"] as const).map((s) => (
            <Button key={s} size="sm" variant={sim === s ? "default" : "outline"} className="h-7 px-2 text-11" onClick={() => setSim(s)}>
              {s === "normal" ? "正常" : s === "loading" ? "加载" : "不可达"}
            </Button>
          ))}
          <Badge variant="outline">UI 原型 v2 · mock</Badge>
        </div>
      </div>

      {/* review Top1：待人类拍板 顶栏常驻通知条 */}
      {decideCount > 0 && (
        <div data-testid="decide-banner" role="status" className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-12 border border-destructive/40 bg-destructive/5 px-4 py-2.5">
          <span className="text-13 font-medium text-foreground">⚡ 有 <strong>{decideCount}</strong> 项决策在等你——系统无法替你做这些决定</span>
          <Button size="sm" variant="secondary" onClick={() => setTab("talk")}>去处理 →</Button>
        </div>
      )}

      {/* review 次优先：窄屏 tab 横滚 */}
      <nav className="mt-5 flex gap-2 overflow-x-auto pb-1" aria-label="板块">
        {TABS.map((t) => (
          <Button key={t.key} size="sm" variant={tab === t.key ? "default" : "outline"} className="shrink-0" onClick={() => setTab(t.key)}>
            {t.label}
            {t.key === "talk" && decideCount > 0 && <Badge variant="destructive" className="ml-1.5 px-1.5 text-11">{decideCount}</Badge>}
          </Button>
        ))}
      </nav>

      <div className="mt-5">
        {tab === "pulse" && <PulseTab sim={sim} />}
        {tab === "coord" && <CoordTab sim={sim} />}
        {tab === "talk" && <TalkTab sim={sim} />}
        {tab === "join" && <JoinTab sim={sim} />}
        {tab === "perf" && <PerfTab sim={sim} />}
      </div>
    </div>
  );
}
