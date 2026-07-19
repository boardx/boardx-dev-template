// W6 /p/:slug/settings 治理台（p30-F03：服务端角色裁剪落地，UC-02）。
// 服务端在 resolveWorkspaceAccess() 一次性判定：slug 未知 → 404；contributor（及非成员）
// → gov-no-access 整页拒绝态，零治理数据进入响应；owner/maintainer → 挂载 GovernanceConsole。
// 裁剪发生在这里（服务端组件渲染前），不是「拿到数据再前端隐藏」。
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { GovernanceConsole } from "@/components/p30/governance-console";
import { WorkspaceNoAccess } from "@/components/p30/workspace-no-access";
import { resolveWorkspaceAccess } from "@/lib/workspace-authz";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "治理台 · Developer Portal" };

const GOVERNANCE_ROLES = ["owner", "maintainer"] as const;

export default async function ProjectSettingsPage({ params }: { params: { slug: string } }) {
  const access = await resolveWorkspaceAccess(params.slug, headers(), { minRoles: GOVERNANCE_ROLES });

  if (access.kind === "not_found") notFound();

  // middleware.ts 已对 /p/:path* 强制会话；理论不可达，保守走 404（绝不泄漏页面骨架）。
  if (access.kind === "unauthenticated") notFound();

  if (access.kind === "forbidden") {
    return (
      <div className="mx-auto max-w-content px-6 pb-14 pt-7 md:px-9">
        <WorkspaceNoAccess
          testid="gov-no-access"
          title="治理台仅 owner / maintainer 可见"
          body={`你在 /p/${params.slug} 的角色是${access.role ? ` ${access.role}` : "非本项目成员"}。治理动作（准入策略 / 审批 / andon 授权 / token 审计）需要 owner 权限——有异常想反映？任何成员都可以 ✋ 举手（不阻断，进待拍板）。`}
        />
      </div>
    );
  }

  return <GovernanceConsole slug={params.slug} viewerRole={access.role} />;
}
