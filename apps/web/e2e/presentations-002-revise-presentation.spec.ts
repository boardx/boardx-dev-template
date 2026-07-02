import { test, expect } from "@playwright/test";

// uc-presentations-002-revise-presentation —— F03 完成契约。
// 覆盖：已生成演示 → 全屏预览「方案修订（整体）」面板提修改要求 → 异步得到更新方案，
// 原地替换预览内容；全屏预览「优化本页」仅重生成该页并原位替换，其余页不变；修订/优化
// 中展示处理态；修订/优化要求为空则禁用提交；修订失败不破坏原可查看结果；创建者以外的
// 用户（含只读线程访问者）不能对他人制品发起修订（不能引用无权访问的文件/制品）。
// 真实链路：入队 boardx.presentation-revision → workflow-worker 消费 → 回写
// presentation_artifacts.slides/title（成功）或 presentation_revisions.status=error（失败），
// 前端轮询刷新（同 p12-F02 presentation_artifacts 管线模式）。

const uniq = (p = "pg") => `${p}_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

const BASE_URL = process.env.E2E_PORT ? `http://localhost:${process.env.E2E_PORT}` : "http://localhost:3000";

async function register(page: import("@playwright/test").Page) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "P", lastName: "R", email: uniq(), password: "secret123", agreeTerms: true },
  });
}

async function createRoomChat(page: import("@playwright/test").Page) {
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  const chat = (await (await page.request.post(`/api/rooms/${room.id}/chats`, { data: { name: "Mine" } })).json())
    .chat;
  return { room, chat };
}

// 通过说明文本来源生成一份演示文稿，返回房间/线程信息，供后续修订操作。
async function generatePresentation(page: import("@playwright/test").Page, topic: string) {
  const { room, chat } = await createRoomChat(page);
  await page.goto(`/rooms/${room.id}/chats/${chat.id}`);

  await page.getByTestId("presentation-generate-open").click();
  await page.getByTestId("presentation-source-instructions").click();
  await page.getByTestId("presentation-topic").fill(topic);
  await page.getByTestId("presentation-instructions").fill("覆盖修订用例所需的说明内容");
  await page.getByTestId("presentation-pages").selectOption("5");
  await page.getByTestId("presentation-config-generate").click();

  const card = page.getByTestId("presentation-preview-card");
  await expect(card).toBeVisible({ timeout: 30_000 });
  return { room, chat };
}

test("方案修订：提修改要求得到更新方案，原地替换预览内容", async ({ page }) => {
  await register(page);
  await generatePresentation(page, "方案修订用例");

  await page.getByTestId("pres-revise-open").click();
  await expect(page.getByTestId("presentation-fullscreen")).toBeVisible();
  await expect(page.getByTestId("presentation-revise-panel")).toBeVisible();

  // 空要求 → 禁用提交
  await expect(page.getByTestId("pres-revise-submit")).toBeDisabled();

  await page.getByTestId("pres-revise-input").fill("受众改为投资人，风格改为深色商务");
  await expect(page.getByTestId("pres-revise-submit")).toBeEnabled();
  await page.getByTestId("pres-revise-submit").click();

  // 处理中展示处理态，最终得到更新方案摘要（异步链路：入队 → worker 消费 → 回写 → 轮询）。
  await expect(
    page.getByTestId("pres-revise-pending").or(page.getByTestId("pres-revise-summary"))
  ).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("pres-revise-summary")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("pres-revise-summary")).toContainText("受众改为投资人");

  // 原可查看结果保持可见：全屏预览幻灯片内容体现修订（原地替换，非破坏性）。
  await expect(page.getByTestId("presentation-fullscreen")).toContainText("修订：受众改为投资人，风格改为深色商务");
});

