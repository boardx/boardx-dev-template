// onboarding-issue.ts — 加入申请的 GitHub 双写（p30/F06，UC-04，需求 N5）。
//
// GITHUB_TOKEN（现有 Pages secret）是**细粒度只读 PAT**（见 wrangler.toml 头注），
// 不能开 issue。开 issue 需要写权限，走**新增的可选 secret GITHUB_WRITE_TOKEN**
// （`wrangler pages secret put GITHUB_WRITE_TOKEN --project-name devportal`）。
// 未配置时——不假装能工作：跳过双写，membership 仍正常进 pending（issue 双写是
// 跟踪型附加动作，不是 join 流程的阻塞前提），响应里如实标注 issue: null。
export interface OnboardingIssueResult {
  configured: boolean;
  url: string | null;
  number: number | null;
}

function writeToken(): string | null {
  return process.env["GITHUB_WRITE_TOKEN"] ?? null;
}

const UPSTREAM_TIMEOUT_MS = 8_000;

/** 开一条 onboarding issue（服务端最佳努力，失败不抛——调用方按 configured/url 判定）。 */
export async function openOnboardingIssue(input: {
  projectSlug: string;
  projectName: string;
  handle: string;
  role: string;
  modules: string[];
  intro: string;
}): Promise<OnboardingIssueResult> {
  const token = writeToken();
  const repo = process.env["GITHUB_REPO"];
  if (!token || !repo) return { configured: false, url: null, number: null };

  const body = [
    `**加入申请**：@${input.handle} 申请加入项目 \`${input.projectSlug}\`（${input.projectName}）`,
    "",
    `- 角色：${input.role}`,
    `- 感兴趣的模块：${input.modules.join(", ") || "（未选）"}`,
    `- 自介：${input.intro || "（无）"}`,
    "",
    "此 issue 用于跟踪加入审批全过程（审批 SLA / 批准或驳回 / onboarding 进度），由 devportal 自动开出（N5 双写）。",
  ].join("\n");

  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "content-type": "application/json",
        "User-Agent": "boardx-devportal",
      },
      body: JSON.stringify({
        title: `[onboarding] @${input.handle} 申请加入 ${input.projectSlug}`,
        body,
        labels: ["onboarding", `project:${input.projectSlug}`],
      }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (!res.ok) return { configured: true, url: null, number: null };
    const created = (await res.json()) as { html_url: string; number: number };
    return { configured: true, url: created.html_url, number: created.number };
  } catch {
    return { configured: true, url: null, number: null };
  }
}

/** 审批结果回写 onboarding issue 评论（最佳努力，失败静默——不阻断审批本身）。 */
export async function commentOnboardingIssue(issueUrl: string, body: string): Promise<boolean> {
  const token = writeToken();
  const repo = process.env["GITHUB_REPO"];
  if (!token || !repo) return false;
  const match = /\/issues\/(\d+)/.exec(issueUrl);
  if (!match) return false;
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/issues/${match[1]}/comments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "content-type": "application/json",
        "User-Agent": "boardx-devportal",
      },
      body: JSON.stringify({ body }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}
