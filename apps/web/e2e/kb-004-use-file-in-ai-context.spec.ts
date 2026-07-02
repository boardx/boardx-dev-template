import { test, expect, type Page } from "@playwright/test";
import { closePool, setKbFileStatus } from "@repo/data";

// uc-kb-004 验收契约（p10-F04：AI 引用知识库上下文 — RAG 检索 + 作用域隔离）。
// 覆盖：
//  1. 勾选 file-reader 工具 + 消息文本命中已 ready 的知识库文件名 → AI 回复标注引用来源。
//  2. 未勾选 file-reader 工具 → 即使文件名命中，也不检索、不引用（用户需主动选用该能力）。
//  3. 文件仍在 processing（未处理完成）→ 不参与检索，不出现在引用里（对应「处理中不可用」）。
//  4. 作用域隔离：other 用户的 personal 文件、以及非当前团队上下文的 team 文件，
//     即使文件名精确命中查询词，也绝不出现在当前用户的引用里（不跨用户/跨团队泄露）。
//  5. 查询词未命中任何文件 → 回复不虚构引用来源（不出现"引用来源"标注）。
//
// 真实链路：POST /api/ava/threads/:id/messages 在 file-reader 工具启用时调用
// retrieveKbFilesForQuery（packages/data/src/kbFiles.ts）按当前用户 + 当前团队上下文
// 作用域检索 status='ready' 的 kb_files，命中文件名拼进 stub provider 上下文标记，
// stub 回复据此显式列出「引用来源」。

