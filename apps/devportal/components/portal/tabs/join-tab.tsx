"use client";
// p23/F07 — 加入开发：onboarding 向导（现实版）+ 学习页。
// 界面契约 = p23 ui-signoff confirmed 的原型 JoinTab（5 步 stepper，每步标预计耗时 + 所需条件，
// 任意步可点击预览；第 4 步显示审批 SLA；第 5 步如实呈现人工发放三步流程 + 命令自取）。
// 诚实原则：本 feature 不做 OAuth 与自动发 token（ADR-011 P2/P3）——提交申请按钮 disabled
// 并注明原因，不伪造"已提交成功"；凭据步骤如实描述人工发放现状。
import { portalFetch } from "@/lib/portal-fetch";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PortalCard } from "@/components/portal/portal-card";

// 文案照 ui-signoff 原型 ONBOARD_STEPS（review Top2：每步标时长/所需条件）
const ONBOARD_STEPS = [
  { t: "登录", cost: "10 秒", need: "GitHub 账号" },
  { t: "选角色", cost: "1 分钟", need: "了解三级 coordinator（可先读教程）" },
  { t: "选模块", cost: "1 分钟", need: "确定负责领域" },
  { t: "等审批", cost: "通常 < 1 个工作周期（3h）", need: "coord-main 或仓库所有者在 issue 上批准" },
  { t: "领凭据", cost: "1 分钟", need: "审批通过通知" },
];

// 学习页条目：点击在页内渲染仓库真实文档（/api/portal/doc 白名单，内容随 main 更新）
const TUTORIALS: Array<{ label: string; doc: string }> = [
  { label: "开发模式一分钟图解（人类 → 三级 coordinator → 全员登记）", doc: "human-onboarding" },
  { label: "module coordinator 的职责与派子 agent", doc: "human-onboarding" },
  { label: "3 小时工作周期与流动时长（flow time）度量", doc: "work-cycle" },
  { label: "防断链三原则（每 tick 续约 / 全员登记 / 状态不留会话）", doc: "human-onboarding" },
  { label: "给你的 agent 的接入执行书（第一条消息就发它）", doc: "agent-bootstrap" },
  { label: "Agent 接入规则清单（哪些线不能踩）", doc: "agent-checklist" },
];

// 模块清单 = 产品真实领域面（roadmap phases + registry areas 提炼，2026-07-10 对齐）
const MODULES = [
  "room", "board", "canvas", "collab", "ava", "knowledge-base", "ai-store",
  "studio", "survey", "credits-billing", "admin", "auth-identity", "platform", "harness",
];

const REPO = "boardx/boardx-dev-template";

const CREDENTIAL_EXPORT_TEMPLATE = [
  "export COORD_SERVICE_URL=https://coord-service-staging.boardx.workers.dev",
  'export COORD_SERVICE_TOKEN=$(jq -r \'.tokens["<你的身份 id>"]\' .harness/state/.cache/coord-credentials.json)',
];

