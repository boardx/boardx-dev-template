// 仓库文件读取层 — 替代产品面 API 里的 node:fs（#523 Track A：Workers 无文件系统）。
// 数据源 = GitHub Contents API（GITHUB_TOKEN 为 Pages secret，GITHUB_REPO 如
// boardx/boardx-dev-template）。registry/feature_list 的权威仍是 git 仓库——本层只是
// 换了读取通道，不改变"仓库即唯一事实来源"；ADR-011 P1 落地后 registry 读取切 D1 快照。
// 全部失败软降级（返回 null/[]），由各 API 路由按各自的 configured/degraded 语义呈现。

const UPSTREAM_TIMEOUT_MS = 8_000;

function ghEnv(): { repo: string; token: string } | null {
  const repo = process.env["GITHUB_REPO"];
  const token = process.env["GITHUB_TOKEN"];
  if (!repo || !token) return null;
  return { repo, token };
}

function ghHeaders(token: string, raw: boolean): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: raw ? "application/vnd.github.raw+json" : "application/vnd.github+json",
    "User-Agent": "boardx-devportal",
  };
}

/** 读仓库单文件（main 分支）原文；未配置/不存在/失败 → null。 */
export async function readRepoFile(path: string): Promise<string | null> {
  const env = ghEnv();
  if (!env) return null;
  try {
    const res = await fetch(`https://api.github.com/repos/${env.repo}/contents/${path}?ref=main`, {
      headers: ghHeaders(env.token, true),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** 列目录下的子目录名；未配置/失败 → []。 */
export async function listRepoDirs(path: string): Promise<string[]> {
  const env = ghEnv();
  if (!env) return [];
  try {
    const res = await fetch(`https://api.github.com/repos/${env.repo}/contents/${path}?ref=main`, {
      headers: ghHeaders(env.token, false),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) return [];
    const entries = (await res.json()) as Array<{ name: string; type: string }>;
    return entries.filter((e) => e.type === "dir").map((e) => e.name);
  } catch {
    return [];
  }
}

export function githubConfigured(): boolean {
  return ghEnv() !== null;
}
