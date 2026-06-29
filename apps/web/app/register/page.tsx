"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

  const err = (k: string) =>
    errors[k] ? <p data-testid={`err-${k}`} className="text-sm text-destructive">{errors[k]}</p> : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">注册 BoardX</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="flex flex-col gap-3">
            <Input data-testid="firstName" placeholder="名 First name"
              value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            {err("firstName")}
            <Input data-testid="lastName" placeholder="姓 Last name"
              value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            {err("lastName")}
            <Input data-testid="email" type="email" placeholder="邮箱 Email"
              value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            {err("email")}
            <Input data-testid="password" type="password" placeholder="密码 Password（≥6）"
              value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            {err("password")}
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input data-testid="agreeTerms" type="checkbox" className="h-4 w-4 accent-primary"
                checked={form.agreeTerms} onChange={(e) => setForm({ ...form, agreeTerms: e.target.checked })} />
              我同意服务条款和隐私政策
            </label>
            {err("agreeTerms")}
            {errors._ && <p data-testid="err-form" className="text-sm text-destructive">{errors._}</p>}
            <Button data-testid="submit" type="submit" disabled={submitting} className="w-full">
              {submitting ? "提交中…" : "注册"}
            </Button>
          </form>
          <a href="/login" className="mt-4 block text-sm text-foreground underline-offset-4 hover:underline">已有账号？登录</a>
        </CardContent>
      </Card>
    </main>
  );
}
