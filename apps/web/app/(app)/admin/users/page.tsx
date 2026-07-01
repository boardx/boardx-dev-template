"use client";
// uc-admin-001 — 后台用户管理（F02）：列表/搜索/分页/增删改 + 手动上分。
// 复用 F01 的 requireSysAdmin() 门控（server component 侧走 gate 决定是否渲染本页），
// 数据走 /api/admin/users* 真实 DB（CAP-DATA），手动上分复用 p14 credit_transactions（personal scope）。
// 本页取代此前的 stub-gated 原型（自带 ADMIN_GATE_OPEN 环境变量网关 + 内存样例数据）。
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, ChevronLeft, ChevronRight, Pencil, Trash2, Coins, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

type PlatformRole = "user" | "sysadmin";

interface AdminUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  platformRole: PlatformRole;
  teamCount: number;
  creditBalance: number;
  createdAt: string;
}

const PAGE_SIZE = 10;

const ROLE_LABEL: Record<PlatformRole, string> = {
  user: "用户",
  sysadmin: "系统管理员",
};

function initials(first: string, last: string) {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || "?";
}

function fullName(u: Pick<AdminUser, "firstName" | "lastName">) {
  return `${u.firstName} ${u.lastName}`.trim();
}

function UsersSkeleton() {
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

function CreateUserForm({
  onCreated,
  onClose,
}: {
  onCreated: () => void;
  onClose: () => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [platformRole, setPlatformRole] = useState<PlatformRole>("user");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email, platformRole }),
      });
      if (res.status === 201) {
        onCreated();
        onClose();
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.errors?.email ?? d.errors?.firstName ?? d.errors?.lastName ?? d.error ?? "创建失败");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={create} className="mt-5 flex flex-col gap-3 rounded-12 border border-border bg-surface-1 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-first-name">名</Label>
          <Input id="new-first-name" data-testid="new-first-name" placeholder="名" value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={saving} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-last-name">姓</Label>
          <Input id="new-last-name" data-testid="new-last-name" placeholder="姓" value={lastName} onChange={(e) => setLastName(e.target.value)} disabled={saving} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new-email">邮箱</Label>
        <Input id="new-email" data-testid="new-email" type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={saving} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new-role">平台角色</Label>
        <Select id="new-role" data-testid="new-role" className="w-48" value={platformRole} onChange={(e) => setPlatformRole(e.target.value as PlatformRole)} disabled={saving}>
          <option value="user">用户</option>
          <option value="sysadmin">系统管理员</option>
        </Select>
      </div>
      {error && (
        <p role="alert" data-testid="err-create" className="text-13 text-destructive">
          {error}
        </p>
      )}
      <Button data-testid="create" type="submit" size="sm" className="self-start" disabled={saving}>
        {saving ? "创建中..." : "创建用户"}
      </Button>
    </form>
  );
}

