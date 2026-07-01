"use client";
// uc-admin-002 — 后台团队管理（F03）：搜索/分页/编辑团队类型 + 手动上分。
// 复用 F01 的 requireSysAdmin() 门控（server component 侧走 gate 决定是否渲染本页），
// 数据走 /api/admin/teams* 真实 DB（CAP-DATA），手动上分复用 p14 credit_transactions。
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ChevronLeft, ChevronRight, Pencil, Coins, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

type TeamType = "standard" | "enterprise";

interface AdminTeam {
  id: number;
  name: string;
  teamType: TeamType;
  memberCount: number;
  creditBalance: number;
  createdAt: string;
}

const PAGE_SIZE = 10;

const TEAM_TYPE_LABEL: Record<TeamType, string> = {
  standard: "Standard",
  enterprise: "Enterprise",
};

function TeamsSkeleton() {
  return (
    <div data-testid="loading" className="mt-4 animate-pulse overflow-hidden rounded-12 border border-border">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-muted px-4.5 py-3 last:border-b-0">
          <div className="h-7.5 w-7.5 rounded-full bg-muted" />
          <div className="h-3.25 flex-1 rounded-md bg-muted" />
        </div>
      ))}
    </div>
  );
}

function EditTeamTypeModal({
  team,
  onClose,
  onSaved,
}: {
  team: AdminTeam;
  onClose: () => void;
  onSaved: (team: AdminTeam) => void;
}) {
  const [teamType, setTeamType] = useState<TeamType>(team.teamType);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/teams/${team.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ teamType }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.errors?.teamType ?? d.error ?? "保存失败");
        return;
      }
      onSaved({ ...team, teamType });
      onClose();
    } catch {
      setError("保存失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-team-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
    >
      <div data-testid="edit-team-modal" className="w-full max-w-md rounded-10 border border-border bg-popover p-4 shadow-lg">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="edit-team-title" className="text-lg font-semibold text-foreground">
              编辑团队类型
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{team.name}</p>
          </div>
          <Button variant="ghost" size="icon" aria-label="关闭" onClick={onClose} disabled={saving} className="shrink-0">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-team-type">团队类型</Label>
            <Select
              id="edit-team-type"
              data-testid="edit-team-type"
              value={teamType}
              onChange={(e) => setTeamType(e.target.value as TeamType)}
              disabled={saving}
            >
              <option value="standard">Standard</option>
              <option value="enterprise">Enterprise</option>
            </Select>
          </div>

          {error && (
            <p role="alert" data-testid="err-edit-team" className="text-13 text-destructive">
              {error}
            </p>
          )}

          <div className="mt-1 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              取消
            </Button>
            <Button type="button" data-testid="save-team-type" onClick={() => void save()} disabled={saving}>
              {saving ? "保存中..." : "保存"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ManualCreditModal({
  team,
  onClose,
  onGranted,
}: {
  team: AdminTeam;
  onClose: () => void;
  onGranted: (newBalance: number) => void;
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setError("");
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      setError("请输入大于 0 的整数");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/teams/${team.id}/credit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount: n, note }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d.errors?.amount ?? d.error ?? "上分失败");
        return;
      }
      onGranted(Number(d.wallet.balance));
      onClose();
    } catch {
      setError("上分失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="credit-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
    >
      <div data-testid="manual-credit-modal" className="w-full max-w-md rounded-10 border border-border bg-popover p-4 shadow-lg">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="credit-title" className="text-lg font-semibold text-foreground">
              手动增加 Credit
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {team.name} · 当前余额 {team.creditBalance.toLocaleString()}
            </p>
          </div>
          <Button variant="ghost" size="icon" aria-label="关闭" onClick={onClose} disabled={saving} className="shrink-0">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="credit-amount">增加额度</Label>
            <Input
              id="credit-amount"
              data-testid="credit-amount"
              type="number"
              min={1}
              placeholder="例如 1000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={saving}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="credit-note">备注（可选）</Label>
            <Input
              id="credit-note"
              data-testid="credit-note"
              placeholder="上分原因"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={saving}
            />
          </div>

          {error && (
            <p role="alert" data-testid="err-credit" className="text-13 text-destructive">
              {error}
            </p>
          )}

          <div className="mt-1 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              取消
            </Button>
            <Button type="button" data-testid="save-credit" onClick={() => void submit()} disabled={saving}>
              {saving ? "提交中..." : "确认增加"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminTeamsPage() {
  const router = useRouter();
  const [authState, setAuthState] = useState<"checking" | "forbidden" | "ok">("checking");

  const [teams, setTeams] = useState<AdminTeam[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");

  const [editing, setEditing] = useState<AdminTeam | null>(null);
  const [granting, setGranting] = useState<AdminTeam | null>(null);

  const load = useCallback(
    async (p: number, q: string) => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({ page: String(p), pageSize: String(PAGE_SIZE) });
      if (q) params.set("q", q);
      try {
        const res = await fetch(`/api/admin/teams?${params.toString()}`);
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (res.status === 403) {
          setAuthState("forbidden");
          setLoading(false);
          return;
        }
        if (!res.ok) {
          setError("加载失败，请稍后重试");
          setLoading(false);
          return;
        }
        const data = (await res.json()) as { teams: AdminTeam[]; total: number };
        setAuthState("ok");
        setTeams(data.teams ?? []);
        setTotal(data.total ?? 0);
      } catch {
        setError("加载失败，请稍后重试");
      } finally {
        setLoading(false);
      }
    },
    [router],
  );

  useEffect(() => {
    void load(1, "");
  }, [load]);

  function applyFilters() {
    setPage(1);
    setAppliedQuery(query);
    void load(1, query);
  }

  function resetFilters() {
    setQuery("");
    setPage(1);
    setAppliedQuery("");
    void load(1, "");
  }

  function goPage(p: number) {
    setPage(p);
    void load(p, appliedQuery);
  }

  function onTeamTypeSaved(updated: AdminTeam) {
    setTeams((current) => current.map((t) => (t.id === updated.id ? updated : t)));
  }

  function onCreditGranted(teamId: number, newBalance: number) {
    setTeams((current) => current.map((t) => (t.id === teamId ? { ...t, creditBalance: newBalance } : t)));
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (authState === "forbidden") {
    return (
      <div className="mx-auto max-w-content px-9 pb-14 pt-7">
        <div
          data-testid="admin-forbidden"
          role="alert"
          className="rounded-12 border border-border bg-surface-1 p-8 text-center"
        >
          <h1 className="text-17 font-bold text-foreground">无权限访问</h1>
          <p className="mt-2 text-13 text-muted-foreground">该页面仅限系统管理员访问。</p>
          <Button className="mt-5" variant="secondary" size="sm" onClick={() => router.push("/home")}>
            返回首页
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-content px-9 pb-14 pt-7">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-26 font-bold tracking-tight text-foreground">团队管理</h1>
          <p className="mt-1 text-13 text-muted-foreground">查看团队基础信息，编辑团队类型，手动增加 Credit</p>
        </div>
      </div>

      {/* 筛选区 */}
      <div className="mt-5.5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-62 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-placeholder" />
          <Input
            data-testid="search"
            placeholder="按团队名称搜索…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            className="pl-9"
          />
        </div>
        <Button data-testid="search-btn" variant="secondary" onClick={applyFilters}>
          查询
        </Button>
        <Button data-testid="reset-btn" variant="ghost" onClick={resetFilters}>
          重置
        </Button>
      </div>

      {/* 全局错误 */}
      {error && (
        <p role="alert" data-testid="err" className="mt-4 text-13 text-destructive">
          {error}
        </p>
      )}

      {/* 内容：loading / empty / 表格 */}
      {loading ? (
        <TeamsSkeleton />
      ) : teams.length === 0 ? (
        <div
          data-testid="empty"
          className="mt-4 flex flex-col items-center justify-center rounded-12 border border-dashed border-border-strong px-6 py-14 text-center"
        >
          <p className="text-13 font-medium text-foreground">暂无团队数据</p>
          <p className="mt-1 text-13 text-muted-foreground">调整筛选条件后重试。</p>
        </div>
      ) : (
        <div data-testid="team-list" className="mt-4 overflow-hidden rounded-12 border border-border">
          {/* 表头 */}
          <div className="flex items-center gap-3 border-b border-border bg-surface-1 px-4.5 py-2.75 text-11 font-semibold text-muted-foreground">
            <div className="flex-[1.8]">团队</div>
            <div className="w-28">类型</div>
            <div className="hidden w-20 sm:block">成员数</div>
            <div className="hidden w-24 sm:block">Credit</div>
            <div className="w-28 text-right">操作</div>
          </div>
          {teams.map((t) => (
            <div
              key={t.id}
              data-testid={`team-${t.id}`}
              className="flex items-center gap-3 border-b border-muted px-4.5 py-3 transition-colors last:border-b-0 hover:bg-surface-1"
            >
              <div className="min-w-0 flex-[1.8]">
                <div className="truncate text-13 font-semibold text-foreground">{t.name}</div>
                <div className="truncate text-11 text-muted-foreground">团队 ID：{t.id}</div>
              </div>
              <div className="w-28">
                <Badge data-testid={`team-type-${t.id}`} variant={t.teamType === "enterprise" ? "default" : "muted"}>
                  {TEAM_TYPE_LABEL[t.teamType] ?? t.teamType}
                </Badge>
              </div>
              <div className="hidden w-20 text-13 text-foreground sm:block">{t.memberCount}</div>
              <div data-testid={`team-credit-${t.id}`} className="hidden w-24 text-13 text-foreground sm:block">
                {t.creditBalance.toLocaleString()}
              </div>
              <div className="flex w-28 items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`编辑 ${t.name} 类型`}
                  data-testid={`edit-team-${t.id}`}
                  className="h-7.5 w-7.5 text-placeholder hover:text-foreground"
                  onClick={() => setEditing(t)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`为 ${t.name} 增加 Credit`}
                  data-testid={`grant-credit-${t.id}`}
                  className="h-7.5 w-7.5 text-placeholder hover:text-foreground"
                  onClick={() => setGranting(t)}
                >
                  <Coins className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 分页 */}
      {!loading && teams.length > 0 && (
        <div className="mt-4 flex items-center justify-between">
          <span className="text-11 text-muted-foreground">
            第 {page} / {totalPages} 页 · 共 {total} 个团队
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              data-testid="prev-page"
              disabled={page <= 1}
              onClick={() => goPage(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
              上一页
            </Button>
            <Button
              variant="outline"
              size="sm"
              data-testid="next-page"
              disabled={page >= totalPages}
              onClick={() => goPage(page + 1)}
            >
              下一页
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {editing && <EditTeamTypeModal team={editing} onClose={() => setEditing(null)} onSaved={onTeamTypeSaved} />}
      {granting && (
        <ManualCreditModal
          team={granting}
          onClose={() => setGranting(null)}
          onGranted={(newBalance) => onCreditGranted(granting.id, newBalance)}
        />
      )}
    </div>
  );
}
