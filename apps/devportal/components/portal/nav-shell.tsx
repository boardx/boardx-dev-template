"use client";
// 门户外壳（p30 视觉对齐批次 5）：232px 固定侧栏 + 三层分区导航，
// 权威视觉源 = phases/phase-p30-devportal-platform/requirements/design/DevPortal-Platform.dc.html。
// 纯视觉/导航 chrome：不读身份、不碰数据层（用户块为 mock，与 p30 原型同一口径）；
// 页面内容与既有 testid 零变更。路由不存在的设计稿导航项标「规划中」，不虚构页面。
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href?: string;
  /** 侧栏右侧小标（琥珀描边，设计稿 platformNav tag 样式） */
  tag?: string;
  /** 精确匹配还是前缀匹配（/me 不能吃掉 /me/agents 的选中态） */
  exact?: boolean;
  /** mono 字体（项目 slug / 路由类条目） */
  mono?: boolean;
};

const PERSONAL: NavItem[] = [
  { label: "/me 工作台", href: "/me", exact: true, mono: true },
  { label: "/me/agents 车队", href: "/me/agents", mono: true },
  { label: "我的公开档案", href: "/u/usamshen" },
  { label: "性能评估", tag: "规划中" },
];

const PLATFORM: NavItem[] = [
  { label: "项目目录·探索", href: "/explore" },
  { label: "调度中心", href: "/platform/dispatcher", tag: "admin" },
  { label: "经典门户", href: "/portal", tag: "p23" },
  { label: "通知中心", tag: "规划中" },
];

const WORKSPACE: NavItem[] = [
  { label: "花名册 People", href: "/p/boardx/people" },
  { label: "治理台 Governance", href: "/p/boardx/settings" },
  { label: "招募页（公开）", href: "/projects/boardx" },
  { label: "接入向导", href: "/onboard" },
];

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-2 pb-1 pt-4 text-10 font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </div>
  );
}

function NavRow({ item, active }: { item: NavItem; active: boolean }) {
  const inner = (
    <>
      <span className={cn("min-w-0 flex-1 truncate text-13", item.mono && "font-mono text-12")}>{item.label}</span>
      {item.tag && (
        <span className="shrink-0 rounded-md border border-accent-amber/35 px-1.5 py-px text-10 text-accent-amber">
          {item.tag}
        </span>
      )}
    </>
  );
  if (!item.href) {
    return (
      <div aria-disabled className="mb-0.5 flex items-center gap-2 rounded-lg px-2.5 py-2 text-placeholder">
        {inner}
      </div>
    );
  }
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "mb-0.5 flex items-center gap-2 rounded-lg px-2.5 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "bg-secondary font-semibold text-foreground" : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
      )}
    >
      {inner}
    </Link>
  );
}

function isActive(pathname: string, item: NavItem): boolean {
  if (!item.href) return false;
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function Sidebar() {
  const pathname = usePathname() ?? "";
  return (
    <nav
      data-testid="portal-sidebar"
      aria-label="门户导航"
      className="flex h-full w-58 shrink-0 flex-col overflow-y-auto border-r border-border bg-card px-3 py-4"
    >
      {/* 品牌块：渐变 logo 方块 + 双行标识（设计稿顶部） */}
      <Link
        href="/me"
        className="mb-2 flex items-center gap-2.25 rounded-lg px-2 pb-4 transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span aria-hidden className="dp-brand-gradient h-6.5 w-6.5 shrink-0 rounded-7" />
        <span className="leading-tight">
          <span className="block text-13 font-semibold text-foreground">DevPortal</span>
          <span className="block font-mono text-10 text-muted-foreground">agentic 协作平台</span>
        </span>
      </Link>

      <SectionLabel>个人层</SectionLabel>
      {PERSONAL.map((item) => (
        <NavRow key={item.label} item={item} active={isActive(pathname, item)} />
      ))}

      <SectionLabel>平台层</SectionLabel>
      {PLATFORM.map((item) => (
        <NavRow key={item.label} item={item} active={isActive(pathname, item)} />
      ))}

      <SectionLabel>
        项目工作区 · <span className="font-mono normal-case text-accent-amber">boardx</span>
      </SectionLabel>
      {WORKSPACE.map((item) => (
        <NavRow key={item.label} item={item} active={isActive(pathname, item)} />
      ))}

      {/* 底部用户块（mock，与 p30 原型同口径：@usamshen 固定平台管理员） */}
      <div className="mt-auto border-t border-border px-2 pt-3">
        <div className="flex items-center gap-2">
          <span aria-hidden className="flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-full bg-tag-purple text-11 text-success">
            U
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate font-mono text-12 font-semibold text-foreground">@usamshen</span>
            <span className="block text-10 text-accent-amber">👤 平台管理员（固定）</span>
          </span>
        </div>
      </div>
    </nav>
  );
}

/** 门户外壳：桌面 = 侧栏 + 滚动主区；<lg 收起侧栏只留顶部品牌条（U8 不横向溢出）。 */
export function NavShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2.25 border-b border-border bg-card px-4 py-2.5 lg:hidden">
          <span aria-hidden className="dp-brand-gradient h-5.5 w-5.5 shrink-0 rounded-md" />
          <span className="text-13 font-semibold text-foreground">DevPortal</span>
          <span className="font-mono text-10 text-muted-foreground">agentic 协作平台</span>
        </div>
        <main className="min-w-0 flex-1 overflow-y-auto animate-fade-in">{children}</main>
      </div>
    </div>
  );
}
