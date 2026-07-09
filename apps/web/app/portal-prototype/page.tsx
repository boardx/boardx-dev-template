"use client";
// Developer Portal — UI 原型（ADR-003 UI 先行确认关卡的产物，mock 数据）
// 覆盖 developer-portal-use-cases.md 的六大板块（UC-01~22 的界面形态）。
// 原型专用路由：不接真实数据、不设登录门禁（方便人类直接打开确认）；
// 转正式开发时按 use case 文档接 coord-service / GitHub 数据源并套 OAuth 门禁。
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ─── mock 数据（取材真实项目状态，便于人类评估信息密度）────────────────────
const PHASES = [
  { id: "04", name: "identity-and-spaces", passing: 12, total: 14 },
  { id: "p6", name: "board-canvas", passing: 19, total: 21 },
  { id: "p11", name: "ai-store", passing: 5, total: 5 },
  { id: "p14", name: "credits-billing", passing: 4, total: 5 },
  { id: "p17", name: "quality-sweep", passing: 3, total: 4 },
  { id: "p18", name: "ava-ai-realization", passing: 13, total: 13 },
  { id: "p21", name: "platform-hardening", passing: 4, total: 6 },
  { id: "p22", name: "room-ia", passing: 2, total: 5 },
];
const FLOW_TREND = [2.4, 2.1, 1.8, 1.9, 1.4, 0.9, 1.1]; // 近 7 天中位 flow time (h)
const ACTIVE_AGENTS = [
  { id: "coord-main", kind: "coordinator", hb: "28 秒前" },
  { id: "coord-architecture", kind: "architecture", hb: "2 分钟前" },
  { id: "coord-ava", kind: "module", hb: "6 分钟前" },
];
const PR_QUEUE = [
  { n: 478, title: "lock/module-lock acquire-or-renew 语义", state: "mergeable", age: "9h", stale: true },
  { n: 492, title: "ADR-010 Agent 组织模型 + 人类上手指南", state: "in-review", age: "1.2h", stale: false },
  { n: 494, title: "ADR-011 自助身份注册（Proposed）", state: "in-review", age: "0.6h", stale: false },
  { n: 496, title: "Portal use case 需求规格（UML）", state: "mergeable", age: "0.3h", stale: false },
];
const DISCUSSIONS = [
  { who: "usam.shen", human: true, at: "10:41", src: "#323", text: "staging 即生产；27 个 worker token 授权轮换。", decide: false },
  { who: "coord-architecture", human: false, at: "10:12", src: "#323", text: "ADR-011 修订：registry.yaml 降级为 D1 派生快照，由 coord-main 同步回仓库。", decide: false },
  { who: "coord-ava", human: false, at: "10:12", src: "#323", text: "AVA 域（p18）全部 13 个 feature passing 且合并进 main，域结项。", decide: false },
  { who: "coord-main", human: false, at: "09:47", src: "#452", text: "cycle-plan 2026-07-09T09Z：合并队列清空 + p22 分派。", decide: false },
  { who: "coord-store-admin", human: false, at: "昨天", src: "#323", text: "主机资源危机已缓解，但缺根因限流——是否引入并发 worktree 上限，需要人类拍板。", decide: true },
  { who: "coord-architecture", human: false, at: "昨天", src: "PR #494", text: "Portal Phase A/B 何时开工、优先级如何——等人类排期拍板。", decide: true },
];
const AGENT_PERF = [
  { id: "coord-ava", kind: "module", flow: "0.8h", commit: "6/6", merged: 13, lease: "role:coord-ava" },
  { id: "coord-board", kind: "module", flow: "1.4h", commit: "4/5", merged: 8, lease: "—" },
  { id: "coord-platform", kind: "module", flow: "1.1h", commit: "5/5", merged: 6, lease: "—" },
  { id: "coord-board.designer-1", kind: "sub-agent", flow: "—", commit: "2/2", merged: 2, lease: "issue:469" },
  { id: "wrk-room-1", kind: "worker", flow: "1.9h", commit: "3/4", merged: 4, lease: "issue:455" },
];
const CYCLES = [
  { id: "2026-07-09T09Z", plans: 3, done: 5, miss: 1, flow: "0.9h", sla: 0 },
  { id: "2026-07-09T06Z", plans: 2, done: 3, miss: 0, flow: "1.1h", sla: 1 },
  { id: "2026-07-09T03Z", plans: 2, done: 4, miss: 2, flow: "1.4h", sla: 1 },
];

