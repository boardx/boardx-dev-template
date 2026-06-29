"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "", agreeTerms: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrors({});
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    setSubmitting(false);
    if (res.status === 201) {
      router.push("/");
      router.refresh();
      return;
    }
    const data = await res.json().catch(() => ({}));
    setErrors(data.errors ?? { _: data.error ?? "注册失败" });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-8">
      <h1 className="text-2xl font-bold">注册 BoardX</h1>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <input data-testid="firstName" placeholder="名 First name" className="rounded border px-3 py-2"
          value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
        {errors.firstName && <p data-testid="err-firstName" className="text-sm text-red-600">{errors.firstName}</p>}
        <input data-testid="lastName" placeholder="姓 Last name" className="rounded border px-3 py-2"
          value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
        {errors.lastName && <p data-testid="err-lastName" className="text-sm text-red-600">{errors.lastName}</p>}
        <input data-testid="email" type="email" placeholder="邮箱 Email" className="rounded border px-3 py-2"
          value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        {errors.email && <p data-testid="err-email" className="text-sm text-red-600">{errors.email}</p>}
        <input data-testid="password" type="password" placeholder="密码 Password（≥6）" className="rounded border px-3 py-2"
          value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        {errors.password && <p data-testid="err-password" className="text-sm text-red-600">{errors.password}</p>}
        <label className="flex items-center gap-2 text-sm">
          <input data-testid="agreeTerms" type="checkbox" checked={form.agreeTerms}
            onChange={(e) => setForm({ ...form, agreeTerms: e.target.checked })} />
          我同意服务条款和隐私政策
        </label>
        {errors.agreeTerms && <p data-testid="err-agreeTerms" className="text-sm text-red-600">{errors.agreeTerms}</p>}
        {errors._ && <p data-testid="err-form" className="text-sm text-red-600">{errors._}</p>}
        <button data-testid="submit" disabled={submitting}
          className="rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-50">
          {submitting ? "提交中…" : "注册"}
        </button>
      </form>
      <a href="/login" className="text-sm text-blue-600">已有账号？登录</a>
    </main>
  );
}