function EditUserModal({
  user,
  isSelf,
  onClose,
  onSaved,
}: {
  user: AdminUser;
  isSelf: boolean;
  onClose: () => void;
  onSaved: (user: AdminUser) => void;
}) {
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [platformRole, setPlatformRole] = useState<PlatformRole>(user.platformRole);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ firstName, lastName, platformRole }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.errors?.firstName ?? d.errors?.lastName ?? d.errors?.platformRole ?? d.error ?? "保存失败");
        return;
      }
      onSaved({ ...user, firstName, lastName, platformRole });
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
      aria-labelledby="edit-user-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
    >
      <div data-testid="edit-user-modal" className="w-full max-w-md rounded-10 border border-border bg-popover p-4 shadow-lg">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="edit-user-title" className="text-lg font-semibold text-foreground">
              编辑用户
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
          </div>
          <Button variant="ghost" size="icon" aria-label="关闭" onClick={onClose} disabled={saving} className="shrink-0">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-first-name">名</Label>
              <Input id="edit-first-name" data-testid="edit-first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={saving} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-last-name">姓</Label>
              <Input id="edit-last-name" data-testid="edit-last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} disabled={saving} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-role">平台角色</Label>
            <Select
              id="edit-role"
              data-testid="edit-role"
              value={platformRole}
              onChange={(e) => setPlatformRole(e.target.value as PlatformRole)}
              disabled={saving || isSelf}
              title={isSelf ? "不能修改自己的平台角色" : undefined}
            >
              <option value="user">用户</option>
              <option value="sysadmin">系统管理员</option>
            </Select>
            {isSelf && (
              <p className="text-11 text-muted-foreground">不能修改自己的平台角色，避免误操作把自己降级。</p>
            )}
          </div>

          {error && (
            <p role="alert" data-testid="err-edit-user" className="text-13 text-destructive">
              {error}
            </p>
          )}

          <div className="mt-1 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              取消
            </Button>
            <Button type="button" data-testid="save-user" onClick={() => void save()} disabled={saving}>
              {saving ? "保存中..." : "保存"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DeleteUserModal({
  user,
  onClose,
  onDeleted,
}: {
  user: AdminUser;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function confirmDelete() {
    setError("");
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "删除失败");
        return;
      }
      onDeleted();
      onClose();
    } catch {
      setError("删除失败，请稍后重试");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-user-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
    >
      <div data-testid="delete-user-modal" className="w-full max-w-md rounded-10 border border-border bg-popover p-4 shadow-lg">
        <div className="mb-4">
          <h2 id="delete-user-title" className="text-lg font-semibold text-foreground">
            删除用户
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            确定要删除 <span className="font-semibold text-foreground">{fullName(user)}</span>（{user.email}
            ）吗？此操作不可撤销。
          </p>
        </div>

        {error && (
          <p role="alert" data-testid="err-delete-user" className="mb-3 text-13 text-destructive">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={deleting}>
            取消
          </Button>
          <Button
            type="button"
            variant="destructive"
            data-testid="confirm-delete-user"
            onClick={() => void confirmDelete()}
            disabled={deleting}
          >
            {deleting ? "删除中..." : "确认删除"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ManualCreditModal({
  user,
  onClose,
  onGranted,
}: {
  user: AdminUser;
  onClose: () => void;
  onGranted: (newBalance: number) => void;
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  // 幂等 key：每次打开弹窗生成一次（不是每次点击），双击/重试提交复用同一个 key，
  // 服务端据此去重，避免网络重试或手滑双击造成重复上分。
  const idempotencyKeyRef = useRef<string>(crypto.randomUUID());

  async function submit() {
    setError("");
    const n = Number(amount);
    // review 加固：非整数（如 1.9）此前客户端能提交，服务端悄悄 Math.trunc 成 1 却没有任何
    // 提示；改为客户端也用 Number.isInteger 校验，和服务端拒绝非整数保持一致。
    if (!Number.isInteger(n) || n <= 0) {
      setError("请输入大于 0 的整数");
      return;
    }
    if (saving) return; // 双重保险：客户端也拦一次并发提交（服务端幂等 key 才是真正的防线）
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/credit`, {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": idempotencyKeyRef.current },
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
              {fullName(user)} · 当前余额 {user.creditBalance.toLocaleString()}
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
            <Label htmlFor="credit-note">备注（可选，最多 200 字）</Label>
            <Input
              id="credit-note"
              data-testid="credit-note"
              placeholder="上分原因"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 200))}
              maxLength={200}
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

export default function AdminUsersPage() {
  const router = useRouter();
  const [authState, setAuthState] = useState<"checking" | "forbidden" | "ok">("checking");

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState<AdminUser | null>(null);
  const [granting, setGranting] = useState<AdminUser | null>(null);

  // 当前操作者自己的 user id（UI 侧防御性禁用"删除自己"/"把自己降级"；服务端才是真正门控，
  // 见 apps/web/app/api/admin/users/[id]/route.ts 的 DELETE/PATCH review 加固）。
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/session");
        if (!res.ok) return;
        const data = (await res.json()) as { user: { id: number } | null };
        if (data.user) setCurrentUserId(data.user.id);
      } catch {
        // 静默失败：拿不到自身 id 只影响 UI 层禁用提示，服务端校验依然生效。
      }
    })();
  }, []);

  const load = useCallback(
    async (p: number, q: string) => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({ page: String(p), pageSize: String(PAGE_SIZE) });
      if (q) params.set("q", q);
      try {
        const res = await fetch(`/api/admin/users?${params.toString()}`);
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
        const data = (await res.json()) as { users: AdminUser[]; total: number };
        setAuthState("ok");
        setUsers(data.users ?? []);
        setTotal(data.total ?? 0);
      } catch {
        setError("加载失败，请稍后重试");
      } finally {
        setLoading(false);
      }
    },
    [router],
  );

  // 只在挂载时拉一次首屏（不放 load 到依赖数组）：load 因闭包 router 而在 useCallback 里
  // 声明了 [router] 依赖，但 router 引用在某些内部重渲染（如弹窗打开/关闭触发的重渲染）中
  // 可能变化，若把 load 放进 deps 会导致该 effect 重跑，把用户已应用的搜索/分页悄悄重置回
  // 第 1 页、无筛选（曾观测到：删除确认后 list 又跳回未过滤状态）。首屏加载只需跑一次。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    void load(1, "");
  }, []);

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

  function onUserSaved(updated: AdminUser) {
    setUsers((current) => current.map((u) => (u.id === updated.id ? updated : u)));
  }

  function onUserDeleted(userId: number) {
    setUsers((current) => current.filter((u) => u.id !== userId));
    setTotal((t) => Math.max(0, t - 1));
  }

  function onCreditGranted(userId: number, newBalance: number) {
    setUsers((current) => current.map((u) => (u.id === userId ? { ...u, creditBalance: newBalance } : u)));
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
          <h1 className="text-26 font-bold tracking-tight text-foreground">用户管理</h1>
          <p className="mt-1 text-13 text-muted-foreground">查看、搜索、创建/编辑/删除用户，手动上分</p>
        </div>
        <Button data-testid="show-create" size="sm" onClick={() => setShowCreate((v) => !v)}>
          <Plus className="h-4 w-4" strokeWidth={2} />
          {showCreate ? "取消" : "添加用户"}
        </Button>
      </div>

      {/* 创建表单（折叠） */}
      {showCreate && (
        <CreateUserForm
          onCreated={() => {
            setPage(1);
            setAppliedQuery("");
            setQuery("");
            void load(1, "");
          }}
          onClose={() => setShowCreate(false)}
        />
      )}

      {/* 筛选区 */}
      <div className="mt-5.5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-62 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-placeholder" />
          <Input
            data-testid="search"
            placeholder="按邮箱或姓名搜索…"
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
        <UsersSkeleton />
      ) : users.length === 0 ? (
        <div
          data-testid="empty"
          className="mt-4 flex flex-col items-center justify-center rounded-12 border border-dashed border-border-strong px-6 py-14 text-center"
        >
          <p className="text-13 font-medium text-foreground">暂无用户数据</p>
          <p className="mt-1 text-13 text-muted-foreground">调整筛选条件，或添加第一个用户。</p>
        </div>
      ) : (
        <div data-testid="user-list" className="mt-4 overflow-hidden rounded-12 border border-border">
          {/* 表头 */}
          <div className="flex items-center gap-3 border-b border-border bg-surface-1 px-4.5 py-2.75 text-11 font-semibold text-muted-foreground">
            <div className="flex-[1.8]">用户</div>
            <div className="w-28">平台角色</div>
            <div className="hidden w-20 sm:block">团队数</div>
            <div className="hidden w-24 sm:block">Credit</div>
            <div className="w-28 text-right">操作</div>
          </div>
          {users.map((u) => (
            <div
              key={u.id}
              data-testid={`user-${u.id}`}
              className="flex items-center gap-3 border-b border-muted px-4.5 py-3 transition-colors last:border-b-0 hover:bg-surface-1"
            >
              <div className="flex flex-[1.8] items-center gap-2.5">
                <span className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-full bg-muted text-11 font-semibold text-muted-foreground">
                  {initials(u.firstName, u.lastName)}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-13 font-semibold text-foreground">{fullName(u)}</div>
                  <div className="truncate text-11 text-muted-foreground">{u.email}</div>
                </div>
              </div>
              <div className="w-28">
                <Badge data-testid={`user-role-${u.id}`} variant={u.platformRole === "sysadmin" ? "default" : "muted"}>
                  {ROLE_LABEL[u.platformRole] ?? u.platformRole}
                </Badge>
              </div>
              <div className="hidden w-20 text-13 text-foreground sm:block">{u.teamCount}</div>
              <div data-testid={`user-credit-${u.id}`} className="hidden w-24 text-13 text-foreground sm:block">
                {u.creditBalance.toLocaleString()}
              </div>
              <div className="flex w-28 items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`为 ${fullName(u)} 增加 Credit`}
                  data-testid={`grant-credit-${u.id}`}
                  className="h-7.5 w-7.5 text-placeholder hover:text-foreground"
                  onClick={() => setGranting(u)}
                >
                  <Coins className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`编辑 ${fullName(u)}`}
                  data-testid={`edit-${u.id}`}
                  className="h-7.5 w-7.5 text-placeholder hover:text-foreground"
                  onClick={() => setEditing(u)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`删除 ${fullName(u)}`}
                  data-testid={`delete-${u.id}`}
                  className="h-7.5 w-7.5 text-placeholder hover:text-destructive disabled:opacity-40"
                  onClick={() => setDeleting(u)}
                  disabled={u.id === currentUserId}
                  title={u.id === currentUserId ? "不能删除自己的账号" : undefined}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 分页 */}
      {!loading && users.length > 0 && (
        <div className="mt-4 flex items-center justify-between">
          <span className="text-11 text-muted-foreground">
            第 {page} / {totalPages} 页 · 共 {total} 个用户
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

      {editing && (
        <EditUserModal
          user={editing}
          isSelf={editing.id === currentUserId}
          onClose={() => setEditing(null)}
          onSaved={onUserSaved}
        />
      )}
      {deleting && (
        <DeleteUserModal user={deleting} onClose={() => setDeleting(null)} onDeleted={() => onUserDeleted(deleting.id)} />
      )}
      {granting && (
        <ManualCreditModal
          user={granting}
          onClose={() => setGranting(null)}
          onGranted={(newBalance) => onCreditGranted(granting.id, newBalance)}
        />
      )}
    </div>
  );
}