export function JoinTab() {
  const [step, setStep] = useState(1);
  const [module, setModule] = useState<string | null>(null);
  const [resp, setResp] = useState("");
  const [doc, setDoc] = useState<{ name: string; title: string; markdown: string } | null>(null);
  const [docLoading, setDocLoading] = useState<string | null>(null);
  const cur = ONBOARD_STEPS[step - 1]!;

  // 提交申请 = 生成预填 onboarding issue 跳 GitHub（权威在 GitHub，门户不代写）。
  // 全自动创建（免跳转）待 ADR-011 P3；预填链接是当下真实可用的最短路径。
  function submitApplication() {
    if (!module) return;
    const title = `[onboarding] module-coordinator 申请：coord-${module}`;
    const body = [
      "## 自助 onboarding 申请（由 Developer Portal 预填）",
      "",
      `- 申请角色：module-coordinator`,
      `- 目标模块：${module}`,
      `- 身份 id 建议：coord-${module}`,
      `- 一句话职责：${resp || "（待补充）"}`,
      "",
      "### 审批后动作（ADR-011 P2/P3，2026-07-14 起零人工传递）",
      "1. 审批人：把该身份加进 registry.yaml（owner=申请者 GitHub login）并合并 PR——**这就是唯一的审批动作**；",
      "2. 申请者：合并后回 develop.boardx.us → 加入开发 → 第 5 步，自己点「领取 token」（明文只在你浏览器显示一次）。",
      "   审批人不再需要 mint / 拷贝凭据 / 回复路径——凭据链里不再有第三个人。",
      "",
      "审批 SLA：通常 < 1 个工作周期（3h）。参考：ADR-010 / ADR-011 / human-developer-onboarding.md",
    ].join("\n");
    const url = `https://github.com/${REPO}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
    window.open(url, "_blank", "noopener");
  }

  // ADR-011 P2 自助领取：第 5 步进入时拉"我的身份"清单；mint 后明文只显示一次。
  // F08：同一入口第二通道——按仓 scoped token（coord-gateway，token 权威在 RepoHub DO）。
  const [myAgents, setMyAgents] = useState<Array<{ id: string; kind: string }> | null>(null);
  const [brokerReady, setBrokerReady] = useState(true);
  const [gatewayReady, setGatewayReady] = useState(true);
  const [minted, setMinted] = useState<{ agentId: string; token: string; target: string } | null>(null);
  const [minting, setMinting] = useState<string | null>(null);
  const [tokenCopied, setTokenCopied] = useState(false);

  async function loadMyAgents() {
    try {
      const res = await portalFetch("/api/portal/my-tokens");
      if (!res || !res.ok) return;
      const body = (await res.json()) as {
        broker_configured: boolean;
        gateway_configured?: boolean;
        agents: Array<{ id: string; kind: string }>;
      };
      setBrokerReady(body.broker_configured);
      setGatewayReady(Boolean(body.gateway_configured));
      setMyAgents(body.agents);
    } catch {
      /* 保持 null → 显示引导而非报错 */
    }
  }

  async function mintToken(agentId: string, target: "coord-service" | "coord-gateway" = "coord-service") {
    setMinting(`${target}:${agentId}`);
    try {
      const res = await portalFetch("/api/portal/my-tokens");
      if (!res) return; // 401 重新认证中
      const post = await fetch("/api/portal/my-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: agentId, target }),
      });
      if (!post.ok) return;
      const body = (await post.json()) as { agent_id: string; token: string; target?: string };
      setMinted({ agentId: body.agent_id, token: body.token, target: body.target ?? target });
    } finally {
      setMinting(null);
    }
  }

  const GATEWAY_URL = "https://coord-gateway.boardx.workers.dev";

  function mintedLines(m: { token: string; target: string }): string[] {
    return m.target === "coord-gateway"
      ? [`export COORD_GATEWAY_URL=${GATEWAY_URL}`, `export COORD_API_TOKEN=${m.token}`]
      : [
          "export COORD_SERVICE_URL=https://coord-service-staging.boardx.workers.dev",
          `export COORD_SERVICE_TOKEN=${m.token}`,
        ];
  }

  async function copyMinted() {
    if (!minted) return;
    try {
      await navigator.clipboard.writeText(mintedLines(minted).join("\n"));
      setTokenCopied(true);
      setTimeout(() => setTokenCopied(false), 2000);
    } catch { /* 页面上可手动选取 */ }
  }

  async function openDoc(name: string) {
    setDocLoading(name);
    try {
      const res = await portalFetch(`/api/portal/doc?name=${encodeURIComponent(name)}`);
      if (!res) return; // 401 → 正在整页重新认证（portal-fetch.ts）
      if (!res.ok) return;
      const body = (await res.json()) as { title: string; markdown: string };
      setDoc({ name, title: body.title, markdown: body.markdown });
    } finally {
      setDocLoading(null);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <PortalCard state="ready" title="自助加入开发（未登录也可预览全部步骤）">
        {/* 任意步可点击预览（界面契约：stepper 即导航） */}
        <ol className="mb-2 flex flex-wrap items-center gap-1 text-11" data-testid="onboarding-stepper">
          {ONBOARD_STEPS.map((s, i) => (
            <li key={s.t}>
              <Button size="sm" variant={i + 1 === step ? "default" : "outline"} className="h-7 px-2 text-11" onClick={() => setStep(i + 1)}>
                {i + 1}. {s.t}
              </Button>
            </li>
          ))}
        </ol>
        <p className="mb-3 text-11 text-muted-foreground" data-testid="step-meta">本步预计 {cur.cost} · 需要：{cur.need}</p>

        {step === 1 && (
          <div className="space-y-3">
            <p className="text-13 text-muted-foreground">用 GitHub 账号登录，你的 agent 身份会绑定到真实可问责的账号。</p>
            <p className="text-11 text-muted-foreground">GitHub OAuth 绑定将随自助身份系统（ADR-011 P2）上线；当前使用站内账号登录即可预览全部步骤。</p>
            <Button onClick={() => setStep(2)}>下一步：选角色 →</Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <Label>选择角色</Label>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="角色">
              <Button variant="outline" className="justify-start" onClick={() => setStep(3)}>
                Module Coordinator<span className="ml-1 text-11 text-muted-foreground">（推荐）</span>
              </Button>
              <Button variant="outline" disabled className="justify-start">
                Worker<span className="ml-1 text-11">（即将开放）</span>
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <Label>选择模块</Label>
            <div className="flex flex-wrap gap-2">
              {MODULES.map((mod) => (
                <Button key={mod} size="sm" variant={module === mod ? "default" : "outline"} onClick={() => setModule(mod)}>
                  {mod}
                </Button>
              ))}
            </div>
            <Label htmlFor="portal-join-resp">一句话职责</Label>
            <Input id="portal-join-resp" placeholder="如：负责 Studio 域的分派与首轮 review" value={resp} onChange={(e) => setResp(e.target.value)} />
            <Button data-testid="submit-application" disabled={!module} onClick={submitApplication}>
              提交申请（生成预填 issue 跳 GitHub）
            </Button>
            <p className="text-11 text-muted-foreground" data-testid="submit-disabled-reason">
              提交 = 打开预填好的 onboarding issue（选模块后可用；需要你有本仓 GitHub 访问权）。
              审批与凭据发放在 issue 上完成——权威在 GitHub；免跳转的全自动创建待自助身份系统（ADR-011 P3）。
            </p>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <p className="text-13 text-foreground">申请提交后会自动创建审批 issue，由人类在 issue 上批准。</p>
            <Badge variant="outline" data-testid="approval-sla">等待审批 · SLA：通常 &lt; 1 个工作周期（3h）</Badge>
            <p className="text-11 text-muted-foreground">审批人：coord-main 或仓库所有者，在 issue 上一句 approve 即可。</p>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-3" data-testid="credential-step">
            <p className="text-13 text-foreground">
              审批通过（registry.yaml 合并且 owner 是你）后，在这里直接领取 token（ADR-011 P2 自助发放）：
            </p>
            {myAgents === null ? (
              <Button size="sm" onClick={() => void loadMyAgents()} data-testid="load-my-agents">
                查看我的身份
              </Button>
            ) : myAgents.length === 0 ? (
              <p className="text-13 text-muted-foreground">
                registry 里还没有归属于你的身份——先完成第 3 步提交申请，审批合并后回到这里。
              </p>
            ) : (
              <ul className="space-y-2" data-testid="my-agents-list">
                {myAgents.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 rounded-8 border border-border bg-surface-2 px-3 py-2">
                    <span className="text-13 text-foreground">🤖 {a.id}<span className="ml-2 text-11 text-muted-foreground">{a.kind}</span></span>
                    <span className="flex shrink-0 gap-2">
                      <Button size="sm" variant="secondary" disabled={!brokerReady || minting === `coord-service:${a.id}`} onClick={() => void mintToken(a.id)} data-testid={`mint-${a.id}`}>
                        {minting === `coord-service:${a.id}` ? "生成中…" : "领取 / 轮换 token"}
                      </Button>
                      <Button size="sm" variant="secondary" disabled={!gatewayReady || minting === `coord-gateway:${a.id}`} onClick={() => void mintToken(a.id, "coord-gateway")} data-testid={`mint-repo-${a.id}`}>
                        {minting === `coord-gateway:${a.id}` ? "生成中…" : "领取仓库 token"}
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {!brokerReady && myAgents !== null && (
              <p className="text-11 text-muted-foreground">发放通道未配置（COORD_BROKER_TOKEN）——找仓库所有者接通后即可自助领取。</p>
            )}
            {!gatewayReady && myAgents !== null && (
              <p className="text-11 text-muted-foreground">仓库 token 通道未配置（COORD_GATEWAY_ADMIN_TOKEN）——接通后可领取按仓 scoped 的 coord-gateway token（F08）。</p>
            )}
            {minted && (
              <div className="space-y-2 rounded-8 border border-destructive/40 bg-destructive/5 p-3" data-testid="minted-token">
                <p className="text-13 font-medium text-foreground">
                  ⚠️ {minted.agentId} 的新{minted.target === "coord-gateway" ? "仓库 scoped " : " "}token——**只显示这一次**，立即保存到本机凭据文件{minted.target === "coord-gateway" ? "；只对本仓 API/MCP 有效，吊销即时生效" : "；旧 token 已失效"}。
                </p>
                <div className="break-all rounded-8 bg-muted p-2 font-mono text-11 text-foreground">
                  {mintedLines(minted).map((l) => (<span key={l}>{l}<br /></span>))}
                </div>
                <Button size="sm" onClick={() => void copyMinted()}>{tokenCopied ? "已复制 ✓" : "复制两行命令"}</Button>
                <p className="text-11 text-muted-foreground">
                  纪律不变：token 值绝不贴进 issue/PR/聊天——保存到 gitignored 文件（如 .harness/state/.cache/ 下），给 agent 只递文件路径。
                </p>
              </div>
            )}
            <p className="text-11 text-muted-foreground">
              轮换（再次点击领取）会使该身份的旧 token 立即失效——token 丢失/疑似泄露时的自救通道。coordinator 级身份不在此列（走人类运维流程）。
            </p>
          </div>
        )}
      </PortalCard>

      <PortalCard state="ready" title="学习如何参与">
        {doc ? (
          <div data-testid="doc-reader">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-13 font-medium text-foreground">{doc.title}</span>
              <Button size="sm" variant="outline" onClick={() => setDoc(null)}>← 返回列表</Button>
            </div>
            <div className="prose-portal max-h-[32rem] overflow-y-auto rounded-8 border border-border bg-surface-2 p-4 text-13 leading-relaxed text-foreground [&_a]:underline [&_code]:rounded-4 [&_code]:bg-muted [&_code]:px-1 [&_code]:text-11 [&_h1]:text-17 [&_h1]:font-bold [&_h2]:mt-4 [&_h2]:text-15 [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:font-medium [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-8 [&_pre]:bg-muted [&_pre]:p-3 [&_table]:text-11 [&_ul]:list-disc [&_ul]:pl-5">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{doc.markdown}</ReactMarkdown>
            </div>
          </div>
        ) : (
          <ul className="space-y-2 text-13" data-testid="tutorial-list">
            {TUTORIALS.map((t) => (
              <li key={t.label}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-8 px-2 py-1.5 text-left transition-colors duration-200 hover:bg-muted"
                  onClick={() => void openDoc(t.doc)}
                >
                  <span className="text-foreground">{t.label}</span>
                  <span className="shrink-0 text-11 text-muted-foreground">{docLoading === t.doc ? "加载中…" : "阅读 →"}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-11 text-muted-foreground">内容渲染自仓库文档（Contents API 读 main，随合并自动更新，5 分钟缓存）</p>
      </PortalCard>
    </div>
  );
}
