// 工作区服务端成员鉴权（p30-F03）。
//
// 铁律：裁剪发生在这里——服务端一次性判定登录者身份 + 项目是否存在 + 登录者在该
// project 的 Membership 角色，页面与 API 路由只消费 resolveWorkspaceAccess() 的判定
// 结果。任何未授权分支（unauthenticated / not_found / forbidden）绝不把项目专属数据
// （governance binding、approval queue 等）放进响应体或 RSC props——不是「拿到全量
// 数据再前端隐藏」。
//
// 安全审计修复（PR #783 复审）：
//   1. 身份 join 键必须是 github_login（认证锚点），绝不能是 handle（目录里的展示用
//      自然键，与登录身份是两个不同字段，可以不相等）。用 handle 判定「当前登录者是哪个
//      engineer」是一个真实的身份混淆漏洞：Access 回退通道把 login 从邮箱 local-part
//      派生，一旦某工程师的 handle 恰好等于这个派生值，任何 local-part 命中它的人登录后
//      会直接继承该工程师的 membership 与角色权限。
//   2. 判定顺序必须「先认证、后查项目是否存在」：未登录请求一律先拿到 unauthenticated，
//      不能在确认身份前就先查 project 是否存在——否则 404 vs 401 会被用来匿名枚举私有
//      项目是否存在（本模块的 API 路由不在 middleware matcher 内，可匿名直达）。
//   3. 公开项目非成员只读态语义独立为 "public-viewer"，不得冒充 "contributor"
//      （contributor 是真实 Membership 角色，混用会让下游代码把「路过的访客」误当成
//      「有成员权限的人」）。
//   4. （二轮复审）已登录态同样不能用 200(WorkspaceNoAccess)/403 vs 404 区分「私有项目
//      存在但我不是成员」与「slug 根本不存在」——否则任意登录工程师都能靠探测状态码
//      枚举出哪些 slug 是真实私有项目。私有项目 + 该用户在其上**完全没有 membership
//      记录**时，一律退化成 not_found，和未知 slug 无法区分。已经在该项目上有
//      membership 记录（哪怕是 suspended/pending，或角色不够 minRoles）的用户，本来就
//      合法地知道项目存在（申请过/已加入），这类仍走 forbidden，不算枚举面。此决策是
//      保守默认（未登录枚举同款处理），已获 coord-main 预授权，不等人类对 AskUserQuestion
//      的回复。
//
// 数据源：coord-gateway 的平台目录读面（p30-F01，/api/coord/directory/*），用 Pages
// 加密 secret COORD_API_TOKEN（ops 只读钥匙，服务端专用，从不下发浏览器）。未配置
// 视为「目录不可达」→ fail-closed（宁可拒绝也不能在配置缺失时放行）。
import { getSessionUser } from "./session";

export const MEMBERSHIP_ROLES = ["owner", "maintainer", "approver", "contributor"] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

/** 公开项目非成员只读态——不是 Membership 角色，独立语义，绝不可与 contributor 混用。 */
export const PUBLIC_VIEWER_ROLE = "public-viewer" as const;
export type ViewerRole = MembershipRole | typeof PUBLIC_VIEWER_ROLE;

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
  /** 身份锚点（GitHub 永远是权威）——鉴权 join 键，绝不能用 handle 代替。 */
  github_login: string | null;
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

/**
 * 用 github_login（认证锚点）查 engineer——绝不能退化成按 handle 匹配。handle 只是
 * 目录里的展示用自然键，与登录身份是两个独立字段；github_login 为空的 engineer 记录
 * （尚未绑定 GitHub）永远不参与匹配，避免误配到无主记录。
 */
async function findEngineerByGithubLogin(login: string): Promise<EngineerRow | null> {
  const body = await directoryGet<{ engineers: EngineerRow[] }>("/engineers");
  if (!body) return null;
  const norm = login.toLowerCase();
  return (
    body.engineers.find((e) => typeof e.github_login === "string" && e.github_login.toLowerCase() === norm) ?? null
  );
}

async function findMembership(projectId: string, engineerId: string): Promise<MembershipRow | null> {
  const body = await directoryGet<{ memberships: MembershipRow[] }>("/memberships");
  if (!body) return null;
  return body.memberships.find((m) => m.project_id === projectId && m.engineer_id === engineerId) ?? null;
}

