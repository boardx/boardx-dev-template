// W5 /p/:slug/people 花名册（p30-F03：服务端成员鉴权落地）。
// slug 未知 → 404；私有项目非成员 → 服务端无权限态（零花名册数据下发）；
// 公开项目非成员仍可只读浏览；已入项目的成员总能看到。
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { PeopleRoster } from "@/components/p30/people-roster";
import { WorkspaceNoAccess } from "@/components/p30/workspace-no-access";
import { resolveWorkspaceAccess } from "@/lib/workspace-authz";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "花名册 · Developer Portal" };

export default async function PeoplePage({ params }: { params: { slug: string } }) {
  const access = await resolveWorkspaceAccess(params.slug, headers(), { allowPublicRead: true });

  if (access.kind === "not_found") notFound();
  if (access.kind === "unauthenticated") notFound();

  if (access.kind === "forbidden") {
    return (
      <div className="mx-auto max-w-content px-6 pb-14 pt-7 md:px-9">
        <WorkspaceNoAccess
          testid="workspace-no-access"
          title="花名册仅项目成员可见"
          body={`/p/${params.slug} 是私有项目，你还不是它的成员。想加入？项目公开主页可以发起加入申请，或 ✋ 举手求助。`}
        />
      </div>
    );
  }

  return <PeopleRoster slug={params.slug} />;
}
