"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">找回密码</CardTitle>
        </CardHeader>
        <CardContent>
          {sent ? (
            <p data-testid="sent" className="text-sm text-success">若该邮箱已注册，重置链接已发送，请前往邮箱查看。</p>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-3">
              <Input data-testid="email" type="email" placeholder="邮箱 Email"
                value={email} onChange={(e) => setEmail(e.target.value)} />
              {error && <p data-testid="err-form" className="text-sm text-destructive">{error}</p>}
              <Button data-testid="submit" type="submit" disabled={submitting} className="w-full">
                {submitting ? "发送中…" : "发送重置链接"}
              </Button>
            </form>
          )}
          <a href="/login" className="mt-4 block text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">返回登录</a>
        </CardContent>
      </Card>
    </main>
  );
}