type WorkspaceAccessCommon =
  | { kind: "unauthenticated" }
  | { kind: "not_found" }
  | { kind: "forbidden"; project: DirectoryProject; role: MembershipRole | null };

/** minRoles 调用形态（settings 治理台）：ok.role 静态收窄为真实 MembershipRole，
 *  永远不会是 public-viewer——调用方（GovernanceConsole 等）据此拿到强类型，
 *  不需要运行时再判一次「这是不是访客态」。 */
export type WorkspaceAccessRestricted = WorkspaceAccessCommon | { kind: "ok"; project: DirectoryProject; role: MembershipRole };

/** 默认/allowPublicRead 调用形态：ok.role 可能是 public-viewer（公开项目非成员只读）。 */
export type WorkspaceAccess = WorkspaceAccessCommon | { kind: "ok"; project: DirectoryProject; role: ViewerRole };

export interface ResolveOpts {
  /** 传入时要求角色 ∈ 集合（如 settings 治理台：仅 owner/maintainer）。 */
  minRoles?: readonly MembershipRole[];
  /** 未传 minRoles 时生效：公开项目允许非成员只读（工作区一般页），角色为 public-viewer。 */
  allowPublicRead?: boolean;
}

/**
 * 工作区鉴权核心。返回值即完成裁剪判定——调用方按 kind 分支渲染，
 * "forbidden"/"not_found"/"unauthenticated" 三态都不得携带项目内部数据。
 *
 * 判定顺序刻意固定：先认证、后查项目是否存在、再查 membership——未登录请求在
 * 触碰任何项目数据前就返回 unauthenticated，防止用 404/401 差异匿名枚举私有项目。
 *
 * 已登录态同理：私有项目上「完全没有 membership 记录」的用户拿到的必须是
 * not_found（而非携带真实 project 的 forbidden），否则 200/403 vs 404 的差异会被
 * 用来枚举私有项目是否存在。已有 membership 记录（任何 status）的用户走 forbidden，
 * 因为他们已合法知道项目存在。
 */
export async function resolveWorkspaceAccess(
  slug: string,
  headers: Headers,
  opts: { minRoles: readonly MembershipRole[] },
): Promise<WorkspaceAccessRestricted>;
export async function resolveWorkspaceAccess(
  slug: string,
  headers: Headers,
  opts?: { allowPublicRead?: boolean },
): Promise<WorkspaceAccess>;
export async function resolveWorkspaceAccess(
  slug: string,
  headers: Headers,
  opts: ResolveOpts = {},
): Promise<WorkspaceAccess> {
  const user = await getSessionUser(headers);
  if (!user) return { kind: "unauthenticated" };

  const project = await findProjectBySlug(slug);
  if (!project) return { kind: "not_found" };

  const engineer = await findEngineerByGithubLogin(user.login);
  const membership = engineer ? await findMembership(project.project_id, engineer.engineer_id) : null;
  const role = membership && membership.status === "active" ? membership.role : null;
  // 私有项目 + 该用户在其上完全没有 membership 记录（无论 engineer 是否存在、无论
  // status）→ 判定「不是当前认可的成员」，且必须与未知 slug 不可区分（not_found），
  // 防止已登录态靠 200/403 vs 404 枚举私有项目存在性。已有记录（哪怕非 active）的
  // 用户走 forbidden——他们已合法知道项目存在，不构成枚举面。
  const noMembershipRecordAtAll = membership === null;
  const isUnrecognizedOnPrivateProject = project.visibility === "private" && noMembershipRecordAtAll;

  if (opts.minRoles) {
    if (role && opts.minRoles.includes(role)) return { kind: "ok", project, role };
    if (isUnrecognizedOnPrivateProject) return { kind: "not_found" };
    return { kind: "forbidden", project, role };
  }

  if (role) return { kind: "ok", project, role };
  if (opts.allowPublicRead && project.visibility === "public") {
    return { kind: "ok", project, role: PUBLIC_VIEWER_ROLE };
  }
  if (isUnrecognizedOnPrivateProject) return { kind: "not_found" };
  return { kind: "forbidden", project, role: null };
}

/** 登录者的真实项目列表（工作区切换器消费，替代 M1 mock 项目集）。 */
export async function listMyProjects(headers: Headers): Promise<MyProjectSummary[]> {
  const user = await getSessionUser(headers);
  if (!user) return [];
  const engineer = await findEngineerByGithubLogin(user.login);
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
