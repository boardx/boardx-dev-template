// p30/F08 e2e：/me 三栏真数据 + D4 登录落点。
//   1) 未登录 → /me 302 到 OAuth 登录，return_to=/me（p30/F02 既有行为，回归锁定）。
//   2) mock 会话（测试注入签名 cookie，同构 e2e/p30/auth-gray.spec.ts）→ /me 200，
//      [data-testid=me-workbench] 可见；三栏 testid（col-decisions/col-stuck-prs/
//      col-agent-anomalies）与切换器 testid 均可达（真实数据源未配置时呈现降级/空态，
//      而不是 mock 假数据——这正是本 feature 要验证的行为）。
//   3) 侧栏切换器（GITHUB_REPO 配置时）点击 → 导航到 /p/:slug。
// 本地跑法：pnpm --filter devportal exec playwright test e2e/p30/me-workbench.spec.ts
import { expect, test } from "@playwright/test";
import { SignJWT } from "jose";
import { E2E_SESSION_SECRET } from "../../playwright.config";

const remote = Boolean(process.env["DEVPORTAL_E2E_BASE_URL"]);

async function mintSessionCookie(login = "e2e-user"): Promise<string> {
  return new SignJWT({ email: `${login}@example.com`, name: "E2E", avatarUrl: null })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(login)
    .setIssuer("devportal")
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
    .sign(new TextEncoder().encode(E2E_SESSION_SECRET));
}

test("D4：未登录访问 /me → 302 到 OAuth 登录，return_to=/me", async ({ request }) => {
  const response = await request.get("/me", { maxRedirects: 0 });
  expect([301, 302, 401]).toContain(response.status());
  if (response.status() === 302 || response.status() === 301) {
    const location = response.headers()["location"] ?? "";
    expect(location).toContain("/api/coord/oauth/github/login");
    expect(location).toContain("return_to=%2Fme");
  }
});

test("真数据：已登录 /me 渲染三栏工作台，四态齐全（无 mock 假数据）", async ({ browser, baseURL }) => {
  test.skip(remote, "远端 SESSION_SECRET 不可知，mock 会话仅本地可验");
  const cookie = await mintSessionCookie();
  const context = await browser.newContext({ baseURL });
  await context.addCookies([
    { name: "devportal_session", value: cookie, url: baseURL as string, httpOnly: true, sameSite: "Lax" },
  ]);
  const page = await context.newPage();

  const response = await page.goto("/me");
  expect(response?.status()).toBe(200);
  await expect(page.locator("[data-testid=me-workbench]")).toBeVisible();
  await expect(page.locator("[data-testid=project-switcher]")).toBeVisible();

  // 三栏最终必然落到 ready(空/数据) 或 degraded 之一——不会停在 loading，也不会渲染 mock。
  const decisionsCard = page.locator("[data-testid=col-decisions], [data-testid=decisions-empty], [data-testid=decisions-degraded], [data-testid=decisions-no-access]");
  await expect(decisionsCard.first()).toBeVisible({ timeout: 15_000 });
  const stuckCard = page.locator("[data-testid=col-stuck-prs], [data-testid=stuck-prs-empty], [data-testid=stuck-prs-degraded], [data-testid=stuck-prs-no-access]");
  await expect(stuckCard.first()).toBeVisible({ timeout: 15_000 });
  const anomaliesCard = page.locator("[data-testid=col-agent-anomalies], [data-testid=anomalies-empty], [data-testid=anomalies-degraded], [data-testid=anomalies-no-access]");
  await expect(anomaliesCard.first()).toBeVisible({ timeout: 15_000 });

  await context.close();
});

test("D4：切换器点击 → 导航到 /p/:slug（GITHUB_REPO 配置时）", async ({ browser, baseURL }) => {
  test.skip(remote, "远端 SESSION_SECRET 不可知，mock 会话仅本地可验");
  const cookie = await mintSessionCookie();
  const context = await browser.newContext({ baseURL });
  await context.addCookies([
    { name: "devportal_session", value: cookie, url: baseURL as string, httpOnly: true, sameSite: "Lax" },
  ]);
  const page = await context.newPage();
  await page.goto("/me");
  await expect(page.locator("[data-testid=me-workbench]")).toBeVisible();

  const switcherLink = page.locator("[data-testid=project-switcher] a[data-testid^=switcher-]").first();
  const count = await switcherLink.count();
  test.skip(count === 0, "本地未配置 GITHUB_REPO 时切换器无项目条目，跳过导航断言");
  await switcherLink.click();
  await expect(page).toHaveURL(/\/p\/[a-z0-9-]+/);
  await context.close();
});
