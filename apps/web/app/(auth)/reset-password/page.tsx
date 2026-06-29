"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">设置新密码</CardTitle>
        </CardHeader>
        <CardContent>
          {done ? (
            <p data-testid="done" className="text-sm text-success">密码已重置，请用新密码登录。</p>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-3">
              <Input data-testid="next" type="password" placeholder="新密码（≥6）"
                value={next} onChange={(e) => setNext(e.target.value)} />
              <Input data-testid="confirm" type="password" placeholder="确认新密码"
                value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              {error && <p data-testid="err-form" className="text-sm text-destructive">{error}</p>}
              <Button data-testid="submit" type="submit" disabled={submitting} className="w-full">
                {submitting ? "提交中…" : "设置密码"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
