"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface TeamWithRole {
  id: number | string;
  name: string;
  role: string;
}

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

  // 邀请操作对象：当前团队，否则列表第一个团队
  const activeTeam =
    teams.find((t) => String(t.id) === current) ?? teams[0] ?? null;
  const canManage =
    activeTeam != null && (activeTeam.role === "owner" || activeTeam.role === "admin");

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
    </div>
  );
}
