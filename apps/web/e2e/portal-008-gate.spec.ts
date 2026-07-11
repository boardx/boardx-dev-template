import { test, expect } from "@playwright/test";

// #544 — 产品面 portal 下线收口：原型路由与门户路由都不在产品面提供内容。
// /portal 保留 302/307 跳转到协作平面 develop.boardx.us（旧书签不断链）。
test("原型路由 /portal-prototype 已退役（404）", async ({ page }) => {
  const res = await page.goto("/portal-prototype");
  expect(res?.status()).toBe(404);
});

test("/portal 跳转到协作平面 develop.boardx.us（产品面不再提供门户内容）", async ({ request }) => {
  const res = await request.get("/portal", { maxRedirects: 0 });
  expect([302, 307, 308]).toContain(res.status());
  expect(res.headers()["location"]).toContain("develop.boardx.us");
});
