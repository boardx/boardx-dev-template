import type { Env } from "../db/types";

const GITHUB_API = "https://api.github.com";

function parseRepo(env: Env): { owner: string; repo: string } | null {
  if (!env.GITHUB_REPO) return null;
  const parts = env.GITHUB_REPO.split("/");
  const owner = parts[0];
  const repo = parts[1];
  if (!owner || !repo) return null;
  return { owner, repo };
}

export function isGithubConfigured(env: Env): boolean {
  return Boolean(env.GITHUB_TOKEN && parseRepo(env));
}

async function githubFetch(env: Env, path: string, init: RequestInit): Promise<Response> {
  if (!env.GITHUB_TOKEN) throw new Error("github_token_not_configured");
  return fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "coord-service-projector",
      "Content-Type": "application/json",
    },
  });
}

/** Posts a comment — this is the surface the projector uses for claim/release/
 *  expire/verdict transitions (matching the `claimed-by:<id> at <ISO8601>`
 *  convention already documented in multi-agent-coordination.md §4). Comments,
 *  not labels, to avoid ever touching sync-github.ts's label surface. */
export async function postIssueComment(env: Env, issueNumber: number, body: string): Promise<void> {
  const repo = parseRepo(env);
  if (!repo) throw new Error("github_repo_not_configured");
  const res = await githubFetch(env, `/repos/${repo.owner}/${repo.repo}/issues/${issueNumber}/comments`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
  if (!res.ok) throw new Error(`github_comment_failed:${res.status}`);
}

/** The one label this projector is allowed to own — sync-github.ts's
 *  status_actions never emits `agent:*` (confirmed by reading github-sync.yaml). */
export async function addAgentLabel(env: Env, issueNumber: number, agentId: string): Promise<void> {
  const repo = parseRepo(env);
  if (!repo) throw new Error("github_repo_not_configured");
  const res = await githubFetch(env, `/repos/${repo.owner}/${repo.repo}/issues/${issueNumber}/labels`, {
    method: "POST",
    body: JSON.stringify({ labels: [`agent:${agentId}`] }),
  });
  if (!res.ok) throw new Error(`github_add_label_failed:${res.status}`);
}
