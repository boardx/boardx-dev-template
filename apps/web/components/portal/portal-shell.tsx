"use client";
// Developer Portal 骨架（p23/F01）：五 tab 导航 + 待人类拍板全局通知 + 开发者身份 chip。
// 界面契约 = p23 ui-signoff confirmed 的 v3 原型；wave 1（F03-F08）逐板块把占位换成真内容。
// 待拍板数据源：/api/portal/discussions 的 needs_human_count（F02）；未配置（configured:false）
// 时通知条与红点整体隐藏——不虚构数据。
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PulseTab } from "@/components/portal/tabs/pulse-tab";
import { CoordTab } from "@/components/portal/tabs/coord-tab";
import { TalkTab } from "@/components/portal/tabs/talk-tab";
import { JoinTab } from "@/components/portal/tabs/join-tab";
import { PerfTab } from "@/components/portal/tabs/perf-tab";

const TABS = [
  { key: "pulse", label: "脉搏与进度" },
  { key: "coord", label: "实时协调" },
  { key: "talk", label: "讨论流" },
  { key: "join", label: "加入开发" },
  { key: "perf", label: "性能" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function PortalShell({ developer }: { developer: { name: string; email: string; agentCount: number } }) {
  const [tab, setTab] = useState<TabKey>("pulse");
  const [decideCount, setDecideCount] = useState<number | null>(null); // null = 未配置/未知 → 不渲染通知

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/portal/discussions");
        if (!res.ok) return;
        const body = (await res.json()) as { configured: boolean; needs_human_count?: number };
        if (!cancelled && body.configured) setDecideCount(body.needs_human_count ?? 0);
      } catch {
        // 数据源失败 → 保持 null，隐藏通知（不虚构）
      }
    }
    void load();
    const timer = setInterval(() => void load(), 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  // 待拍板进浏览器 title 前缀（界面契约 Top1）
  useEffect(() => {
    document.title = decideCount && decideCount > 0 ? `(${decideCount}) Developer Portal · BoardX` : "Developer Portal · BoardX";
  }, [decideCount]);

  const initial = developer.name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="mx-auto max-w-content px-9 pb-14 pt-7">
      <div data-testid="visitor-band" className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-12 border border-border bg-surface-2 px-4 py-2.5">
        <span className="text-13 text-foreground">
          第一次来到这里？<Button variant="link" size="sm" className="px-1" onClick={() => setTab("join")}>3 分钟了解这个项目 →</Button>
        </span>
        <span className="text-13 text-foreground">
          想加入开发？<Button variant="link" size="sm" className="px-1" onClick={() => setTab("join")}>开始 onboarding →</Button>
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-21 font-bold text-foreground">Developer Portal</h1>
          <p className="mt-1 text-13 text-muted-foreground">BoardX agentic 开发的统一人类入口 · GitHub 是底座，coord-service 是 AI 增强</p>
        </div>
        {/* 开发者身份 chip：开发者是人类一等实体（👤），带来 N 个 agent（配对关系，ADR-011） */}
        <div data-testid="dev-identity-chip" className="flex items-center gap-2 rounded-12 border border-border bg-surface-1 px-3 py-1.5">
          <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-13 font-semibold text-primary-foreground">{initial}</span>
          <span className="leading-tight">
            <span className="block text-13 font-medium text-foreground">👤 {developer.name}</span>
            <span className="block text-11 text-muted-foreground">带来 {developer.agentCount} 个 agent</span>
          </span>
        </div>
      </div>

      {decideCount !== null && decideCount > 0 && (
        <div data-testid="decide-banner" role="status" className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-12 border border-destructive/40 bg-destructive/5 px-4 py-2.5">
          <span className="text-13 font-medium text-foreground">⚡ 有 <strong>{decideCount}</strong> 项决策在等你——系统无法替你做这些决定</span>
          <Button size="sm" variant="secondary" onClick={() => setTab("talk")}>去处理 →</Button>
        </div>
      )}

      <nav className="mt-5 flex gap-2 overflow-x-auto pb-1" aria-label="板块">
        {TABS.map((t) => (
          <Button key={t.key} size="sm" variant={tab === t.key ? "default" : "outline"} className="shrink-0" onClick={() => setTab(t.key)}>
            {t.label}
            {t.key === "talk" && decideCount !== null && decideCount > 0 && (
              <Badge variant="destructive" className="ml-1.5 px-1.5 text-11">{decideCount}</Badge>
            )}
          </Button>
        ))}
      </nav>

      <div className="mt-5" data-testid={`tab-${tab}`}>
        {tab === "pulse" && <PulseTab />}
        {tab === "coord" && <CoordTab />}
        {tab === "talk" && <TalkTab />}
        {tab === "join" && <JoinTab />}
        {tab === "perf" && <PerfTab />}
      </div>
    </div>
  );
}
