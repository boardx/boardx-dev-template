// 应用层（F06）：把引擎产出的调用描述真正发到 GitHub REST。
// 单条失败只记 console.error 不中断整批——投影是最终一致对账，
// 下一 tick 会再补投，绝不因一个坏 sha 卡住游标推进。
import type { GithubCall } from "./engine";

export interface ApplyOptions {
  owner: string;
  repo: string;
  token: string; // installation token（github-app.ts 产出）
  calls: GithubCall[];
  fetchImpl?: typeof fetch;
  apiBase?: string;
}

export interface ApplyResult {
  applied: number;
  failed: number;
}

export async function applyCalls(opts: ApplyOptions): Promise<ApplyResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const apiBase = opts.apiBase ?? "https://api.github.com";
  const repoBase = `${apiBase}/repos/${opts.owner}/${opts.repo}`;
  let applied = 0;
  let failed = 0;

  for (const call of opts.calls) {
    const [url, body] =
      call.kind === "commit_status"
        ? [
            `${repoBase}/statuses/${call.sha}`,
            { state: call.state, context: call.context, description: call.description },
          ]
        : [
            `${repoBase}/check-runs`,
            {
              name: call.name,
              head_sha: call.head_sha,
              status: "completed",
              conclusion: call.conclusion,
              output: { title: call.title, summary: call.summary },
            },
          ];
    try {
      const res = await fetchImpl(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${opts.token}`,
          accept: "application/vnd.github+json",
          "content-type": "application/json",
          "user-agent": "coord-projection",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`github_api_${res.status}`);
      applied++;
    } catch (e) {
      failed++;
      console.error(`[coord-projection] apply 失败（继续整批）: POST ${url}`, e);
    }
  }
  return { applied, failed };
}
