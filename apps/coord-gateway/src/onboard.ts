// GitHub App 多仓安装流（p30/F05，UC-01）：/onboard 接真。
// 独立成文件是刻意的——index.ts 只加路由，降低与并行改动的冲突面（同 directory.ts/mcp.ts 纪律）。
//
// 三块职责：
//   1. 安装即注册：installation(created)/installation_repositories(added) webhook
//      → 直调 PlatformDirectory（同 worker 内 stub.fetch，不经 REST 鉴权层——写路径
//      仅这一条特例，因为触发源已由 webhook 签名校验过，等价于 gateway 自己的内部调用）。
//   2. GitHub API façade（installation 视角）：list repos / collaborator permission /
//      CODEOWNERS·CONTRIBUTING 存在性 / 分支保护——全部复用 coord-projection 的
//      GitHubAppAuth（installationTokenById/getInstallation），不引入新长期密钥。
//   3. REST 面：GET /api/coord/onboard/installations/:id、GET /api/coord/onboard/checkup、
//      POST /api/coord/onboard/finalize——ops token 门（同目录读面口径，devportal 服务端持有）。
import { createGitHubAppAuth, type GitHubAppAuth } from "@repo/coord-projection";
import type { Env } from "./index";
import { timingSafeEqualStr } from "./auth";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

// ---------- 项目注册（安装即租户，webhook 触发） ----------

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,62}$/;

/** repo 短名 → 目录 slug：小写化、非法字符折叠为 "-"，两端裁剪，兜底 "repo"。 */
export function deriveSlug(repoName: string): string {
  const cleaned = repoName
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const candidate = cleaned.length > 0 ? cleaned : "repo";
  const padded = candidate.length < 2 ? `${candidate}0` : candidate;
  return padded.slice(0, 63);
}

export interface InstalledRepo {
  full_name: string;
  name: string;
  private: boolean;
}

function directoryStub(env: Env): DurableObjectStub {
  return env.DIRECTORY.get(env.DIRECTORY.idFromName("platform"));
}

/** 单仓注册：POST /directory/projects（内部直调，幂等——slug 已占用视为「已注册」非错误）。 */
async function registerProject(env: Env, repo: InstalledRepo): Promise<{ slug: string; registered: boolean }> {
  const slug = deriveSlug(repo.name);
  const res = await directoryStub(env).fetch("https://directory/directory/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      slug,
      name: repo.full_name,
      visibility: repo.private ? "private" : "public",
      actor: "github-app-install",
    }),
  });
  if (res.status === 201) return { slug, registered: true };
  if (res.status === 409) return { slug, registered: false }; // 已在册：幂等，不视为失败
  throw new Error(`directory_register_failed_${res.status}`);
}

/** installation(created) 与 installation_repositories(added) 的 repos 抽取（两种事件形状不同）。 */
export function reposFromInstallationPayload(event: string, payload: Record<string, unknown>): InstalledRepo[] {
  const list =
    event === "installation"
      ? (payload["repositories"] as unknown[] | undefined)
      : (payload["repositories_added"] as unknown[] | undefined);
  if (!Array.isArray(list)) return [];
  return list
    .map((r) => r as Record<string, unknown>)
    .filter((r) => typeof r["full_name"] === "string" && typeof r["name"] === "string")
    .map((r) => ({
      full_name: r["full_name"] as string,
      name: r["name"] as string,
      private: r["private"] === true,
    }));
}

/** installation 相关 webhook 的处理入口：安装即注册为租户。非 created/added 动作只 ack 不处理。 */
export async function handleInstallationWebhook(
  env: Env,
  event: string,
  payload: Record<string, unknown>,
): Promise<{ ok: true; registered: { slug: string; registered: boolean }[] }> {
  const action = payload["action"];
  const applicable =
    (event === "installation" && action === "created") ||
    (event === "installation_repositories" && action === "added");
  if (!applicable) return { ok: true, registered: [] };
  const repos = reposFromInstallationPayload(event, payload);
  const registered: { slug: string; registered: boolean }[] = [];
  for (const repo of repos) registered.push(await registerProject(env, repo));
  return { ok: true, registered };
}

// ---------- GitHub API façade（installation 视角，复用 coord-projection 认证栈） ----------

// fetchImpl 可注入（测试用 mock，不打真 GitHub；生产路径省略即用全局 fetch）。
function githubAuth(env: Env, fetchImpl?: typeof fetch): GitHubAppAuth | null {
  if (!env.GITHUB_APP_ID || !env.GITHUB_APP_PRIVATE_KEY) return null;
  return createGitHubAppAuth({ appId: env.GITHUB_APP_ID, privateKey: env.GITHUB_APP_PRIVATE_KEY, fetchImpl });
}

