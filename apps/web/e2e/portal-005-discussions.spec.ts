import { test, expect } from "@playwright/test";

// p23/F06 — 讨论流板块：人类/AI 分流 + 分级降噪 + 待拍板卡强化。
// 界面契约 = p23 ui-signoff（confirmed）v3 原型 TalkTab：👤/🤖/⚡待拍板 过滤按钮；
// 排序待拍板优先；巡检类（【coord-* 巡检】开头）默认折叠可展开；待拍板卡红框高亮 +
// 问题首行加粗放大（data-testid="decide-question"）+ 快捷回应跳该评论；
// 其它条目"去 GitHub 回复 →"链接。权威在 GitHub：门户不提供评论输入。
// 数据源 GET /api/portal/discussions（F02），configured:false → unconfigured 态。

const uniq = () => `p23f06_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

const ITEMS = [
  { who: "coord-store-admin", isAgent: true, at: "2026-07-08T10:00:00Z", src: "#323", url: "https://github.com/x/r/issues/323#issuecomment-1",
    excerpt: "是否引入并发 worktree 上限？\n主机资源危机已缓解，但缺根因限流。需要人类拍板。", needsHuman: true },
  { who: "usam.shen", isAgent: false, at: "2026-07-09T10:41:00Z", src: "#323", url: "https://github.com/x/r/issues/323#issuecomment-2",
    excerpt: "staging 即生产；27 个 worker token 授权轮换。", needsHuman: false },
  { who: "coord-main", isAgent: true, at: "2026-07-09T09:47:00Z", src: "#452", url: "https://github.com/x/r/issues/452#issuecomment-3",
    excerpt: "cycle-plan 2026-07-09T09Z：合并队列清空 + p22 分派。", needsHuman: false },
  { who: "coord-ava", isAgent: true, at: "2026-07-09T10:12:00Z", src: "#323", url: "https://github.com/x/r/issues/323#issuecomment-4",
    excerpt: "【coord-ava 巡检】AVA 域（p18）13/13 passing，域结项。", needsHuman: false },
];

async function registerAndGotoTalk(page: import("@playwright/test").Page) {
  const email = uniq();
  await page.request.post("/api/auth/register", {
    data: { firstName: "Portal", lastName: "Talk", email, password: "secret123", agreeTerms: true },
  });
  await page.goto("/portal");
  await page.getByRole("button", { name: /讨论流/ }).click();
  await expect(page.getByTestId("tab-talk")).toBeVisible();
}

function mockDiscussions(page: import("@playwright/test").Page, items = ITEMS) {
  return page.route("**/api/portal/discussions", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        configured: true,
        items,
        needs_human_count: items.filter((i) => i.needsHuman).length,
        generated_at: new Date().toISOString(),
      }),
    })
  );
}

test("未配置数据源：unconfigured 态而非报错（合法部署中间态），且无评论输入框", async ({ page }) => {
  // e2e 环境不配 GITHUB_TOKEN → /api/portal/discussions 返回 {configured:false}
  await registerAndGotoTalk(page);
  await expect(page.getByTestId("tab-talk").getByTestId("card-unconfigured")).toBeVisible();
  // 权威在 GitHub：门户任何状态下都不提供评论输入
  await expect(page.getByTestId("tab-talk").locator("textarea, input[type='text']")).toHaveCount(0);
});

test("过滤按钮：👤 人类 / 🤖 AI / ⚡待拍板 三向分流 + 待拍板计数", async ({ page }) => {
  await mockDiscussions(page);
  await registerAndGotoTalk(page);
  const stream = page.getByTestId("talk-stream");
  await expect(stream).toBeVisible();

  // 待拍板过滤：只剩 needsHuman 条目，按钮带计数徽章
  await page.getByRole("button", { name: /⚡ 待人类拍板/ }).click();
  await expect(stream.locator("li")).toHaveCount(1);
  await expect(stream.getByText("coord-store-admin")).toBeVisible();

  // 人类过滤：只剩 isAgent=false 的条目
  await page.getByRole("button", { name: "👤 人类" }).click();
  await expect(stream.locator("li")).toHaveCount(1);
  await expect(stream.getByText("usam.shen")).toBeVisible();

  // AI 过滤：agent 条目（巡检类默认折叠，不计入）
  await page.getByRole("button", { name: "🤖 AI" }).click();
  await expect(stream.getByText("coord-store-admin")).toBeVisible();
  await expect(stream.getByText("coord-main")).toBeVisible();
  await expect(stream.getByText(/coord-ava 巡检/)).toHaveCount(0);
});

test("待拍板优先排序 + 待拍板卡强化：红框 + 问题首行加粗放大 + 快捷回应跳该评论", async ({ page }) => {
  await mockDiscussions(page);
  await registerAndGotoTalk(page);
  const stream = page.getByTestId("talk-stream");

  // 排序：needsHuman 条目排最前（即使时间更早）
  await expect(stream.locator("li").first()).toContainText("coord-store-admin");

  // 待拍板卡：excerpt 首行加粗放大（text-15 font-bold，data-testid="decide-question"）
  const q = page.getByTestId("decide-question");
  await expect(q).toHaveText("是否引入并发 worktree 上限？");
  await expect(q).toHaveClass(/text-15/);
  await expect(q).toHaveClass(/font-bold/);
  // 红框高亮
  await expect(stream.locator("li").first()).toHaveClass(/border-destructive/);
  // 快捷回应按钮跳该评论 url
  const quick = stream.getByRole("link", { name: /快捷回应/ });
  await expect(quick).toHaveAttribute("href", "https://github.com/x/r/issues/323#issuecomment-1");

  // 其它条目："去 GitHub 回复 →"链接 href=item.url
  const reply = stream.getByRole("link", { name: "去 GitHub 回复 →" }).first();
  await expect(reply).toHaveAttribute("href", /issuecomment/);
});

test("巡检类（【coord-* 巡检】开头）默认折叠，可展开/收起", async ({ page }) => {
  await mockDiscussions(page);
  await registerAndGotoTalk(page);
  const stream = page.getByTestId("talk-stream");

  // 默认折叠：巡检条目不可见，折叠按钮显示计数
  await expect(stream.getByText(/coord-ava 巡检/)).toHaveCount(0);
  const toggle = page.getByTestId("patrol-toggle");
  await expect(toggle).toContainText("展开巡检类低优先条目（1）");

  // 展开后可见，再点收起
  await toggle.click();
  await expect(stream.getByText(/coord-ava 巡检/)).toBeVisible();
  await expect(toggle).toContainText("收起巡检类低优先条目（1）");
  await toggle.click();
  await expect(stream.getByText(/coord-ava 巡检/)).toHaveCount(0);
});
