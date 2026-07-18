"use client";
// P3 /onboard 项目接入向导（p30 UI 先行原型批次 3，UC-01，发起人 = repo admin 视角）。
// 三步：① 安装 GitHub App（零侵入）→ ② 选 repo（admin 前置）→ ③ 自动体检（逐项实时校验，
// 警告不阻塞）→ 完成：「项目已成为租户，coord-agent 归属已确立」+ 耗时计（目标 ≤5 分钟）。
// 体检状态点沿用批次 1 HeartbeatDot 的语义色（成功绿 / 警告 tag-yellow 琥珀，与 andon 红区分）。
// ⚠️ 全部 mock（lib/mock/p30.ts）：不发起真实 GitHub 安装，体检为前端定时器动画。
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, LoadingSkeleton, PrototypeHeader, useMockLoading } from "@/components/p30/shared";
import {
  MOCK_CHECKUP_ITEMS,
  MOCK_GH_INSTALL,
  MOCK_ONBOARD_DONE,
  MOCK_ONBOARD_REPOS,
  type MockCheckupItem,
} from "@/lib/mock/p30";

type Step = 1 | 2 | 3;

function StepRail({ step }: { step: Step }) {
  const items: ReadonlyArray<{ n: Step; label: string }> = [
    { n: 1, label: "安装 GitHub App" },
    { n: 2, label: "选择仓库" },
    { n: 3, label: "自动体检" },
  ];
  return (
    <ol className="flex flex-wrap items-center gap-2" aria-label="接入步骤">
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

type CheckState = "pending" | "running" | "done";

/** 体检状态点：沿用批次 1 状态点语义（HeartbeatDot 视觉语言）——
 * 等待灰 / 校验中脉冲 / ✅ 成功绿 / ⚠️ 警告琥珀（tag-yellow，与 andon 红严格区分）。 */
function CheckupDot({ state, result }: { state: CheckState; result: MockCheckupItem["result"] }) {
  if (state === "pending") {
    return <span aria-label="等待校验" className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-muted ring-1 ring-border" />;
  }
  if (state === "running") {
    return <span aria-label="校验中" className="inline-block h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-primary" />;
  }
  return result === "ok" ? (
    <span aria-label="通过" className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-success" />
  ) : (
    <span aria-label="警告（不阻塞）" className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-tag-yellow ring-1 ring-border" />
  );
}

function CheckupRow({ item, state }: { item: MockCheckupItem; state: CheckState }) {
  const warn = state === "done" && item.result === "warn";
  return (
    <li
      data-testid={`checkup-item-${item.id}`}
      data-state={state}
      className={`rounded-10 border p-3 transition-colors ${
        warn ? "border-tag-yellow bg-tag-yellow/30" : state === "done" ? "border-success/40 bg-tag-green/30" : "border-border bg-surface-1"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <CheckupDot state={state} result={item.result} />
        <span className={`min-w-0 flex-1 text-13 font-medium ${state === "pending" ? "text-muted-foreground" : "text-foreground"}`}>{item.label}</span>
        <span className="shrink-0 text-12 text-muted-foreground">
          {state === "pending" ? "等待中" : state === "running" ? "校验中…" : item.result === "ok" ? "✅ 通过" : "⚠️ 警告 · 不阻塞"}
        </span>
      </div>
      {state === "done" && (
        <div className="mt-1.5 pl-5">
          <p className="text-12 text-muted-foreground">{item.detail}</p>
          {item.remedy && (
            <p data-testid={`checkup-remedy-${item.id}`} className="mt-0.5 text-12 font-medium text-foreground">
              → {item.remedy}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

export function OnboardWizard() {
  const loading = useMockLoading();
  const [emptyDemo, setEmptyDemo] = useState(false);
  const [step, setStep] = useState<Step>(1);
  const [installed, setInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [repo, setRepo] = useState<string | null>(null);
  // 体检进度：已完成的项数；等于总数 = 全部完成
  const [checkedCount, setCheckedCount] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const repos = emptyDemo ? [] : MOCK_ONBOARD_REPOS;
  const selectedRepo = MOCK_ONBOARD_REPOS.find((r) => r.fullName === repo) ?? null;
  const allDone = checkedCount >= MOCK_CHECKUP_ITEMS.length;

  // ① mock「跳转 GitHub 安装」：1.2s 后返回已安装回执态。真实实现是 GitHub App 安装跳转往返。
  const startInstall = () => {
    setInstalling(true);
    timers.current.push(setTimeout(() => {
      setInstalling(false);
      setInstalled(true);
    }, 1200));
  };

  // ③ 进入第 3 步自动开跑：逐项实时校验动画（mock 定时器链）。真实实现换 WS/轮询体检事件。
  useEffect(() => {
    if (step !== 3) return;
    setCheckedCount(0);
    let acc = 0;
    const ts: ReturnType<typeof setTimeout>[] = [];
    MOCK_CHECKUP_ITEMS.forEach((item, i) => {
      acc += item.durationMs;
      ts.push(setTimeout(() => setCheckedCount(i + 1), acc));
    });
    timers.current.push(...ts);
    return () => ts.forEach(clearTimeout);
  }, [step]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  return (
    <div className="mx-auto max-w-content space-y-4 px-6 pb-14 pt-7 md:px-9" data-testid="onboard-wizard">
      <PrototypeHeader
        title="项目接入向导"
        subtitle="/onboard · 发起人 = 仓库 GitHub admin（UC-01）· 零侵入：只要只读镜像 + webhook + commit status · 目标 ≤5 分钟"
        emptyDemo={emptyDemo}
        onToggleEmptyDemo={() => setEmptyDemo((v) => !v)}
      />

      <div className="rounded-12 border border-border bg-surface-1 p-5">
        <StepRail step={step} />

        {loading ? (
          <div className="mt-4">
            <LoadingSkeleton rows={3} />
          </div>
        ) : (
          <>
            {/* ① 安装 GitHub App */}
            {step === 1 && (
              <div data-testid="onboard-step-1" className="mt-5 space-y-4">
                <div className="rounded-10 border border-border bg-background p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-13 font-medium text-foreground">BoardX DevPortal · GitHub App</span>
                    <Badge variant="outline" className="text-11">零侵入</Badge>
                  </div>
                  <ul className="mt-2 space-y-1 text-12 text-muted-foreground">
                    <li>· 只申请三项权限：仓库只读镜像 / webhook 事件 / commit status 写入</li>
                    <li>· 不改你的代码、不建分支、不发 commit——写入永远发生在 GitHub 侧由你确认</li>
                    <li>· 卸载 App 即完全退出，无残留</li>
                  </ul>
                  {installed ? (
                    <div data-testid="install-receipt" className="mt-3 flex flex-wrap items-center gap-2 rounded-8 border border-success/40 bg-tag-green/40 p-2.5">
                      <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-success" />
                      <span className="text-12 font-medium text-foreground">
                        已安装 · installation #{MOCK_GH_INSTALL.installationId} · @{MOCK_GH_INSTALL.account} 账户
                      </span>
                      <span className="text-11 text-muted-foreground">（权限：{MOCK_GH_INSTALL.permissions.join(" / ")}）</span>
                    </div>
                  ) : (
                    <Button className="mt-3" data-testid="install-github-app" disabled={installing} onClick={startInstall}>
                      {installing ? "跳转 GitHub 安装中…（mock）" : "跳转 GitHub 安装 →"}
                    </Button>
                  )}
                </div>
                <div className="flex justify-end">
                  <Button data-testid="onboard-next-1" disabled={!installed} onClick={() => setStep(2)}>
                    下一步：选择仓库 →
                  </Button>
                </div>
              </div>
            )}

            {/* ② 选 repo（admin 前置） */}
            {step === 2 && (
              <div data-testid="onboard-step-2" className="mt-5 space-y-4">
                <p className="text-13 text-muted-foreground">
                  App 已装到 <span className="font-mono text-foreground">@{MOCK_GH_INSTALL.account}</span>——选择要接入的仓库。
                  <span className="font-medium text-foreground">前置：发起人必须是该仓库的 GitHub admin</span>（管理员即 coord-agent 持有者，权限变化即失效）。
                </p>
                {repos.length === 0 ? (
                  <EmptyState testid="onboard-repos-empty">这个 GitHub 账户下没有可接入的仓库——先在 GitHub 上给 App 授权仓库范围。</EmptyState>
                ) : (
                  <ul role="radiogroup" aria-label="选择仓库" className="space-y-2" data-testid="onboard-repo-list">
                    {repos.map((r) => (
                      <li key={r.fullName}>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={repo === r.fullName}
                          disabled={!r.isAdmin}
                          data-testid={`repo-row-${r.slug}`}
                          onClick={() => setRepo(r.fullName)}
                          className={`flex w-full flex-wrap items-center gap-2 rounded-10 border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                            repo === r.fullName
                              ? "border-primary bg-surface-2"
                              : r.isAdmin
                                ? "border-border bg-background hover:bg-surface-1"
                                : "cursor-not-allowed border-border bg-muted/50 opacity-60"
                          }`}
                        >
                          <span
                            aria-hidden
                            className={`h-2.5 w-2.5 shrink-0 rounded-full ${repo === r.fullName ? "bg-primary" : "bg-muted ring-1 ring-border"}`}
                          />
                          <span className="min-w-0 font-mono text-13 text-foreground">{r.fullName}</span>
                          {r.private && <Badge variant="outline" className="text-11">private</Badge>}
                          <Badge variant="outline" className="text-11">{r.language}</Badge>
                          {r.isAdmin ? (
                            <span data-testid={`admin-badge-${r.slug}`} className="rounded-full bg-tag-green px-2 py-0.5 text-11 font-medium text-foreground">
                              admin ✓
                            </span>
                          ) : (
                            <span data-testid={`not-admin-${r.slug}`} className="rounded-full bg-muted px-2 py-0.5 text-11 text-muted-foreground">
                              非 admin · 不满足前置
                            </span>
                          )}
                          <span className="w-full pl-4.5 text-12 text-muted-foreground sm:w-auto sm:flex-1 sm:pl-0 sm:text-right">{r.description}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep(1)}>
                    ← 上一步
                  </Button>
                  <Button data-testid="onboard-next-2" disabled={!selectedRepo} onClick={() => setStep(3)}>
                    开始自动体检 →
                  </Button>
                </div>
              </div>
            )}

            {/* ③ 自动体检（逐项实时校验；警告不阻塞） */}
            {step === 3 && selectedRepo && (
              <div data-testid="onboard-step-3" className="mt-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-13 text-muted-foreground">
                    正在体检 <span className="font-mono text-foreground">{selectedRepo.fullName}</span> ——逐项实时校验，
                    <span className="font-medium text-foreground">⚠️ 警告不阻塞接入</span>。
                  </p>
                  <span className="text-12 tabular-nums text-muted-foreground" data-testid="checkup-progress">
                    {checkedCount}/{MOCK_CHECKUP_ITEMS.length}
                  </span>
                </div>

                <ul className="space-y-2" data-testid="checkup-list" aria-live="polite">
                  {MOCK_CHECKUP_ITEMS.map((item, i) => (
                    <CheckupRow key={item.id} item={item} state={i < checkedCount ? "done" : i === checkedCount ? "running" : "pending"} />
                  ))}
                </ul>

                {allDone ? (
                  <div data-testid="onboard-done" className="flex flex-col items-center gap-2 rounded-12 border border-success/40 bg-tag-green/40 py-7 text-center">
                    <span aria-hidden className="h-3 w-3 rounded-full bg-success" />
                    <p className="text-15 font-semibold text-foreground">🎉 {MOCK_ONBOARD_DONE.banner}</p>
                    <p className="text-12 text-muted-foreground" data-testid="onboard-elapsed">
                      耗时 <span className="font-mono font-semibold text-foreground">{MOCK_ONBOARD_DONE.elapsed}</span>
                      （目标 {MOCK_ONBOARD_DONE.target}）· 2 项警告可稍后在治理台补齐
                    </p>
                    <Link
                      href={`/p/${selectedRepo.slug}/settings`}
                      data-testid="enter-workspace"
                      className="mt-1 inline-flex h-10 items-center rounded-lg bg-primary px-4 text-13 font-semibold text-primary-foreground transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      进入工作区 →
                    </Link>
                  </div>
                ) : (
                  <p className="text-12 text-muted-foreground">原型说明：体检为 mock 定时器动画（约 7 秒跑完）；真实实现由后端逐项回报事件。</p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <p className="text-12 text-muted-foreground">
        想先看看别的项目长什么样？<Link href="/explore" className="font-medium text-foreground underline-offset-2 hover:underline">去项目目录 →</Link>
      </p>
    </div>
  );
}
