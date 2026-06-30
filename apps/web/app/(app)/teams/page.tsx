"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface TeamWithRole {
  id: number | string;
  name: string;
  role: string;
  description?: string;
  team_type?: string;
}

const TEAM_TYPE_LABEL: Record<string, string> = {
  standard: "Standard",
  enterprise: "Enterprise",
};

const TAG_FILLS = ["bg-tag-green", "bg-tag-blue", "bg-tag-purple", "bg-tag-pink", "bg-tag-yellow"];
function fillFor(id: string | number) {
  const s = String(id);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return TAG_FILLS[h % TAG_FILLS.length];
}

function TeamSkeleton() {
  return (
    <div data-testid="loading" className="flex flex-col gap-2 animate-pulse">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-15 rounded-12 bg-muted" />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div
      data-testid="empty"
      className="flex flex-col items-center gap-4 rounded-12 border border-dashed border-border-strong py-12 text-center"
    >
      <p className="text-13 text-muted-foreground">No teams yet — create your first one above.</p>
    </div>
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface InviteResult {
  email: string;
  status: "added" | "invited" | "error";
  message: string;
}

export default function TeamsPage() {
  const router = useRouter();
  const [teams, setTeams] = useState<TeamWithRole[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  // 邀请成员（uc-team-003）
  const [emailDraft, setEmailDraft] = useState("");
  const [emailTags, setEmailTags] = useState<string[]>([]);
  const [inviteError, setInviteError] = useState("");
  const [inviteResults, setInviteResults] = useState<InviteResult[]>([]);
  const [inviting, setInviting] = useState(false);
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);

  // uc-team-007 团队通用设置
  const [genName, setGenName] = useState("");
  const [genDesc, setGenDesc] = useState("");
  const [genError, setGenError] = useState("");
  const [genSaved, setGenSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // 操作对象：当前团队，否则列表第一个团队
  const activeTeam =
    teams.find((t) => String(t.id) === current) ?? teams[0] ?? null;
  const canManage =
    activeTeam != null && (activeTeam.role === "owner" || activeTeam.role === "admin");
  const isOwner = activeTeam != null && activeTeam.role === "owner";

  // 切换激活团队时，回填通用设置表单
  useEffect(() => {
    if (activeTeam) {
      setGenName(activeTeam.name);
      setGenDesc(activeTeam.description ?? "");
      setGenError("");
      setGenSaved(false);
      setConfirmDelete(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTeam?.id]);

  async function load() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/teams");
    if (res.status === 401) {
      setError("请先登录");
      setLoading(false);
      router.replace("/login");
      return;
    }
    const data = await res.json();
    setTeams(data.teams ?? []);
    const cur = await (await fetch("/api/teams/current")).json();
    setCurrent(cur.teamId != null ? String(cur.teamId) : null);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  function commitDraft(): boolean {
    const raw = emailDraft.trim().replace(/,$/, "").trim();
    if (!raw) return true;
    if (!EMAIL_RE.test(raw)) {
      setInviteError("invalidEmail");
      return false;
    }
    setInviteError("");
    setEmailTags((prev) => (prev.includes(raw) ? prev : [...prev, raw]));
    setEmailDraft("");
    return true;
  }

  function onEmailKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commitDraft();
    }
  }

  function removeTag(email: string) {
    setEmailTags((prev) => prev.filter((t) => t !== email));
  }

  async function sendInvites() {
    if (!activeTeam) return;
    // 把还在输入框里的邮箱也并入待发送列表
    const pending = [...emailTags];
    const draft = emailDraft.trim().replace(/,$/, "").trim();
    if (draft) {
      if (!EMAIL_RE.test(draft)) {
        setInviteError("invalidEmail");
        return;
      }
      if (!pending.includes(draft)) pending.push(draft);
    }
    if (pending.length === 0) {
      setInviteError("请输入邮箱地址");
      return;
    }
    setInviteError("");
    setInviting(true);
    const results: InviteResult[] = [];
    for (const email of pending) {
      try {
        const res = await fetch("/api/teams/invite", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ teamId: activeTeam.id, email }),
        });
        const d = await res.json().catch(() => ({}));
        if (res.ok && d.status === "added") {
          results.push({ email, status: "added", message: "已加入团队" });
        } else if (res.ok && d.status === "invited") {
          results.push({ email, status: "invited", message: "邀请已发送" });
        } else {
          results.push({ email, status: "error", message: d.error ?? "邀请失败" });
        }
      } catch {
        results.push({ email, status: "error", message: "邀请失败" });
      }
    }
    setInviteResults(results);
    setEmailTags([]);
    setEmailDraft("");
    setInviting(false);
    await load();
  }

  async function copyInviteLink() {
    if (!activeTeam) return;
    setInviteError("");
    try {
      const res = await fetch(`/api/teams/${activeTeam.id}/invites`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.token) {
        setCopied("fail");
        setInviteError("copyFailed");
        return;
      }
      const link = `${window.location.origin}/teams/join?token=${d.token}`;
      await navigator.clipboard.writeText(link);
      setCopied("ok");
    } catch {
      setCopied("fail");
      setInviteError("copyFailed");
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/teams", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.status === 201) {
      setName("");
      await load();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.errors?.name ?? d.error ?? "创建失败");
    }
  }

  async function switchTeam(id: number | string) {
    await fetch("/api/teams/current", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ teamId: id }),
    });
    await load();
  }

  async function saveGeneral(e: React.FormEvent) {
    e.preventDefault();
    if (!activeTeam) return;
    setGenError("");
    setGenSaved(false);
    const trimmed = genName.trim();
    if (!trimmed) {
      setGenError("团队名不能为空");
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/teams/${activeTeam.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: trimmed, description: genDesc.trim() }),
    });
    setSaving(false);
    if (res.ok) {
      setGenSaved(true);
      await load();
    } else {
      const d = await res.json().catch(() => ({}));
      setGenError(d.errors?.name ?? d.error ?? "保存失败");
    }
  }

  async function deleteTeam() {
    if (!activeTeam) return;
    setGenError("");
    setDeleting(true);
    const res = await fetch(`/api/teams/${activeTeam.id}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) {
      setConfirmDelete(false);
      await load();
    } else {
      const d = await res.json().catch(() => ({}));
      setGenError(d.error ?? "删除失败");
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-9 py-7">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-26 font-bold tracking-tight text-foreground">Teams</h1>
        <p className="text-13 text-muted-foreground">Create teams, switch context, and manage members.</p>
      </div>

      {error && (
        <p role="alert" data-testid="err" className="text-13 text-destructive">
          {error}
        </p>
      )}

      {/* Create form */}
      <form onSubmit={create} className="flex gap-2 rounded-12 border border-border bg-surface-1 p-4">
        <Input
          data-testid="team-name"
          placeholder="Team name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1"
        />
        <Button data-testid="create" type="submit">
          Create team
        </Button>
      </form>

      {/* Content */}
      {loading ? (
        <TeamSkeleton />
      ) : teams.length === 0 ? (
        <EmptyState />
      ) : (
        <ul data-testid="team-list" className="overflow-hidden rounded-12 border border-border">
          {teams.map((t, i) => (
            <li
              key={t.id}
              data-testid={`team-${t.id}`}
              className={cn(
                "flex items-center gap-3 px-4 py-3.25 transition-colors hover:bg-surface-1",
                i > 0 && "border-t border-muted",
              )}
            >
              <div className={cn("flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-full text-13 font-semibold text-foreground/70", fillFor(t.id))}>
                {t.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-center gap-2">
                  <span className="truncate text-13 font-semibold text-foreground">{t.name}</span>
                  {current === String(t.id) && (
                    <Badge data-testid="current-mark" variant="secondary">
                      当前
                    </Badge>
                  )}
                </div>
                <span className="text-11 capitalize text-placeholder">{t.role}</span>
              </div>
              <Button
                data-testid={`switch-${t.id}`}
                variant="outline"
                size="sm"
                onClick={() => switchTeam(t.id)}
              >
                Switch
              </Button>
            </li>
          ))}
        </ul>
      )}

      {/* Members — 邀请成员（uc-team-003）*/}
      {!loading && activeTeam && canManage && (
        <section
          data-testid="invite-section"
          className="flex flex-col gap-3 rounded-12 border border-border bg-surface-1 p-4"
        >
          <div className="flex flex-col gap-0.5">
            <h2 className="text-15 font-semibold text-foreground">Invite members</h2>
            <p className="text-11 text-muted-foreground">
              邀请成员加入 <span className="font-medium text-foreground">{activeTeam.name}</span>。
            </p>
          </div>

          {/* 邮箱标签输入区 */}
          <div className="flex flex-wrap items-center gap-2 rounded-12 border border-border bg-background p-2">
            {emailTags.map((email) => (
              <span
                key={email}
                data-testid={`email-tag-${email}`}
                className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-11 font-medium text-muted-foreground"
              >
                {email}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`移除 ${email}`}
                  data-testid={`remove-${email}`}
                  className="h-5 w-5 rounded-full p-0 text-13 leading-none text-muted-foreground hover:bg-surface-dark-2/10"
                  onClick={() => removeTag(email)}
                >
                  ×
                </Button>
              </span>
            ))}
            <Input
              data-testid="invite-email"
              type="email"
              placeholder="输入邮箱后按 Enter 或逗号"
              aria-label="邀请邮箱"
              value={emailDraft}
              onChange={(e) => setEmailDraft(e.target.value)}
              onKeyDown={onEmailKeyDown}
              onBlur={() => commitDraft()}
              className="h-8 min-w-[12.5rem] flex-1 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              data-testid="invite-submit"
              onClick={() => void sendInvites()}
              disabled={inviting}
            >
              {inviting ? "邀请中…" : "邀请"}
            </Button>
            <Button
              type="button"
              variant="outline"
              data-testid="copy-invite-link"
              onClick={() => void copyInviteLink()}
            >
              复制邀请链接
            </Button>
            {copied === "ok" && (
              <span data-testid="copy-ok" className="self-center text-11 text-success">
                已复制邀请链接
              </span>
            )}
          </div>

          {inviteError && (
            <p role="alert" data-testid="invite-err" className="text-11 text-destructive">
              {inviteError}
            </p>
          )}

          {inviteResults.length > 0 && (
            <ul data-testid="invite-results" className="flex flex-col gap-1">
              {inviteResults.map((r) => (
                <li
                  key={r.email}
                  data-testid={`invite-result-${r.email}`}
                  className={cn(
                    "text-11",
                    r.status === "error" ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  <span className="font-medium text-foreground">{r.email}</span> — {r.message}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* General settings — uc-team-007 */}
      {!loading && activeTeam && canManage && (
        <section
          data-testid="team-general"
          className="flex flex-col gap-4 rounded-12 border border-border bg-surface-1 p-5"
        >
          <div className="flex flex-col gap-0.5">
            <h2 className="text-15 font-semibold text-foreground">General</h2>
            <p className="text-11 text-muted-foreground">
              管理 <span className="font-medium text-foreground">{activeTeam.name}</span> 的常规设置。
            </p>
          </div>

          <form onSubmit={saveGeneral} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="team-general-name" className="text-11 font-medium text-foreground">
                Team name
              </label>
              <Input
                id="team-general-name"
                data-testid="general-name"
                value={genName}
                onChange={(e) => {
                  setGenName(e.target.value);
                  setGenSaved(false);
                }}
                placeholder="Team name"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="team-general-desc" className="text-11 font-medium text-foreground">
                Description
              </label>
              <Textarea
                id="team-general-desc"
                data-testid="general-description"
                value={genDesc}
                onChange={(e) => {
                  setGenDesc(e.target.value);
                  setGenSaved(false);
                }}
                placeholder="What is this team about?"
                className="resize-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-11 font-medium text-foreground">Team type</span>
              <div className="flex items-center gap-2">
                <Badge data-testid="general-team-type" variant="default">
                  {TEAM_TYPE_LABEL[activeTeam.team_type ?? "standard"] ?? "Standard"}
                </Badge>
                <span className="text-11 text-placeholder">Managed by BoardX admin</span>
              </div>
            </div>

            {genError && (
              <p role="alert" data-testid="general-err" className="text-11 text-destructive">
                {genError}
              </p>
            )}

            <div className="flex items-center justify-end gap-2">
              {genSaved && (
                <span data-testid="general-saved" className="text-11 text-success">
                  已保存
                </span>
              )}
              <Button type="submit" data-testid="general-save" disabled={saving}>
                {saving ? "保存中…" : "Save changes"}
              </Button>
            </div>
          </form>

          {/* DANGER ZONE — 仅 owner 可删除团队 */}
          {isOwner && (
            <div
              data-testid="danger-zone"
              className="mt-2 flex flex-col gap-3 rounded-12 border border-destructive/40 p-4"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-11 font-semibold uppercase tracking-wide text-muted-foreground">
                  Danger zone
                </span>
                <p className="text-11 text-placeholder">
                  Permanently remove this team and its data. 此操作不可撤销。
                </p>
              </div>

              {!confirmDelete ? (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  data-testid="delete-team"
                  className="self-start"
                  onClick={() => setConfirmDelete(true)}
                >
                  Delete team
                </Button>
              ) : (
                <div className="flex flex-col gap-2">
                  <p data-testid="delete-confirm" className="text-11 text-foreground">
                    确认删除 <span className="font-semibold">{activeTeam.name}</span>？
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      data-testid="delete-team-confirm"
                      disabled={deleting}
                      onClick={() => void deleteTeam()}
                    >
                      {deleting ? "删除中…" : "确认删除"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      data-testid="delete-team-cancel"
                      onClick={() => setConfirmDelete(false)}
                    >
                      取消
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
