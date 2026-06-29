"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AccountPage() {
  const router = useRouter();
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (form.next.length < 6) return setError("新密码至少 6 位");
    if (form.next !== form.confirm) return setError("两次密码不一致");
    setSubmitting(true);
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ current: form.current, next: form.next }),
    });
    setSubmitting(false);
    if (res.ok) {
      setDone(true);
      setTimeout(() => router.push("/login"), 300);
      return;
    }
    const data = await res.json().catch(() => ({}));
    setError(data.errors?.current ?? data.errors?.next ?? data.error ?? "修改失败");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-8">
      <h1 className="text-2xl font-bold">账号中心 · Security</h1>
      <p className="text-sm text-neutral-600">修改密码会使现有会话失效，需要重新登录。</p>
      {done ? (
        <p data-testid="done" className="text-green-700">密码已更新，请重新登录。</p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <input data-testid="current" type="password" placeholder="当前密码" className="rounded border px-3 py-2"
            value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} />
          <input data-testid="next" type="password" placeholder="新密码（≥6）" className="rounded border px-3 py-2"
            value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} />
          <input data-testid="confirm" type="password" placeholder="确认新密码" className="rounded border px-3 py-2"
            value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
          {error && <p data-testid="err-form" className="text-sm text-red-600">{error}</p>}
          <button data-testid="submit" disabled={submitting}
            className="rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-50">
            {submitting ? "提交中…" : "Update password"}
          </button>
        </form>
      )}
    </main>
  );
}
