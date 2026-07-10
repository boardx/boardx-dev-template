// Developer Portal @ develop.boardx.us（#523 Track A：Cloudflare 原生部署）
// 与产品面 apps/web/app/portal/page.tsx 同一界面契约（p23 ui-signoff v3），差异：
// - 身份来自 Cloudflare Access（整域 GitHub 登录门禁），没有产品的"未登录访客"分支——
//   能到达此页即已通过 Access；无 Access 上下文（pages.dev 直连）渲染受限提示。
// - 开发者↔agents 配对计数：registry.yaml 经 GitHub Contents API 读取（过渡态，
//   ADR-011 P1 后切 D1）。
import { headers } from "next/headers";
import { parse } from "yaml";
import { accessUser, ownerMatches } from "@/lib/access";
import { readRepoFile } from "@/lib/repo-files";
import { PortalShell } from "@/components/portal/portal-shell";

export const runtime = "edge";
export const dynamic = "force-dynamic";

async function countAgentsOwnedBy(email: string): Promise<number> {
  const raw = await readRepoFile(".harness/agents/registry.yaml");
  if (!raw) return 0;
  try {
    const doc = parse(raw) as { agents?: Array<{ owner?: string; active?: boolean }> };
    return (doc.agents ?? []).filter((a) => ownerMatches(a.owner, email) && a.active !== false).length;
  } catch {
    return 0;
  }
}

export default async function PortalPage() {
  const user = await accessUser(headers());

  if (!user) {
    // 正常路径不会到这里（Access 在边缘拦截未登录）；只有 pages.dev 直连或 Access
    // 配置异常才会看到。不渲染任何数据。
    return (
      <div className="mx-auto max-w-content px-9 pb-14 pt-7">
        <h1 className="text-21 font-bold text-foreground">Developer Portal</h1>
        <p className="mt-2 text-13 text-muted-foreground">
          请通过 https://develop.boardx.us 访问（Cloudflare Access · GitHub 登录）。
        </p>
      </div>
    );
  }

  const displayName = user.email.split("@")[0] ?? user.email;
  const agentCount = await countAgentsOwnedBy(user.email);

  return <PortalShell developer={{ name: displayName, email: user.email, agentCount }} />;
}
