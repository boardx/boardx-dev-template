"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { User, Shield, Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Section = "personal" | "security" | "settings";
const CANDIDATE_AVATARS = ["seed:a1", "seed:b2", "seed:c3", "seed:d4"];

const NAV: { key: Section; label: string; icon: typeof User }[] = [
  { key: "personal", label: "Personal info", icon: User },
  { key: "security", label: "Security", icon: Shield },
  { key: "settings", label: "Settings", icon: SettingsIcon },
];
const TITLE: Record<Section, string> = {
  personal: "Personal info",
  security: "Security",
  settings: "Settings",
};

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
    <div className="flex h-full overflow-hidden">
      {/* 左侧 section 导航 */}
      <aside className="flex w-[12.5rem] shrink-0 flex-col gap-0.5 border-r border-border p-3">
        <div className="px-2 pb-3 text-15 font-bold text-foreground">Account</div>
        {NAV.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            data-testid={`tab-${key}`}
            onClick={() => setSection(key)}
            className={cn(
              "flex items-center gap-2.5 rounded-7 px-2.5 py-2 text-13 transition-colors",
              section === key
                ? "bg-muted font-semibold text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
        <div className="flex-1" />
        <a
          href="/"
          data-testid="back-workspace"
          className="rounded-7 px-2.5 py-2 text-13 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          ‹ Back to workspace
        </a>
      </aside>

      {/* 内容 */}
      <div className="flex-1 overflow-auto px-9 py-8">
        <h1 className="text-22 font-bold tracking-tight text-foreground">{TITLE[section]}</h1>
        <div className="mt-5 max-w-[32.5rem]">
          {section === "personal" && <PersonalInfo />}
          {section === "security" && <Security router={router} />}
          {section === "settings" && <Settings />}
        </div>
      </div>
    </div>
  );
}

function PersonalInfo() {
  const [displayName, setDisplayName] = useState("");
  const [avatar, setAvatar] = useState("");
  const avatarRef = useRef("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void (async () => {
      const p = (await (await fetch("/api/profile")).json()).profile;
      if (p) {
        setDisplayName(p.displayName ?? "");
        setAvatar(p.avatar ?? "");
        avatarRef.current = p.avatar ?? "";
      }
      setLoaded(true);
    })();
  }, []);

  if (!loaded) return <section data-testid="section-personal"><p className="text-13 text-muted-foreground">加载中…</p></section>;

  async function save() {
    setError(""); setSaved(false);
    const input = document.getElementById("display-name") as HTMLInputElement | null;
    const nextDisplayName = (input?.value ?? displayName).trim();
    const nextAvatar = avatarRef.current;
    setDisplayName(nextDisplayName);
    setAvatar(nextAvatar);
    if (!nextDisplayName) return setError("显示名不能为空");
    const res = await fetch("/api/profile", {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ displayName: nextDisplayName, avatar: nextAvatar }),
    });
    if (res.ok) setSaved(true);
    else setError((await res.json().catch(() => ({}))).errors?.displayName ?? "保存失败");
  }

  function chooseAvatar(nextAvatar: string) {
    avatarRef.current = nextAvatar;
    setAvatar(nextAvatar);
  }

  return (
    <section data-testid="section-personal" className="flex flex-col gap-1.5">
      {/* 头像 */}
      <div className="mb-4 flex items-center gap-4">
        <div className="flex h-[3.875rem] w-[3.875rem] items-center justify-center rounded-full bg-foreground text-22 font-semibold text-background">
          {(displayName || "?").charAt(0).toUpperCase()}
        </div>
        <span data-testid="avatar-preview" className="font-mono text-13 text-muted-foreground">
          {avatar || "(默认)"}
        </span>
      </div>

      <Label htmlFor="display-name">Name</Label>
      <Input id="display-name" data-testid="display-name" className="mb-2" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />

      <Label>Avatar</Label>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        {CANDIDATE_AVATARS.map((a, i) => (
          <Button key={a} data-testid={`avatar-opt-${i}`} type="button" size="sm"
            variant={avatar === a ? "default" : "outline"} onClick={() => chooseAvatar(a)}>{a}</Button>
        ))}
        <Button data-testid="avatar-generate" type="button" size="sm" variant="secondary" onClick={() => chooseAvatar("seed:gen" + Date.now())}>AI generate</Button>
      </div>

      {error && <p data-testid="err" className="text-13 text-destructive">{error}</p>}
      {saved && <p data-testid="saved" className="text-13 text-success">已保存</p>}
      <Button data-testid="save-personal" type="button" className="mt-2 self-start" onClick={save}>Save personal info</Button>
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
      <p className="text-13 text-muted-foreground">Changing your password signs out other sessions.</p>
      {done ? <p data-testid="done" className="text-13 text-success">密码已更新，请重新登录。</p> : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <Input data-testid="current" type="password" placeholder="Current password" value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} />
          <Input data-testid="next" type="password" placeholder="New password (≥6)" value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} />
          <Input data-testid="confirm" type="password" placeholder="Confirm new password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
          {error && <p data-testid="err-sec" className="text-13 text-destructive">{error}</p>}
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
  if (!loaded) return <section data-testid="section-settings"><p className="text-13 text-muted-foreground">加载中…</p></section>;
  async function save() {
    setSaved(false);
    const aiModelSelect = document.getElementById("ai-model") as HTMLSelectElement | null;
    const privacySelect = document.getElementById("default-privacy") as HTMLSelectElement | null;
    const nextAiModel = aiModelSelect?.value ?? aiModel;
    const nextDefaultPrivacy = privacySelect?.value ?? defaultPrivacy;
    setAiModel(nextAiModel);
    setDefaultPrivacy(nextDefaultPrivacy);
    const res = await fetch("/api/profile/settings", {
      method: "PUT", headers: { "content-type": "application/json" },
      body: JSON.stringify({ aiModel: nextAiModel, defaultPrivacy: nextDefaultPrivacy }),
    });
    if (res.ok) setSaved(true);
  }
  return (
    <section data-testid="section-settings" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ai-model">AI model preference</Label>
        <Select id="ai-model" data-testid="ai-model" value={aiModel} onChange={(e) => setAiModel(e.target.value)}>
          <option value="claude-opus-4-8">claude-opus-4-8</option>
          <option value="claude-sonnet-4-6">claude-sonnet-4-6</option>
          <option value="claude-haiku-4-5">claude-haiku-4-5</option>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="default-privacy">Default privacy</Label>
        <Select id="default-privacy" data-testid="default-privacy" value={defaultPrivacy} onChange={(e) => setDefaultPrivacy(e.target.value)}>
          <option value="private">Private</option>
          <option value="team">Team</option>
        </Select>
      </div>
      {saved && <p data-testid="saved-settings" className="text-13 text-success">已保存</p>}
      <Button data-testid="save-settings" type="button" className="self-start" onClick={save}>Save settings</Button>
    </section>
  );
}
