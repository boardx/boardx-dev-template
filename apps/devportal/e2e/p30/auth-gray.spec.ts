// p30-F02 e2e：D3 阶段 2 灰度的三条可见行为。
//   1) 公开层免登录：未登录 GET /explore → 200 且 [data-testid=explore-directory] 可见。
//   2) 工作区要求会话：未登录 /me → 302 到 OAuth 登录（保留 return_to）/ 401。
//   3) mock 会话（测试注入签名 cookie）→ /me 200；登出后 /explore 仍 200。
// 本地跑法（playwright.config.ts 自动起 next dev，SESSION_SECRET=E2E 测试值）：
//   pnpm --filter devportal exec playwright test e2e/p30/auth-gray.spec.ts
import { expect, test } from "@playwright/test";
import { SignJWT } from "jose";
import { E2E_SESSION_SECRET } from "../../playwright.config";

const remote = Boolean(process.env["DEVPORTAL_E2E_BASE_URL"]);

/** 与 lib/session.ts 同构地签一枚测试 session（HS256，issuer=devportal）。 */
async function mintSessionCookie(): Promise<string> {
  return new SignJWT({ email: "e2e@example.com", name: "E2E", avatarUrl: null })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("e2e-user")
    .setIssuer("devportal")
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
    .sign(new TextEncoder().encode(E2E_SESSION_SECRET));
}

test("公开层：未登录访问 /explore → 200 且目录可见（零鉴权零身份读取）", async ({ page }) => {
  const response = await page.goto("/explore");
  expect(response?.status()).toBe(200);
  await expect(page.locator("[data-testid=explore-directory]")).toBeVisible();
});

test("个人层：未登录访问 /me → 302 到 OAuth 登录（保留 return_to）或 401", async ({ request }) => {
  const response = await request.get("/me", { maxRedirects: 0 });
  expect([301, 302, 401]).toContain(response.status());
  if (response.status() === 302 || response.status() === 301) {
    const location = response.headers()["location"] ?? "";
    expect(location).toContain("/api/coord/oauth/github/login");
    expect(location).toContain("return_to=%2Fme");
  }
});

test("工作区：未登录访问 /p/boardx/settings 同样被挡（302/401）", async ({ request }) => {
  const response = await request.get("/p/boardx/settings", { maxRedirects: 0 });
  expect([301, 302, 401]).toContain(response.status());
});

test("mock 会话：注入签名 session cookie → /me 200；登出 → /explore 仍 200", async ({ browser, baseURL }) => {
  test.skip(remote, "远端 SESSION_SECRET 不可知，mock 会话仅本地可验");
  const cookie = await mintSessionCookie();
  const context = await browser.newContext({ baseURL });
  await context.addCookies([
    {
      // #769：cookie 名加 __Host- 前缀，同时要求 Secure（127.0.0.1 回环地址被视为
      // 安全上下文，浏览器允许 __Host- cookie 在 http://127.0.0.1 下生效）。
      name: "__Host-devportal_session",
      value: cookie,
      url: baseURL as string,
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    },
  ]);
  const page = await context.newPage();
  const response = await page.goto("/me");
  expect(response?.status()).toBe(200);

  // 登出：清 cookie 并回落公开层；/explore 免登录不受影响（灰度红线）。
  const logout = await page.goto("/api/coord/oauth/logout");
  expect(logout?.status()).toBe(200); // 跟随 302 落 /explore
  expect(page.url()).toContain("/explore");
  await expect(page.locator("[data-testid=explore-directory]")).toBeVisible();
  await context.close();
});
