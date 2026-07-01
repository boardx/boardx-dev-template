"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Role = "owner" | "admin" | "member";

interface Member {
  user_id: number;
  email: string;
  role: string;
}

interface InviteResult {
  email: string;
  status: "added" | "invited" | "error";
  message: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TAG_FILLS = ["bg-tag-green", "bg-tag-blue", "bg-tag-purple", "bg-tag-pink", "bg-tag-yellow"];
function fillFor(id: string | number) {
  const s = String(id);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return TAG_FILLS[h % TAG_FILLS.length];
}

function MembersSkeleton() {
  return (
    <div data-testid="loading" className="flex animate-pulse flex-col gap-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-15 rounded-12 bg-muted" />
      ))}
    </div>
  );
}

export default function RoomMembersPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const roomId = params.id;

  const [members, setMembers] = useState<Member[]>([]);
  const [myRole, setMyRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");

  // 邀请（邮箱标签）
  const [emailDraft, setEmailDraft] = useState("");
  const [emailTags, setEmailTags] = useState<string[]>([]);
  const [inviteError, setInviteError] = useState("");
  const [inviteResults, setInviteResults] = useState<InviteResult[]>([]);
  const [inviting, setInviting] = useState(false);
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);

  const canManage = myRole === "owner" || myRole === "admin";

  async function load() {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/rooms/${roomId}/members`);
    if (res.status === 401) {
      setLoading(false);
      router.replace("/login");
      return;
    }
    if (res.status === 403) {
      setError("你不是该房间成员，无法查看成员");
      setLoading(false);
      return;
    }
    if (!res.ok) {
      setError("加载成员失败");
      setLoading(false);
      return;
    }
    const d = await res.json();
    setMembers(d.members ?? []);
    setMyRole((d.myRole as Role | null) ?? null);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

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
        const res = await fetch(`/api/rooms/${roomId}/members`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const da = await res.json().catch(() => ({}));
        if (res.ok && da.status === "added") {
          results.push({ email, status: "added", message: "已加入房间" });
        } else if (res.ok && da.status === "invited") {
          results.push({ email, status: "invited", message: "邀请已发送" });
        } else {
          results.push({ email, status: "error", message: da.error ?? "邀请失败" });
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
    setInviteError("");
    try {
      const link = `${window.location.origin}/rooms/${roomId}`;
      await navigator.clipboard.writeText(link);
      setCopied("ok");
    } catch {
      setCopied("fail");
      setInviteError("copyFailed");
    }
  }

  async function changeRole(userId: number, role: "admin" | "member") {
    const res = await fetch(`/api/rooms/${roomId}/members/${userId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "改角色失败");
      return;
    }
    await load();
  }

  async function remove(userId: number) {
    const res = await fetch(`/api/rooms/${roomId}/members/${userId}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "移除失败");
      return;
    }
    await load();
  }

  const shown = members.filter((m) => {
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    return m.email.toLowerCase().includes(q) || m.role.toLowerCase().includes(q);
  });

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-9 py-7">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-26 font-bold tracking-tight text-foreground">房间成员</h1>
        <p className="text-13 text-muted-foreground">查看成员、邀请新成员、管理角色与移除。</p>
      </div>

      {error && (
        <p role="alert" data-testid="err" className="text-13 text-destructive">
          {error}
        </p>
      )}

      {/* 邀请区（仅 owner/admin）*/}
      {!loading && canManage && (
        <section
          data-testid="invite-section"
          className="flex flex-col gap-3 rounded-12 border border-border bg-surface-1 p-4"
        >
          <div className="flex flex-col gap-0.5">
            <h2 className="text-15 font-semibold text-foreground">邀请成员</h2>
            <p className="text-11 text-muted-foreground">输入邮箱后按 Enter 或逗号，已注册用户将直接加入房间。</p>
          </div>

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
                  data-testid={`remove-tag-${email}`}
                  className="h-5 w-5 rounded-full p-0 text-13 leading-none text-muted-foreground transition-colors hover:bg-surface-dark-2/10"
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
            <Button type="button" data-testid="invite-submit" onClick={() => void sendInvites()} disabled={inviting}>
              {inviting ? "邀请中…" : "邀请"}
            </Button>
            <Button type="button" variant="outline" data-testid="copy-invite-link" onClick={() => void copyInviteLink()}>
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
                  className={cn("text-11", r.status === "error" ? "text-destructive" : "text-muted-foreground")}
                >
                  <span className="font-medium text-foreground">{r.email}</span> — {r.message}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {!loading && !canManage && (
        <p data-testid="readonly-notice" className="text-11 text-muted-foreground">
          你是房间成员，只能查看成员列表；仅 owner / admin 可邀请或管理成员。
        </p>
      )}

      {/* 搜索 */}
      {!loading && members.length > 0 && (
        <Input
          data-testid="search"
          placeholder="按邮箱或角色过滤成员…"
          aria-label="搜索成员"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      )}

      {/* 成员列表 */}
      {loading ? (
        <MembersSkeleton />
      ) : members.length === 0 ? (
        <div
          data-testid="empty"
          className="flex flex-col items-center gap-4 rounded-12 border border-dashed border-border-strong py-12 text-center"
        >
          <p className="text-13 text-muted-foreground">这个房间还没有成员。</p>
        </div>
      ) : shown.length === 0 ? (
        <p data-testid="no-match" className="py-12 text-center text-13 text-muted-foreground">
          没有匹配「{filter}」的成员
        </p>
      ) : (
        <ul data-testid="member-list" className="overflow-hidden rounded-12 border border-border">
          {shown.map((m, i) => {
            const isOwner = m.role === "owner";
            return (
              <li
                key={m.user_id}
                data-testid={`member-${m.user_id}`}
                className={cn(
                  "flex items-center gap-3 px-4 py-3.25 transition-colors hover:bg-surface-1",
                  i > 0 && "border-t border-muted",
                )}
              >
                <div
                  className={cn(
                    "flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-full text-13 font-semibold text-foreground/70",
                    fillFor(m.user_id),
                  )}
                  aria-hidden="true"
                >
                  {m.email.charAt(0).toUpperCase()}
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-13 font-semibold text-foreground">{m.email}</span>
                  <span data-testid={`role-${m.user_id}`} className="text-11 capitalize text-placeholder">
                    {m.role}
                  </span>
                </div>

                {isOwner ? (
                  <Badge variant="secondary">owner</Badge>
                ) : canManage ? (
                  <div className="flex items-center gap-2">
                    <Select
                      data-testid={`role-select-${m.user_id}`}
                      aria-label={`修改 ${m.email} 的角色`}
                      value={m.role === "admin" ? "admin" : "member"}
                      onChange={(e) => void changeRole(m.user_id, e.target.value === "admin" ? "admin" : "member")}
                      className="h-8 w-28"
                    >
                      <option value="member">member</option>
                      <option value="admin">admin</option>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      data-testid={`remove-${m.user_id}`}
                      onClick={() => void remove(m.user_id)}
                    >
                      移除
                    </Button>
                  </div>
                ) : (
                  <Badge variant="muted">{m.role}</Badge>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