const uniq = () => `kb004_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;
const PASSWORD = "secret123";

test.afterEach(async () => {
  await closePool();
});

interface UploadedFile {
  id: string;
  name: string;
}

async function register(page: Page, email = uniq()) {
  const res = await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email, password: PASSWORD, agreeTerms: true },
  });
  expect(res.status()).toBe(201);
  return email;
}

async function uploadFile(
  page: Page,
  name: string,
  scope: "personal" | "team" = "personal",
  body = "knowledge base fixture content"
): Promise<UploadedFile> {
  const res = await page.request.post("/api/kb/files", {
    multipart: {
      file: {
        name,
        mimeType: name.endsWith(".pdf") ? "application/pdf" : "text/markdown",
        buffer: Buffer.from(body),
      },
      scope,
    },
  });
  expect(res.status()).toBe(201);
  const json = (await res.json()) as { file: UploadedFile };
  return json.file;
}

async function enableFileReaderTool(page: Page) {
  await page.goto("/ava");
  await expect(page.getByTestId("ai-settings")).toBeVisible();
  const toggle = page.getByTestId("tool-file-reader");
  await toggle.click();
  await expect(page.getByTestId("current-tools")).toContainText("File Reader");
}

test("勾选 file-reader 后，AI 回复引用命中的已 ready 知识库文件", async ({ page }) => {
  await register(page);
  const target = await uploadFile(page, "quarterly-roadmap.pdf");
  await setKbFileStatus(target.id, "ready");

  await enableFileReaderTool(page);
  await page.getByTestId("composer").fill("帮我总结一下 quarterly-roadmap 里的内容");
  await page.getByTestId("send").click();

  const assistant = page.getByTestId("msg-assistant");
  await expect(assistant).toBeVisible({ timeout: 15_000 });
  await expect(assistant).toContainText("引用来源", { timeout: 15_000 });
  await expect(assistant).toContainText("quarterly-roadmap.pdf");
});

test("未勾选 file-reader 工具：即使文件名命中也不检索、不引用", async ({ page }) => {
  await register(page);
  const target = await uploadFile(page, "unused-context-file.md");
  await setKbFileStatus(target.id, "ready");

  await page.goto("/ava");
  await expect(page.getByTestId("ai-settings")).toBeVisible();
  // 默认工具只有 web-search，不含 file-reader。
  await expect(page.getByTestId("current-tools")).not.toContainText("File Reader");

  await page.getByTestId("composer").fill("讲讲 unused-context-file 的要点");
  await page.getByTestId("send").click();

  const assistant = page.getByTestId("msg-assistant");
  await expect(assistant).toBeVisible({ timeout: 15_000 });
  await expect(assistant).not.toContainText("引用来源");
});

test("处理中（未 ready）的文件不参与检索，不出现在引用里", async ({ page }) => {
  await register(page);
  const processing = await uploadFile(page, "still-processing-doc.pdf");
  // 不调用 setKbFileStatus，保持默认 processing 状态。

  await enableFileReaderTool(page);
  await page.getByTestId("composer").fill("still-processing-doc 讲了什么");
  await page.getByTestId("send").click();

  const assistant = page.getByTestId("msg-assistant");
  await expect(assistant).toBeVisible({ timeout: 15_000 });
  await expect(assistant).not.toContainText("引用来源");
  await expect(assistant).not.toContainText("still-processing-doc.pdf");
});

test("查询词未命中任何文件：回复不虚构引用来源", async ({ page }) => {
  await register(page);
  const target = await uploadFile(page, "completely-unrelated-name.pdf");
  await setKbFileStatus(target.id, "ready");

  await enableFileReaderTool(page);
  await page.getByTestId("composer").fill("今天天气怎么样");
  await page.getByTestId("send").click();

  const assistant = page.getByTestId("msg-assistant");
  await expect(assistant).toBeVisible({ timeout: 15_000 });
  await expect(assistant).not.toContainText("引用来源");
});

test("作用域隔离：other 用户的 personal 文件即使文件名命中也绝不被引用", async ({
  page,
  playwright,
  baseURL,
}) => {
  const otherCtx = await playwright.request.newContext({ baseURL });
  const otherEmail = uniq();
  await otherCtx.post("/api/auth/register", {
    data: { firstName: "O", lastName: "O", email: otherEmail, password: PASSWORD, agreeTerms: true },
  });
  const otherUploadRes = await otherCtx.post("/api/kb/files", {
    multipart: {
      file: {
        name: "other-users-secret-plan.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("other user private content"),
      },
      scope: "personal",
    },
  });
  expect(otherUploadRes.status()).toBe(201);
  const otherFile = (await otherUploadRes.json()) as { file: UploadedFile };
  await setKbFileStatus(otherFile.file.id, "ready");
  await otherCtx.dispose();

  // 当前测试用户与 other 用户无关，personal 文件互不可见。
  await register(page);
  await enableFileReaderTool(page);
  await page.getByTestId("composer").fill("other-users-secret-plan 里写了什么");
  await page.getByTestId("send").click();

  const assistant = page.getByTestId("msg-assistant");
  await expect(assistant).toBeVisible({ timeout: 15_000 });
  await expect(assistant).not.toContainText("other-users-secret-plan.pdf");
  await expect(assistant).not.toContainText("引用来源");
});

test("作用域隔离：非当前团队上下文的 team 文件不被引用，切回该团队后可被引用", async ({ page }) => {
  await register(page);

  const alphaTeamRes = await page.request.post("/api/teams", { data: { name: "Alpha KB Team" } });
  expect(alphaTeamRes.status()).toBe(201);
  const alphaTeam = (await alphaTeamRes.json()) as { team: { id: number } };

  const betaTeamRes = await page.request.post("/api/teams", { data: { name: "Beta KB Team" } });
  expect(betaTeamRes.status()).toBe(201);
  const betaTeam = (await betaTeamRes.json()) as { team: { id: number } };

  // 切到 Alpha 团队上下文，上传一份 team 作用域文件。
  await page.request.post("/api/teams/current", { data: { teamId: alphaTeam.team.id } });
  const alphaFile = await uploadFile(page, "alpha-team-financials.pdf", "team");
  await setKbFileStatus(alphaFile.id, "ready");

  // 切到 Beta 团队上下文：即使用户同时是两个团队成员，Alpha 的 team 文件不应在 Beta 上下文被引用。
  await page.request.post("/api/teams/current", { data: { teamId: betaTeam.team.id } });
  await enableFileReaderTool(page);
  await page.getByTestId("composer").fill("alpha-team-financials 里的数字对不对");
  await page.getByTestId("send").click();

  const assistantInBeta = page.getByTestId("msg-assistant");
  await expect(assistantInBeta).toBeVisible({ timeout: 15_000 });
  await expect(assistantInBeta).not.toContainText("alpha-team-financials.pdf");
  await expect(assistantInBeta).not.toContainText("引用来源");

  // 切回 Alpha 团队上下文：同样的查询现在应命中并引用该 team 文件。
  await page.request.post("/api/teams/current", { data: { teamId: alphaTeam.team.id } });
  await page.reload();
  await enableFileReaderTool(page);
  await page.getByTestId("composer").fill("alpha-team-financials 里的数字对不对");
  await page.getByTestId("send").click();

  const assistantInAlpha = page.getByTestId("msg-assistant").last();
  await expect(assistantInAlpha).toBeVisible({ timeout: 15_000 });
  await expect(assistantInAlpha).toContainText("引用来源", { timeout: 15_000 });
  await expect(assistantInAlpha).toContainText("alpha-team-financials.pdf");
});