async function ghGet(token: string, path: string, fetchImpl: typeof fetch = fetch): Promise<Response> {
  return fetchImpl(`https://api.github.com${path}`, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "user-agent": "coord-gateway-onboard",
    },
  });
}

export interface OnboardRepo {
  full_name: string;
  owner: string;
  name: string;
  slug: string;
  description: string | null;
  language: string | null;
  private: boolean;
  default_branch: string;
  is_admin: boolean;
}

/** collaborator permission 查询的单一出口（授权门禁与 UI admin 徽章共用同一次真相）。
 *  返回 GitHub 的 permission 字符串（"admin"|"write"|"read"|"none"...）；查不到
 *  （403/404，App 权限不足或请求者根本不是协作者）一律按 null 处理——保守拒绝，
 *  不假定任何默认权限（IDOR 修复：#776 review，2026-07-19）。 */
export async function collaboratorPermission(
  token: string,
  owner: string,
  repo: string,
  login: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  const res = await ghGet(token, `/repos/${owner}/${repo}/collaborators/${login}/permission`, fetchImpl);
  if (!res.ok) return null;
  const body = (await res.json()) as { permission?: string };
  return body.permission ?? null;
}

/** installation 下真实仓库列表，且**只返回请求者有真实 collaborator 关系的仓库**
 *  （权限查不到/查到 "none" 的仓库整条剔除，不下发任何元数据——修复跨租户 IDOR：
 *  任意登录用户曾能枚举 installation_id 拿到其他账户全部私有仓库 full_name/
 *  description/language，#776 review）。admin 徽章沿用同一次权限查询结果，
 *  非 admin 仓仍会出现在列表里（disabled 供 UI 展示"我是协作者但不是 admin"），
 *  但零关系的仓库彻底不可见。 */
export async function listInstallationRepos(
  auth: GitHubAppAuth,
  installationId: number,
  login: string,
  fetchImpl: typeof fetch = fetch,
): Promise<OnboardRepo[]> {
  const token = await auth.installationTokenById(installationId);
  const res = await ghGet(token, "/installation/repositories?per_page=100", fetchImpl);
  if (!res.ok) throw new Error(`github_list_repos_${res.status}`);
  const body = (await res.json()) as { repositories?: Record<string, unknown>[] };
  const repos = body.repositories ?? [];
  const withPermission = await Promise.all(
    repos.map(async (r) => {
      const fullName = r["full_name"] as string;
      const [owner, name] = fullName.split("/") as [string, string];
      const permission = await collaboratorPermission(token, owner, name, login, fetchImpl);
      return { r, fullName, owner, name, permission };
    }),
  );
  return withPermission
    .filter(({ permission }) => permission !== null && permission !== "none")
    .map(({ r, fullName, owner, name, permission }): OnboardRepo => ({
      full_name: fullName,
      owner,
      name,
      slug: deriveSlug(name),
      description: typeof r["description"] === "string" ? (r["description"] as string) : null,
      language: typeof r["language"] === "string" ? (r["language"] as string) : null,
      private: r["private"] === true,
      default_branch: typeof r["default_branch"] === "string" ? (r["default_branch"] as string) : "main",
      is_admin: permission === "admin",
    }));
}

// ---------- 自动体检（真实四项：webhook / 镜像种子 / CODEOWNERS·CONTRIBUTING / 分支保护） ----------

export type CheckupResult = "ok" | "warn";
export interface CheckupItem {
  id: string;
  label: string;
  result: CheckupResult;
  detail: string;
  remedy?: string;
}

async function checkWebhook(env: Env): Promise<CheckupItem> {
  const configured = Boolean(env.GITHUB_WEBHOOK_SECRET);
  return {
    id: "webhook",
    label: "webhook 连通",
    result: configured ? "ok" : "warn",
    detail: configured ? "GITHUB_WEBHOOK_SECRET 已配置，签名校验通道就绪" : "webhook secret 未配置，事件无法验签接收",
    ...(configured ? {} : { remedy: "在 coord-gateway 配置 GITHUB_WEBHOOK_SECRET（wrangler secret put）" }),
  };
}

async function checkMirrorSeed(env: Env, repo: string): Promise<CheckupItem> {
  const stub = env.REPOHUB.get(env.REPOHUB.idFromName(repo));
  const [issuesRes, prsRes] = await Promise.all([
    stub.fetch("https://repohub/realtime/issues"),
    stub.fetch("https://repohub/realtime/prs"),
  ]);
  const issues = issuesRes.ok ? ((await issuesRes.json()) as { items?: unknown[] }).items ?? [] : [];
  const prs = prsRes.ok ? ((await prsRes.json()) as { items?: unknown[] }).items ?? [] : [];
  const total = issues.length + prs.length;
  return {
    id: "mirror-seed",
    label: "issues · PR 镜像种子",
    result: total > 0 ? "ok" : "warn",
    detail:
      total > 0
        ? `已灌入 ${issues.length} 条 issues + ${prs.length} 条 PR`
        : "尚未收到镜像事件——首次 webhook 投递前属正常中间态",
    ...(total > 0 ? {} : { remedy: "确认 App webhook 已订阅 issues/pull_request 事件，或等待首次事件到达" }),
  };
}

