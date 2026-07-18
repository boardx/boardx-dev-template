"use client";
// P1 /explore 项目目录·探索页（p30 UI 先行原型批次 3，UC-03 目录侧）。
// 访客可见（D3）：本组件零身份读取、零 cookie/header 分支——不依赖 Access 注入 header 的任何假设。
// 项目卡：名称/语言徽章/活跃度火花线/「招募中」徽章/需要帮助的模块 chips/👤🤖 分开计数；
// 筛选（语言/活跃度/招募状态）+ 搜索框，全部本地过滤；点击卡进 /projects/:slug（P2 招募页模板）。
// ⚠️ 全部 mock（lib/mock/p30.ts）。
import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState, IdentityChip, LoadingSkeleton, PrototypeHeader, useMockLoading } from "@/components/p30/shared";
import {
  EXPLORE_ACTIVITY_LABEL,
  EXPLORE_LANGUAGES,
  MOCK_EXPLORE_PROJECTS,
  type ExploreActivity,
  type MockExploreProject,
} from "@/lib/mock/p30";

/** 活跃度火花线（SVG mock）：数据自动生成自 GitHub 合并统计，纯展示、currentColor 走语义色。 */
function ActivitySparkline({ data, slug }: { data: readonly number[]; slug: string }) {
  const w = 160;
  const h = 32;
  const max = Math.max(...data, 1);
  const last = data[data.length - 1] ?? 0;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * (h - 6) - 3}`).join(" ");
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-8 w-full text-primary"
      role="img"
      aria-label={`近 ${data.length} 周每周合并数，最近一周 ${last} 个`}
      data-testid={`explore-sparkline-${slug}`}
    >
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={w} cy={h - (last / max) * (h - 6) - 3} r={2.5} fill="currentColor" />
    </svg>
  );
}

type ActivityFilter = "all" | ExploreActivity;
type RecruitFilter = "all" | "recruiting";

/** 筛选 chip 按钮（radiogroup 语义，键盘可达）。 */
function FilterChip({
  testid,
  active,
  onClick,
  children,
}: {
  testid: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      data-testid={testid}
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-12 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        active ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background text-foreground hover:bg-surface-1"
      }`}
    >
      {children}
    </button>
  );
}

