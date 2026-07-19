// GET /api/portal/workspace/:slug/access — p30-F03 通用工作区成员鉴权探针。
// 服务端一次性判定：未知 slug → 404；未登录 → 401；已登录非成员（私有项目）→ 403；
// 成员/公开项目只读 → 200 携带 {project, role}。这是「服务端裁剪」而非「前端隐藏」的
// 反面测试锚点——curl 本端点即可验证不同身份得到不同真实状态码，数据从不越界下发。
import { NextResponse } from "next/server";
import { resolveWorkspaceAccess } from "@/lib/workspace-authz";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const access = await resolveWorkspaceAccess(params.slug, req.headers, { allowPublicRead: true });

  if (access.kind === "not_found") return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (access.kind === "unauthenticated") return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (access.kind === "forbidden")
    return NextResponse.json({ error: "forbidden", role: access.role }, { status: 403 });

  return NextResponse.json({ project: access.project, role: access.role }, { status: 200 });
}
