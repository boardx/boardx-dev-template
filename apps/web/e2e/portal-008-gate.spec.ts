import { test, expect } from "@playwright/test";

// p23/F09 — 门禁与路由收口：/portal 为正式路由，原型路由退役。
// （F09 wave 2，依赖 F03-F08 全绿后实施；本规格先行定义完成契约。）

const uniq = () => `p23f09_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

test("原型路由 /portal-prototype 已退役（404）", async ({ page }) => {
  const res = await page.goto("/portal-prototype");
  expect(res?.status()).toBe(404);
});

test("/portal 未登录 = 访客视图（分流带+登录入口），登录后 = 完整门户", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/portal");
  await expect(page.getByTestId("visitor-band")).toBeVisible();
  await expect(page.getByTestId("dev-identity-chip")).toHaveCount(0);

  await page.request.post("/api/auth/register", {
    data: { firstName: "Gate", lastName: "Check", email: uniq(), password: "secret123", agreeTerms: true },
  });
  await page.goto("/portal");
  await expect(page.getByTestId("dev-identity-chip")).toBeVisible();
  // 五个板块 tab 全部真实内容挂载（wave 1 完成后不再有"板块接入中"占位）
  for (const key of ["pulse", "coord", "talk", "join", "perf"]) {
    await page.getByRole("button", { name: new RegExp({ pulse: "脉搏与进度", coord: "实时协调", talk: "讨论流", join: "加入开发", perf: "性能" }[key]!) }).click();
    await expect(page.getByTestId(`tab-${key}`)).toBeVisible();
    await expect(page.getByTestId(`tab-${key}`)).not.toContainText("板块接入中");
  }
});
