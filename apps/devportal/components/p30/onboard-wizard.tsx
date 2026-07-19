"use client";
// /onboard 项目接入向导 —— 接真（p30/F05，UC-01，发起人 = repo admin 视角）。
// 三步：① 真实「跳转 GitHub 安装」（GitHub App 4328933）→ ② repo 列表 = 该 installation
// 真实仓库，admin 徽章按 GitHub collaborator permission 真实判定 → ③ 自动体检由后端
// 逐项真实检测（webhook 连通 / issues·PR 镜像种子 / CODEOWNERS·CONTRIBUTING / 分支保护，
// 警告不阻塞）→ 完成：项目写入目录 DO 成为租户，「进入工作区」落 /p/:slug/settings。
//
// 批次 3 原型（mock 定时器动画）已整体替换为真实网络请求；testid 集合保持不变
// （onboard-step-{1,2,3}/checkup-item-<id>/onboard-elapsed/onboard-done/enter-workspace）。
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/p30/shared";

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
type CheckupResult = "ok" | "warn";
interface CheckupItem {
  id: string;
  label: string;
  result: CheckupResult;
  detail: string;
  remedy?: string;
}

/** 体检状态点：等待灰 / 校验中脉冲 / ✅ 成功绿 / ⚠️ 警告琥珀（与 andon 红严格区分）。 */
function CheckupDot({ state, result }: { state: CheckState; result: CheckupResult | undefined }) {
  if (state !== "done") {
    return (
      <span
        aria-label={state === "running" ? "校验中" : "等待校验"}
        className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${state === "running" ? "animate-pulse bg-primary" : "bg-muted ring-1 ring-border"}`}
      />
    );
  }
  return result === "ok" ? (
    <span aria-label="通过" className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-success" />
  ) : (
    <span aria-label="警告（不阻塞）" className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-accent-amber" />
  );
}

function CheckupRow({ item, state }: { item: CheckupItem | undefined; state: CheckState }) {
  const warn = state === "done" && item?.result === "warn";
  const label = item?.label ?? "";
  return (
    <li
      data-testid={`checkup-item-${item?.id ?? ""}`}
      data-state={state}
      className={`rounded-10 border p-3 transition-colors ${
        warn ? "border-tag-yellow bg-tag-yellow/30" : state === "done" ? "border-success/40 bg-tag-green/30" : "border-border bg-surface-1"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <CheckupDot state={state} result={item?.result} />
        <span className={`min-w-0 flex-1 text-13 font-medium ${state === "pending" ? "text-muted-foreground" : "text-foreground"}`}>{label}</span>
        <span className="shrink-0 text-12 text-muted-foreground">
          {state === "pending" ? "等待中" : state === "running" ? "校验中…" : item?.result === "ok" ? "✅ 通过" : "⚠️ 警告 · 不阻塞"}
        </span>
      </div>
      {state === "done" && item && (
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

interface InstallationRepo {
  full_name: string;
  owner: string;
  name: string;
  slug: string;
  description: string | null;
  language: string | null;
  private: boolean;
  default_branch: string;
  is_admin: boolean;
}

interface InstallationPayload {
  installation_id: number;
  account: { login: string; type: string } | null;
  permissions: string[];
  repos: InstallationRepo[];
}

type FetchState<T> = { status: "loading" } | { status: "error"; message: string } | { status: "ok"; data: T };

const CHECKUP_ID_ORDER = ["webhook", "mirror-seed", "modules-init", "branch-protection"];

/** 体检结果分批揭示：数据一次性到位，但按固定节奏逐项展现（真实结果，非 mock 时长）。 */
function useStaggeredReveal(total: number, active: boolean): number {
  const [revealed, setRevealed] = useState(0);
  useEffect(() => {
    if (!active || total === 0) return;
    setRevealed(0);
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < total; i++) timers.push(setTimeout(() => setRevealed((n) => Math.max(n, i + 1)), (i + 1) * 500));
    return () => timers.forEach(clearTimeout);
  }, [active, total]);
  return revealed;
}

export function OnboardWizard({ installationId }: { installationId: number | null }) {
  const [step, setStep] = useState<Step>(1);
  const [installation, setInstallation] = useState<FetchState<InstallationPayload> | null>(null);
  const [repo, setRepo] = useState<InstallationRepo | null>(null);
  const [checkup, setCheckup] = useState<FetchState<CheckupItem[]> | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [finalSlug, setFinalSlug] = useState<string | null>(null);
  const [finalError, setFinalError] = useState<string | null>(null);
  const stepThreeStartedAt = useRef<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  // ① installation_id 出现（GitHub 安装回调已带回）→ 拉真实回执 + 仓库列表。
  useEffect(() => {
    if (!installationId) return;
    let cancelled = false;
    setInstallation({ status: "loading" });
    fetch(`/api/coord/onboard/installations/${installationId}`)
      .then(async (res) => {
        if (cancelled) return;
        const body = (await res.json()) as { configured: boolean; installation?: InstallationPayload; error?: string };
        if (!res.ok || body.error) return setInstallation({ status: "error", message: body.error ?? `upstream_${res.status}` });
        if (!body.configured) return setInstallation({ status: "error", message: "coord_gateway_not_configured" });
        setInstallation({ status: "ok", data: body.installation! });
      })
      .catch((e: unknown) => !cancelled && setInstallation({ status: "error", message: String(e) }));
    return () => {
      cancelled = true;
    };
  }, [installationId]);

  // ③ 进入第 3 步：拉真实体检结果（一次性到位，展现逻辑见 useStaggeredReveal）。
  useEffect(() => {
    if (step !== 3 || !repo || installation?.status !== "ok") return;
    const inst = installation.data.installation_id;
    stepThreeStartedAt.current = Date.now();
    setCheckup({ status: "loading" });
    const qs = new URLSearchParams({
      installation_id: String(inst),
      owner: repo.owner,
      repo: repo.name,
      default_branch: repo.default_branch,
    });
    let cancelled = false;
    fetch(`/api/coord/onboard/checkup?${qs.toString()}`)
      .then(async (res) => {
        if (cancelled) return;
        const body = (await res.json()) as { configured: boolean; items?: CheckupItem[]; error?: string };
        if (!res.ok || body.error) return setCheckup({ status: "error", message: body.error ?? `upstream_${res.status}` });
        if (!body.configured) return setCheckup({ status: "error", message: "coord_gateway_not_configured" });
        const ordered = CHECKUP_ID_ORDER.map((id) => body.items!.find((i) => i.id === id)).filter((i): i is CheckupItem => Boolean(i));
        setCheckup({ status: "ok", data: ordered });
      })
      .catch((e: unknown) => !cancelled && setCheckup({ status: "error", message: String(e) }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- repo/installation identity 足够
  }, [step, repo, installation]);

  const items = checkup?.status === "ok" ? checkup.data : [];
  const revealed = useStaggeredReveal(items.length, checkup?.status === "ok");
  const allDone = checkup?.status === "ok" && revealed >= items.length && items.length > 0;

  // 真实耗时计（目标 ≤5 分钟）：从进入第 3 步到全部体检项揭示完成。
  useEffect(() => {
    if (!allDone || !stepThreeStartedAt.current) return;
    setElapsedMs(Date.now() - stepThreeStartedAt.current);
  }, [allDone]);

  // 全部体检项揭示完成 → 立即 finalize（幂等注册为目录项目，拿真实 slug）。
  // installation_id 必传：服务端据此换 installation token 核实发起人对该仓的
  // admin 权限（服务端强制，非前端 disabled 徽章能代替，#776 review）。
  useEffect(() => {
    if (!allDone || !repo || installation?.status !== "ok" || finalSlug || finalizing) return;
    setFinalizing(true);
    fetch("/api/coord/onboard/finalize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        full_name: repo.full_name,
        private: repo.private,
        installation_id: installation.data.installation_id,
      }),
    })
      .then(async (res) => {
        const body = (await res.json()) as { configured: boolean; slug?: string; error?: string };
        if (!res.ok || body.error || !body.configured) return setFinalError(body.error ?? "finalize_failed");
        setFinalSlug(body.slug ?? repo.slug);
      })
      .catch((e: unknown) => setFinalError(String(e)))
      .finally(() => setFinalizing(false));
  }, [allDone, repo, installation, finalSlug, finalizing]);

  const repos = installation?.status === "ok" ? installation.data.repos : [];

  return (
    <div className="mx-auto max-w-content space-y-4 px-6 pb-14 pt-7 md:px-9" data-testid="onboard-wizard">
      <div>
        <h1 className="text-21 font-bold text-foreground">项目接入向导</h1>
        <p className="mt-1 text-13 text-muted-foreground">
          /onboard · 发起人 = 仓库 GitHub admin（UC-01）· 零侵入：只要只读镜像 + webhook + commit status · 目标 ≤5 分钟
        </p>
      </div>

      <div className="rounded-12 border border-border bg-surface-1 p-5">
        <StepRail step={step} />

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

              {!installationId && (
                <a
                  className={`mt-3 ${buttonVariants({})}`}
                  data-testid="install-github-app"
                  href="/api/coord/onboard/install?return_to=%2Fonboard"
                >
                  跳转 GitHub 安装 →
                </a>
              )}

              {installationId && installation?.status === "loading" && (
                <p className="mt-3 text-12 text-muted-foreground">正在核对安装回执…</p>
              )}
              {installationId && installation?.status === "error" && (
                <div data-testid="install-error" className="mt-3 rounded-8 border border-destructive/40 bg-destructive/10 p-2.5 text-12 text-foreground">
                  安装回执核对失败：{installation.message}。<a className="underline" href="/api/coord/onboard/install?return_to=%2Fonboard">重新发起安装</a>
                </div>
              )}
              {installationId && installation?.status === "ok" && (
                <div data-testid="install-receipt" className="mt-3 flex flex-wrap items-center gap-2 rounded-8 border border-success/40 bg-tag-green/40 p-2.5">
                  <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-success" />
                  <span className="text-12 font-medium text-foreground">
                    已安装 · installation #{installation.data.installation_id} · @{installation.data.account?.login ?? "未知账户"} 账户
                  </span>
                  <span className="text-11 text-muted-foreground">（权限：{installation.data.permissions.join(" / ") || "无"}）</span>
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <Button data-testid="onboard-next-1" disabled={installation?.status !== "ok"} onClick={() => setStep(2)}>
                下一步：选择仓库 →
              </Button>
            </div>
          </div>
        )}

        {/* ② 选 repo（admin 前置，真实 collaborator permission 判定） */}
        {step === 2 && installation?.status === "ok" && (
          <div data-testid="onboard-step-2" className="mt-5 space-y-4">
            <p className="text-13 text-muted-foreground">
              App 已装到 <span className="font-mono text-foreground">@{installation.data.account?.login}</span>——选择要接入的仓库。
              <span className="font-medium text-foreground">前置：发起人必须是该仓库的 GitHub admin</span>（管理员即 coord-agent 持有者，权限变化即失效）。
            </p>
            {repos.length === 0 ? (
              <EmptyState testid="onboard-repos-empty">这个 GitHub 账户下没有可接入的仓库——先在 GitHub 上给 App 授权仓库范围。</EmptyState>
            ) : (
              <ul role="radiogroup" aria-label="选择仓库" className="space-y-2" data-testid="onboard-repo-list">
                {repos.map((r) => (
                  <li key={r.full_name}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={repo?.full_name === r.full_name}
                      disabled={!r.is_admin}
                      data-testid={`repo-row-${r.slug}`}
                      onClick={() => setRepo(r)}
                      className={`flex w-full flex-wrap items-center gap-2 rounded-10 border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        repo?.full_name === r.full_name
                          ? "border-primary bg-surface-2"
                          : r.is_admin
                            ? "border-border bg-background hover:bg-surface-1"
                            : "cursor-not-allowed border-border bg-muted/50 opacity-60"
                      }`}
                    >
                      <span
                        aria-hidden
                        className={`h-2.5 w-2.5 shrink-0 rounded-full ${repo?.full_name === r.full_name ? "bg-primary" : "bg-muted ring-1 ring-border"}`}
                      />
                      <span className="min-w-0 font-mono text-13 text-foreground">{r.full_name}</span>
                      {r.private && <Badge variant="outline" className="text-11">private</Badge>}
                      {r.language && <Badge variant="outline" className="text-11">{r.language}</Badge>}
                      {r.is_admin ? (
                        <span data-testid={`admin-badge-${r.slug}`} className="rounded-full bg-tag-green px-2 py-0.5 text-11 font-medium text-foreground">
                          admin ✓
                        </span>
                      ) : (
                        <span data-testid={`not-admin-${r.slug}`} className="rounded-full bg-muted px-2 py-0.5 text-11 text-muted-foreground">
                          非 admin · 不满足前置
                        </span>
                      )}
                      {r.description && <span className="w-full pl-4.5 text-12 text-muted-foreground sm:w-auto sm:flex-1 sm:pl-0 sm:text-right">{r.description}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                ← 上一步
              </Button>
              <Button data-testid="onboard-next-2" disabled={!repo} onClick={() => setStep(3)}>
                开始自动体检 →
              </Button>
            </div>
          </div>
        )}

        {/* ③ 自动体检（后端逐项真实检测；警告不阻塞） */}
        {step === 3 && repo && (
          <div data-testid="onboard-step-3" className="mt-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-13 text-muted-foreground">
                正在体检 <span className="font-mono text-foreground">{repo.full_name}</span> ——逐项真实校验，
                <span className="font-medium text-foreground">⚠️ 警告不阻塞接入</span>。
              </p>
              <span className="text-12 tabular-nums text-muted-foreground" data-testid="checkup-progress">
                {revealed}/{CHECKUP_ID_ORDER.length}
              </span>
            </div>

            {checkup?.status === "error" && (
              <div data-testid="checkup-error" className="rounded-8 border border-destructive/40 bg-destructive/10 p-2.5 text-12 text-foreground">
                体检失败：{checkup.message}
              </div>
            )}

            <ul className="space-y-2" data-testid="checkup-list" aria-live="polite">
              {CHECKUP_ID_ORDER.map((id, i) => {
                const item = items.find((it) => it.id === id);
                const state: CheckState = i < revealed ? "done" : i === revealed && checkup?.status === "ok" ? "running" : "pending";
                return <CheckupRow key={id} item={item} state={state} />;
              })}
            </ul>

            {allDone && (
              <div data-testid="onboard-done" className="flex flex-col items-center gap-2 rounded-12 border border-success/40 bg-tag-green/40 py-7 text-center">
                <span aria-hidden className="h-3 w-3 rounded-full bg-success" />
                <p className="text-15 font-semibold text-foreground">🎉 项目已成为租户，coord-agent 归属已确立</p>
                <p className="text-12 text-muted-foreground" data-testid="onboard-elapsed">
                  耗时 <span className="font-mono font-semibold text-foreground">{(elapsedMs / 1000).toFixed(1)}s</span>（目标 ≤5 分钟）
                  {items.some((i) => i.result === "warn") && ` · ${items.filter((i) => i.result === "warn").length} 项警告可稍后在治理台补齐`}
                </p>
                {finalizing && <p className="text-12 text-muted-foreground">正在写入项目目录…</p>}
                {finalError && <p className="text-12 text-destructive" data-testid="finalize-error">项目注册失败：{finalError}（webhook 会稍后自动重试注册）</p>}
                {finalSlug && (
                  <Link
                    href={`/p/${finalSlug}/settings`}
                    data-testid="enter-workspace"
                    className="mt-1 inline-flex h-10 items-center rounded-lg bg-primary px-4 text-13 font-semibold text-primary-foreground transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    进入工作区 →
                  </Link>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <p className="text-12 text-muted-foreground">
        想先看看别的项目长什么样？<Link href="/explore" className="font-medium text-foreground underline-offset-2 hover:underline">去项目目录 →</Link>
      </p>
    </div>
  );
}