const TABS = [
  { key: "pulse", label: "① 项目脉搏" },
  { key: "coord", label: "② 实时协调" },
  { key: "progress", label: "③ 开发进度" },
  { key: "talk", label: "④ 讨论流" },
  { key: "join", label: "⑤ 加入开发" },
  { key: "perf", label: "⑥ 性能" },
];

function Card({ title, children, wide }: { title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`rounded-12 border border-border bg-surface-1 p-5 ${wide ? "md:col-span-2" : ""}`}>
      <h2 className="text-15 font-semibold text-foreground">{title}</h2>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(...data);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${36 - (v / max) * 32}`).join(" ");
  return (
    <svg viewBox="0 0 100 40" className="h-10 w-full text-foreground" role="img" aria-label="flow time 趋势">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="100" cy={36 - (data[data.length - 1]! / max) * 32} r="3" fill="currentColor" />
    </svg>
  );
}

function PulseTab() {
  const totals = PHASES.reduce((a, p) => ({ p: a.p + p.passing, t: a.t + p.total }), { p: 0, t: 0 });
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card title="整体进度">
        <p className="text-26 font-bold text-foreground">
          {totals.p}<span className="text-15 font-normal text-muted-foreground"> / {totals.t} features passing</span>
        </p>
        <div className="mt-3 space-y-2">
          {PHASES.map((ph) => (
            <div key={ph.id} className="flex items-center gap-2">
              <span className="w-40 truncate text-13 text-foreground">{ph.id} · {ph.name}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-8 bg-muted">
                <div className="h-full rounded-8 bg-primary" style={{ width: `${(ph.passing / ph.total) * 100}%` }} />
              </div>
              <span className="w-12 text-right text-11 tabular-nums text-muted-foreground">{ph.passing}/{ph.total}</span>
            </div>
          ))}
        </div>
      </Card>
      <div className="space-y-4">
        <Card title="Flow time（PR 开出→合并 中位）">
          <div className="flex items-end justify-between">
            <p className="text-26 font-bold text-foreground">0.9h</p>
            <Badge variant="secondary" className="text-11">基线 1.8h ↓50%</Badge>
          </div>
          <Sparkline data={FLOW_TREND} />
          <p className="text-11 text-muted-foreground">近 7 天 · 更新于 12 秒前</p>
        </Card>
        <Card title="现在谁在干活">
          <ul className="space-y-1">
            {ACTIVE_AGENTS.map((a) => (
              <li key={a.id} className="flex items-center justify-between rounded-8 px-2 py-1.5 transition-colors duration-200 hover:bg-muted">
                <span className="text-13 text-foreground">{a.id}</span>
                <span className="text-11 text-muted-foreground">心跳 {a.hb}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-11 text-muted-foreground">3 个活跃租约 · 近 24h 合并 25 个 PR</p>
        </Card>
      </div>
    </div>
  );
}

function CoordTab() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card title="Active Claims（现有卡片，保持不变）">
        <ul className="space-y-1">
          {[
            { r: "role:coord-main", by: "coord-main", hb: "28 秒前", ttl: "360m" },
            { r: "role:coord-architecture", by: "coord-architecture", hb: "2 分钟前", ttl: "360m" },
            { r: "issue:455", by: "wrk-room-1", hb: "11 分钟前", ttl: "180m" },
          ].map((c) => (
            <li key={c.r} className="flex items-center justify-between gap-2 rounded-8 px-2 py-1.5 transition-colors duration-200 hover:bg-muted">
              <div className="min-w-0">
                <div className="truncate text-13 font-medium text-foreground">{c.r}</div>
                <div className="text-11 text-muted-foreground">held by {c.by} · heartbeat {c.hb}</div>
              </div>
              <Badge variant="outline" className="shrink-0 text-11">ttl {c.ttl}</Badge>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Recent Events（现有卡片，保持不变）">
        <ul className="space-y-1">
          {[
            { t: "heartbeat", r: "role:coord-main", at: "28 秒前" },
            { t: "cycle-plan", r: "cycle:2026-07-09T09Z", at: "44 分钟前" },
            { t: "release", r: "role:credential-rotation", at: "昨天" },
            { t: "expire", r: "role:coord-main", at: "昨天" },
          ].map((e, i) => (
            <li key={i} className="flex items-center justify-between gap-2 rounded-8 px-2 py-1.5 transition-colors duration-200 hover:bg-muted">
              <span className="truncate text-13 text-foreground">{e.r}<span className="text-muted-foreground"> · {e.at}</span></span>
              <Badge variant={e.t === "expire" ? "destructive" : e.t === "cycle-plan" ? "secondary" : "outline"} className="shrink-0 text-11">{e.t}</Badge>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function ProgressTab() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card title="Feature 矩阵（phase × status）">
        <div className="overflow-x-auto">
          <table className="w-full text-13">
            <thead>
              <tr className="text-left text-11 uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 font-medium">Phase</th>
                <th className="pb-2 font-medium">passing</th>
                <th className="pb-2 font-medium">in&nbsp;progress</th>
                <th className="pb-2 font-medium">blocked</th>
              </tr>
            </thead>
            <tbody>
              {[
                { id: "p18 ava", p: 13, i: 0, b: 0 },
                { id: "p21 platform", p: 4, i: 1, b: 1 },
                { id: "p22 room-ia", p: 2, i: 2, b: 1 },
                { id: "p6 canvas", p: 19, i: 1, b: 1 },
              ].map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="py-2 text-foreground">{r.id}</td>
                  <td className="py-2"><Badge variant="secondary" className="text-11">{r.p}</Badge></td>
                  <td className="py-2"><Badge variant="outline" className="text-11">{r.i}</Badge></td>
                  <td className="py-2">{r.b > 0 ? <Badge variant="destructive" className="text-11">{r.b}</Badge> : <span className="text-11 text-muted-foreground">0</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="PR 队列（超 1 个周期未动的高亮）">
        <ul className="space-y-1">
          {PR_QUEUE.map((pr) => (
            <li key={pr.n} className={`flex items-center justify-between gap-2 rounded-8 px-2 py-1.5 transition-colors duration-200 hover:bg-muted ${pr.stale ? "border border-destructive/30 bg-destructive/5" : ""}`}>
              <div className="min-w-0">
                <div className="truncate text-13 text-foreground">#{pr.n} {pr.title}</div>
                <div className="text-11 text-muted-foreground">open {pr.age}{pr.stale ? " · 超过 1 个周期（3h）无动作" : ""}</div>
              </div>
              <Badge variant={pr.state === "mergeable" ? "secondary" : "outline"} className="shrink-0 text-11">{pr.state}</Badge>
            </li>
          ))}
        </ul>
        <Button variant="link" size="sm" className="mt-1 px-0">在 GitHub 打开全部 →</Button>
      </Card>
    </div>
  );
}

function TalkTab() {
  const [filter, setFilter] = useState<"all" | "human" | "ai" | "decide">("all");
  const list = DISCUSSIONS.filter((d) =>
    filter === "all" ? true : filter === "human" ? d.human : filter === "ai" ? !d.human : d.decide
  );
  const decideCount = DISCUSSIONS.filter((d) => d.decide).length;
  return (
    <Card title="讨论流（人类 + AI，权威在 GitHub，此处聚合呈现）" wide>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>全部</Button>
        <Button size="sm" variant={filter === "human" ? "default" : "outline"} onClick={() => setFilter("human")}>👤 人类</Button>
        <Button size="sm" variant={filter === "ai" ? "default" : "outline"} onClick={() => setFilter("ai")}>🤖 AI</Button>
        <Button size="sm" variant={filter === "decide" ? "default" : "outline"} onClick={() => setFilter("decide")}>
          ⚡ 待人类拍板 <Badge variant="destructive" className="ml-1 px-1.5 text-11">{decideCount}</Badge>
        </Button>
      </div>
      <ul className="space-y-2">
        {list.map((d, i) => (
          <li key={i} className={`rounded-8 border p-3 transition-colors duration-200 hover:bg-muted ${d.decide ? "border-destructive/40 bg-destructive/5" : "border-border"}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-13 font-medium text-foreground">{d.human ? "👤" : "🤖"} {d.who}</span>
              <span className="text-11 text-muted-foreground">{d.src} · {d.at}</span>
            </div>
            <p className="mt-1 text-13 text-foreground">{d.text}</p>
            <div className="mt-2 flex items-center gap-2">
              {d.decide && <Badge variant="destructive" className="text-11">待人类拍板</Badge>}
              <Button variant="link" size="sm" className="px-0">去 GitHub 回复 →</Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function JoinTab() {
  const [step, setStep] = useState(1);
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card title="自助加入开发（GitHub 登录 → 注册 → 审批 → 领凭据）">
        <ol className="mb-4 flex items-center gap-1 text-11">
          {["登录", "选角色", "选模块", "等审批", "领凭据"].map((s, i) => (
            <li key={s} className={`rounded-8 px-2 py-1 ${i + 1 <= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{i + 1}. {s}</li>
          ))}
        </ol>
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
              {["room", "board", "collab", "ava", "store-admin", "survey", "platform", "studio"].map((m, i) => (
                <Button key={m} size="sm" variant="outline" disabled={i < 7} onClick={() => setStep(4)}>{m}</Button>
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
            <Badge variant="outline">等待 coord-main / 仓库所有者审批</Badge>
            <Button variant="outline" size="sm" onClick={() => setStep(5)}>（原型演示：跳到已批准）</Button>
          </div>
        )}
        {step === 5 && (
          <div className="space-y-3">
            <p className="text-13 text-foreground">🎉 已批准。你的正式 token（<strong>只显示这一次</strong>）：</p>
            <div className="rounded-8 border border-border bg-muted p-3 font-mono text-13 text-foreground">cs_live_9f3k…（原型占位）</div>
            <div className="rounded-8 border border-border bg-surface-2 p-3 font-mono text-11 text-muted-foreground">
              export COORD_SERVICE_URL=https://coord-service-staging.boardx.workers.dev<br />export COORD_SERVICE_TOKEN=cs_live_9f3k…
            </div>
            <Button size="sm" variant="secondary">复制命令</Button>
          </div>
        )}
      </Card>
      <Card title="学习如何参与">
        <ul className="space-y-2 text-13">
          {[
            "开发模式一分钟图解（人类 → 三级 coordinator → 全员登记）",
            "module coordinator 的职责与派子 agent",
            "3 小时工作周期与 flow-time 度量",
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

function PerfTab() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card title="每个 agent 的 performance（含子 agent，按归属树）" wide>
        <div className="overflow-x-auto">
          <table className="w-full text-13">
            <thead>
              <tr className="text-left text-11 uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 font-medium">Agent</th>
                <th className="pb-2 font-medium">类型</th>
                <th className="pb-2 font-medium">flow time</th>
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
      <Card title="C-cycle 周期报告（cycle-report 的 Web 版）" wide>
        <div className="overflow-x-auto">
          <table className="w-full text-13">
            <thead>
              <tr className="text-left text-11 uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 font-medium">周期</th>
                <th className="pb-2 font-medium">cycle-plan</th>
                <th className="pb-2 font-medium">done / miss</th>
                <th className="pb-2 font-medium">flow</th>
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
  return (
    <div className="mx-auto max-w-content px-9 pb-14 pt-7">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-21 font-bold text-foreground">Developer Portal</h1>
          <p className="mt-1 text-13 text-muted-foreground">
            BoardX agentic 开发的统一人类入口 · GitHub 是底座，coord-service 是 AI 增强
          </p>
        </div>
        <Badge variant="outline">UI 原型 · mock 数据</Badge>
      </div>
      <nav className="mt-5 flex flex-wrap gap-2" aria-label="板块">
        {TABS.map((t) => (
          <Button key={t.key} size="sm" variant={tab === t.key ? "default" : "outline"} onClick={() => setTab(t.key)}>
            {t.label}
          </Button>
        ))}
      </nav>
      <div className="mt-5">
        {tab === "pulse" && <PulseTab />}
        {tab === "coord" && <CoordTab />}
        {tab === "progress" && <ProgressTab />}
        {tab === "talk" && <TalkTab />}
        {tab === "join" && <JoinTab />}
        {tab === "perf" && <PerfTab />}
      </div>
    </div>
  );
}
