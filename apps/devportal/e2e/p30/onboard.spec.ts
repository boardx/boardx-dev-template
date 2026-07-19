// p30-F05 e2e：/onboard 接真三步向导。
//   1) 未登录 → middleware 302 到 OAuth 登录（保留 return_to=/onboard，同 F02 灰度纪律）。
//   2) 已登录、未安装：真实「跳转 GitHub 安装」链接指向 /api/coord/onboard/install。
//   3) 已登录、installation_id 已带回：安装回执 → 选仓（admin 徽章按真实 is_admin 判定）
//      → 自动体检（四项终态）→ 完成 + 进入工作区。
//
// 本地无法驱动真实 GitHub App 安装（需要真实仓库 + 真实 OAuth 用户），CI 环境同理——
// 后端集成（webhook→目录注册、GitHub API façade、checkup 四项逻辑）由
// apps/coord-gateway/test/onboard.test.ts 用注入 fetch mock 覆盖真实交互细节；
// 本 e2e 覆盖的是 UI 与 devportal API 路由的真实绑定（page.route 只替身 coord-gateway/
// GitHub 这一层网络边界，devportal 自身路由 + React 组件全部真实运行，不 mock React 状态）。
import { expect, test } from "@playwright/test";
import { SignJWT } from "jose";
import { E2E_SESSION_SECRET } from "../../playwright.config";

const remote = Boolean(process.env["DEVPORTAL_E2E_BASE_URL"]);

async function mintSessionCookie(login = "usamshen"): Promise<string> {
  return new SignJWT({ email: `${login}@example.com`, name: "E2E User", avatarUrl: null })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(login)
    .setIssuer("devportal")
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
    .sign(new TextEncoder().encode(E2E_SESSION_SECRET));
}

test("未登录访问 /onboard → 302 到 OAuth 登录，保留 return_to=/onboard", async ({ request }) => {
  const response = await request.get("/onboard", { maxRedirects: 0 });
  expect([301, 302, 401]).toContain(response.status());
  if (response.status() === 302 || response.status() === 301) {
    const location = response.headers()["location"] ?? "";
    expect(location).toContain("/api/coord/oauth/github/login");
    expect(location).toContain("return_to=%2Fonboard");
  }
});

test.describe("已登录（mock session）", () => {
  test.skip(remote, "远端 SESSION_SECRET 不可知，mock 会话仅本地可验（同 auth-gray.spec.ts 纪律）");

  test("步骤①：未带 installation_id → 真实安装链接指向 /api/coord/onboard/install", async ({ browser, baseURL }) => {
    const cookie = await mintSessionCookie();
    const context = await browser.newContext({ baseURL });
    await context.addCookies([{ name: "devportal_session", value: cookie, url: baseURL as string, httpOnly: true, sameSite: "Lax" }]);
    const page = await context.newPage();
    const response = await page.goto("/onboard");
    expect(response?.status()).toBe(200);
    await expect(page.locator("[data-testid=onboard-wizard]")).toBeVisible();
    await expect(page.locator("[data-testid=onboard-step-1]")).toBeVisible();
    const installLink = page.locator("[data-testid=install-github-app]");
    await expect(installLink).toBeVisible();
    await expect(installLink).toHaveAttribute("href", /\/api\/coord\/onboard\/install\?return_to=/);
    await context.close();
  });

  test("步骤①②③：installation 回执真实渲染 → admin 判定真实生效 → 体检四项终态 → 完成", async ({ browser, baseURL }) => {
    const cookie = await mintSessionCookie();
    const context = await browser.newContext({ baseURL });
    await context.addCookies([{ name: "devportal_session", value: cookie, url: baseURL as string, httpOnly: true, sameSite: "Lax" }]);
    const page = await context.newPage();

    // 只替身 coord-gateway 这一层网络边界（真实 GitHub App 安装/API 在本地/CI 均不可达）；
    // devportal 自身路由（/api/coord/onboard/installations/:id 等）与 React 状态全部真实运行。
    await page.route("**/api/coord/onboard/installations/4821", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          configured: true,
          installation: {
            installation_id: 4821,
            account: { login: "usamshen", type: "User" },
            permissions: ["contents:read", "issues:write", "pull_requests:write"],
            repos: [
              { full_name: "usamshen/pixel-forge", owner: "usamshen", name: "pixel-forge", slug: "pixel-forge", description: "渲染引擎", language: "TypeScript", private: false, default_branch: "main", is_admin: true },
              { full_name: "acme-inc/crm-core", owner: "acme-inc", name: "crm-core", slug: "crm-core", description: "CRM 主仓", language: "TypeScript", private: true, default_branch: "main", is_admin: false },
            ],
          },
        }),
      });
    });
    await page.route("**/api/coord/onboard/checkup*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          configured: true,
          items: [
            { id: "webhook", label: "webhook 连通", result: "ok", detail: "签名校验通道就绪" },
            { id: "mirror-seed", label: "issues · PR 镜像种子", result: "ok", detail: "已灌入 12 条 issues + 3 条 PR" },
            { id: "modules-init", label: "CODEOWNERS · CONTRIBUTING 模块划分初始化", result: "warn", detail: "未找到 CODEOWNERS", remedy: "稍后在治理台补" },
            { id: "branch-protection", label: "分支保护检查", result: "ok", detail: "main 已开启 required reviews" },
          ],
        }),
      });
    });
    await page.route("**/api/coord/onboard/finalize", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ configured: true, slug: "pixel-forge" }),
      });
    });

    await page.goto("/onboard?installation_id=4821");
    await expect(page.locator("[data-testid=install-receipt]")).toContainText("installation #4821");
    await expect(page.locator("[data-testid=install-receipt]")).toContainText("@usamshen");

    const next1 = page.locator("[data-testid=onboard-next-1]");
    await expect(next1).toBeEnabled();
    await next1.click();

    await expect(page.locator("[data-testid=onboard-step-2]")).toBeVisible();
    await expect(page.locator("[data-testid=admin-badge-pixel-forge]")).toBeVisible();
    await expect(page.locator("[data-testid=not-admin-crm-core]")).toBeVisible();
    // 非 admin 仓禁用，点击不生效
    await page.locator("[data-testid=repo-row-crm-core]").click({ force: true });
    await expect(page.locator("[data-testid=onboard-next-2]")).toBeDisabled();
    // admin 仓可选
    await page.locator("[data-testid=repo-row-pixel-forge]").click();
    await page.locator("[data-testid=onboard-next-2]").click();

    await expect(page.locator("[data-testid=onboard-step-3]")).toBeVisible();
    await expect(page.locator("[data-testid=checkup-list]")).toBeVisible();
    for (const id of ["webhook", "mirror-seed", "modules-init", "branch-protection"]) {
      await expect(page.locator(`[data-testid=checkup-item-${id}]`)).toHaveAttribute("data-state", "done", { timeout: 10_000 });
    }
    await expect(page.locator("[data-testid=checkup-remedy-modules-init]")).toBeVisible();

    await expect(page.locator("[data-testid=onboard-done]")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("[data-testid=onboard-elapsed]")).toBeVisible();
    const enterWorkspace = page.locator("[data-testid=enter-workspace]");
    await expect(enterWorkspace).toBeVisible({ timeout: 10_000 });
    await expect(enterWorkspace).toHaveAttribute("href", "/p/pixel-forge/settings");

    await context.close();
  });
});
