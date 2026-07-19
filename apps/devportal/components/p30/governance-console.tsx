"use client";
// W6 /p/:slug/settings 治理台（p30 UI 先行原型，UC-02 owner 视角，D2/D5）。
// 板块：唯一管理员与 coord-agent 绑定卡｜agent 准入策略开关（D2）｜审批队列（SLA 倒计时）｜
// andon 面板（拉停状态一键解除 + per-person 授权名单 D5 + ✋ 举手事件琥珀区）｜token 审计表。
// Probation 规则提示条（前 3 个 PR 强制人工 review）。
// 「无权限态」占位：右上视角开关 mock 切到非 owner，看到的就是拒绝页（N1 第四态）；
// 审批队列（F06 接真）：真实待审 membership + SLA 倒计时 + 批准/驳回真实调用状态迁移，
// 详见 /api/portal/approvals；其余板块（绑定卡/准入策略/andon/token 审计）仍是 mock，出于
// 范围纪律不在本 feature 一并接真。
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PortalCard } from "@/components/portal/portal-card";
import { HeartbeatDot } from "@/components/portal/heartbeat-dot";
import { ConfirmDialog } from "@/components/p30/confirm-dialog";
import { EmptyState, IdentityChip, LoadingSkeleton, PrototypeHeader, useMockLoading } from "@/components/p30/shared";
import { SlaBadge } from "@/components/p30/sla-countdown";
import {
  MOCK_ACTIVE_ANDON,
  MOCK_ANDON_GRANTS,
  MOCK_GOVERNANCE_BINDING,
  MOCK_GRANT_CANDIDATES,
  MOCK_RAISE_HANDS,
  MOCK_TOKEN_AUDIT,
  type MockAndonGrant,
} from "@/lib/mock/p30";

interface ApprovalItem {
  membership_id: string;
  handle: string;
  role: string;
  modules: string[];
  intro: string;
  created_at: string;
  sla: { deadline: string; hoursLeft: number; timedOut: boolean; urgent: boolean } | null;
}

/** 审批队列一行：批准/驳回真实调用 /api/portal/approvals/:id（p30/F06）。 */
function ApprovalRow({
  item,
  onDecide,
  decided,
  pending,
}: {
  item: ApprovalItem;
  decided: "approved" | "rejected" | null;
  pending: boolean;
  onDecide: (d: "approved" | "rejected") => void;
}) {
  return (
    <li data-testid={`approval-row-${item.membership_id}`} className="rounded-10 border border-border bg-surface-1 p-3 transition-colors hover:bg-surface-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <IdentityChip kind="human">@{item.handle}</IdentityChip>
        <Badge variant="secondary" className="text-11">申请 {item.role}</Badge>
        {item.modules.map((m) => (
          <IdentityChip key={m} kind="project">{m}</IdentityChip>
        ))}
        {item.sla && (
          <span data-testid={`sla-badge-${item.membership_id}`}>
            <SlaBadge deadline={item.sla.deadline} promiseH={Math.max(1, Math.round((Date.parse(item.sla.deadline) - Date.parse(item.created_at)) / 3_600_000))} />
          </span>
        )}
      </div>
      <p className="mt-2 text-12 leading-relaxed text-muted-foreground">“{item.intro}”</p>
      {decided ? (
        <p data-testid={`approval-decided-${item.membership_id}`} className={`mt-2 text-12 font-medium ${decided === "approved" ? "text-success" : "text-destructive"}`}>
          {decided === "approved" ? "✓ 已批准（初始 Probation）" : "✗ 已驳回"} · 已入审计，onboarding issue 已更新
        </p>
      ) : (
        <div className="mt-2 flex gap-2">
          <Button size="sm" disabled={pending} data-testid={`approve-${item.membership_id}`} onClick={() => onDecide("approved")}>
            批准
          </Button>
          <Button size="sm" variant="outline" disabled={pending} data-testid={`reject-${item.membership_id}`} onClick={() => onDecide("rejected")}>
            驳回
          </Button>
        </div>
      )}
    </li>
  );
}

