"use client";
import { useState } from "react";

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
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-8">
      <h1 className="text-2xl font-bold">找回密码</h1>
      {sent ? (
        <p data-testid="sent" className="text-green-700">若该邮箱已注册，重置链接已发送，请前往邮箱查看。</p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <input data-testid="email" type="email" placeholder="邮箱 Email" className="rounded border px-3 py-2"
            value={email} onChange={(e) => setEmail(e.target.value)} />
          {error && <p data-testid="err-form" className="text-sm text-red-600">{error}</p>}
          <button data-testid="submit" disabled={submitting}
            className="rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-50">
            {submitting ? "发送中…" : "发送重置链接"}
          </button>
        </form>
      )}
      <a href="/login" className="text-sm text-blue-600">返回登录</a>
    </main>
  );
}
