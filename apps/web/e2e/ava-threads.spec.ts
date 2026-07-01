import { test, expect, type Page } from "@playwright/test";

const uniq = () => `ava_threads_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function register(page: Page) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "Thread", lastName: "Owner", email: uniq(), password: "secret123", agreeTerms: true },
  });
}

async function createTeam(page: Page, name: string): Promise<number> {
  const res = await page.request.post("/api/teams", { data: { name } });
  expect(res.status()).toBe(201);
  const data = await res.json();
  return data.team.id;
}

async function switchTeam(page: Page, teamId: number) {
  const res = await page.request.post("/api/teams/current", { data: { teamId } });
  expect(res.status()).toBe(200);
}

async function createThread(page: Page, title: string): Promise<number> {
  const create = await page.request.post("/api/ava/threads");
  expect(create.status()).toBe(201);
  const { thread } = await create.json();
  const rename = await page.request.patch(`/api/ava/threads/${thread.id}`, { data: { title } });
  expect(rename.status()).toBe(200);
  return thread.id;
}

async function createThreadWithMessage(page: Page, title: string, text: string): Promise<number> {
  const create = await page.request.post("/api/ava/threads");
  expect(create.status()).toBe(201);
  const { thread } = await create.json();
  const send = await page.request.post(`/api/ava/threads/${thread.id}/messages`, { data: { text } });
  expect(send.status()).toBe(201);
  const rename = await page.request.patch(`/api/ava/threads/${thread.id}`, { data: { title } });
  expect(rename.status()).toBe(200);
  return thread.id;
}

test("线程列表按日期分组，可分页加载、切换、重命名、删除，并按团队隔离", async ({ page }) => {
  await register(page);
  const alphaTeamId = await createTeam(page, "Alpha AVA");
  const betaTeamId = await createTeam(page, "Beta AVA");

  await switchTeam(page, alphaTeamId);
  for (let i = 0; i < 22; i += 1) {
    await createThread(page, `Alpha Thread ${String(i).padStart(2, "0")}`);
  }
  const alphaHistoryId = await createThreadWithMessage(page, "Alpha History", "alpha history message");

  await switchTeam(page, betaTeamId);
  const betaThreadId = await createThread(page, "Beta Thread");

  await page.goto("/ava");
  await expect(page.getByTestId("thread-group-today")).toBeVisible();
  await expect(page.getByTestId("thread-list")).toContainText("Beta Thread");
  await expect(page.getByTestId("thread-list")).not.toContainText("Alpha History");

  await switchTeam(page, alphaTeamId);
  await page.reload();
  await expect(page.getByTestId("thread-list")).toContainText("Alpha History");
  await expect(page.getByTestId("thread-list")).not.toContainText("Beta Thread");
  await expect(page.getByTestId("threads-load-more")).toBeVisible();
  await expect(page.getByTestId("thread-list")).not.toContainText("Alpha Thread 00");
  await page.getByTestId("threads-load-more").click();
  await expect(page.getByTestId("thread-list")).toContainText("Alpha Thread 00");

  await page.getByTestId(`thread-${alphaHistoryId}`).click();
  await expect(page.getByTestId("msg-user")).toContainText("alpha history message");

  await page.getByTestId(`thread-menu-${alphaHistoryId}`).click();
  await page.getByTestId("thread-rename").click();
  await page.getByTestId("thread-rename-input").fill("Renamed Alpha History");
  await page.getByTestId("thread-rename-save").click();
  await expect(page.getByTestId("thread-list")).toContainText("Renamed Alpha History");

  await page.getByTestId(`thread-menu-${alphaHistoryId}`).click();
  await page.getByTestId("thread-delete").click();
  await expect(page.getByTestId(`thread-${alphaHistoryId}`)).toHaveCount(0);
  await expect(page.getByTestId("empty")).toBeVisible();

  const betaReadFromAlpha = await page.request.get(`/api/ava/threads/${betaThreadId}`);
  expect(betaReadFromAlpha.status()).toBe(404);
  const betaWriteFromAlpha = await page.request.post(`/api/ava/threads/${betaThreadId}/messages`, {
    data: { text: "cross-team write" },
  });
  expect(betaWriteFromAlpha.status()).toBe(404);

  await switchTeam(page, betaTeamId);
  await page.reload();
  await expect(page.getByTestId("thread-list")).toContainText("Beta Thread");
  await expect(page.getByTestId("thread-list")).not.toContainText("Renamed Alpha History");
});
