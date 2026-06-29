"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function ResetPasswordPage() {
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
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-8">
      <h1 className="text-2xl font-bold">设置新密码</h1>
      {done ? (
        <p data-testid="done" className="text-green-700">密码已重置，请用新密码登录。</p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <input data-testid="next" type="password" placeholder="新密码（≥6）" className="rounded border px-3 py-2"
            value={next} onChange={(e) => setNext(e.target.value)} />
          <input data-testid="confirm" type="password" placeholder="确认新密码" className="rounded border px-3 py-2"
            value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          {error && <p data-testid="err-form" className="text-sm text-red-600">{error}</p>}
          <button data-testid="submit" disabled={submitting}
            className="rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-50">
            {submitting ? "提交中…" : "设置密码"}
          </button>
        </form>
      )}
    </main>
  );
}
