// /p/:slug/{pulse,work,coord,talk} 路由化占位（p30-F03 范围：路由 + 服务端成员鉴权）。
// 这四个 tab 的真数据分别属于后续 feature（F04 项目分片数据 / F09 三层意图协议 /
// F18 需求流水线等）——F03 只保证「路由存在 + 到达前已通过服务端裁剪」，
// 不在此提前铺陈这些 feature 尚未交付的数据形态。无状态纯展示，Server Component 可用。
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { PortalCard } from "@/components/portal/portal-card";
import { WorkspaceNoAccess } from "@/components/p30/workspace-no-access";
import { resolveWorkspaceAccess, type DirectoryProject, type MembershipRole } from "@/lib/workspace-authz";

const TAB_COPY: Record<string, { title: string; note: string }> = {
  pulse: { title: "脉搏与进度", note: "工作区脉搏数据按项目分片后接入（p30/F04）。" },
  work: { title: "需求与 sprint", note: "需求流水线与 sprint 面板按项目分片后接入（p30/F04，UC-07/UC-08）。" },
  coord: { title: "实时协调", note: "租约/事件实时协调面按项目分片后接入（p30/F04）。" },
  talk: { title: "对话流", note: "三层意图消息协议落地后接入（p30/F09，UC-11）。" },
};

export function WorkspacePlaceholder({
  tab,
  project,
  role,
}: {
  tab: keyof typeof TAB_COPY;
  project: DirectoryProject;
  role: MembershipRole;
}) {
  const copy = TAB_COPY[tab];
  return (
    <div className="mx-auto max-w-content space-y-4 px-6 pb-14 pt-7 md:px-9" data-testid={`workspace-${tab}`}>
      <div>
        <h1 className="text-21 font-bold text-foreground">
          {project.name} · {copy?.title}
        </h1>
        <p className="mt-1 text-13 text-muted-foreground">
          /p/{project.slug}/{tab} · 你的角色：{role} · 已通过服务端成员鉴权（p30-F03）
        </p>
      </div>
      <PortalCard title={copy?.title ?? tab} state="ready">
        <p className="text-13 leading-relaxed text-muted-foreground">{copy?.note}</p>
      </PortalCard>
    </div>
  );
}

/** 四个占位 tab 页共用的服务端鉴权 + 渲染骨架，供各 page.tsx 直接调用。 */
export async function renderWorkspaceTabPage(tab: keyof typeof TAB_COPY, slug: string) {
  const access = await resolveWorkspaceAccess(slug, headers(), { allowPublicRead: true });

  if (access.kind === "not_found") notFound();
  if (access.kind === "unauthenticated") notFound();

  if (access.kind === "forbidden") {
    return (
      <div className="mx-auto max-w-content px-6 pb-14 pt-7 md:px-9">
        <WorkspaceNoAccess
          testid="workspace-no-access"
          title={`${TAB_COPY[tab]?.title ?? tab}仅项目成员可见`}
          body={`/p/${slug} 是私有项目，你还不是它的成员。想加入？项目公开主页可以发起加入申请，或 ✋ 举手求助。`}
        />
      </div>
    );
  }

  return <WorkspacePlaceholder tab={tab} project={access.project} role={access.role} />;
}
