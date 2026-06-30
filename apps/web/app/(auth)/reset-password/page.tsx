"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthShell, AuthLabel } from "@/components/auth/auth-shell";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordInner />
    </Suspense>
  );
}

function ResetPasswordInner() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (next.length < 6) return setError("新密码至少 6 位");
    if (next !== confirm) return setError("两次密码不一致");
    setSubmitting(true);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, next }),
    });
    setSubmitting(false);
    if (res.ok) {
      setDone(true);
      setTimeout(() => router.push("/login"), 300);
      return;
    }
    const data = await res.json().catch(() => ({}));
    setError(data.error ?? data.errors?.next ?? "重置失败");
  }

  return (
    <AuthShell>
      <h2 className="text-22 font-bold tracking-tight">Set a new password</h2>
      <p className="mt-1.5 text-13 text-muted-foreground">
        Choose a strong password you don&apos;t use elsewhere.
      </p>

      {done ? (
        <div
          data-testid="done"
          className="mt-4.5 flex items-start gap-3 rounded-xl border border-border p-4.5"
        >
          <div className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground">
            ✓
          </div>
          <div>
            <div className="text-13 font-semibold">Password updated</div>
            <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              Redirecting you to sign in…
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col">
          <div className="mt-5.5">
            <AuthLabel htmlFor="next">New password</AuthLabel>
          </div>
          <Input
            id="next"
            data-testid="next"
            type="password"
            placeholder="At least 6 characters"
            className="mt-1.5"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />

          <div className="mt-3">
            <AuthLabel htmlFor="confirm">Confirm password</AuthLabel>
          </div>
          <Input
            id="confirm"
            data-testid="confirm"
            type="password"
            placeholder="Re-enter password"
            className="mt-1.5"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />

          {error && (
            <p data-testid="err-form" className="mt-3 text-13 text-destructive">
              {error}
            </p>
          )}

          <Button
            data-testid="submit"
            type="submit"
            disabled={submitting}
            size="lg"
            className="mt-4 w-full"
          >
            {submitting ? "Updating…" : "Update password"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
