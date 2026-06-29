"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

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
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-8">
      <h1 className="text-2xl font-bold">登录 BoardX</h1>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <input data-testid="email" type="email" placeholder="邮箱 Email" className="rounded border px-3 py-2"
          value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input data-testid="password" type="password" placeholder="密码 Password" className="rounded border px-3 py-2"
          value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        {error && <p data-testid="err-form" className="text-sm text-red-600">{error}</p>}
        <button data-testid="submit" disabled={submitting}
          className="rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-50">
          {submitting ? "提交中…" : "登录"}
        </button>
      </form>
      <div className="flex justify-between text-sm">
        <a href="/forgot-password" className="text-blue-600">忘记密码？</a>
        <a href="/register" className="text-blue-600">创建账号</a>
      </div>
    </main>
  );
}
