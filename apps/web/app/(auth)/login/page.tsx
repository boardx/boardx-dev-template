"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthShell, AuthLabel, AuthDivider } from "@/components/auth/auth-shell";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    setSubmitting(false);
    if (res.ok) {
      router.push("/");
      router.refresh();
      return;
    }
    const data = await res.json().catch(() => ({}));
    setError(data.error ?? "登录失败");
  }

  return (
    <AuthShell>
      <h2 className="text-22 font-bold tracking-tight">Sign in</h2>
      <p className="mt-1.5 text-13 text-muted-foreground">
        Welcome back. Enter your details.
      </p>

      <form onSubmit={submit} className="mt-6 flex flex-col">
        <AuthLabel htmlFor="email">Email</AuthLabel>
        <Input
          id="email"
          data-testid="email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          className="mt-1.5"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />

        <div className="mt-3.5">
          <AuthLabel htmlFor="password">Password</AuthLabel>
        </div>
        <Input
          id="password"
          data-testid="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          className="mt-1.5"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />

        <div className="mt-2 text-right">
          <Link
            href="/forgot-password"
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Forgot password?
          </Link>
        </div>

        {error && (
          <p
            role="alert"
            data-testid="err-form"
            className="mt-3 text-13 text-destructive"
          >
            {error}
          </p>
        )}

        <Button
          data-testid="submit"
          type="submit"
          disabled={submitting}
          size="lg"
          className="mt-3.5 w-full"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <AuthDivider />

      <div className="flex gap-2.5">
        <Button variant="outline" type="button" className="flex-1 text-13 font-normal">
          Google
        </Button>
        <Button variant="outline" type="button" className="flex-1 text-13 font-normal">
          WeChat
        </Button>
      </div>

      <p className="mt-5 text-center text-13 text-muted-foreground">
        No account?{" "}
        <Link href="/register" className="font-semibold text-foreground transition-colors hover:text-muted-foreground">
          Sign up
        </Link>
      </p>
    </AuthShell>
  );
}