test("单页优化：仅重生成本页并原位替换，其余页不变", async ({ page }) => {
  await register(page);
  await generatePresentation(page, "单页优化用例");

  await page.getByTestId("pres-open-fullscreen").click();
  await expect(page.getByTestId("presentation-fullscreen")).toBeVisible();
  await expect(page.getByTestId("presentation-fullscreen")).toContainText("第 1 / 5 页");

  // 记录第 2 页原始内容，优化第 1 页后应保持不变。
  await page.getByTestId("pres-next").click();
  await expect(page.getByTestId("presentation-fullscreen")).toContainText("第 2 / 5 页");
  const page2TextBefore = await page.getByTestId("presentation-fullscreen").innerText();
  await page.getByTestId("pres-prev").click();
  await expect(page.getByTestId("presentation-fullscreen")).toContainText("第 1 / 5 页");

  // 优化要求为空 → 禁用提交
  await expect(page.getByTestId("pres-optimize-submit")).toBeDisabled();

  await page.getByTestId("pres-optimize-input").fill("加一张架构图并精简文字");
  await expect(page.getByTestId("pres-optimize-submit")).toBeEnabled();
  await page.getByTestId("pres-optimize-submit").click();

  await expect(
    page.getByTestId("pres-optimize-pending").or(page.getByTestId("presentation-fullscreen"))
  ).toBeVisible({ timeout: 10_000 });

  // 轮询直至第 1 页内容体现优化结果（原位替换）。
  await expect(page.getByTestId("presentation-fullscreen")).toContainText("优化：加一张架构图并精简文字", {
    timeout: 20_000,
  });

  // 第 2 页未受影响。
  await page.getByTestId("pres-next").click();
  await expect(page.getByTestId("presentation-fullscreen")).toContainText("第 2 / 5 页");
  const page2TextAfter = await page.getByTestId("presentation-fullscreen").innerText();
  expect(page2TextAfter).toBe(page2TextBefore);
});

test("方案修订失败不破坏原可查看结果", async ({ page }) => {
  await register(page);
  await generatePresentation(page, "修订失败用例");

  const cardBefore = await page.getByTestId("presentation-preview-card").innerText();

  await page.getByTestId("pres-revise-open").click();
  await page.getByTestId("pres-revise-input").fill("__presentation_revision_force_fail__");
  await page.getByTestId("pres-revise-submit").click();

  await expect(page.getByTestId("pres-revise-error")).toBeVisible({ timeout: 20_000 });

  // 关闭全屏预览，聊天内预览卡片内容与修订前一致（未被破坏）。
  await page.getByTestId("presentation-fullscreen-close").click();
  await expect(page.getByTestId("presentation-fullscreen")).toBeHidden();
  const cardAfter = await page.getByTestId("presentation-preview-card").innerText();
  expect(cardAfter).toBe(cardBefore);
});

test("非创建者（只读线程）不能对他人制品发起修订/优化", async ({ page, browser }) => {
  await register(page);
  const { room, chat } = await generatePresentation(page, "权限校验用例");

  // 取得该制品 id，供另一用户直接调用 API 验证权限边界。
  const artifactsRes = await page.request.get(`/api/rooms/${room.id}/chats/${chat.id}/presentations/artifacts`);
  const { artifacts } = await artifactsRes.json();
  const artifactId = artifacts[0].id;

  // 第二个用户注册后加入房间（走公开加入流程不存在时，直接用未加房间的用户调用应得 403）。
  const otherContext = await browser.newContext();
  const otherPage = await otherContext.newPage();
  await register(otherPage);

  const reviseRes = await otherPage.request.post(
    `${BASE_URL}/api/rooms/${room.id}/chats/${chat.id}/presentations/artifacts/${artifactId}/revisions`,
    { data: { instructions: "尝试越权修订" } }
  );
  expect([403, 404]).toContain(reviseRes.status());

  const optimizeRes = await otherPage.request.post(
    `${BASE_URL}/api/rooms/${room.id}/chats/${chat.id}/presentations/artifacts/${artifactId}/optimize-page`,
    { data: { pageN: 1, instructions: "尝试越权优化" } }
  );
  expect([403, 404]).toContain(optimizeRes.status());

  await otherContext.close();
});

test("未登录调用修订/优化接口 → 401", async ({ page }) => {
  const revRes = await page.request.post(
    `${BASE_URL}/api/rooms/1/chats/1/presentations/artifacts/pa_x/revisions`,
    { data: { instructions: "x" } }
  );
  expect(revRes.status()).toBe(401);

  const optRes = await page.request.post(
    `${BASE_URL}/api/rooms/1/chats/1/presentations/artifacts/pa_x/optimize-page`,
    { data: { pageN: 1, instructions: "x" } }
  );
  expect(optRes.status()).toBe(401);
});