async function contentsExists(token: string, owner: string, repo: string, path: string, fetchImpl: typeof fetch): Promise<boolean> {
  const res = await ghGet(token, `/repos/${owner}/${repo}/contents/${path}`, fetchImpl);
  return res.ok;
}

async function checkModulesInit(token: string, owner: string, repo: string, fetchImpl: typeof fetch): Promise<CheckupItem> {
  const [codeowners, codeownersGithub, contributing] = await Promise.all([
    contentsExists(token, owner, repo, "CODEOWNERS", fetchImpl),
    contentsExists(token, owner, repo, ".github/CODEOWNERS", fetchImpl),
    contentsExists(token, owner, repo, "CONTRIBUTING.md", fetchImpl),
  ]);
  const hasCodeowners = codeowners || codeownersGithub;
  const ok = hasCodeowners && contributing;
  const missing = [!hasCodeowners && "CODEOWNERS", !contributing && "CONTRIBUTING.md"].filter(Boolean).join(" / ");
  return {
    id: "modules-init",
    label: "CODEOWNERS · CONTRIBUTING 模块划分初始化",
    result: ok ? "ok" : "warn",
    detail: ok ? "CODEOWNERS 与 CONTRIBUTING.md 均已找到" : `未找到 ${missing}——模块划分暂以顶层目录代替`,
    ...(ok ? {} : { remedy: "稍后在治理台补：settings → 模块划分，补文件后自动重扫" }),
  };
}

async function checkBranchProtection(token: string, owner: string, repo: string, defaultBranch: string, fetchImpl: typeof fetch): Promise<CheckupItem> {
  const res = await ghGet(token, `/repos/${owner}/${repo}/branches/${defaultBranch}/protection`, fetchImpl);
  if (!res.ok) {
    return {
      id: "branch-protection",
      label: "分支保护检查",
      result: "warn",
      detail: `${defaultBranch} 未开启分支保护——agent PR 将无人工门禁`,
      remedy: "稍后在治理台补：一键生成推荐保护规则（需 repo admin 在 GitHub 确认）",
    };
  }
  const body = (await res.json()) as { required_pull_request_reviews?: unknown };
  const hasReviews = Boolean(body.required_pull_request_reviews);
  return {
    id: "branch-protection",
    label: "分支保护检查",
    result: hasReviews ? "ok" : "warn",
    detail: hasReviews ? `${defaultBranch} 已开启 required reviews` : `${defaultBranch} 已保护但未要求 review`,
    ...(hasReviews ? {} : { remedy: "稍后在治理台补：一键生成推荐保护规则（需 repo admin 在 GitHub 确认）" }),
  };
}

/** 四项真实体检；警告不阻塞（result="warn" 仍然是终态，不是失败）。 */
export async function runCheckup(
  env: Env,
  auth: GitHubAppAuth,
  installationId: number,
  owner: string,
  repo: string,
  defaultBranch: string,
  fetchImpl: typeof fetch = fetch,
): Promise<CheckupItem[]> {
  const token = await auth.installationTokenById(installationId);
  const [webhook, mirrorSeed, modulesInit, branchProtection] = await Promise.all([
    checkWebhook(env),
    checkMirrorSeed(env, `${owner}/${repo}`),
    checkModulesInit(token, owner, repo, fetchImpl),
    checkBranchProtection(token, owner, repo, defaultBranch, fetchImpl),
  ]);
  return [webhook, mirrorSeed, modulesInit, branchProtection];
}

/** 请求者对 owner/repo 是否有 admin 权限——checkup 与 finalize 共用的唯一授权门禁
 *  出口（IDOR 修复，#776 review：此前这两个端点完全不校验发起人与目标仓的归属
 *  关系，任意登录用户可对任意仓触发体检/注册）。非 admin（含查不到关系）一律拒绝。 */
export async function verifyAdminAccess(
  auth: GitHubAppAuth,
  installationId: number,
  owner: string,
  repo: string,
  login: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const token = await auth.installationTokenById(installationId);
  const permission = await collaboratorPermission(token, owner, repo, login, fetchImpl);
  return permission === "admin";
}

// ---------- REST 面：/api/coord/onboard/*（ops token 门，同目录读面口径） ----------

