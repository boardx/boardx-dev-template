import { test, expect } from "@playwright/test";

const uniq = () => `as_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function register(page: import("@playwright/test").Page) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
}

test("未登录访问 /ai-store 重定向到 /login", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/ai-store");
  await expect(page).toHaveURL(/\/login/);
});

test("登录后浏览：submenu 分类 + 内容网格", async ({ page }) => {
  await register(page);
  await page.goto("/ai-store");

  // 左侧 AI 商店菜单：Browsing(Explore/Subscribe) + Creation(Create/Authorized/Shared)
  await expect(page.getByTestId("store-submenu")).toBeVisible();
  await expect(page.getByTestId("nav-explore")).toBeVisible();
  await expect(page.getByTestId("nav-subscribe")).toBeVisible();
  await expect(page.getByTestId("nav-authorized")).toBeVisible();

  // 右侧内容网格（默认 Explore）
  await expect(page.getByTestId("item-grid")).toBeVisible();
  await expect(page.getByTestId("type-tabs")).toBeVisible();
  // 样本含 Research Agent
  await expect(page.getByTestId("item-grid")).toContainText("Research Agent");
});

test("类型筛选只显示该类型，并在页面上下文生效", async ({ page }) => {
  await register(page);
  await page.goto("/ai-store");
  await expect(page.getByTestId("item-grid")).toBeVisible();

  await page.getByTestId("type-template").click();
  await expect(page.getByTestId("type-template")).toHaveAttribute("aria-pressed", "true");
  const grid = page.getByTestId("item-grid");
  await expect(grid).toContainText("Retro Template");
  // Agent 类型项不应再出现
  await expect(grid).not.toContainText("Research Agent");
});

test("搜索按名称/描述收窄列表", async ({ page }) => {
  await register(page);
  await page.goto("/ai-store");
  await expect(page.getByTestId("item-grid")).toBeVisible();

  await page.getByTestId("store-search").fill("Translate");
  await page.getByTestId("store-search").press("Enter");
  const grid = page.getByTestId("item-grid");
  await expect(grid).toContainText("Translate");
  await expect(grid).not.toContainText("Research Agent");
});

test("输入后立即按 Enter 使用当前搜索词刷新网格", async ({ page }) => {
  await register(page);
  await page.goto("/ai-store");
  const grid = page.getByTestId("item-grid");
  await expect(grid).toBeVisible();
  await expect(grid).toContainText("Research Agent");

  // 已实测排除两种看似合理但实际测不出回归的写法：
  //   1) pressSequentially(text) 后单独再 .press("Enter")：两次调用之间有独立的
  //      Playwright action 边界，足够 React flush，Enter 触发时 q 早已是最新值。
  //   2) pressSequentially(text + "\n")（把 Enter 内嵌进同一次调用）：Playwright 对
  //      序列里的每个按键仍各自走一次独立派发+await，末尾的 "\n" 与倒数第二个字符
  //      之间照样有事件循环 tick 给 React flush，同样测不出回归。
  //   3) 同一个 page.evaluate 里背靠背派发最后一个字符的 "input" 事件、再派发 Enter
  //      的 "keydown" 事件（中间不 await）：dispatchEvent 是同步的，但 React 在处理
  //      "input" 事件时会同步 flush state 更新（setQ）并重渲染，其间重新创建
  //      onKeyDown 闭包——回到调用方代码时，闭包早已拿到最新 q，即便两次 dispatchEvent
  //      本身在同一个 JS tick 里也测不出回归。
  // 以上三种在用刻意还原的旧实现（读闭包里的 q 而非 e.currentTarget.value）复现验证时
  // 全部仍然通过，说明都没有真正打开"最后一个字符触发的 setQ 还没被 React 处理完，
  // Enter 的 keydown 就已经需要读值"这个窗口。
  //
  // 能验证出回归的写法：在 input 元素自身注册一个"capture 阶段 + one-shot"的原生
  // input 监听器，抢在 React 挂在根节点上的委托（bubble 阶段）监听器之前同步触发——
  // 于是我们能在 React 的 onChange/setQ 真正跑起来之前，就同步派发 Enter 的 keydown。
  // 这样 keydown 处理时 React state 必然还是"打最后一个字之前"的旧值：如果 onKeyDown
  // 读的是闭包里的旧 q，请求会带上旧词；如果读的是 e.currentTarget.value（当前修复），
  // 请求会带上包含最后一个字符的新词——这才是真正区分新旧实现的断言点。
  async function appendCharAndEnterBeforeReactFlush(testId: string, finalChar: string) {
    await page.evaluate(
      ({ testId, finalChar }) => {
        const el = document.querySelector<HTMLInputElement>(`[data-testid="${testId}"]`);
        if (!el) throw new Error(`input not found: ${testId}`);
        el.focus();
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value",
        )!.set!;

        const fireEnterBeforeReactSeesInput = () => {
          el.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true, cancelable: true }),
          );
        };
        el.addEventListener("input", fireEnterBeforeReactSeesInput, { capture: true, once: true });

        nativeInputValueSetter.call(el, el.value + finalChar);
        el.dispatchEvent(new Event("input", { bubbles: true }));
      },
      { testId, finalChar },
    );
  }

  // 断言设计要点：后端 q 用 ILIKE '%q%' 子串匹配（见 packages/data/src/aiStore.ts）。
  // 所以不能用"前缀不匹配、加了最后一个字符也不匹配"的词对（比如 no-match-<ts> 缺一个
  // 字符依然是 no-match-<ts-1个字符>，一样查不到东西）去断言——那种情况下无论用旧的
  // stale q 还是新的 fresh q，请求都会落到"零匹配"，测不出区别（踩过这个坑：之前一版
  // 用 "Translat"→"Translate" 时，缺最后一个 "e" 的 "Translat" 依然是 "Translate" 的
  // 子串，ILIKE 依然命中同一个 item，断言"看到 Translate"两种实现下都成立，同样测不出
  // 回归）。
  // 真正能区分的设计：让"最后一个字符之前的前缀"本身就能 ILIKE 命中某个真实 item，
  // 而"加上最后一个字符之后的完整词"必须不再匹配任何 item。这样：
  //   - 用旧 q（缺最后一个字符的前缀）→ 命中该 item，网格非空
  //   - 用新 q（含最后一个字符的完整词）→ 零命中，显示空态
  // 前缀 "Translat" 对 "Translate" item 命中；追加一个 "9" 变成 "Translat9"，
  // 不会是任何 item 名称/描述的子串，必然零命中。
  const search = page.getByTestId("store-search");
  await search.click();
  await search.pressSequentially("Translat", { delay: 0 });
  await expect(search).toHaveValue("Translat");
  // sanity：光打到 "Translat"（还没追加最后一个字符、还没按 Enter）不该已经刷新网格，
  // 确保下面的断言真的是由 appendCharAndEnterBeforeReactFlush 触发的搜索，而不是巧合。
  await expect(grid).toContainText("Research Agent");

  await appendCharAndEnterBeforeReactFlush("store-search", "9");
  // 新实现（e.currentTarget.value，读到完整的 "Translat9"）：零命中 → 空态。
  // 旧实现（闭包里的 q，还停留在 "Translat"）：命中 Translate item → 网格非空、
  // 看不到空态——这条断言就是区分新旧实现的关键点。
  //
  // 注：这里没有再补一段"前缀不匹配、加最后一个字符后才匹配"的反向用例——在
  // ILIKE '%q%' 子串匹配语义下这种反向用例做不出来：只要完整词 S 能子串命中某个
  // item，S 去掉最后一个字符的前缀作为子串必然也命中同一个 item（前缀本身就是
  // 子串的子串）。所以"前缀不匹配→加字符后才匹配"这个方向在子串匹配下不可能
  // 构造出反例，唯一能区分新旧实现的方向就是这里用的"前缀匹配→加字符后不匹配"。
  await expect(page.getByTestId("empty")).toBeVisible();
  await expect(grid).toHaveCount(0);
});

test("无匹配结果显示空状态 + 清空筛选入口", async ({ page }) => {
  await register(page);
  await page.goto("/ai-store");
  await expect(page.getByTestId("item-grid")).toBeVisible();

  await page.getByTestId("store-search").fill("zzzz-no-match-xyz");
  await page.getByTestId("store-search").press("Enter");
  await expect(page.getByTestId("empty")).toBeVisible();
  await expect(page.getByTestId("empty-clear")).toBeVisible();

  // 清空后恢复列表
  await page.getByTestId("empty-clear").click();
  await expect(page.getByTestId("item-grid")).toBeVisible();
});

test("标签筛选高亮并显示 filters active，Clear all 复位", async ({ page }) => {
  await register(page);
  await page.goto("/ai-store");
  await expect(page.getByTestId("item-grid")).toBeVisible();

  await page.getByTestId("tag-writing").click();
  await expect(page.getByTestId("tag-writing")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("filters-active")).toBeVisible();
  await expect(page.getByTestId("item-grid")).toContainText("Summarize");

  await page.getByTestId("clear-filters").click();
  await expect(page.getByTestId("tag-writing")).toHaveAttribute("aria-pressed", "false");
});

test("未登录调用 GET /api/ai-store/items 返回未授权", async ({ page, request }) => {
  await page.context().clearCookies();
  const res = await request.get("/api/ai-store/items");
  expect(res.status()).toBe(401);
});

test("分页：种子数据超过一页时显示分页控件，翻页后内容更新", async ({ page }) => {
  await register(page);
  await page.goto("/ai-store");
  await expect(page.getByTestId("item-grid")).toBeVisible();

  // 12 条种子数据、默认 pageSize=9 → 应有 2 页。
  await expect(page.getByTestId("result-count")).toContainText("12");
  await expect(page.getByTestId("pagination")).toBeVisible();
  await expect(page.getByTestId("page-indicator")).toContainText("Page 1 / 2");
  await expect(page.getByTestId("page-prev")).toBeDisabled();

  const firstPageText = await page.getByTestId("item-grid").textContent();

  await page.getByTestId("page-next").click();
  await expect(page.getByTestId("page-indicator")).toContainText("Page 2 / 2");
  await expect(page.getByTestId("page-next")).toBeDisabled();
  const secondPageText = await page.getByTestId("item-grid").textContent();
  expect(secondPageText).not.toBe(firstPageText);

  await page.getByTestId("page-prev").click();
  await expect(page.getByTestId("page-indicator")).toContainText("Page 1 / 2");
});

test("点卡片打开详情弹窗：展示描述/示例/统计/订阅入口，可关闭", async ({ page }) => {
  await register(page);
  await page.goto("/ai-store");
  await expect(page.getByTestId("item-grid")).toBeVisible();

  const card = page.getByTestId("item-grid").locator('article:has-text("Research Agent")');
  await card.click();

  const modal = page.getByTestId("item-detail-modal");
  await expect(modal).toBeVisible();
  await expect(modal.getByTestId("detail-name")).toContainText("Research Agent");
  await expect(modal.getByTestId("detail-description")).toBeVisible();
  await expect(modal.getByTestId("detail-examples")).toBeVisible();
  await expect(modal.getByTestId("detail-stats")).toBeVisible();
  // 订阅入口（P11 F03）：已发布的 platform 项目可订阅，按钮可用。
  await expect(modal.getByTestId("detail-subscribe")).toBeVisible();
  await expect(modal.getByTestId("detail-subscribe")).toBeEnabled();

  await modal.getByTestId("close-detail").click();
  await expect(modal).not.toBeVisible();
});
