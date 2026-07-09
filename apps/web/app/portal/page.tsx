// Developer Portal 正式路由（p23/F01 门户骨架）
// - 已登录：完整五 tab 骨架 + 开发者身份 chip + 待拍板全局通知（PortalShell 客户端组件）。
// - 未登录：不粗暴 redirect——渲染访客视图（visitor-band 分流带 + 登录入口 + 学习指引），
//   对应 use-cases N1"未登录见分流带 + 学习内容只读"。
// 界面契约 = p23 ui-signoff（confirmed 2026-07-09）锁定的 v3 原型形态。
import Link from "next/link";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";
import { currentUser } from "@/lib/session";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PortalShell } from "@/components/portal/portal-shell";

export const dynamic = "force-dynamic";

// 开发者↔agents 配对（ADR-011 增补：agents.owner=人类归属）。身份权威迁移（P1-P4）
// 落地前的过渡数据源：registry.yaml 可选 owner 字段（值=开发者邮箱，P1 后切 github_login）。
async function countAgentsOwnedBy(email: string): Promise<number> {
  try {
    const raw = await readFile(path.join(process.cwd(), "..", "..", ".harness", "agents", "registry.yaml"), "utf8");
    const doc = parse(raw) as { agents?: Array<{ owner?: string; active?: boolean }> };
    return (doc.agents ?? []).filter((a) => a.owner === email && a.active !== false).length;
  } catch {
    return 0;
  }
}

export default async function PortalPage() {
  const user = await currentUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-content px-9 pb-14 pt-7">
        <div data-testid="visitor-band" className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-12 border border-border bg-surface-2 px-4 py-2.5">
          <span className="text-13 text-foreground">
            第一次来？<Link href="/portal" className={cn(buttonVariants({ variant: "link", size: "sm" }), "px-1")}>3 分钟了解这个项目 →</Link>
          </span>
          <span className="text-13 text-foreground">
            想加入开发？<Link href="/login" className={cn(buttonVariants({ variant: "link", size: "sm" }), "px-1")}>登录后开始 onboarding →</Link>
          </span>
        </div>
        <h1 className="text-21 font-bold text-foreground">Developer Portal</h1>
        <p className="mt-1 text-13 text-muted-foreground">
          BoardX agentic 开发的统一人类入口 · GitHub 是底座，coord-service 是 AI 增强
        </p>
        <div className="mt-6 rounded-12 border border-border bg-surface-1 p-5">
          <p className="text-13 text-foreground">登录后可见项目脉搏、实时协调、讨论流与性能板块。</p>
          <Link href="/login" className={cn(buttonVariants(), "mt-3")}>登录</Link>
        </div>
      </div>
    );
  }

  const displayName = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email;
  const agentCount = await countAgentsOwnedBy(user.email);

  return <PortalShell developer={{ name: displayName, email: user.email, agentCount }} />;
}