export function GovernanceConsole({ slug }: { slug: string }) {
  const loading = useMockLoading();
  const [emptyDemo, setEmptyDemo] = useState(false);
  const [asOwner, setAsOwner] = useState(true);
  const [manualAdmission, setManualAdmission] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, "approved" | "rejected" | null>>({});
  const [andonActive, setAndonActive] = useState(true);
  const [releaseConfirm, setReleaseConfirm] = useState(false);
  const [grants, setGrants] = useState<readonly MockAndonGrant[]>(MOCK_ANDON_GRANTS);
  const [removeConfirm, setRemoveConfirm] = useState<string | null>(null);
  const [auditFlash, setAuditFlash] = useState<string | null>(null);

  // 审批队列（F06 接真）：真实拉取 + 真实决策，其余板块仍是 mock（见文件头范围纪律说明）。
  const [approvalItems, setApprovalItems] = useState<ApprovalItem[] | null>(null);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const flash = (msg: string) => {
    setAuditFlash(msg);
    setTimeout(() => setAuditFlash(null), 4000);
  };

  useEffect(() => {
    if (!asOwner) return;
    let cancelled = false;
    setApprovalError(null);
    fetch(`/api/portal/approvals?project=${encodeURIComponent(slug)}`)
      .then(async (r) => {
        if (cancelled) return;
        if (r.status === 401) return setApprovalError("未登录，无法读取真实审批队列");
        if (r.status === 403) return setApprovalError("无权限：你在此项目不是 owner/maintainer/approver");
        const body = (await r.json().catch(() => ({}))) as { configured?: boolean; items?: ApprovalItem[]; error?: string };
        if (body.configured === false) return setApprovalError("目录服务尚未在本环境接入");
        if (body.error) return setApprovalError(`读取失败：${body.error}`);
        setApprovalItems(body.items ?? []);
      })
      .catch(() => !cancelled && setApprovalError("网络错误，无法读取审批队列"));
    return () => {
      cancelled = true;
    };
  }, [asOwner, slug, refreshTick]);

  const decide = async (membershipId: string, decision: "approved" | "rejected") => {
    setDecidingId(membershipId);
    try {
      const res = await fetch(`/api/portal/approvals/${membershipId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ project: slug, action: decision === "approved" ? "approve" : "reject" }),
      });
      if (res.ok) {
        const item = approvalItems?.find((a) => a.membership_id === membershipId);
        setDecisions((cur) => ({ ...cur, [membershipId]: decision }));
        flash(`成员申请 @${item?.handle ?? membershipId} ${decision === "approved" ? "已批准" : "已驳回"}`);
        setRefreshTick((t) => t + 1);
      } else {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        flash(`操作失败：${body.error ?? res.status}`);
      }
    } catch {
      flash("操作失败：网络错误");
    } finally {
      setDecidingId(null);
    }
  };

  const queue = emptyDemo ? [] : approvalItems ?? [];
  const hands = emptyDemo ? [] : MOCK_RAISE_HANDS;
  const audit = emptyDemo ? [] : MOCK_TOKEN_AUDIT;
  const b = MOCK_GOVERNANCE_BINDING;

  return (
    <div className="mx-auto max-w-content space-y-4 px-6 pb-14 pt-7 md:px-9" data-testid="governance-console">
      <PrototypeHeader
        title="治理台"
        subtitle={`项目工作区 /p/${slug}/settings · owner 专属：准入策略 / 审批队列 / andon / token 审计`}
        emptyDemo={emptyDemo}
        onToggleEmptyDemo={() => setEmptyDemo((v) => !v)}
      />

      {/* mock 视角开关：核对无权限态（N1 第四态） */}
      <div className="flex flex-wrap items-center gap-2 rounded-10 border border-dashed border-border p-2.5">
        <span className="text-12 text-muted-foreground">原型视角开关（mock，仅供核对无权限态）：</span>
        <Button size="sm" variant={asOwner ? "default" : "outline"} data-testid="view-as-owner" aria-pressed={asOwner} onClick={() => setAsOwner(true)}>
          👤 owner 视角
        </Button>
        <Button size="sm" variant={asOwner ? "outline" : "default"} data-testid="view-as-contributor" aria-pressed={!asOwner} onClick={() => setAsOwner(false)}>
          👤 contributor 视角（无权限）
        </Button>
      </div>

      {!asOwner ? (
        <div data-testid="gov-no-access" className="flex flex-col items-center gap-3 rounded-12 border border-border bg-surface-1 py-14 text-center">
          <span aria-hidden className="text-21">🔒</span>
          <p className="text-15 font-semibold text-foreground">治理台仅 owner / maintainer 可见</p>
          <p className="max-w-brand text-13 leading-relaxed text-muted-foreground">
            你当前是 contributor。治理动作（准入策略 / 审批 / andon 授权 / token 审计）需要 owner 权限——
            有异常想反映？任何成员都可以 ✋ 举手（不阻断，进待拍板）。
          </p>
          <Button size="sm" variant="outline">✋ 举手反映问题</Button>
        </div>
      ) : loading ? (
        <LoadingSkeleton rows={6} />
      ) : (
        <>
          {/* 审计反馈条（mock：任何治理动作后浮现） */}
          {auditFlash && (
            <p data-testid="audit-flash" role="status" className="rounded-8 border border-success/40 bg-tag-green/50 px-3 py-2 text-12 text-foreground transition-opacity">
              ✓ {auditFlash} · 已写入只增审计日志并双写 GitHub issue（N5）
            </p>
          )}

          {/* Probation 规则提示条 */}
          <p data-testid="probation-notice" className="rounded-8 border border-border bg-surface-2 px-3 py-2 text-12 text-muted-foreground">
            规则：Probation 成员的 agent <span className="font-semibold text-foreground">前 3 个 PR 强制人工 review</span>，
            通过后自动升 Trusted；移交管理员 = 移交 coord-agent（双写审计）。
          </p>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* 唯一管理员与 coord-agent 绑定卡 */}
            <PortalCard title="唯一管理员 · coord-agent 绑定" state="ready">
              <div data-testid="binding-card" className="space-y-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <IdentityChip kind="human">@{b.adminHandle}</IdentityChip>
                  <span className="text-13 font-medium text-foreground">{b.adminName}</span>
                  {b.adminVerified && (
                    <Badge variant="secondary" className="text-11" data-testid="admin-verified">
                      ✓ repo admin 已校验
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 rounded-8 bg-surface-2 p-2.5">
                  <HeartbeatDot minutes={1} />
                  <IdentityChip kind="agent" className="font-mono">{b.coordAgentId}</IdentityChip>
                  <span className="text-12 text-muted-foreground">项目协调 agent · 绑定于 {b.boundAt.slice(0, 10)}</span>
                </div>
                <p className="text-11 text-muted-foreground">
                  一个项目恰好一个管理员 + 一个 coord-agent；移交管理员即移交 coord-agent（原子，双写审计）。
                </p>
              </div>
            </PortalCard>

            {/* agent 准入策略（D2） */}
            <PortalCard title="agent 准入策略" state="ready">
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={manualAdmission ? "outline" : "default"}
                    data-testid="admission-auto"
                    aria-pressed={!manualAdmission}
                    onClick={() => {
                      if (manualAdmission) flash("准入策略切换为「自动准入」");
                      setManualAdmission(false);
                    }}
                  >
                    自动准入（默认）
                  </Button>
                  <Button
                    size="sm"
                    variant={manualAdmission ? "default" : "outline"}
                    data-testid="admission-manual"
                    aria-pressed={manualAdmission}
                    onClick={() => {
                      if (!manualAdmission) flash("准入策略切换为「人工审批」");
                      setManualAdmission(true);
                    }}
                  >
                    人工审批
                  </Button>
                </div>
                <p data-testid="admission-explain" className="rounded-8 bg-surface-2 p-2.5 text-12 leading-relaxed text-muted-foreground">
                  {manualAdmission
                    ? "人工审批：成员 enroll 的每个 agent 都进入审批队列，由你逐个放行。适合高敏感期（如发版冻结）。"
                    : "自动准入（D2 默认）：信任锚点是人——审批发生在成员加入层，成员的 agent enroll 即生效。安全靠事后控制链：归因到 owner → andon 拉停 → 吊销 token 即时 401。"}
                </p>
              </div>
            </PortalCard>
          </div>

          {/* 审批队列（真实数据，p30/F06） */}
          <PortalCard title={`审批队列（${queue.filter((a) => !decisions[a.membership_id]).length} 待处理）`} state="ready" wide>
            {approvalError ? (
              <p data-testid="approval-error" role="alert" className="rounded-8 border border-destructive/40 bg-destructive/5 p-3 text-12 text-destructive">
                {approvalError}
              </p>
            ) : !emptyDemo && approvalItems === null ? (
              <LoadingSkeleton rows={2} />
            ) : queue.length === 0 ? (
              <EmptyState testid="approval-empty">没有待审批的成员申请——招募页（P2）会把新申请送到这里。</EmptyState>
            ) : (
              <ul data-testid="approval-queue" className="space-y-2.5">
                {queue.map((a) => (
                  <ApprovalRow
                    key={a.membership_id}
                    item={a}
                    decided={decisions[a.membership_id] ?? null}
                    pending={decidingId === a.membership_id}
                    onDecide={(d) => decide(a.membership_id, d)}
                  />
                ))}
              </ul>
            )}
          </PortalCard>

          {/* andon 面板 */}
          <PortalCard title="andon 面板" state="ready" wide>
            <div data-testid="andon-panel" className="space-y-4">
              {/* 当前拉停状态 */}
              {emptyDemo || !andonActive ? (
                <div data-testid="andon-clear" className="flex items-center gap-2 rounded-10 border border-success/40 bg-tag-green/50 p-3">
                  <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-success" />
                  <p className="text-13 text-foreground">当前没有活跃 andon——流水线畅通。</p>
                </div>
              ) : (
                <div data-testid="andon-active" role="alert" className="rounded-10 border border-destructive/40 bg-destructive/5 p-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span aria-hidden className="h-2.5 w-2.5 animate-pulse rounded-full bg-destructive" />
                    <span className="text-13 font-semibold text-destructive">andon 拉停中 · {MOCK_ACTIVE_ANDON.sinceMin} 分钟</span>
                    <IdentityChip kind="agent">{MOCK_ACTIVE_ANDON.pulledBy}</IdentityChip>
                  </div>
                  <p className="mt-1.5 text-13 text-foreground">{MOCK_ACTIVE_ANDON.reason}</p>
                  <p className="mt-1 text-12 text-muted-foreground">{MOCK_ACTIVE_ANDON.scope}</p>
                  <Button size="sm" variant="destructive" className="mt-2" data-testid="andon-release" onClick={() => setReleaseConfirm(true)}>
                    解除拉停…
                  </Button>
                </div>
              )}

              {/* per-person 授权名单（D5） */}
              <div data-testid="andon-grants" className="rounded-10 border border-border bg-surface-1 p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-13 font-semibold text-foreground">per-person 拉停授权名单（D5）</p>
                  <span className="text-11 text-muted-foreground">maintainer+ 天然有权；以下是额外授权 · 全部入审计</span>
                </div>
                <ul className="mt-2 space-y-1.5">
                  {grants.length === 0 && (
                    <li>
                      <EmptyState testid="grants-empty">没有额外授权——只有 maintainer+ 能拉停。</EmptyState>
                    </li>
                  )}
                  {grants.map((g) => (
                    <li key={g.handle} data-testid={`grant-row-${g.handle}`} className="flex flex-wrap items-center gap-1.5 rounded-8 bg-surface-2 px-2.5 py-1.5 transition-colors hover:bg-accent">
                      <IdentityChip kind="human">@{g.handle}</IdentityChip>
                      <span className="text-12 text-foreground">{g.name}</span>
                      <Badge variant="outline" className="text-11">{g.role}</Badge>
                      <span className="text-11 text-muted-foreground">授予于 {g.grantedAt.slice(0, 10)} · by {g.grantedBy}</span>
                      <Button size="sm" variant="ghost" className="ml-auto" data-testid={`grant-remove-${g.handle}`} onClick={() => setRemoveConfirm(g.handle)}>
                        移除
                      </Button>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {MOCK_GRANT_CANDIDATES.filter((c) => !grants.some((g) => g.handle === c.handle)).map((c) => (
                    <Button
                      key={c.handle}
                      size="sm"
                      variant="outline"
                      data-testid={`grant-add-${c.handle}`}
                      onClick={() => {
                        setGrants((cur) => [...cur, { ...c, grantedAt: "2026-07-19T00:00:00Z", grantedBy: "@usamshen" }]);
                        flash(`已授予 @${c.handle} andon 拉停权`);
                      }}
                    >
                      ＋ 授予 @{c.handle}
                    </Button>
                  ))}
                  <span className="text-11 text-muted-foreground">不做自动规则：授权只针对具体的人（「人人可举手，班组长拉绳」）。</span>
                </div>
              </div>

              {/* ✋ 举手事件（琥珀色，与红色 andon 视觉区分） */}
              <div data-testid="raise-hand-list" className="rounded-10 border border-tag-yellow bg-tag-yellow/40 p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-13 font-semibold text-foreground">✋ 举手事件（不阻断）</p>
                  <span className="text-11 text-muted-foreground">人人可发 · 进待拍板 · 24h 无回应自动升级</span>
                </div>
                {hands.length === 0 ? (
                  <div className="mt-2">
                    <EmptyState testid="raise-hand-empty">没有举手事件。</EmptyState>
                  </div>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {hands.map((rh) => (
                      <li key={rh.id} data-testid={`raise-hand-${rh.id}`} className="flex flex-wrap items-center gap-1.5 rounded-8 bg-background/60 px-2.5 py-1.5 transition-colors hover:bg-background">
                        <IdentityChip kind={rh.fromKind}>{rh.from}</IdentityChip>
                        <span className="min-w-0 flex-1 truncate text-12 text-foreground">{rh.text}</span>
                        {rh.status === "answered" ? (
                          <Badge variant="outline" className="text-11">已回应</Badge>
                        ) : (
                          <span className="shrink-0 rounded-full bg-tag-yellow px-2 py-0.5 text-11 tabular-nums text-foreground">
                            {rh.ageH}h 前 · {rh.escalateInH}h 后升级
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </PortalCard>

          {/* token 审计表 */}
          <PortalCard title="token 审计（最近 mint / rotate / revoke）" state="ready" wide>
            {audit.length === 0 ? (
              <EmptyState testid="token-audit-empty">还没有 token 事件——成员 enroll 第一个 agent 后出现。</EmptyState>
            ) : (
              <div className="overflow-x-auto">
                <table data-testid="token-audit" className="w-full min-w-max border-collapse text-12 md:min-w-full">
                  <thead>
                    <tr className="border-b border-border text-left text-11 uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">时间</th>
                      <th className="py-2 pr-3 font-medium">动作</th>
                      <th className="py-2 pr-3 font-medium">agent</th>
                      <th className="py-2 pr-3 font-medium">操作者</th>
                      <th className="py-2 font-medium">备注</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.map((t) => (
                      <tr key={t.id} data-testid={`token-audit-${t.id}`} className="border-b border-border transition-colors last:border-0 hover:bg-surface-1">
                        <td className="py-2 pr-3 tabular-nums text-muted-foreground">{t.at.slice(5, 16).replace("T", " ")}</td>
                        <td className="py-2 pr-3">
                          <Badge variant={t.action === "revoke" ? "destructive" : t.action === "rotate" ? "secondary" : "outline"} className="text-11">
                            {t.action}
                          </Badge>
                        </td>
                        <td className="py-2 pr-3 font-mono text-foreground">{t.agentId}</td>
                        <td className="py-2 pr-3 font-mono text-muted-foreground">{t.actor}</td>
                        <td className="py-2 text-muted-foreground">{t.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-2 text-11 text-muted-foreground">只增审计：吊销/轮换即时 401（UC-13）；本表与招募页 SLA 记录同一审计源。</p>
          </PortalCard>
        </>
      )}

      {/* 解除 andon 确认 */}
      {releaseConfirm && (
        <ConfirmDialog
          testid="andon-release-confirm"
          title="解除 andon 拉停"
          body={`确认解除 ${MOCK_ACTIVE_ANDON.pulledBy} 拉起的 andon？merge 队列将立即恢复。解除动作会记入审计并通知拉停者说明理由。`}
          confirmLabel="确认解除，恢复流水线"
          destructive
          onConfirm={() => {
            setAndonActive(false);
            setReleaseConfirm(false);
            flash(`andon ${MOCK_ACTIVE_ANDON.id} 已解除`);
          }}
          onCancel={() => setReleaseConfirm(false)}
        />
      )}

      {/* 移除授权确认 */}
      {removeConfirm && (
        <ConfirmDialog
          testid="grant-remove-confirm"
          title={`移除 @${removeConfirm} 的拉停授权`}
          body="移除后该成员立即失去 andon 拉停权（不影响 ✋ 举手）。动作会记入只增审计。"
          confirmLabel="确认移除"
          destructive
          onConfirm={() => {
            setGrants((cur) => cur.filter((g) => g.handle !== removeConfirm));
            flash(`已移除 @${removeConfirm} 的 andon 授权`);
            setRemoveConfirm(null);
          }}
          onCancel={() => setRemoveConfirm(null)}
        />
      )}
    </div>
  );
}
