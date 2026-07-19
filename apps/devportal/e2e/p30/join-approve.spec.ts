// p30-F06 e2e：P2 join 向导 + W6 审批队列接真的可见行为（批次 2 testid）。
// playwright.config.ts 自 p30-F03 起为 workspace-authz.spec.ts 起了固定数据 fixture
// server 并把 COORD_GATEWAY_URL/COORD_API_TOKEN 接到它——这个 webServer 配置是全
// e2e 套件共享的，本文件也跑在同一个 next dev 实例上，"directory 未配置" 从此在这份
// 配置里不可复现（这两条用例原先假设的前提已经不成立，直接断言不可达的状态只会一直
// 红）。改为用 fixture 里真实存在的 project(fixture-proj)/engineer(owner-user 等)
// 断言"已配置、真实数据"的路径——诚实降级契约本身（未登录 / 表单校验 / 中间件拦截）
// 由其余用例继续覆盖。真正打活体 coord-gateway 的状态机/SLA 断言见
// phases/phase-p30-devportal-platform/scripts/verify-join-flow.sh（本地 wrangler dev 已验证 PASS）
// 与 packages/coord-directory/test/directory.test.ts。
//
// 本地跑法：pnpm --filter devportal exec playwright test e2e/p30/join-approve.spec.ts
//
// cookie 名同 auth-gray.spec.ts / workspace-authz.spec.ts 的纪律（#769）：session
// cookie 加了 __Host- 前缀（本文件此前一直用旧名 devportal_session，服务端已经不认
// 这个名字，本次同步）；注入方式用 `context.setExtraHTTPHeaders` 而不是
// `context.addCookies`——本地这套 Playwright/Chromium 组合下，CDP 的
// `Storage.setCookies` 对 `__Host-` 前缀 + `http://127.0.0.1` 源直接报
// "Invalid cookie fields"（同一根因见 workspace-authz.spec.ts 的注释）。
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

  test("已登录 + 目录读面已配置、写面未配置：如实显示「已登录」，提交时报真实 503（不是目录整体未配置的降级态）", async ({ browser, baseURL }) => {
    test.skip(remote, "远端 SESSION_SECRET 不可知，mock 会话仅本地可验");
    const context = await browser.newContext({ baseURL });
    // fixture-proj 是 fixture 目录里真实存在的项目；用一个不在 FIXTURE_ENGINEERS 里的
    // 全新 login，走「首次申请」路径。playwright.config.ts 的 webServer 只给了
    // COORD_API_TOKEN（读面），没给 COORD_GATEWAY_ADMIN_TOKEN（写面）——GET 因此真实
    // 可达（configured:true），POST 因此真实 503（directoryWriteConfigured() 为 false）；
    // 这是当前 e2e 环境下唯一能诚实复现的「未配置」形态，与 step1 的读面状态不冲突。
    await context.setExtraHTTPHeaders({ cookie: `__Host-devportal_session=${await mintSessionCookie("e2e-new-joiner")}` });
    const page = await context.newPage();
    await page.goto("/projects/fixture-proj");
    await page.locator("[data-testid=join-cta]").click();
    await expect(page.locator("[data-testid=join-step-1]")).toBeVisible();

    // 真实登录态：显示 @e2e-new-joiner（服务端 session 解出的 login，非 mock「new-engineer」）
    await expect(page.locator("[data-testid=join-step-1]")).toContainText("@e2e-new-joiner");
    // 目录读面真实可达（fixture GET 通）——不该出现「未接入」降级提示
    await expect(page.locator("[data-testid=join-directory-not-configured]")).toHaveCount(0);
    await expect(page.locator("[data-testid=join-next-1]")).toBeEnabled();

    await page.locator("[data-testid=join-next-1]").click();
    await expect(page.locator("[data-testid=join-step-2]")).toBeVisible();
    await page.locator("[data-testid=join-module-collab]").click();
    await page.locator("#join-intro").fill("e2e 自动化验证加入向导真实提交路径");
    await page.locator("[data-testid=join-submit]").click();

    // 写面真实未配置 → 服务端真实 503，前端如实报错而非假装 pending
    await expect(page.locator("[data-testid=join-submit-error]")).toBeVisible();
    await context.close();
  });

  test("表单校验：模块未选 / 自介太短 → 行内错误提示，不允许提交", async ({ browser, baseURL }) => {
    test.skip(remote, "远端 SESSION_SECRET 不可知，mock 会话仅本地可验");
    const context = await browser.newContext({ baseURL });
    await context.setExtraHTTPHeaders({ cookie: `__Host-devportal_session=${await mintSessionCookie("e2e-joiner-2")}` });
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

  test("已登录 owner + 目录已配置：审批队列真实拉取，fixture 里无待审记录 → 如实展示空态", async ({ browser, baseURL }) => {
    test.skip(remote, "远端 SESSION_SECRET 不可知，mock 会话仅本地可验");
    const context = await browser.newContext({ baseURL });
    // owner-user 是 fixture-proj 在 fixture 目录里的真实 owner（directory-fixture-constants.mjs）。
    // governance-console 挂载后自己发起客户端 fetch(/api/portal/approvals)——"Cookie" 是
    // fetch 规范里的禁止头，`setExtraHTTPHeaders`/`route.continue` 都无法覆盖浏览器原生
    // fetch 请求实际携带的 Cookie（只对服务端渲染的页面导航请求生效），必须走浏览器
    // 真实的 cookie jar 才能让客户端 fetch 自动带上；用 `domain`+`path`（而非 `url`）
    // 传给 addCookies 就能通过这套 Playwright/Chromium 组合对 `__Host-` 前缀的校验
    // （用 `url` 会报 "Invalid cookie fields"，同一根因见 workspace-authz.spec.ts 注释）。
    await context.addCookies([
      {
        name: "__Host-devportal_session",
        value: await mintSessionCookie("owner-user"),
        domain: new URL(baseURL as string).hostname,
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
      },
    ]);
    const page = await context.newPage();
    const response = await page.goto("/p/fixture-proj/settings");
    expect(response?.status()).toBe(200);
    await expect(page.locator("[data-testid=governance-console]")).toBeVisible();
    // 真实拉取 /api/portal/approvals——fixture 里没有 pending 状态的 membership，
    // 如实展示空态，不是「未接入」降级提示，也不是假数据。
    await expect(page.locator("[data-testid=approval-empty]")).toBeVisible();
    await expect(page.locator("[data-testid=approval-error]")).toHaveCount(0);
    await context.close();
  });
});
