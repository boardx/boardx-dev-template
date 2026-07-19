// p30-F03 e2e：/p/:slug 路由化 + 成员鉴权（服务端角色裁剪）。
//
// 数据来自本地固定 fixture 目录（e2e/fixtures/directory-fixture-server.mjs，
// playwright.config.ts 已把 next dev 的 COORD_GATEWAY_URL/COORD_API_TOKEN 指向它）：
//   project fixture-proj（私有）：owner-user=owner，contrib-user=contributor
//   project fixture-public（公开）：无成员也可只读
// lib/workspace-authz.ts 走的是与生产一致的 fetch 路径，测试环境零特判——本地跑通
// 即证明服务端裁剪逻辑本身正确，只是数据源换成了固定 fixture（而非真实部署）。
//
// 本地跑法：pnpm --filter devportal exec playwright test e2e/p30/workspace-authz.spec.ts
import { expect, test } from "@playwright/test";
import { SignJWT } from "jose";
import { E2E_SESSION_SECRET } from "../../playwright.config";

const remote = Boolean(process.env["DEVPORTAL_E2E_BASE_URL"]);

async function mintSessionCookie(login: string): Promise<string> {
  return new SignJWT({ email: null, name: null, avatarUrl: null })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(login)
    .setIssuer("devportal")
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
    .sign(new TextEncoder().encode(E2E_SESSION_SECRET));
}

test.describe("p30-F03 工作区服务端角色裁剪", () => {
  test.skip(remote, "远端 SESSION_SECRET / 目录 fixture 不可知，仅本地可验（同 auth-gray.spec.ts 纪律）");

  test("contributor 访问 /p/fixture-proj/settings → gov-no-access 可见，governance-console 不可见", async ({ browser, baseURL }) => {
    const cookie = await mintSessionCookie("contrib-user");
    const context = await browser.newContext({ baseURL });
    await context.addCookies([
      { name: "devportal_session", value: cookie, url: baseURL as string, httpOnly: true, sameSite: "Lax" },
    ]);
    const page = await context.newPage();
    const response = await page.goto("/p/fixture-proj/settings");
    expect(response?.status()).toBe(200);
    await expect(page.locator("[data-testid=gov-no-access]")).toBeVisible();
    await expect(page.locator("[data-testid=governance-console]")).toHaveCount(0);
    await context.close();
  });

  test("owner 访问 /p/fixture-proj/settings → governance-console 可见，gov-no-access 不可见", async ({ browser, baseURL }) => {
    const cookie = await mintSessionCookie("owner-user");
    const context = await browser.newContext({ baseURL });
    await context.addCookies([
      { name: "devportal_session", value: cookie, url: baseURL as string, httpOnly: true, sameSite: "Lax" },
    ]);
    const page = await context.newPage();
    const response = await page.goto("/p/fixture-proj/settings");
    expect(response?.status()).toBe(200);
    await expect(page.locator("[data-testid=governance-console]")).toBeVisible();
    await expect(page.locator("[data-testid=gov-no-access]")).toHaveCount(0);
    await context.close();
  });

  test("未知 slug → 404（路由化：未知项目不返回任何页面骨架）", async ({ request }) => {
    const cookie = await mintSessionCookie("owner-user");
    const response = await request.get("/p/does-not-exist/settings", {
      headers: { cookie: `devportal_session=${cookie}` },
    });
    expect(response.status()).toBe(404);
  });

  test("反面测试：contributor 直接 curl 数据接口 → 403 且响应体不含 project 数据", async ({ request }) => {
    const cookie = await mintSessionCookie("contrib-user");
    const response = await request.get("/api/portal/workspace/fixture-proj/settings", {
      headers: { cookie: `devportal_session=${cookie}` },
    });
    expect(response.status()).toBe(403);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body["project"]).toBeUndefined();
  });

  test("从切换器真实点击路径进入 /p/:slug（不再是过滤三栏的 mock 交互）", async ({ browser, baseURL }) => {
    const cookie = await mintSessionCookie("owner-user");
    const context = await browser.newContext({ baseURL });
    await context.addCookies([
      { name: "devportal_session", value: cookie, url: baseURL as string, httpOnly: true, sameSite: "Lax" },
    ]);
    const page = await context.newPage();
    await page.goto("/me");
    await expect(page.locator("[data-testid=project-switcher]")).toBeVisible();
    const switcherLink = page.locator("[data-testid=switcher-fixture-proj]");
    await expect(switcherLink).toBeVisible();
    await switcherLink.click();
    await page.waitForURL(/\/p\/fixture-proj/);
    expect(page.url()).toContain("/p/fixture-proj");
    await context.close();
  });
});
