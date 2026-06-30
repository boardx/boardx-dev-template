import { test, expect } from "@playwright/test";

// uc-invite-001-accept-invite-link
// 用户打开邀请链接（/invite/<token>）查看邀请详情并接受。
// 未登录 → 提示登录后再接受；已登录 → 点击「接受邀请」加入并跳转。
// 未知/过期 token → 显示不可用/过期出口。
// 已知 stub token：`demo` → 示例 team 邀请（Acme Design / Jordan Lee）。

const uniqEmail = () => `inv_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

/** 通过 register API 注册并把会话 cookie 注入到浏览器 context。 */
async function registerAndLogin(page: import("@playwright/test").Page) {
  const res = await page.request.post("/api/auth/register", {
    data: {
      firstName: "Invitee",
      lastName: "User",
      email: uniqEmail(),
      password: "secret123",
      agreeTerms: true,
    },
  });
  expect(res.ok()).toBeTruthy();
}

test("logged-out: /invite/demo 显示邀请详情 + 登录提示", async ({ page }) => {
  // 确保未登录：清掉任何已有会话 cookie
  await page.context().clearCookies();
  await page.goto("/invite/demo");

  // 邀请详情可见
  await expect(page.getByTestId("invite-detail")).toBeVisible();
  await expect(page.getByTestId("target-name")).toHaveText("Acme Design");
  await expect(page.getByTestId("inviter")).toHaveText("Jordan Lee");

  // 未登录 → 显示登录提示，不显示接受按钮
  await expect(page.getByTestId("signin-prompt")).toBeVisible();
  await expect(page.getByTestId("accept")).toHaveCount(0);

  // 登录入口带回调到本邀请链接
  await expect(page.getByTestId("signin")).toHaveAttribute(
    "href",
    /\/login\?next=.*invite.*demo/,
  );
});

test("logged-in: 接受邀请 → 加入并跳转", async ({ page }) => {
  await registerAndLogin(page);
  await page.goto("/invite/demo");

  // 已登录 → 显示接受按钮，不显示登录提示
  await expect(page.getByTestId("invite-detail")).toBeVisible();
  await expect(page.getByTestId("accept")).toBeVisible();
  await expect(page.getByTestId("signin-prompt")).toHaveCount(0);

  // 点击接受 → team 邀请跳转到房间列表
  await page.getByTestId("accept").click();
  await expect(page).toHaveURL(/\/rooms/);
});

test("unknown token: /invite/unknown 显示不可用出口", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/invite/unknown");

  await expect(page.getByTestId("invite-invalid")).toBeVisible();
  await expect(page.getByTestId("err")).toBeVisible();
  // 提供可操作出口：返回首页
  await expect(page.getByTestId("go-home")).toBeVisible();
  // 不会显示接受按钮
  await expect(page.getByTestId("accept")).toHaveCount(0);
});
