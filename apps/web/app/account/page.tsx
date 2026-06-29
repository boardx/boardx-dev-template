"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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

  // 未登录跳登录（uc-profile-001）
  useEffect(() => {
    void (async () => {
      const { user } = await (await fetch("/api/auth/session")).json();
      if (!user) router.push("/login");
    })();
  }, [router]);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">账号中心</h1>
        <a href="/" data-testid="back-workspace" className="text-sm text-blue-600">返回工作区</a>
      </div>
      <nav className="flex gap-2 border-b">
        {(["personal", "security", "settings"] as Section[]).map((s) => (
          <button key={s} data-testid={`tab-${s}`} onClick={() => setSection(s)}
            className={`px-3 py-2 text-sm ${section === s ? "border-b-2 border-neutral-900 font-medium" : "text-neutral-500"}`}>
            {s === "personal" ? "Personal info" : s === "security" ? "Security" : "Settings"}
          </button>
        ))}
      </nav>
      {section === "personal" && <PersonalInfo />}
      {section === "security" && <Security router={router} />}
      {section === "settings" && <Settings />}
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
      setLoaded(true); // 加载完成后再渲染输入，避免覆盖用户输入
    })();
  }, []);

  if (!loaded) return <section data-testid="section-personal"><p>加载中…</p></section>;

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
      <label className="text-sm">显示名</label>
      <input data-testid="display-name" className="rounded border px-3 py-2"
        value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      <div className="text-sm">当前头像：<span data-testid="avatar-preview" className="font-mono">{avatar || "(默认)"}</span></div>
      <div className="flex gap-2">
        {CANDIDATE_AVATARS.map((a, i) => (
          <button key={a} data-testid={`avatar-opt-${i}`} onClick={() => setAvatar(a)}
            className={`rounded border px-2 py-1 text-xs ${avatar === a ? "border-neutral-900" : ""}`}>{a}</button>
        ))}
        <button data-testid="avatar-generate" onClick={() => setAvatar("seed:gen" + Date.now())}
          className="rounded bg-neutral-200 px-2 py-1 text-xs">AI generate</button>
      </div>
      {error && <p data-testid="err" className="text-sm text-red-600">{error}</p>}
      {saved && <p data-testid="saved" className="text-sm text-green-700">已保存</p>}
      <button data-testid="save-personal" onClick={save} className="self-start rounded bg-neutral-900 px-4 py-2 text-white">Save personal info</button>
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
      <p className="text-sm text-neutral-600">修改密码会使现有会话失效，需要重新登录。</p>
      {done ? <p data-testid="done" className="text-green-700">密码已更新，请重新登录。</p> : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <input data-testid="current" type="password" placeholder="当前密码" className="rounded border px-3 py-2"
            value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} />
          <input data-testid="next" type="password" placeholder="新密码（≥6）" className="rounded border px-3 py-2"
            value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} />
          <input data-testid="confirm" type="password" placeholder="确认新密码" className="rounded border px-3 py-2"
            value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
          {error && <p data-testid="err-sec" className="text-sm text-red-600">{error}</p>}
          <button data-testid="submit-security" className="self-start rounded bg-neutral-900 px-4 py-2 text-white">Update password</button>
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

  if (!loaded) return <section data-testid="section-settings"><p>加载中…</p></section>;
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
      <label className="text-sm">AI 模型偏好</label>
      <select data-testid="ai-model" className="rounded border px-3 py-2" value={aiModel} onChange={(e) => setAiModel(e.target.value)}>
        <option value="claude-opus-4-8">claude-opus-4-8</option>
        <option value="claude-sonnet-4-6">claude-sonnet-4-6</option>
        <option value="claude-haiku-4-5">claude-haiku-4-5</option>
      </select>
      <label className="text-sm">默认隐私级别</label>
      <select data-testid="default-privacy" className="rounded border px-3 py-2" value={defaultPrivacy} onChange={(e) => setDefaultPrivacy(e.target.value)}>
        <option value="private">私有</option>
        <option value="team">团队可见</option>
      </select>
      {saved && <p data-testid="saved-settings" className="text-sm text-green-700">已保存</p>}
      <button data-testid="save-settings" onClick={save} className="self-start rounded bg-neutral-900 px-4 py-2 text-white">Save settings</button>
    </section>
  );
}
