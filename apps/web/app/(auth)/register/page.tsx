"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthShell, AuthLabel, AuthDivider } from "@/components/auth/auth-shell";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    agreeTerms: false,
  });
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
    errors[k] ? (
      <p data-testid={`err-${k}`} className="mt-1.5 text-11 text-destructive">
        {errors[k]}
      </p>
    ) : null;

  return (
    <AuthShell>
      <h2 className="text-22 font-bold tracking-tight">Create your account</h2>
      <p className="mt-1.5 text-13 text-muted-foreground">
        Start collaborating in minutes.
      </p>

      <form onSubmit={submit} className="mt-5.5 flex flex-col">
        <div className="flex gap-2.5">
          <div className="flex-1">
            <AuthLabel htmlFor="firstName">First name</AuthLabel>
            <Input
              id="firstName"
              data-testid="firstName"
              placeholder="Alex"
              className="mt-1.5"
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            />
            {err("firstName")}
          </div>
          <div className="flex-1">
            <AuthLabel htmlFor="lastName">Last name</AuthLabel>
            <Input
              id="lastName"
              data-testid="lastName"
              placeholder="Lee"
              className="mt-1.5"
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            />
            {err("lastName")}
          </div>
        </div>

        <div className="mt-3">
          <AuthLabel htmlFor="email">Email</AuthLabel>
        </div>
        <Input
          id="email"
          data-testid="email"
          type="email"
          placeholder="you@company.com"
          className="mt-1.5"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        {err("email")}

        <div className="mt-3">
          <AuthLabel htmlFor="password">Password</AuthLabel>
        </div>
        <Input
          id="password"
          data-testid="password"
          type="password"
          placeholder="At least 6 characters"
          className="mt-1.5"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        {err("password")}

        <label className="mt-3.5 flex items-start gap-2 text-11 leading-snug text-muted-foreground">
          <input type="checkbox" data-testid="agreeTerms"
            className="mt-px h-3.75 w-3.75 shrink-0 rounded accent-primary"
            checked={form.agreeTerms}
            onChange={(e) => setForm({ ...form, agreeTerms: e.target.checked })} />
          <span>
            I agree to the{" "}
            <span className="text-foreground underline">Terms</span> and{" "}
            <span className="text-foreground underline">Privacy Policy</span>.
          </span>
        </label>
        {err("agreeTerms")}

        {errors._ && (
          <p data-testid="err-form" className="mt-3 text-13 text-destructive">
            {errors._}
          </p>
        )}

        <Button
          data-testid="submit"
          type="submit"
          disabled={submitting}
          size="lg"
          className="mt-4 w-full"
        >
          {submitting ? "Creating…" : "Create account"}
        </Button>
      </form>

      <AuthDivider />

      <div className="flex gap-2.5">
        <Button variant="outline" type="button" className="flex-1 text-13 font-normal">
          Google
        </Button>
        <Button variant="outline" type="button" className="flex-1 text-13 font-normal">
          Facebook
        </Button>
      </div>

      <p className="mt-4.5 text-center text-13 text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-foreground transition-colors hover:text-muted-foreground">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