function ProjectCard({ p }: { p: MockExploreProject }) {
  return (
    <Link
      href={`/projects/${p.slug}`}
      data-testid={`explore-card-${p.slug}`}
      className="group flex flex-col gap-3 rounded-12 border border-border bg-surface-1 p-4 transition-colors hover:border-border-strong hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <IdentityChip kind="project">{p.slug}</IdentityChip>
          <span className="truncate text-15 font-semibold text-foreground">{p.name}</span>
        </div>
        {p.recruiting ? (
          <span data-testid={`recruiting-badge-${p.slug}`} className="shrink-0 rounded-full bg-tag-green px-2 py-0.5 text-11 font-medium text-foreground">
            招募中
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-11 text-muted-foreground">未开放招募</span>
        )}
      </div>

      <p className="line-clamp-2 text-13 leading-relaxed text-muted-foreground">{p.tagline}</p>

      <div className="flex flex-wrap items-center gap-1.5">
        {p.languages.map((lang) => (
          <Badge key={lang} variant="outline" className="text-11" data-testid={`lang-badge-${p.slug}-${lang}`}>
            {lang}
          </Badge>
        ))}
        <span className="text-11 text-muted-foreground">· {EXPLORE_ACTIVITY_LABEL[p.activity]}</span>
      </div>

      <div className="rounded-8 bg-background px-2 py-1.5 ring-1 ring-border">
        <ActivitySparkline data={p.sparkline} slug={p.slug} />
        <p className="mt-0.5 text-11 text-muted-foreground">近 12 周合并 · 自动生成自 GitHub，不可自填</p>
      </div>

      {p.helpModules.length > 0 && (
        <div data-testid={`help-chips-${p.slug}`} className="flex flex-wrap items-center gap-1.5">
          <span className="text-11 text-muted-foreground">需要帮助：</span>
          {p.helpModules.map((m) => (
            <span key={m} className="rounded-full bg-tag-yellow px-2 py-0.5 text-11 font-medium text-foreground">
              {m}
            </span>
          ))}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between border-t border-border pt-2.5">
        <div className="flex items-center gap-2 text-12 text-muted-foreground" data-testid={`explore-counts-${p.slug}`}>
          <span title="人类成员数">👤 {p.humans}</span>
          <span aria-hidden>·</span>
          <span title="agent 数">🤖 {p.agents}</span>
        </div>
        <span className="text-12 font-medium text-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          查看主页 →
        </span>
      </div>
    </Link>
  );
}

export function ExploreDirectory() {
  const loading = useMockLoading();
  const [emptyDemo, setEmptyDemo] = useState(false);
  const [query, setQuery] = useState("");
  const [lang, setLang] = useState<string>("all");
  const [activity, setActivity] = useState<ActivityFilter>("all");
  const [recruit, setRecruit] = useState<RecruitFilter>("all");

  const projects = emptyDemo ? [] : MOCK_EXPLORE_PROJECTS;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter((p) => {
      if (lang !== "all" && !p.languages.includes(lang)) return false;
      if (activity !== "all" && p.activity !== activity) return false;
      if (recruit === "recruiting" && !p.recruiting) return false;
      if (q && ![p.name, p.slug, p.tagline, ...p.helpModules].some((s) => s.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [projects, query, lang, activity, recruit]);

  return (
    <div className="mx-auto max-w-content space-y-4 px-6 pb-14 pt-7 md:px-9" data-testid="explore-directory">
      <PrototypeHeader
        title="项目目录 · 探索"
        subtitle="/explore · 访客可见（公开层免登录，D3）· 双边市场需求侧——找到值得带 agent 加入的项目"
        emptyDemo={emptyDemo}
        onToggleEmptyDemo={() => setEmptyDemo((v) => !v)}
      />

      {/* 接入入口（P3）：owner 侧旅程从这里开始 */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-12 border border-border bg-surface-dark p-4 text-surface-dark-foreground">
        <div className="min-w-0">
          <p className="text-15 font-semibold">你的项目也想让人和 agent 车队一起交付？</p>
          <p className="mt-0.5 text-12 opacity-70">接入向导 3 步 + 自动体检，目标 ≤5 分钟（前置：你是仓库 GitHub admin）</p>
        </div>
        <Link
          href="/onboard"
          data-testid="explore-onboard-cta"
          className="inline-flex h-10 shrink-0 items-center rounded-lg bg-primary px-4 text-13 font-semibold text-primary-foreground transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          ＋ 接入你的项目 →
        </Link>
      </div>

      {/* 筛选 + 搜索（本地过滤） */}
      <div className="space-y-2.5 rounded-12 border border-border bg-surface-1 p-4" data-testid="explore-filters">
        <Input
          data-testid="explore-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索项目名 / 简介 / 需要帮助的模块…"
          aria-label="搜索项目"
        />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div role="radiogroup" aria-label="按语言筛选" className="flex flex-wrap items-center gap-1.5">
            <span className="text-11 text-muted-foreground">语言</span>
            <FilterChip testid="filter-lang-all" active={lang === "all"} onClick={() => setLang("all")}>
              全部
            </FilterChip>
            {EXPLORE_LANGUAGES.map((l) => (
              <FilterChip key={l} testid={`filter-lang-${l}`} active={lang === l} onClick={() => setLang(l)}>
                {l}
              </FilterChip>
            ))}
          </div>
          <div role="radiogroup" aria-label="按活跃度筛选" className="flex flex-wrap items-center gap-1.5">
            <span className="text-11 text-muted-foreground">活跃度</span>
            <FilterChip testid="filter-activity-all" active={activity === "all"} onClick={() => setActivity("all")}>
              全部
            </FilterChip>
            {(["high", "medium", "low"] as const).map((a) => (
              <FilterChip key={a} testid={`filter-activity-${a}`} active={activity === a} onClick={() => setActivity(a)}>
                {EXPLORE_ACTIVITY_LABEL[a]}
              </FilterChip>
            ))}
          </div>
          <div role="radiogroup" aria-label="按招募状态筛选" className="flex flex-wrap items-center gap-1.5">
            <span className="text-11 text-muted-foreground">招募</span>
            <FilterChip testid="filter-recruit-all" active={recruit === "all"} onClick={() => setRecruit("all")}>
              全部
            </FilterChip>
            <FilterChip testid="filter-recruit-recruiting" active={recruit === "recruiting"} onClick={() => setRecruit("recruiting")}>
              招募中
            </FilterChip>
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingSkeleton rows={4} />
      ) : projects.length === 0 ? (
        <EmptyState testid="explore-empty">目录还是空的——第一个接入的项目会出现在这里。</EmptyState>
      ) : filtered.length === 0 ? (
        <EmptyState testid="explore-no-match">
          没有匹配「{query.trim() || "当前筛选"}」的项目——试试清空筛选，或换个关键词（可搜项目名 / 简介 / 模块）。
        </EmptyState>
      ) : (
        <>
          <p className="text-12 text-muted-foreground" data-testid="explore-result-count">
            {filtered.length} 个项目 · 排序：活跃度（自动，不可购买位次）
          </p>
          <div className="grid gap-3 sm:grid-cols-2" data-testid="explore-grid">
            {filtered.map((p) => (
              <ProjectCard key={p.slug} p={p} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
