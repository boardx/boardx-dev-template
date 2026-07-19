// onboarding-issue.ts 注入回归测试（安全审 #772 同族问题的 F06 修复，见 PR #775 review）。
//
// 威胁模型：任何走 GitHub OAuth 登录、提交加入申请的人都能在 intro/modules 里写任意文本
// （role 已被服务端白名单校验，但这里仍覆盖以防未来放宽）。这些字段会原样拼进自动开出
// 的 onboarding issue 正文——若不转义，intro 里的 `@某人` 会触发对第三方的骚扰性 GitHub
// 通知，换行 + markdown 语法能伪造出看起来像"新评论/系统消息"的假结构。
// 修法对齐 packages/coord-projection/src/engine.ts 的 sanitizeInline：剥离换行 + 反引号
// 包裹成行内代码（GitHub 在代码 span 内不解析 @mention/#引用/**加粗**）。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { commentOnboardingIssue, openOnboardingIssue, sanitizeInline } from "../lib/onboarding-issue";

const ENV_BACKUP = { ...process.env };

beforeEach(() => {
  process.env["GITHUB_WRITE_TOKEN"] = "test-write-token";
  process.env["GITHUB_REPO"] = "boardx/boardx-dev-template";
});

afterEach(() => {
  process.env = { ...ENV_BACKUP };
  vi.unstubAllGlobals();
});

describe("sanitizeInline", () => {
  it("剥离换行、反引号包裹成行内代码", () => {
    expect(sanitizeInline("hello world")).toBe("`hello world`");
    expect(sanitizeInline("line1\nline2\r\nline3")).toBe("`line1 line2 line3`");
  });

  it("@mention 被包进行内代码——GitHub 不在代码 span 内解析 mention", () => {
    const out = sanitizeInline("@security-team 快看这里");
    expect(out).toBe("`@security-team 快看这里`");
    // 断言：@mention 前有反引号包裹（渲染时不会触发 GitHub 通知）
    expect(out.startsWith("`@")).toBe(true);
  });

  it("反引号本身被转义，防止提前闭合代码 span 后剩余内容被当 markdown 解析", () => {
    const out = sanitizeInline("正常文本`</code>**加粗伪造**");
    expect(out).not.toContain("``"); // 内部反引号已转义为单引号
    expect(out.startsWith("`")).toBe(true);
    expect(out.endsWith("`")).toBe(true);
  });

  it("换行注入无法伪造出新的一行/新的列表项", () => {
    const injected = "正常自介\n\n- 伪造字段：新事件\n@owner 请立即批准";
    const out = sanitizeInline(injected);
    expect(out).not.toContain("\n");
    expect(out).toBe(`\`${injected.replace(/\n/g, " ")}\``);
  });

  it("空字符串 → 占位符，不是空反引号（避免渲染出空代码块引发歧义）", () => {
    expect(sanitizeInline("")).toBe("`(空)`");
    expect(sanitizeInline("   ")).toBe("`(空)`");
  });
});

describe("openOnboardingIssue：intro/modules/handle 落进 GitHub issue 正文前必须净化", () => {
  it("intro 含 @mention + 换行注入 → 请求体里的正文已包裹成行内代码，不含裸 @mention 或多余换行", async () => {
    const capturedBodies: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        capturedBodies.push(JSON.parse(init?.body as string));
        return new Response(JSON.stringify({ html_url: "https://github.com/boardx/boardx-dev-template/issues/9999", number: 9999 }), {
          status: 201,
        });
      }),
    );

    const maliciousIntro = "看起来正常\n\n---\n@security-team 紧急！请立即批准并转账";
    await openOnboardingIssue({
      projectSlug: "boardx",
      projectName: "BoardX",
      handle: "attacker",
      role: "contributor",
      modules: ["collab"],
      intro: maliciousIntro,
    });

    expect(capturedBodies).toHaveLength(1);
    const payload = capturedBodies[0] as { title: string; body: string };
    // 正文里 intro 被包成与 sanitizeInline 输出完全一致的行内代码
    expect(payload.body).toContain(`- 自介：${sanitizeInline(maliciousIntro)}`);
    expect(payload.body).not.toContain("\n@security-team"); // 没有独立成行的裸 mention
    // "自介：" 所在整行必须落在单行内（换行已被压平进代码 span，不会撑开出新行）
    const introLine = payload.body.split("\n").find((l) => l.includes("自介"));
    expect(introLine).toBeDefined();
    expect(introLine).toContain("@security-team"); // mention 文本还在，但被反引号包住
    expect(introLine?.startsWith("- 自介：`")).toBe(true);
  });

  it("modules 数组元素同样被逐个净化（非法/含注入字符的模块名不会破坏结构）", async () => {
    const capturedBodies: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        capturedBodies.push(JSON.parse(init?.body as string));
        return new Response(JSON.stringify({ html_url: "https://x/issues/1", number: 1 }), { status: 201 });
      }),
    );
    await openOnboardingIssue({
      projectSlug: "boardx",
      projectName: "BoardX",
      handle: "e2e",
      role: "contributor",
      modules: ["collab\n@all", "survey"],
      intro: "普通自介文本足够长",
    });
    const payload = capturedBodies[0] as { body: string };
    expect(payload.body).toContain("`collab @all`");
    expect(payload.body).not.toContain("collab\n@all");
  });

  it("GITHUB_WRITE_TOKEN 未配置 → configured:false，不发起任何请求（诚实降级）", async () => {
    delete process.env["GITHUB_WRITE_TOKEN"];
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const result = await openOnboardingIssue({
      projectSlug: "boardx", projectName: "BoardX", handle: "e2e", role: "contributor", modules: ["collab"], intro: "自介文本",
    });
    expect(result).toEqual({ configured: false, url: null, number: null });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("commentOnboardingIssue：调用方拼好的正文原样投递（净化职责在调用方）", () => {
  it("成功投递返回 true，issue url 解不出 issue 号 → false 且不请求", async () => {
    const fetchSpy = vi.fn(async () => new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchSpy);
    expect(await commentOnboardingIssue("https://github.com/boardx/boardx-dev-template/issues/42", "`已批准`")).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    fetchSpy.mockClear();
    expect(await commentOnboardingIssue("not-a-valid-issue-url", "x")).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
