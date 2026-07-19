// 工作区服务端成员鉴权（p30-F03）。
//
// 铁律：裁剪发生在这里——服务端一次性判定 project 是否存在 + 登录者在该 project 的
// Membership 角色，页面与 API 路由只消费 resolveWorkspaceAccess() 的判定结果。任何
// 未授权分支（not_found / unauthenticated / forbidden）绝不把项目专属数据（governance
// binding、approval queue 等）放进响应体或 RSC props——不是「拿到全量数据再前端隐藏」。
//
// 数据源：coord-gateway 的平台目录读面（p30-F01，/api/coord/directory/*），用 Pages
// 加密 secret COORD_API_TOKEN（ops 只读钥匙，服务端专用，从不下发浏览器）。未配置
// 视为「目录不可达」→ fail-closed（宁可拒绝也不能在配置缺失时放行）。
import { getSessionUser } from "./session";

export const MEMBERSHIP_ROLES = ["owner", "maintainer", "approver", "contributor"] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

export interface DirectoryProject {
  project_id: string;
  slug: string;
  name: string;
  visibility: "public" | "private";
}

export interface MyProjectSummary extends DirectoryProject {
  role: MembershipRole;
}

interface EngineerRow {
  engineer_id: string;
  handle: string;
}

interface MembershipRow {
  project_id: string;
  engineer_id: string;
  role: MembershipRole;
  status: "pending" | "active" | "suspended";
}

const UPSTREAM_TIMEOUT_MS = 5_000;

function directoryBase(): { base: string; token: string } | null {
  const url = process.env["COORD_GATEWAY_URL"];
  const token = process.env["COORD_API_TOKEN"];
  if (!url || !token) return null;
  return { base: `${url.replace(/\/+$/, "")}/api/coord/directory`, token };
}

async function directoryGet<T>(path: string): Promise<T | null> {
  const d = directoryBase();
  if (!d) return null;
  try {
    const res = await fetch(`${d.base}${path}`, {
      headers: { Authorization: `Bearer ${d.token}` },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function findProjectBySlug(slug: string): Promise<DirectoryProject | null> {
  const body = await directoryGet<{ projects: DirectoryProject[] }>("/projects");
  if (!body) return null;
  return body.projects.find((p) => p.slug === slug) ?? null;
}

async function findEngineerByLogin(login: string): Promise<EngineerRow | null> {
  const body = await directoryGet<{ engineers: EngineerRow[] }>("/engineers");
  if (!body) return null;
  const norm = login.toLowerCase();
  return body.engineers.find((e) => e.handle.toLowerCase() === norm) ?? null;
}

async function findMembership(projectId: string, engineerId: string): Promise<MembershipRow | null> {
  const body = await directoryGet<{ memberships: MembershipRow[] }>("/memberships");
  if (!body) return null;
  return body.memberships.find((m) => m.project_id === projectId && m.engineer_id === engineerId) ?? null;
}

export type WorkspaceAccess =
  | { kind: "unauthenticated" }
  | { kind: "not_found" }
  | { kind: "forbidden"; project: DirectoryProject; role: MembershipRole | null }
  | { kind: "ok"; project: DirectoryProject; role: MembershipRole };

export interface ResolveOpts {
  /** 传入时要求角色 ∈ 集合（如 settings 治理台：仅 owner/maintainer）。 */
  minRoles?: readonly MembershipRole[];
  /** 未传 minRoles 时生效：公开项目允许非成员只读（工作区一般页）。settings 永远不适用。 */
  allowPublicRead?: boolean;
}

/**
 * 工作区鉴权核心。返回值即完成裁剪判定——调用方按 kind 分支渲染，
 * "forbidden"/"not_found"/"unauthenticated" 三态都不得携带项目内部数据。
 */
export async function resolveWorkspaceAccess(
  slug: string,
  headers: Headers,
  opts: ResolveOpts = {},
): Promise<WorkspaceAccess> {
  const project = await findProjectBySlug(slug);
  if (!project) return { kind: "not_found" };

  const user = await getSessionUser(headers);
  if (!user) return { kind: "unauthenticated" };

  const engineer = await findEngineerByLogin(user.login);
  const membership = engineer ? await findMembership(project.project_id, engineer.engineer_id) : null;
  const role = membership && membership.status === "active" ? membership.role : null;

  if (opts.minRoles) {
    if (role && opts.minRoles.includes(role)) return { kind: "ok", project, role };
    return { kind: "forbidden", project, role };
  }

  if (role) return { kind: "ok", project, role };
  if (opts.allowPublicRead && project.visibility === "public") {
    return { kind: "ok", project, role: "contributor" };
  }
  return { kind: "forbidden", project, role: null };
}

/** 登录者的真实项目列表（工作区切换器消费，替代 M1 mock 项目集）。 */
export async function listMyProjects(headers: Headers): Promise<MyProjectSummary[]> {
  const user = await getSessionUser(headers);
  if (!user) return [];
  const engineer = await findEngineerByLogin(user.login);
  if (!engineer) return [];
  const [projBody, memBody] = await Promise.all([
    directoryGet<{ projects: DirectoryProject[] }>("/projects"),
    directoryGet<{ memberships: MembershipRow[] }>("/memberships"),
  ]);
  if (!projBody || !memBody) return [];
  const byId = new Map(projBody.projects.map((p) => [p.project_id, p] as const));
  const mine: MyProjectSummary[] = [];
  for (const m of memBody.memberships) {
    if (m.engineer_id !== engineer.engineer_id || m.status !== "active") continue;
    const p = byId.get(m.project_id);
    if (p) mine.push({ ...p, role: m.role });
  }
  return mine;
}
