"use client";
// p30 UI 先行共享件：三色身份 chip、mock 加载/空态演示开关、页头。
// ⚠️ 仅服务 p30 原型页（/me、/me/agents、/p/:slug/people），mock 由 lib/mock/p30.ts 供给。
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TRI_COLOR } from "@/lib/mock/p30";

/** 三色体系 chip（N6）：👤 tag-blue / 🤖 tag-purple / 项目 tag-green。 */
export function IdentityChip({ kind, children, className }: { kind: keyof typeof TRI_COLOR; children: ReactNode; className?: string }) {
  const icon = kind === "human" ? "👤" : kind === "agent" ? "🤖" : "📁";
  return (
    <span className={`inline-flex max-w-full min-w-0 items-center gap-1 rounded-full px-2 py-0.5 text-11 font-medium transition-colors ${TRI_COLOR[kind]} ${className ?? ""}`}>
      <span aria-hidden className="shrink-0">{icon}</span>
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}

/** mock 加载模拟：首屏 700ms 骨架，让人类能核对 loading 态（U1）。 */
export function useMockLoading(ms = 700): boolean {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), ms);
    return () => clearTimeout(t);
  }, [ms]);
  return loading;
}

/** 原型页头：面包屑 + mock 徽标 + 「演示空态」开关（让人类核对空态，U2）。 */
export function PrototypeHeader({
  title,
  subtitle,
  emptyDemo,
  onToggleEmptyDemo,
}: {
  title: string;
  subtitle: string;
  emptyDemo: boolean;
  onToggleEmptyDemo: () => void;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-21 font-bold text-foreground">{title}</h1>
          <span className="rounded-full bg-tag-yellow px-2 py-0.5 text-11 font-medium text-foreground" title="p30 UI 先行原型：全部 mock 数据，未接真实数据源">
            UI 先行 · mock
          </span>
        </div>
        <p className="mt-1 text-13 text-muted-foreground">{subtitle}</p>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" data-testid="toggle-empty-demo" aria-pressed={emptyDemo} onClick={onToggleEmptyDemo}>
          {emptyDemo ? "恢复演示数据" : "演示空态"}
        </Button>
        <Link
          href="/"
          className="inline-flex h-8 items-center rounded-lg px-3 text-13 font-semibold text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          回门户 →
        </Link>
      </div>
    </div>
  );
}

/** 空态（U2）：统一虚线框样式。 */
export function EmptyState({ testid, children }: { testid: string; children: ReactNode }) {
  return (
    <div data-testid={testid} className="flex flex-col items-center gap-2 rounded-10 border border-dashed border-border py-8 text-center">
      <p className="text-13 text-muted-foreground">{children}</p>
    </div>
  );
}

/** loading 骨架（U1）。 */
export function LoadingSkeleton({ rows = 3, testid = "loading" }: { rows?: number; testid?: string }) {
  return (
    <div data-testid={testid} className="animate-pulse space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 rounded-8 bg-muted" />
      ))}
    </div>
  );
}
