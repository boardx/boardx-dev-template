// p30-F06 e2e：P2 join 向导 + W6 审批队列接真的可见行为（批次 2 testid）。
// 本地 playwright 只起 next dev（无 coord-gateway 后端），COORD_GATEWAY_URL/COORD_API_TOKEN/
// COORD_GATEWAY_ADMIN_TOKEN 均未配置——这恰好覆盖「诚实降级」契约：未登录/未配置态必须
// 如实提示，不能假装能工作。真正打活体 coord-gateway 的状态机/SLA 断言见
// phases/phase-p30-devportal-platform/scripts/verify-join-flow.sh（本地 wrangler dev 已验证 PASS）
// 与 packages/coord-directory/test/directory.test.ts。
//
// 本地跑法：pnpm --filter devportal exec playwright test e2e/p30/join-approve.spec.ts
import { expect, test } from "@playwright/test";
import { SignJWT } from "jose";
import { E2E_SESSION_SECRET } from "../../playwright.config";

const remote = Boolean(process.env["DEVPORTAL_E2E_BASE_URL"]);

async function mintSessionCookie(login: string): Promise<string> {
  return new SignJWT({ email: `${login}@example.com`, name: login, avatarUrl: null })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(login)
    .setIssuer("devportal")
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
    .sign(new TextEncoder().encode(E2E_SESSION_SECRET));
}

test.describe("P2 join 向导（UC-04）", () => {
  test("未登录：join-cta 打开向导，step1 显示真实 GitHub 登录链接（非 mock 按钮）", async ({ page }) => {
    await page.goto("/projects/boardx");
    await page.locator("[data-testid=join-cta]").click();
    await expect(page.locator("[data-testid=join-wizard]")).toBeVisible();
    await expect(page.locator("[data-testid=join-step-1]")).toBeVisible();

    const login = page.locator("[data-testid=join-github-login]");
    await expect(login).toBeVisible();
    const href = await login.getAttribute("href");
    expect(href).toContain("/api/coord/oauth/github/login");
    expect(href).toContain("return_to=");

    // 未登录时「下一步」必须禁用——不能绕过身份直接进角色选择
    await expect(page.locator("[data-testid=join-next-1]")).toBeDisabled();
  });

  test("已登录 + 目录未配置：如实显示「已登录」与「目录服务未接入」，不假装能提交", async ({ browser, baseURL }) => {
    test.skip(remote, "远端 SESSION_SECRET 不可知，mock 会话仅本地可验");
    const context = await browser.newContext({ baseURL });
    await context.addCookies([
      { name: "devportal_session", value: await mintSessionCookie("e2e-joiner"), url: baseURL as string, httpOnly: true, sameSite: "Lax" },
    ]);
    const page = await context.newPage();
    await page.goto("/projects/boardx");
    await page.locator("[data-testid=join-cta]").click();
    await expect(page.locator("[data-testid=join-step-1]")).toBeVisible();

    // 真实登录态：显示 @e2e-joiner（服务端 session 解出的 login，非 mock「new-engineer」）
    await expect(page.locator("[data-testid=join-step-1]")).toContainText("@e2e-joiner");
    await expect(page.locator("[data-testid=join-directory-not-configured]")).toBeVisible();
    await expect(page.locator("[data-testid=join-next-1]")).toBeEnabled();

    await page.locator("[data-testid=join-next-1]").click();
    await expect(page.locator("[data-testid=join-step-2]")).toBeVisible();
    await page.locator("[data-testid=join-module-collab]").click();
    await page.locator("#join-intro").fill("e2e 自动化验证加入向导的诚实降级路径");
    await page.locator("[data-testid=join-submit]").click();

    // 目录未配置 → 服务端 503，前端如实报错而非假装 pending
    await expect(page.locator("[data-testid=join-submit-error]")).toBeVisible();
    await context.close();
  });

  test("表单校验：模块未选 / 自介太短 → 行内错误提示，不允许提交", async ({ browser, baseURL }) => {
    test.skip(remote, "远端 SESSION_SECRET 不可知，mock 会话仅本地可验");
    const context = await browser.newContext({ baseURL });
    await context.addCookies([
      { name: "devportal_session", value: await mintSessionCookie("e2e-joiner-2"), url: baseURL as string, httpOnly: true, sameSite: "Lax" },
    ]);
    const page = await context.newPage();
    await page.goto("/projects/boardx");
    await page.locator("[data-testid=join-cta]").click();
    await page.locator("[data-testid=join-next-1]").click();
    await page.locator("[data-testid=join-submit]").click();
    await expect(page.locator("[data-testid=err-join-modules]")).toBeVisible();
    await expect(page.locator("[data-testid=err-join-intro]")).toBeVisible();
    await context.close();
  });
});

test.describe("W6 审批队列（owner 视角）", () => {
  test("未登录访问治理台被中间件挡（302/401，工作区要求会话）", async ({ request }) => {
    const response = await request.get("/p/boardx/settings", { maxRedirects: 0 });
    expect([301, 302, 401]).toContain(response.status());
  });

  test("已登录 + 目录未配置：审批队列如实报「未接入」，不展示假数据", async ({ browser, baseURL }) => {
    test.skip(remote, "远端 SESSION_SECRET 不可知，mock 会话仅本地可验");
    const context = await browser.newContext({ baseURL });
    await context.addCookies([
      { name: "devportal_session", value: await mintSessionCookie("e2e-owner"), url: baseURL as string, httpOnly: true, sameSite: "Lax" },
    ]);
    const page = await context.newPage();
    const response = await page.goto("/p/boardx/settings");
    expect(response?.status()).toBe(200);
    await expect(page.locator("[data-testid=governance-console]")).toBeVisible();
    await expect(page.locator("[data-testid=approval-error]")).toBeVisible();
    await expect(page.locator("[data-testid=approval-error]")).toContainText("目录服务尚未在本环境接入");
    await context.close();
  });
});
