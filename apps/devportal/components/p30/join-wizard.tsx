"use client";
// P2 招募页「加入这个项目」三步向导（p30 UI 先行原型，UC-04）：
// ① GitHub 登录（平台不另设账号）→ ② 选角色/模块 + 一句话自介 → ③ 提交后 pending + SLA 倒计时。
// ⚠️ 全部 mock：登录按钮只切换本地状态，不发起任何 OAuth；提交不落任何数据。
// D3：公开层组件，不依赖 Access 注入 header 的任何假设。
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { JOIN_MODULES, JOIN_ROLES, type JoinRole } from "@/lib/mock/p30";

type Step = 1 | 2 | 3;

function StepRail({ step }: { step: Step }) {
  const items: ReadonlyArray<{ n: Step; label: string }> = [
    { n: 1, label: "GitHub 登录" },
    { n: 2, label: "角色与自介" },
    { n: 3, label: "等待审批" },
  ];
  return (
    <ol className="flex flex-wrap items-center gap-2" aria-label="加入步骤">
      {items.map((it, i) => (
        <li key={it.n} className="flex items-center gap-2">
          {i > 0 && <span aria-hidden className="h-px w-6 bg-border" />}
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full text-12 font-semibold transition-colors ${
              step === it.n ? "bg-primary text-primary-foreground" : step > it.n ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"
            }`}
            aria-current={step === it.n ? "step" : undefined}
          >
            {step > it.n ? "✓" : it.n}
          </span>
          <span className={`text-12 ${step === it.n ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{it.label}</span>
        </li>
      ))}
    </ol>
  );
}

export function JoinWizard({ projectName, slaPromiseH, onClose }: { projectName: string; slaPromiseH: number; onClose: () => void }) {
  const [step, setStep] = useState<Step>(1);
  const [mockHandle, setMockHandle] = useState<string | null>(null);
  const [role, setRole] = useState<JoinRole>("contributor");
  const [modules, setModules] = useState<readonly string[]>([]);
  const [intro, setIntro] = useState("");
  const [triedSubmit, setTriedSubmit] = useState(false);

  const introOk = intro.trim().length >= 8;
  const modulesOk = modules.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-surface-darkest/60 p-4 pt-14" role="presentation" onClick={onClose}>
      <div
        data-testid="join-wizard"
        role="dialog"
        aria-modal="true"
        aria-label={`加入 ${projectName}`}
        className="w-full max-w-xl rounded-14 border border-border bg-background p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-17 font-bold text-foreground">加入 {projectName}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="关闭向导">
            ✕
          </Button>
        </div>
        <div className="mt-3">
          <StepRail step={step} />
        </div>

        {step === 1 && (
          <div data-testid="join-step-1" className="mt-4 space-y-4">
            <p className="text-13 leading-relaxed text-muted-foreground">
              平台不另设账号——你的 GitHub 身份就是唯一身份（@handle 全局唯一），贡献与声誉跨项目累积。
            </p>
            {mockHandle ? (
              <div className="flex items-center gap-2 rounded-10 border border-success/40 bg-tag-green/50 p-3">
                <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-success" />
                <p className="text-13 text-foreground">
                  已登录：<span className="font-mono font-semibold">@{mockHandle}</span>
                </p>
              </div>
            ) : (
              <Button data-testid="join-github-login" className="w-full" onClick={() => setMockHandle("new-engineer")}>
                使用 GitHub 登录（mock：不发起真实 OAuth）
              </Button>
            )}
            <div className="flex justify-end">
              <Button data-testid="join-next-1" disabled={!mockHandle} onClick={() => setStep(2)}>
                下一步：选择角色 →
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div data-testid="join-step-2" className="mt-4 space-y-4">
            <div className="flex flex-col gap-1.5">
              <Label id="join-role-label">申请角色</Label>
              <div role="radiogroup" aria-labelledby="join-role-label" className="flex flex-wrap gap-2">
                {JOIN_ROLES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    role="radio"
                    aria-checked={role === r}
                    data-testid={`join-role-${r}`}
                    onClick={() => setRole(r)}
                    className={`rounded-10 border px-3 py-1.5 text-13 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      role === r ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background text-foreground hover:bg-surface-1"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <p className="text-12 text-muted-foreground">新成员默认从 Probation 起步：前 3 个 PR 强制人工 review。</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label id="join-modules-label">感兴趣的模块（多选）</Label>
              <div role="group" aria-labelledby="join-modules-label" className="flex flex-wrap gap-2">
                {JOIN_MODULES.map((m) => {
                  const on = modules.includes(m);
                  return (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={on}
                      data-testid={`join-module-${m}`}
                      onClick={() => setModules((cur) => (on ? cur.filter((x) => x !== m) : [...cur, m]))}
                      className={`rounded-10 border px-3 py-1.5 text-13 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        on ? "border-primary bg-secondary text-secondary-foreground" : "border-input bg-background text-foreground hover:bg-surface-1"
                      }`}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
              {triedSubmit && !modulesOk && (
                <p role="alert" data-testid="err-join-modules" className="text-12 text-destructive">
                  至少选一个模块，项目才知道把你介绍给谁。
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="join-intro">一句话自介</Label>
              <Input
                id="join-intro"
                data-testid="join-intro-input"
                value={intro}
                autoComplete="off"
                placeholder="背景 + 想做什么，例：8 年前端，想带 agent 参与 collab 模块"
                aria-describedby={triedSubmit && !introOk ? "join-intro-err" : undefined}
                onChange={(e) => setIntro(e.target.value)}
              />
              {triedSubmit && !introOk && (
                <p id="join-intro-err" role="alert" data-testid="err-join-intro" className="text-12 text-destructive">
                  写至少 8 个字——这是 owner 审批时唯一能看到的你。
                </p>
              )}
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                ← 上一步
              </Button>
              <Button
                data-testid="join-submit"
                onClick={() => {
                  setTriedSubmit(true);
                  if (introOk && modulesOk) setStep(3);
                }}
              >
                提交申请 →
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div data-testid="join-step-3" className="mt-4 space-y-4">
            <div data-testid="join-pending" className="flex flex-col items-center gap-2 rounded-10 border border-dashed border-border py-8 text-center">
              <Badge variant="outline" className="text-11">pending</Badge>
              <p className="text-15 font-semibold text-foreground">申请已提交，等待 owner 审批</p>
              <p data-testid="join-sla-countdown" className="text-12 tabular-nums text-muted-foreground">
                审批 SLA {slaPromiseH}h · 剩余 <span className="font-semibold text-foreground">{slaPromiseH - 1}h 42m</span>（mock 倒计时）
              </p>
              <p className="max-w-brand text-12 leading-relaxed text-muted-foreground">
                已自动开 onboarding issue 跟踪；超时会自动升级到 owner 的待拍板流。批准后你会在 /me 看到 onboarding 清单，
                你的 agent enroll 即生效、无需再审批（D2）。
              </p>
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={onClose}>
                知道了，等通知
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
