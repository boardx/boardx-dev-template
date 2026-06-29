"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function Field({
  id, label, error, ...inputProps
}: { id: string; label: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} aria-describedby={error ? `${id}-err` : undefined} {...inputProps} />
      {error && (
        <p id={`${id}-err`} role="alert" className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}

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
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold tracking-tight">登录 BoardX</CardTitle>
          <p className="text-sm text-muted-foreground">欢迎回来，请输入你的账号信息。</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <Field
              id="email"
              label="邮箱"
              data-testid="email"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <Field
              id="password"
              label="密码"
              data-testid="password"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />

            {error && (
              <p role="alert" data-testid="err-form" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <Button
              data-testid="submit"
              type="submit"
              disabled={submitting}
              className="w-full transition-all duration-200 active:scale-[0.98]"
            >
              {submitting ? "提交中…" : "登录"}
            </Button>
          </form>

          <div className="mt-4 flex justify-between text-sm">
            <a
              href="/forgot-password"
              className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              忘记密码？
            </a>
            <a
              href="/register"
              className="text-foreground underline-offset-4 transition-colors hover:underline"
            >
              创建账号
            </a>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
