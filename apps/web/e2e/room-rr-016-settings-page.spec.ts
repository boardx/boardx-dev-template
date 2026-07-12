import { test, expect, type Page } from "@playwright/test";
import { closePool } from "@repo/data";

// issue #587：Room 设置从 Members tab 拆到独立 Settings 页。
// 契约：
//   - /rooms/:id/settings 承载 rename（room-rename-input/save/ok）、About & AI
//     （room-about-ai-section 等，复用组件）、Danger Zone（room-danger-zone，仅 owner）。
//   - 改名保存后头部房间名（room-header-name）更新。
//   - Members 页保留成员列表（member-list），不再出现 About & AI / Danger Zone。
//   - Settings tab（room-tab-settings）仅 owner/admin 可见。

const uniq = (p = "rr16") => `${p}_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;
const PASSWORD = "secret123";

test.afterEach(async () => {
  await closePool();
});

interface RegisteredUser {
  id: number;
  email: string;
}

async function register(page: Page, prefix = "u"): Promise<RegisteredUser> {
  const email = uniq(prefix);
  const res = await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email, password: PASSWORD, agreeTerms: true },
  });
  expect(res.status()).toBe(201);
  const json = (await res.json()) as { user: { id: number } };
  return { id: json.user.id, email };
}

async function login(page: Page, email: string) {
  const res = await page.request.post("/api/auth/login", { data: { email, password: PASSWORD } });
  expect(res.ok()).toBeTruthy();
}

async function createRoom(page: Page, name: string) {
  const res = await page.request.post("/api/rooms", { data: { name, visibility: "private" } });
  expect(res.status()).toBe(201);
  const body = (await res.json()) as { room: { id: number; name: string } };
  return body.room;
}

test("owner 的 Settings 页承载 rename + About&AI + Danger Zone；改名生效；Members 页瘦身；Settings tab 可见", async ({
  page,
}) => {
  const owner = await register(page, "s16owner");
  const room = await createRoom(page, "SettingsRoom");
  await login(page, owner.email);

  // 进入 Settings 页
  await page.goto(`/rooms/${room.id}/settings`);
  // 房间壳（client layout）加载数据后会有一次挂载抖动，等网络静默再交互，避免表单输入被重挂重置。
  await page.waitForLoadState("networkidle");

  // rename、About & AI、Danger Zone 三块都在
  await expect(page.getByTestId("room-rename-input")).toBeVisible();
  await expect(page.getByTestId("room-about-ai-section")).toBeVisible();
  await expect(page.getByTestId("room-settings-description")).toBeVisible();
  await expect(page.getByTestId("room-settings-ai-instruction")).toBeVisible();
  await expect(page.getByTestId("room-danger-zone")).toBeVisible();

  // Settings tab 对 owner 可见
  await expect(page.getByTestId("room-tab-settings")).toBeVisible();

  // 改名 → 保存 → 成功提示 + 头部房间名更新
  await page.getByTestId("room-rename-input").fill("Renamed Room");
  await page.getByTestId("room-rename-save").click();
  await expect(page.getByTestId("room-rename-ok")).toBeVisible();
  await expect(page.getByTestId("room-header-name")).toHaveText("Renamed Room");

  // 服务端确认持久化
  const after = await (await page.request.get(`/api/rooms/${room.id}`)).json();
  expect(after.room.name).toBe("Renamed Room");

  // Members 页：成员列表在，且 About&AI / Danger Zone 不再出现
  await page.goto(`/rooms/${room.id}/members`);
  await expect(page.getByTestId("member-list")).toBeVisible();
  await expect(page.getByTestId("room-about-ai-section")).toHaveCount(0);
  await expect(page.getByTestId("room-danger-zone")).toHaveCount(0);
});

test("member 看不到 Settings tab；直接访问 Settings 页得无权限提示，无设置项", async ({ page }) => {
  const owner = await register(page, "s16owner2");
  const member = await register(page, "s16member2");
  await login(page, owner.email);
  const room = await createRoom(page, "MemberViewRoom");
  await page.request.post(`/api/rooms/${room.id}/members`, { data: { userId: member.id } });

  await login(page, member.email);

  // Members 页可见，但 Settings tab 不可见
  await page.goto(`/rooms/${room.id}/members`);
  await expect(page.getByTestId("member-list")).toBeVisible();
  await expect(page.getByTestId("room-tab-settings")).toHaveCount(0);

  // 直接访问 Settings 页 → 无权限提示，设置项不渲染
  await page.goto(`/rooms/${room.id}/settings`);
  await expect(page.getByTestId("settings-forbidden")).toBeVisible();
  await expect(page.getByTestId("room-rename-input")).toHaveCount(0);
  await expect(page.getByTestId("room-danger-zone")).toHaveCount(0);
});
