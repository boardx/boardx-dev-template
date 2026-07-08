"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "overview", label: "Overview", href: "/admin" },
  { key: "users", label: "Users", href: "/admin/users" },
  { key: "teams", label: "Teams", href: "/admin/teams" },
  { key: "store-approval", label: "Store Approval", href: "/admin/ai-store/review" },
  { key: "store-featured", label: "Store Featured", href: "/admin/ai-store/featured" },
];

// 所有 /admin/* 页面共用的 tab 导航（在 layout.tsx 里渲染，位于 SysAdmin 门控通过之后）。
// 用 pathname 判定高亮态，点击直接走 Next.js 路由——不是客户端 state 切换,
// 保留每个子页原有的独立 URL/SSR/权限校验,只是把入口从"返回 Overview 点卡片"
// 改成"随时可见的顶部 tab"。
export function AdminTabs() {
  const pathname = usePathname();

  return (
    <nav data-testid="admin-tabs" aria-label="Admin sections" className="flex flex-wrap gap-1">
      {TABS.map((tab) => {
        const active = tab.href === "/admin" ? pathname === "/admin" : (pathname?.startsWith(tab.href) ?? false);
        return (
          <Link
            key={tab.key}
            href={tab.href}
            data-testid={`admin-tab-${tab.key}`}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-8 px-3.5 py-1.5 text-13 font-medium transition-colors",
              active
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-surface-1 hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
