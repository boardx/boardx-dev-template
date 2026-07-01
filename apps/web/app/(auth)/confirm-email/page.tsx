"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { AuthShell } from "@/components/auth/auth-shell";

export default function ConfirmEmailPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmEmailInner />
    </Suspense>
  );
}

type Status = "verifying" | "success" | "error";

function ConfirmEmailInner() {
  const token = useSearchParams().get("token") ?? "";
  const [status, setStatus] = useState<Status>("verifying");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/auth/confirm-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (cancelled) return;
      if (res.ok) {
        setStatus("success");
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "确认链接无效或已过期");
      setStatus("error");
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <AuthShell>
      <h2 className="text-22 font-bold tracking-tight">Confirm your email</h2>

      {status === "verifying" && (
        <div
          data-testid="loading"
          className="mt-4.5 flex items-start gap-3 rounded-xl border border-border p-4.5"
        >
          <div className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-full border-2 border-border border-t-primary motion-safe:animate-spin" />
          <div>
            <div className="text-13 font-semibold">Verifying…</div>
            <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              Hold on while we confirm your email address.
            </div>
          </div>
        </div>
      )}

      {status === "success" && (
        <>
          <div
            data-testid="success"
            className="mt-4.5 flex items-start gap-3 rounded-xl border border-border p-4.5"
          >
            <div className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground">
              ✓
            </div>
            <div>
              <div className="text-13 font-semibold">Email confirmed</div>
              <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                Your email address has been verified.
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2">
            <Link
              data-testid="to-workspace"
              href="/"
              className={buttonVariants({ size: "lg", className: "w-full" })}
            >
              Go to workspace
            </Link>
            <Link
              data-testid="to-login"
              href="/login"
              className={buttonVariants({
                variant: "ghost",
                size: "lg",
                className: "w-full",
              })}
            >
              Go to sign in
            </Link>
          </div>
        </>
      )}

      {status === "error" && (
        <>
          <div
            data-testid="error"
            className="mt-4.5 flex items-start gap-3 rounded-xl border border-destructive/40 p-4.5"
          >
            <div className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-full bg-destructive text-sm text-destructive-foreground">
              !
            </div>
            <div>
              <div className="text-13 font-semibold">Confirmation failed</div>
              <div
                data-testid="err-message"
                className="mt-0.5 text-xs leading-relaxed text-muted-foreground"
              >
                {error}
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2">
            <Link
              data-testid="resend"
              href="/forgot-password"
              className={buttonVariants({ size: "lg", className: "w-full" })}
            >
              Resend confirmation
            </Link>
            <Link
              data-testid="to-login"
              href="/login"
              className={buttonVariants({
                variant: "ghost",
                size: "lg",
                className: "w-full",
              })}
            >
              Back to sign in
            </Link>
          </div>
        </>
      )}
    </AuthShell>
  );
}
