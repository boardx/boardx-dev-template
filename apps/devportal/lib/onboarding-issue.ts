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

// 加入申请的每个自由文本字段（intro 尤其——任何走 GitHub OAuth 登录的人都能填）在拼进
// GitHub issue 正文前一律经 sanitizeInline：否则换行 + markdown 语法能伪造出看起来像
// "新评论/系统消息"的假结构，@mention/#issue 引用还会触发对任意第三方的真实 GitHub 通知
// ——与 p30/F09 独立安全审 #772 阻断的 GitHub 双写注入同一族问题、同款修法（剥离换行 +
// 反引号包裹成行内代码，GitHub 在代码 span 内不解析 @mention/#引用/**加粗** 等
// markdown，从根上失效）；同类实现另见 #772 分支的 packages/coord-projection/src/
// engine.ts（该 PR 尚未合并进 main，两处各自独立维护同一套手法，非共享调用）。
// role/modules 在调用方（app/api/portal/join/route.ts）已做白名单校验，这里仍统一过一遍
// 是防御纵深，不依赖上游校验不漏。
function sanitizeInline(v: string): string {
  const collapsed = v.replace(/\r\n|\r|\n/g, " ").trim();
  const escaped = collapsed.replace(/`/g, "'");
  return escaped.length > 0 ? `\`${escaped}\`` : "`(空)`";
}

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

  const handle = sanitizeInline(input.handle);
  const projectSlug = sanitizeInline(input.projectSlug);
  const body = [
    `**加入申请**：@${handle} 申请加入项目 ${projectSlug}（${sanitizeInline(input.projectName)}）`,
    "",
    `- 角色：${sanitizeInline(input.role)}`,
    `- 感兴趣的模块：${input.modules.length > 0 ? input.modules.map(sanitizeInline).join(", ") : "（未选）"}`,
    `- 自介：${input.intro ? sanitizeInline(input.intro) : "（无）"}`,
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
        // title 是纯文本字段（GitHub 不对 issue 标题做 markdown/mention 解析），仍剥离换行防多行标题
        title: `[onboarding] @${input.handle.replace(/\r\n|\r|\n/g, " ").trim()} 申请加入 ${input.projectSlug}`,
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

/** 审批结果回写 onboarding issue 评论（最佳努力，失败静默——不阻断审批本身）。
 *  body 由调用方拼好（含审批人 @handle），调用方需自行对自由文本字段过 sanitizeInline
 *  ——本函数只负责投递，不重复解析调用方已经处理好的字符串。 */
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

/** 导出给调用方（approvals/[id]/route.ts 拼审批评论时）复用同一份 sanitizeInline，
 *  避免各处各写一份、标准不一致。 */
export { sanitizeInline };