// ops token 门（devportal 服务端持有 COORD_API_TOKEN 代读，同目录读面口径的 ops 万能钥匙一侧；
// 本面不接普通用户/浏览器，故未扩展 scoped token 分支——GitHub API 调用天然只应由服务端发起）。
async function requireOps(req: Request, env: Env): Promise<Response | null> {
  if (!env.COORD_API_TOKEN) return json(503, { error: "api_token_not_configured" });
  const auth = req.headers.get("authorization");
  if (!auth || !auth.startsWith("Bearer ")) return json(401, { error: "unauthorized" });
  const bearer = auth.slice("Bearer ".length);
  if (timingSafeEqualStr(bearer, env.COORD_API_TOKEN)) return null;
  return json(401, { error: "unauthorized" });
}

export async function handleOnboard(req: Request, env: Env, url: URL): Promise<Response> {
  const denied = await requireOps(req, env);
  if (denied) return denied;

  // 先判路由是否存在（未知子路径一律 404，不受 GitHub App 配置态影响）。
  const installationsMatch = url.pathname.match(/^\/api\/coord\/onboard\/installations\/(\d+)$/);
  const isFinalize = req.method === "POST" && url.pathname === "/api/coord/onboard/finalize";
  const isInstallations = req.method === "GET" && Boolean(installationsMatch);
  const isCheckup = req.method === "GET" && url.pathname === "/api/coord/onboard/checkup";
  if (!isFinalize && !isInstallations && !isCheckup) return json(404, { error: "not_found" });

  // 三个端点全部需要 GitHub App 凭据（finalize 也要——注册前必须先核实发起人对该
  // repo 有 admin 权限；此前 finalize 只写目录 DO 未打 GitHub 是 IDOR 根因之一，
  // #776 review）：未配置 fail-closed。
  const auth = githubAuth(env);
  if (!auth) return json(503, { error: "github_app_not_configured" });

  if (isFinalize) {
    const body = (await req.json().catch(() => null)) as
      | { full_name?: string; private?: boolean; installation_id?: number; login?: string }
      | null;
    const fullName = body?.full_name;
    const installationId = body?.installation_id;
    const login = body?.login;
    if (!fullName || !fullName.includes("/")) return json(422, { error: "invalid_full_name" });
    if (!installationId || !login) return json(422, { error: "missing_params", details: ["installation_id/login 必填（服务端权限核验用）"] });
    const [owner, name] = fullName.split("/") as [string, string];
    try {
      const isAdmin = await verifyAdminAccess(auth, installationId, owner, name, login);
      if (!isAdmin) return json(403, { error: "not_admin", detail: `${login} 对 ${fullName} 无 admin 权限` });
    } catch (e) {
      return json(502, { error: "github_unreachable", detail: String(e) });
    }
    try {
      const result = await registerProject(env, { full_name: fullName, name, private: body?.private === true });
      return json(200, { project: result });
    } catch (e) {
      return json(502, { error: "directory_unreachable", detail: String(e) });
    }
  }

  if (isInstallations) {
    const installationId = Number(installationsMatch![1]);
    const login = url.searchParams.get("login");
    // login 必填：没有它就无法核实"请求者与该 installation 有归属关系"，
    // 绝不能退化为返回全部仓库（跨租户 IDOR 根因，#776 review）。
    if (!login) return json(422, { error: "missing_params", details: ["login 必填（服务端权限核验用）"] });
    try {
      const [installation, repos] = await Promise.all([
        auth.getInstallation(installationId),
        listInstallationRepos(auth, installationId, login),
      ]);
      return json(200, {
        installation_id: installationId,
        account: installation.account,
        permissions: Object.entries(installation.permissions).map(([k, v]) => `${k}:${v}`),
        repos,
      });
    } catch (e) {
      return json(502, { error: "github_unreachable", detail: String(e) });
    }
  }

  if (isCheckup) {
    const installationId = Number(url.searchParams.get("installation_id") ?? "");
    const owner = url.searchParams.get("owner");
    const repo = url.searchParams.get("repo");
    const login = url.searchParams.get("login");
    const defaultBranch = url.searchParams.get("default_branch") ?? "main";
    if (!installationId || !owner || !repo || !login)
      return json(422, { error: "missing_params", details: ["installation_id/owner/repo/login 必填"] });
    try {
      const isAdmin = await verifyAdminAccess(auth, installationId, owner, repo, login);
      if (!isAdmin) return json(403, { error: "not_admin", detail: `${login} 对 ${owner}/${repo} 无 admin 权限` });
    } catch (e) {
      return json(502, { error: "github_unreachable", detail: String(e) });
    }
    try {
      const items = await runCheckup(env, auth, installationId, owner, repo, defaultBranch);
      return json(200, { items });
    } catch (e) {
      return json(502, { error: "github_unreachable", detail: String(e) });
    }
  }

  return json(404, { error: "not_found" });
}
