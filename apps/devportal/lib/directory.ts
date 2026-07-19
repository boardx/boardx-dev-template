// directory.ts — 门户服务端读写 PlatformDirectory（p30/F06，UC-04 加入审批流）。
//
// 与 coord-gateway.ts（RepoHub 按仓读面）并列：这里代理的是平台单例目录
// （coord-gateway 的 /api/coord/directory/*，见 apps/coord-gateway/src/directory.ts）。
// 读面用 COORD_API_TOKEN（ops 万能钥匙，与 coordination/my-home 同一把）；
// 写面（申请加入 / 批准 / 驳回）是身份与授权类动作，必须用 COORD_GATEWAY_ADMIN_TOKEN
// （gateway 侧 requireAdmin，fail-closed）——浏览器永远不持有它，全部服务端代理。
//
// 诚实三态（ADR-006）：未配置 → configured:false；已配置但打不通 → configured:true+error。

const UPSTREAM_TIMEOUT_MS = 8_000;

export interface DirectoryProject {
  project_id: string;
  slug: string;
  name: string;
  visibility: string;
  modules: string[];
  sla: { promiseH?: number; [k: string]: unknown };
  gate_policy: Record<string, unknown>;
}

export interface DirectoryEngineer {
  engineer_id: string;
  handle: string;
  display_name: string;
  github_login: string | null;
}

export interface DirectorySla {
  deadline: string;
  hoursLeft: number;
  timedOut: boolean;
  urgent: boolean;
}

export interface DirectoryMembership {
  membership_id: string;
  project_id: string;
  engineer_id: string;
  role: string;
  status: string;
  modules: string[];
  intro: string;
  onboarding_issue_url: string | null;
  created_at: string;
  updated_at: string;
  project_slug?: string;
  engineer_handle?: string;
  sla?: DirectorySla | null;
}

function readBase(): string | null {
  const url = process.env["COORD_GATEWAY_URL"];
  if (!url) return null;
  return `${url.replace(/\/+$/, "")}/api/coord/directory`;
}

function readToken(): string | null {
  return process.env["COORD_API_TOKEN"] ?? null;
}

function writeToken(): string | null {
  return process.env["COORD_GATEWAY_ADMIN_TOKEN"] ?? null;
}

export function directoryReadConfigured(): boolean {
  return Boolean(readBase() && readToken());
}

export function directoryWriteConfigured(): boolean {
  return Boolean(readBase() && writeToken());
}

async function readCall<T>(path: string): Promise<{ ok: true; body: T } | { ok: false; status: number; error?: string }> {
  const base = readBase();
  const token = readToken();
  if (!base || !token) return { ok: false, status: 0, error: "not_configured" };
  try {
    const res = await fetch(`${base}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, body: (await res.json()) as T };
  } catch {
    return { ok: false, status: 0, error: "unreachable" };
  }
}

async function writeCall<T>(
  path: string,
  body: unknown,
): Promise<{ ok: true; status: number; body: T } | { ok: false; status: number; error?: string }> {
  const base = readBase();
  const token = writeToken();
  if (!base || !token) return { ok: false, status: 0, error: "not_configured" };
  try {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      cache: "no-store",
    });
    const parsed = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) return { ok: false, status: res.status, error: (parsed as { error?: string }).error };
    return { ok: true, status: res.status, body: parsed };
  } catch {
    return { ok: false, status: 0, error: "unreachable" };
  }
}

export async function findProjectBySlug(slug: string): Promise<DirectoryProject | null> {
  const r = await readCall<{ projects: DirectoryProject[] }>("/projects");
  if (!r.ok) return null;
  return r.body.projects.find((p) => p.slug === slug) ?? null;
}

export async function listProjectMemberships(slug: string): Promise<DirectoryMembership[] | null> {
  const r = await readCall<{ memberships: DirectoryMembership[] }>("/memberships");
  if (!r.ok) return null;
  return r.body.memberships.filter((m) => m.project_slug === slug);
}

/** upsert engineer by GitHub 身份（handle 用小写 login，一律真身份，不接受调用方自报 handle）。 */
export async function upsertEngineerFromSession(login: string, displayName: string | null): Promise<
  { ok: true; engineer: DirectoryEngineer } | { ok: false; status: number; error?: string }
> {
  const handle = login.toLowerCase();
  const r = await writeCall<{ engineer: DirectoryEngineer }>("/engineers", {
    handle,
    display_name: displayName ?? login,
    github_login: login,
    actor: `devportal:${login}`,
  });
  if (!r.ok) return r;
  return { ok: true, engineer: r.body.engineer };
}

export async function requestMembership(input: {
  project: string;
  engineer: string;
  role: string;
  modules: string[];
  intro: string;
  onboardingIssueUrl: string | null;
  actor: string;
}): Promise<{ ok: true; status: number; membership: DirectoryMembership } | { ok: false; status: number; error?: string }> {
  const r = await writeCall<{ membership: DirectoryMembership }>("/memberships", {
    project: input.project,
    engineer: input.engineer,
    role: input.role,
    modules: input.modules,
    intro: input.intro,
    onboarding_issue_url: input.onboardingIssueUrl,
    actor: input.actor,
  });
  if (!r.ok) return r;
  return { ok: true, status: r.status, membership: r.body.membership };
}

export async function transitionMembership(
  membershipId: string,
  action: "approve" | "reject" | "suspend" | "reinstate",
  actor: string,
): Promise<{ ok: true; membership: DirectoryMembership } | { ok: false; status: number; error?: string }> {
  const r = await writeCall<{ membership: DirectoryMembership }>(`/memberships/${membershipId}/transition`, {
    action,
    actor,
  });
  if (!r.ok) return r;
  return { ok: true, membership: r.body.membership };
}

export async function getMembershipSla(
  membershipId: string,
): Promise<{ membership_id: string; status: string; sla: DirectorySla | null } | null> {
  const r = await readCall<{ membership_id: string; status: string; sla: DirectorySla | null }>(
    `/memberships/${membershipId}/sla`,
  );
  if (!r.ok) return null;
  return r.body;
}
