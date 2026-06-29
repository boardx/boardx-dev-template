"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Section = "personal" | "security" | "settings";
const CANDIDATE_AVATARS = ["seed:a1", "seed:b2", "seed:c3", "seed:d4"];

export default function AccountPage() {
  return (
    <Suspense fallback={null}>
      <AccountCenter />
    </Suspense>
  );
}

function AccountCenter() {
  const router = useRouter();
  const initial = (useSearchParams().get("section") as Section) || "personal";
  const [section, setSection] = useState<Section>(initial);

  useEffect(() => {
    void (async () => {
      const { user } = await (await fetch("/api/auth/session")).json();
      if (!user) router.push("/login");
    })();
  }, [router]);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-5 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">账号中心</h1>
        <a href="/" data-testid="back-workspace" className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">返回工作区</a>
      </div>
      <nav className="flex gap-1 border-b border-border">
        {(["personal", "security", "settings"] as Section[]).map((s) => (
          <button key={s} data-testid={`tab-${s}`} onClick={() => setSection(s)}
            className={cn(
              "px-3 py-2 text-sm transition-colors",
              section === s
                ? "border-b-2 border-primary font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}>
            {s === "personal" ? "Personal info" : s === "security" ? "Security" : "Settings"}
          </button>
        ))}
      </nav>
      <Card>
        <CardContent className="pt-6">
          {section === "personal" && <PersonalInfo />}
          {section === "security" && <Security router={router} />}
          {section === "settings" && <Settings />}
        </CardContent>
      </Card>
    </main>
  );
}

function PersonalInfo() {
  const [displayName, setDisplayName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void (async () => {
      const p = (await (await fetch("/api/profile")).json()).profile;
      if (p) { setDisplayName(p.displayName ?? ""); setAvatar(p.avatar ?? ""); }
      setLoaded(true);
    })();
  }, []);

  if (!loaded) return <section data-testid="section-personal"><p className="text-sm text-muted-foreground">加载中…</p></section>;

  async function save() {
    setError(""); setSaved(false);
    if (!displayName.trim()) return setError("显示名不能为空");
    const res = await fetch("/api/profile", {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ displayName, avatar }),
    });
    if (res.ok) setSaved(true);
    else setError((await res.json().catch(() => ({}))).errors?.displayName ?? "保存失败");
  }

  return (
    <section data-testid="section-personal" className="flex flex-col gap-3">
      <Label htmlFor="display-name">显示名</Label>
      <Input id="display-name" data-testid="display-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      <p className="text-sm text-foreground">当前头像：<span data-testid="avatar-preview" className="font-mono text-muted-foreground">{avatar || "(默认)"}</span></p>
      <div className="flex flex-wrap items-center gap-2">
        {CANDIDATE_AVATARS.map((a, i) => (
          <Button key={a} data-testid={`avatar-opt-${i}`} type="button" size="sm"
            variant={avatar === a ? "default" : "outline"} onClick={() => setAvatar(a)}>{a}</Button>
        ))}
        <Button data-testid="avatar-generate" type="button" size="sm" variant="secondary" onClick={() => setAvatar("seed:gen" + Date.now())}>AI generate</Button>
      </div>
      {error && <p data-testid="err" className="text-sm text-destructive">{error}</p>}
      {saved && <p data-testid="saved" className="text-sm text-success">已保存</p>}
      <Button data-testid="save-personal" type="button" className="self-start" onClick={save}>Save personal info</Button>
    </section>
  );
}

function Security({ router }: { router: ReturnType<typeof useRouter> }) {
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError("");
    if (form.next.length < 6) return setError("新密码至少 6 位");
    if (form.next !== form.confirm) return setError("两次密码不一致");
    const res = await fetch("/api/auth/change-password", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ current: form.current, next: form.next }),
    });
    if (res.ok) { setDone(true); setTimeout(() => router.push("/login"), 300); }
    else { const d = await res.json().catch(() => ({})); setError(d.errors?.current ?? d.error ?? "修改失败"); }
  }
  return (
    <section data-testid="section-security" className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">修改密码会使现有会话失效，需要重新登录。</p>
      {done ? <p data-testid="done" className="text-sm text-success">密码已更新，请重新登录。</p> : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <Input data-testid="current" type="password" placeholder="当前密码" value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} />
          <Input data-testid="next" type="password" placeholder="新密码（≥6）" value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} />
          <Input data-testid="confirm" type="password" placeholder="确认新密码" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
          {error && <p data-testid="err-sec" className="text-sm text-destructive">{error}</p>}
          <Button data-testid="submit-security" type="submit" className="self-start">Update password</Button>
        </form>
      )}
    </section>
  );
}

function Settings() {
  const [aiModel, setAiModel] = useState("claude-opus-4-8");
  const [defaultPrivacy, setDefaultPrivacy] = useState("private");
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    void (async () => {
      const s = (await (await fetch("/api/profile/settings")).json()).settings;
      if (s) { setAiModel(s.aiModel); setDefaultPrivacy(s.defaultPrivacy); }
      setLoaded(true);
    })();
  }, []);
  if (!loaded) return <section data-testid="section-settings"><p className="text-sm text-muted-foreground">加载中…</p></section>;
  async function save() {
    setSaved(false);
    const res = await fetch("/api/profile/settings", {
      method: "PUT", headers: { "content-type": "application/json" },
      body: JSON.stringify({ aiModel, defaultPrivacy }),
    });
    if (res.ok) setSaved(true);
  }
  return (
    <section data-testid="section-settings" className="flex flex-col gap-3">
      <Label htmlFor="ai-model">AI 模型偏好</Label>
      <Select id="ai-model" data-testid="ai-model" value={aiModel} onChange={(e) => setAiModel(e.target.value)}>
        <option value="claude-opus-4-8">claude-opus-4-8</option>
        <option value="claude-sonnet-4-6">claude-sonnet-4-6</option>
        <option value="claude-haiku-4-5">claude-haiku-4-5</option>
      </Select>
      <Label htmlFor="default-privacy">默认隐私级别</Label>
      <Select id="default-privacy" data-testid="default-privacy" value={defaultPrivacy} onChange={(e) => setDefaultPrivacy(e.target.value)}>
        <option value="private">私有</option>
        <option value="team">团队可见</option>
      </Select>
      {saved && <p data-testid="saved-settings" className="text-sm text-success">已保存</p>}
      <Button data-testid="save-settings" type="button" className="self-start" onClick={save}>Save settings</Button>
    </section>
  );
}
