"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">登录 BoardX</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="flex flex-col gap-3">
            <Input data-testid="email" type="email" placeholder="邮箱 Email"
              value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input data-testid="password" type="password" placeholder="密码 Password"
              value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            {error && <p data-testid="err-form" className="text-sm text-destructive">{error}</p>}
            <Button data-testid="submit" type="submit" disabled={submitting} className="w-full">
              {submitting ? "提交中…" : "登录"}
            </Button>
          </form>
          <div className="mt-4 flex justify-between text-sm">
            <a href="/forgot-password" className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">忘记密码？</a>
            <a href="/register" className="text-foreground underline-offset-4 hover:underline">创建账号</a>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
