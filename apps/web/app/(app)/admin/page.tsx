"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

type Role = "admin" | "user";
type RoleFilter = "all" | Role;

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  credits: number;
  joined: string;
  disabled: boolean;
}

const PAGE_SIZE = 10;

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
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

export default function AdminUsersPage() {
  const router = useRouter();
  const [authState, setAuthState] = useState<"checking" | "forbidden" | "ok">("checking");

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 筛选（输入态）+ 已应用态
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [appliedRole, setAppliedRole] = useState<RoleFilter>("all");

  // 创建表单
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<Role>("user");
  const [createError, setCreateError] = useState("");

  const load = useCallback(
    async (p: number, q: string, role: RoleFilter) => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({ page: String(p), pageSize: String(PAGE_SIZE) });
      if (q) params.set("q", q);
      if (role !== "all") params.set("role", role);
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

  useEffect(() => {
    void load(1, "", "all");
  }, [load]);

  function applyFilters() {
    setPage(1);
    setAppliedQuery(query);
    setAppliedRole(roleFilter);
    void load(1, query, roleFilter);
  }

  function resetFilters() {
    setQuery("");
    setRoleFilter("all");
    setPage(1);
    setAppliedQuery("");
    setAppliedRole("all");
    void load(1, "", "all");
  }

  function goPage(p: number) {
    setPage(p);
    void load(p, appliedQuery, appliedRole);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: newName, email: newEmail, role: newRole }),
    });
    if (res.status === 201) {
      setNewName("");
      setNewEmail("");
      setNewRole("user");
      setShowForm(false);
      setPage(1);
      setAppliedQuery("");
      setAppliedRole("all");
      setQuery("");
      setRoleFilter("all");
      void load(1, "", "all");
    } else {
      const d = await res.json().catch(() => ({}));
      setCreateError(d.errors?.email ?? d.errors?.name ?? d.error ?? "创建失败");
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (authState === "forbidden") {
    return (
      <div className="mx-auto max-w-content px-9 pb-14 pt-7">
        <div
          data-testid="forbidden"
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
          <p className="mt-1 text-13 text-muted-foreground">管理系统用户和权限设置</p>
        </div>
        <Button data-testid="show-create" size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4" strokeWidth={2} />
          {showForm ? "取消" : "添加用户"}
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="mt-5.5 grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        {[
          { label: "总用户数", value: total },
          { label: "普通用户", value: users.filter((u) => u.role === "user").length },
          { label: "管理员", value: users.filter((u) => u.role === "admin").length },
          { label: "已禁用", value: 0 },
        ].map((c) => (
          <div key={c.label} className="rounded-12 border border-border p-4">
            <div className="text-22 font-bold text-foreground">{c.value}</div>
            <div className="mt-0.5 text-11 text-muted-foreground">{c.label}</div>
          </div>
        ))}
      </div>

      {/* 创建表单（折叠） */}
      {showForm && (
        <form
          onSubmit={create}
          className="mt-5 flex flex-col gap-3 rounded-12 border border-border bg-surface-1 p-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-name">姓名</Label>
            <Input id="new-name" data-testid="new-name" placeholder="用户姓名" value={newName} onChange={(e) => setNewName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-email">邮箱</Label>
            <Input id="new-email" data-testid="new-email" type="email" placeholder="name@example.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-role">角色</Label>
            <Select id="new-role" data-testid="new-role" className="w-40" value={newRole} onChange={(e) => setNewRole(e.target.value as Role)}>
              <option value="user">用户</option>
              <option value="admin">管理员</option>
            </Select>
          </div>
          {createError && (
            <p role="alert" data-testid="err-create" className="text-13 text-destructive">
              {createError}
            </p>
          )}
          <Button data-testid="create" type="submit" size="sm" className="self-start">
            创建用户
          </Button>
        </form>
      )}

      {/* 筛选区 */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-62 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-placeholder" />
          <Input
            data-testid="search"
            placeholder="按邮箱搜索…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            className="pl-9"
          />
        </div>
        <Select
          data-testid="role-filter"
          className="w-32"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
        >
          <option value="all">全部角色</option>
          <option value="admin">管理员</option>
          <option value="user">用户</option>
        </Select>
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
          <Button className="mt-4" size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" strokeWidth={2} />
            添加用户
          </Button>
        </div>
      ) : (
        <div data-testid="user-list" className="mt-4 overflow-hidden rounded-12 border border-border">
          {/* 表头 */}
          <div className="flex items-center gap-3 border-b border-border bg-surface-1 px-4.5 py-2.75 text-11 font-semibold text-muted-foreground">
            <div className="flex-[1.8]">用户</div>
            <div className="hidden w-40 sm:block">用户 ID</div>
            <div className="w-24">角色</div>
            <div className="hidden w-24 sm:block">积分</div>
            <div className="hidden w-28 md:block">加入时间</div>
            <div className="w-16 text-right">操作</div>
          </div>
          {users.map((u) => (
            <div
              key={u.id}
              data-testid={`user-${u.id}`}
              className="flex items-center gap-3 border-b border-muted px-4.5 py-3 transition-colors last:border-b-0 hover:bg-surface-1"
            >
              <div className="flex flex-[1.8] items-center gap-2.5">
                <span className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-full bg-muted text-11 font-semibold text-muted-foreground">
                  {initials(u.name)}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-13 font-semibold text-foreground">{u.name}</div>
                  <div className="truncate text-11 text-muted-foreground">{u.email}</div>
                </div>
              </div>
              <div className="hidden w-40 truncate text-11 text-muted-foreground sm:block">{u.id}</div>
              <div className="w-24">
                <Badge variant={u.role === "admin" ? "default" : "muted"}>
                  {u.role === "admin" ? "管理员" : "用户"}
                </Badge>
              </div>
              <div className="hidden w-24 text-13 text-foreground sm:block">{u.credits.toLocaleString()}</div>
              <div className="hidden w-28 text-11 text-muted-foreground md:block">{u.joined}</div>
              <div className="flex w-16 items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`编辑 ${u.name}`}
                  data-testid={`edit-${u.id}`}
                  className="h-7.5 w-7.5 text-placeholder hover:text-foreground"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`删除 ${u.name}`}
                  data-testid={`delete-${u.id}`}
                  className="h-7.5 w-7.5 text-placeholder hover:text-destructive"
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
    </div>
  );
}
