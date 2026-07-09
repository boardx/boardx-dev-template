"use client";
// p23/F07 — 加入开发：onboarding 向导（现实版）+ 学习页。
// 界面契约 = p23 ui-signoff confirmed 的原型 JoinTab（5 步 stepper，每步标预计耗时 + 所需条件，
// 任意步可点击预览；第 4 步显示审批 SLA；第 5 步如实呈现人工发放三步流程 + 命令自取）。
// 诚实原则：本 feature 不做 OAuth 与自动发 token（ADR-011 P2/P3）——提交申请按钮 disabled
// 并注明原因，不伪造"已提交成功"；凭据步骤如实描述人工发放现状。
import { useState } from "react";
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

// 学习页条目（文案照原型；内容源为仓库 human-developer-onboarding.md，自动渲染待接线）
const TUTORIALS = [
  "开发模式一分钟图解（人类 → 三级 coordinator → 全员登记）",
  "module coordinator 的职责与派子 agent",
  "3 小时工作周期与流动时长（flow time）度量",
  "防断链三原则（每 tick 续约 / 全员登记 / 状态不留会话）",
];

const MODULES = ["room", "board", "collab", "ava", "store-admin", "survey", "platform", "studio"];

const CREDENTIAL_EXPORT_TEMPLATE = [
  "export COORD_SERVICE_URL=https://coord-service-staging.boardx.workers.dev",
  'export COORD_SERVICE_TOKEN=$(jq -r \'.tokens["<你的身份 id>"]\' .harness/state/.cache/coord-credentials.json)',
];

export function JoinTab() {
  const [step, setStep] = useState(1);
  const [module, setModule] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const cur = ONBOARD_STEPS[step - 1]!;

  async function copyCommands() {
    try {
      await navigator.clipboard.writeText(CREDENTIAL_EXPORT_TEMPLATE.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 剪贴板不可用（如无权限）时静默——命令文本本身就在页面上可手动选取
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
            <Input id="portal-join-resp" placeholder="如：负责 Studio 域的分派与首轮 review" />
            {/* 诚实占位：真实提交（自动创建预填 onboarding issue）在 ADR-011 P3 落地后开放 */}
            <Button disabled data-testid="submit-application">提交申请</Button>
            <p className="text-11 text-muted-foreground" data-testid="submit-disabled-reason">
              网页内提交申请（自动创建预填审批 issue）将在自助身份系统（ADR-011 P3）落地后开放——
              当前请在 GitHub 手动开 onboarding issue（模板见学习页教程）。可继续点击上方步骤预览后续流程。
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
            <p className="text-13 text-foreground">批准后领取凭据（当前为人工发放）：</p>
            <ol className="list-decimal space-y-1 pl-5 text-13 text-foreground">
              <li>仓库所有者按审批 issue 里的预填模板为你的身份 mint token；</li>
              <li>
                token 写入本机凭据文件 <code className="rounded-8 bg-muted px-1 text-11">.harness/state/.cache/coord-credentials.json</code>；
              </li>
              <li>你的会话按下方命令自取。</li>
            </ol>
            <div className="rounded-8 border border-border bg-surface-2 p-3 font-mono text-11 text-muted-foreground" data-testid="credential-export-template">
              {CREDENTIAL_EXPORT_TEMPLATE.map((line) => (
                <div key={line} className="break-all">{line}</div>
              ))}
            </div>
            <Button size="sm" variant="secondary" onClick={() => void copyCommands()}>{copied ? "已复制 ✓" : "复制命令"}</Button>
            <p className="text-11 text-muted-foreground">网页内一键发放将在自助身份系统（ADR-011 P2/P3）落地后上线——此处如实反映现状。</p>
          </div>
        )}
      </PortalCard>

      <PortalCard state="ready" title="学习如何参与">
        <ul className="space-y-2 text-13" data-testid="tutorial-list">
          {TUTORIALS.map((t) => (
            <li key={t} className="flex items-center justify-between rounded-8 px-2 py-1.5 transition-colors duration-200 hover:bg-muted">
              <span className="text-foreground">{t}</span>
              <span className="text-11 text-muted-foreground">阅读 →</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-11 text-muted-foreground">内容渲染自仓库 human-developer-onboarding.md（当前为静态清单，自动同步随 main 更新待接线）</p>
      </PortalCard>
    </div>
  );
}
