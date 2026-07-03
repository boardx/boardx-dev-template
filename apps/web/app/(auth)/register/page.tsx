"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthShell, AuthLabel, AuthDivider } from "@/components/auth/auth-shell";

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterInner />
    </Suspense>
  );
}

function RegisterInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillEmail = searchParams.get("email") ?? "";
  const roomInviteToken = searchParams.get("token") ?? "";
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: prefillEmail,
    password: "",
    agreeTerms: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [pendingProvider, setPendingProvider] = useState<string | null>(null);
  // uc-rr-008 E1：过期邀请注册仍成功，但要提示"邀请已过期"而不是静默跳过。
  const [expiredInviteRoom, setExpiredInviteRoom] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrors({});
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...form, roomInviteToken: roomInviteToken || undefined }),
    });
    setSubmitting(false);
    if (res.status === 201) {
      const data = await res.json().catch(() => ({}));
      if (data.roomInvite?.status === "expired") {
        // 邀请已过期：注册本身成功，但不自动入房——留在本页展示提示，不立刻跳走，
        // 确保被邀者能看到这条消息（而不是被 router.push 立刻带走）。
        setExpiredInviteRoom(data.roomInvite.roomName ?? "该房间");
        return;
      }
      router.push("/");
      router.refresh();
      return;
    }
    const data = await res.json().catch(() => ({}));
    setErrors(data.errors ?? { _: data.error ?? "注册失败" });
  }

  // 第三方注册/登录（uc-auth-003 stub）：POST /api/auth/social → 成功建立会话并回首页。
  async function social(provider: string) {
    setPendingProvider(provider);
    setErrors({});
    const res = await fetch("/api/auth/social", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider }),
    });
    if (res.ok) {
      router.push("/");
      router.refresh();
      return;
    }
    setPendingProvider(null);
    const data = await res.json().catch(() => ({}));
    setErrors({ _: data.error ?? "第三方登录失败" });
  }

  const err = (k: string) =>
    errors[k] ? (
      <p data-testid={`err-${k}`} className="mt-1.5 text-11 text-destructive">
        {errors[k]}
      </p>
    ) : null;

  if (expiredInviteRoom) {
    return (
      <AuthShell>
        <h2 className="text-22 font-bold tracking-tight">Account created</h2>
        <p data-testid="room-invite-expired" className="mt-3 text-13 text-muted-foreground">
          你的「{expiredInviteRoom}」房间邀请已过期，未自动加入该房间。如需加入，请让房间的
          owner/admin 重新邀请你。
        </p>
        <Button
          data-testid="continue-to-app"
          size="lg"
          className="mt-4 w-full"
          onClick={() => {
            router.push("/");
            router.refresh();
          }}
        >
          继续
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h2 className="text-22 font-bold tracking-tight">Create your account</h2>
      <p className="mt-1.5 text-13 text-muted-foreground">
        Start collaborating in minutes.
      </p>

      <form onSubmit={submit} className="mt-5.5 flex flex-col">
        <div className="flex gap-2.5">
          <div className="flex-1">
            <AuthLabel htmlFor="firstName">First name</AuthLabel>
            <Input
              id="firstName"
              data-testid="firstName"
              placeholder="Alex"
              className="mt-1.5"
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            />
            {err("firstName")}
          </div>
          <div className="flex-1">
            <AuthLabel htmlFor="lastName">Last name</AuthLabel>
            <Input
              id="lastName"
              data-testid="lastName"
              placeholder="Lee"
              className="mt-1.5"
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            />
            {err("lastName")}
          </div>
        </div>

        <div className="mt-3">
          <AuthLabel htmlFor="email">Email</AuthLabel>
        </div>
        <Input
          id="email"
          data-testid="email"
          type="email"
          placeholder="you@company.com"
          className="mt-1.5"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        {err("email")}

        <div className="mt-3">
          <AuthLabel htmlFor="password">Password</AuthLabel>
        </div>
        <Input
          id="password"
          data-testid="password"
          type="password"
          placeholder="At least 6 characters"
          className="mt-1.5"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        {err("password")}

        <label className="mt-3.5 flex items-start gap-2 text-11 leading-snug text-muted-foreground">
          <input type="checkbox" data-testid="agreeTerms"
            className="mt-px h-3.75 w-3.75 shrink-0 rounded accent-primary"
            checked={form.agreeTerms}
            onChange={(e) => setForm({ ...form, agreeTerms: e.target.checked })} />
          <span>
            I agree to the{" "}
            <span className="text-foreground underline">Terms</span> and{" "}
            <span className="text-foreground underline">Privacy Policy</span>.
          </span>
        </label>
        {err("agreeTerms")}

        {errors._ && (
          <p data-testid="err-form" className="mt-3 text-13 text-destructive">
            {errors._}
          </p>
        )}

        <Button
          data-testid="submit"
          type="submit"
          disabled={submitting}
          size="lg"
          className="mt-4 w-full"
        >
          {submitting ? "Creating…" : "Create account"}
        </Button>
      </form>

      <AuthDivider />

      <div className="flex gap-2.5">
        <Button
          data-testid="social-google"
          variant="outline"
          type="button"
          disabled={pendingProvider !== null}
          onClick={() => social("google")}
          className="flex-1 text-13 font-normal"
        >
          {pendingProvider === "google" ? "Connecting…" : "Google"}
        </Button>
        <Button
          data-testid="social-facebook"
          variant="outline"
          type="button"
          disabled={pendingProvider !== null}
          onClick={() => social("facebook")}
          className="flex-1 text-13 font-normal"
        >
          {pendingProvider === "facebook" ? "Connecting…" : "Facebook"}
        </Button>
      </div>

      <p className="mt-4.5 text-center text-13 text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-foreground transition-colors hover:text-muted-foreground">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
