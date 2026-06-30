"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Users, DoorOpen, MailQuestion } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { AuthShell } from "@/components/auth/auth-shell";
import { cn } from "@/lib/utils";

interface InviteInfo {
  token: string;
  kind: "team" | "room";
  targetName: string;
  inviterName: string;
}

interface SessionUser {
  displayName: string;
}

/** 居中的邀请卡片外壳，复用 auth 的两栏品牌外壳与视觉语言。 */
function InviteCard({ children }: { children: React.ReactNode }) {
  return (
    <AuthShell>
      <div className="rounded-12 border border-border bg-surface-1 p-6">{children}</div>
    </AuthShell>
  );
}

export default function InvitePage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const token = params?.token ?? "";

  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [error, setError] = useState("");
  const [reason, setReason] = useState<"unknown" | "expired" | "">("");
  const [user, setUser] = useState<SessionUser | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [inviteRes, sessionRes] = await Promise.all([
          fetch(`/api/invite/${encodeURIComponent(token)}`),
          fetch("/api/auth/session"),
        ]);
        if (cancelled) return;
        const sessionData = await sessionRes.json().catch(() => ({}));
        setUser(sessionData.user ?? null);
        if (inviteRes.ok) {
          setInvite((await inviteRes.json()).invite);
        } else {
          const d = await inviteRes.json().catch(() => ({}));
          setReason(d.reason === "expired" ? "expired" : "unknown");
          setError(d.error ?? "邀请不可用");
        }
      } catch {
        if (!cancelled) setError("无法加载邀请，请稍后再试");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function accept() {
    setAccepting(true);
    setAcceptError("");
    try {
      const res = await fetch(`/api/invite/${encodeURIComponent(token)}`, { method: "POST" });
      if (res.ok) {
        const d = await res.json();
        router.push(d.redirect ?? "/rooms");
        router.refresh();
        return;
      }
      const d = await res.json().catch(() => ({}));
      setAcceptError(d.error ?? "接受邀请失败");
    } catch {
      setAcceptError("接受邀请失败，请稍后再试");
    } finally {
      setAccepting(false);
    }
  }

  // ── 加载状态 ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <InviteCard>
        <div data-testid="loading" className="flex animate-pulse flex-col gap-3">
          <div className="h-11 w-11 rounded-full bg-muted" />
          <div className="h-5 w-3/4 rounded-7 bg-muted" />
          <div className="h-4 w-1/2 rounded-7 bg-muted" />
          <div className="mt-2 h-10 w-full rounded-lg bg-muted" />
        </div>
      </InviteCard>
    );
  }

  // ── 无效 / 过期 ────────────────────────────────────────────────────────────
  if (!invite) {
    return (
      <InviteCard>
        <div data-testid="invite-invalid" className="flex flex-col items-center text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <MailQuestion className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <h2 className="mt-4 text-22 font-bold tracking-tight text-foreground">
            {reason === "expired" ? "邀请已过期" : "邀请不可用"}
          </h2>
          <p role="alert" data-testid="err" className="mt-1.5 text-13 text-muted-foreground">
            {error}
          </p>
          <div className="mt-6 flex w-full flex-col gap-2.5">
            <Link href="/" data-testid="go-home" className={cn(buttonVariants({ size: "lg" }), "w-full")}>
              返回首页
            </Link>
            <Link
              href="/login"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full text-13 font-normal")}
            >
              登录其他账号
            </Link>
          </div>
        </div>
      </InviteCard>
    );
  }

  // ── 有效邀请 ───────────────────────────────────────────────────────────────
  const KindIcon = invite.kind === "room" ? DoorOpen : Users;
  const kindLabel = invite.kind === "room" ? "房间" : "团队";

  return (
    <InviteCard>
      <div data-testid="invite-detail" className="flex flex-col items-center text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-tag-blue text-foreground/70">
          <KindIcon className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <h2 className="mt-4 text-22 font-bold tracking-tight text-foreground">You're invited</h2>
        <p className="mt-1.5 text-13 leading-relaxed text-muted-foreground">
          <span data-testid="inviter" className="font-semibold text-foreground">
            {invite.inviterName}
          </span>{" "}
          邀请你加入{kindLabel}{" "}
          <span data-testid="target-name" className="font-semibold text-foreground">
            {invite.targetName}
          </span>
          。
        </p>
      </div>

      {user ? (
        <div className="mt-6 flex flex-col gap-2.5">
          {acceptError && (
            <p role="alert" data-testid="err-accept" className="text-13 text-destructive">
              {acceptError}
            </p>
          )}
          <Button
            data-testid="accept"
            size="lg"
            className="w-full"
            disabled={accepting}
            onClick={accept}
          >
            {accepting ? "处理中…" : "接受邀请"}
          </Button>
          <p className="text-center text-11 text-placeholder">
            以 {user.displayName} 的身份加入
          </p>
        </div>
      ) : (
        <div data-testid="signin-prompt" className="mt-6 flex flex-col gap-2.5">
          <p className="text-center text-13 text-muted-foreground">
            登录后即可接受此邀请。
          </p>
          <Link
            href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}
            data-testid="signin"
            className={cn(buttonVariants({ size: "lg" }), "w-full")}
          >
            登录后接受
          </Link>
          <Link
            href={`/register?next=${encodeURIComponent(`/invite/${token}`)}`}
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full text-13 font-normal")}
          >
            没有账号？注册
          </Link>
        </div>
      )}
    </InviteCard>
  );
}
