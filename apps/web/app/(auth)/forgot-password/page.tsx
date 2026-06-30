"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthShell, AuthLabel } from "@/components/auth/auth-shell";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setSubmitting(false);
    if (res.ok) {
      setSent(true);
      return;
    }
    const data = await res.json().catch(() => ({}));
    setError(data.errors?.email ?? data.error ?? "发送失败");
  }

  return (
    <AuthShell>
      <Link
        href="/login"
        className="mb-4.5 inline-block text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        ‹ Back to sign in
      </Link>
      <h2 className="text-22 font-bold tracking-tight">Reset your password</h2>

      {sent ? (
        <div
          data-testid="sent"
          className="mt-4.5 flex items-start gap-3 rounded-xl border border-border p-4.5"
        >
          <div className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground">
            ✓
          </div>
          <div>
            <div className="text-13 font-semibold">Check your email</div>
            <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              If that email is registered, a reset link has been sent. It expires
              in 30 minutes.
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col">
          <p className="mt-1.5 text-13 text-muted-foreground">
            Enter your email and we&apos;ll send a reset link.
          </p>
          <div className="mt-5.5">
            <AuthLabel htmlFor="email">Email</AuthLabel>
          </div>
          <Input
            id="email"
            data-testid="email"
            type="email"
            placeholder="you@company.com"
            className="mt-1.5"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
            {submitting ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
