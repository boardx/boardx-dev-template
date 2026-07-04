import { test, expect, type Page } from "@playwright/test";
import { closePool, setSurveyActive } from "@repo/data";
import { REPORT_SUMMARY_FORCE_FAIL_MARKER } from "@repo/ai";

// uc-survey-007 — 问卷报告 AI 摘要：Report 视图一键生成基于当前回收数据的自然语言摘要。
// 核心边界：生成 → loading → 成功文本；生成失败 → 失败态 + 重试；零回收时生成按钮禁用；
// 非 owner/无权限者调用生成接口 403（复用 F04 的结果查看权限边界）。

const uniq = () => `sv7_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

async function register(page: Page, prefix = "survey7") {
  const email = `${prefix}_${uniq()}@ex.com`;
  const res = await page.request.post("/api/auth/register", {
    data: { firstName: "S", lastName: "V", email, password: "secret123", agreeTerms: true },
  });
  expect(res.status()).toBe(201);
  return email;
}

async function createSurvey(page: Page, title: string) {
  const res = await page.request.post("/api/surveys", {
    data: {
      title,
      description: "AI summary coverage survey",
      questions: [
        { title: "What should we improve?", type: "text", required: true, options: [] },
        { title: "Pick one priority", type: "single", required: true, options: ["Speed", "Quality"] },
        { title: "Rate the experience", type: "rating", required: true, options: [] },
      ],
    },
  });
  expect(res.status()).toBe(201);
  return (await res.json()).survey as {
    id: number;
    shareUrl: string;
    questions: Array<{ id: number; title: string; type: string }>;
  };
}

async function submitResponse(
  page: Page,
  survey: { id: number; questions: Array<{ id: number; title: string; type: string }> },
  choice: { single: string; rating: number; text: string }
) {
  const text = survey.questions.find((q) => q.type === "text")!;
  const single = survey.questions.find((q) => q.type === "single")!;
  const rating = survey.questions.find((q) => q.type === "rating")!;
  const answers: Record<string, unknown> = {
    [String(text.id)]: choice.text,
    [String(single.id)]: choice.single,
    [String(rating.id)]: choice.rating,
  };
  const res = await page.request.post(`/api/surveys/${survey.id}/responses`, { data: { answers } });
  expect(res.status()).toBe(201);
}

test.afterAll(async () => {
  await closePool();
});

test("生成 AI 摘要：点击进入 loading，成功后展示摘要文本", async ({ page }) => {
  await register(page, "ai-owner");
  const title = `AI Summary ${uniq()}`;
  const survey = await createSurvey(page, title);
  await setSurveyActive(survey.id, true);
  await submitResponse(page, survey, { single: "Speed", rating: 5, text: "Faster onboarding" });
  await submitResponse(page, survey, { single: "Quality", rating: 3, text: "Better docs" });

  await page.goto(`/surveys/${survey.id}/results`);
  await expect(page.getByTestId("results-total")).toContainText("2 responses collected");

  await page.getByTestId("tab-report").click();
  await expect(page.getByTestId("report-view")).toBeVisible();
  await expect(page.getByTestId("report-ai-summary")).toBeVisible();

  const generateBtn = page.getByTestId("report-ai-summary-generate");
  await expect(generateBtn).toBeEnabled();

  await generateBtn.click();
  // loading 态短暂但确定性出现（stub 生成器同步返回，这里只断言最终态可靠可见；
  // loading 态本身在下面失败态用例里用慢速网络场景更稳定地捕捉）。
  await expect(page.getByTestId("report-ai-summary-text")).toBeVisible();
  const summaryText = await page.getByTestId("report-ai-summary-text").textContent();
  expect(summaryText).toContain(title);
  expect(summaryText).toMatch(/2 份回收|2 responses|完成率/);
});

test("生成 AI 摘要 loading 态可见（网络节流下）", async ({ page, context }) => {
  await register(page, "ai-loading");
  const survey = await createSurvey(page, `AI Loading ${uniq()}`);
  await setSurveyActive(survey.id, true);
  await submitResponse(page, survey, { single: "Speed", rating: 4, text: "Great" });

  await page.goto(`/surveys/${survey.id}/results`);
  await page.getByTestId("tab-report").click();
  await expect(page.getByTestId("report-view")).toBeVisible();

  // 人为延迟 ai-summary 请求的响应，制造可观察的 loading 窗口。
  await context.route("**/results/ai-summary", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    await route.continue();
  });

  const generateBtn = page.getByTestId("report-ai-summary-generate");
  await generateBtn.click();
  await expect(page.getByTestId("report-ai-summary-loading")).toBeVisible();
  await expect(page.getByTestId("report-ai-summary-text")).toBeVisible({ timeout: 10_000 });
});

test("生成失败展示失败态与重试，不影响既有 Summary/Individual/Report 视图", async ({ page }) => {
  await register(page, "ai-fail");
  // 触发词命中 survey 标题时，生成器确定性抛错（REPORT_SUMMARY_FORCE_FAIL_MARKER）。
  const survey = await createSurvey(page, `AI Fail ${REPORT_SUMMARY_FORCE_FAIL_MARKER} ${uniq()}`);
  await setSurveyActive(survey.id, true);
  await submitResponse(page, survey, { single: "Speed", rating: 4, text: "Great" });

  await page.goto(`/surveys/${survey.id}/results`);

  // 既有 Summary 视图不受影响
  await expect(page.getByTestId("summary-view")).toBeVisible();
  await page.getByTestId("tab-individual").click();
  await expect(page.getByTestId("individual-view")).toBeVisible();

  await page.getByTestId("tab-report").click();
  await expect(page.getByTestId("report-view")).toBeVisible();
  await expect(page.getByTestId("report-total")).toHaveText("1");

  await page.getByTestId("report-ai-summary-generate").click();
  await expect(page.getByTestId("err-report-ai-summary")).toBeVisible();
  await expect(page.getByTestId("report-ai-summary-text")).toHaveCount(0);

  // 重试仍然失败（标题依旧含触发词），失败态保持，既有视图仍完好
  await page.getByTestId("retry-report-ai-summary").click();
  await expect(page.getByTestId("err-report-ai-summary")).toBeVisible();
  await expect(page.getByTestId("report-total")).toHaveText("1");
});

test("零回收时生成按钮禁用", async ({ page }) => {
  await register(page, "ai-empty");
  const survey = await createSurvey(page, `AI Empty ${uniq()}`);

  await page.goto(`/surveys/${survey.id}/results`);
  await expect(page.getByTestId("results-empty")).toBeVisible();
  await expect(page.getByTestId("report-ai-summary-generate")).toBeDisabled();
});

test("从问卷 A 的 Report 视图跳转到问卷 B 后，不残留 A 的 AI 摘要（code review 回归）", async ({ page }) => {
  // 背景（code review 发现）：如果两份问卷的 results 页在某种导航方式下共享同一个组件
  // 实例（不重新挂载，只有 useParams() 的 id 变化），而 AI 摘要相关 state 没有随 id 变化
  // 被重置，就会把上一份问卷的摘要文本/失败态误展示成当前问卷的内容。修复是在
  // `useEffect(..., [surveyId])` 里显式重置 aiSummaryText/aiSummaryError/aiSummaryLoading，
  // 这是正确且廉价的防御性写法，不论组件是否重新挂载都不会有副作用。
  //
  // 实测澄清（写这条用例时验证过，供以后维护者参考，避免重复踩坑）：本仓库当前所有指向
  // results 页的入口都是普通 <a>（整页硬导航）；即便改用 Next.js 暴露的 `window.next.router`
  // 真实客户端路由实例发起 push（而不是 history.pushState+popstate 之类不可靠的模拟手法），
  // 这个 [id] 动态段的页面组件在当前 Next 14 配置下经实测**仍然会整体重新挂载**
  // （tab 等未被本次修复触碰的 state 也会一并回到初始值），而不是"同一实例只换 id"。
  // 也就是说，review 描述的"同一组件实例不重新挂载"这个具体触发路径，在当前代码库里
  // 目前还观察不到——但修复本身仍然值得保留（面向未来：一旦任何页面结构调整导致真的
  // 出现跨 id 复用同一实例的情况，这行重置代码会立刻生效，不需要再回来补）。
  // 本用例仍然覆盖有价值的黑盒契约——依次访问两份问卷的 Report 视图不会互相污染摘要——
  // 但请不要误读为"证明了修复在软路由场景下生效"，如实记录以免误导后续 review。
  await register(page, "ai-switch");
  const titleA = `AI Switch A ${uniq()}`;
  const surveyA = await createSurvey(page, titleA);
  await setSurveyActive(surveyA.id, true);
  await submitResponse(page, surveyA, { single: "Speed", rating: 5, text: "From A" });

  const titleB = `AI Switch B ${uniq()}`;
  const surveyB = await createSurvey(page, titleB);
  await setSurveyActive(surveyB.id, true);
  await submitResponse(page, surveyB, { single: "Quality", rating: 2, text: "From B" });

  await page.goto(`/surveys/${surveyA.id}/results`);
  await page.getByTestId("tab-report").click();
  await expect(page.getByTestId("report-view")).toBeVisible();
  await page.getByTestId("report-ai-summary-generate").click();
  await expect(page.getByTestId("report-ai-summary-text")).toBeVisible();
  const summaryA = await page.getByTestId("report-ai-summary-text").textContent();
  expect(summaryA).toContain(titleA);

  // 用 Next.js 暴露的真实客户端路由实例发起 push（比 page.goto 更贴近应用内导航，
  // 即便如上方注释所述，实测下这个页面在当前配置里仍会整体重新挂载）。
  await page.evaluate((id) => {
    (window as unknown as { next: { router: { push(href: string): void } } }).next.router.push(
      `/surveys/${id}/results`
    );
  }, surveyB.id);

  await expect(page.getByTestId("results-title")).toHaveText(titleB);
  // 新问卷进入时不应带着上一份问卷的摘要文本/失败态/loading 态。
  await expect(page.getByTestId("report-ai-summary-text")).toHaveCount(0);
  await expect(page.getByTestId("err-report-ai-summary")).toHaveCount(0);
  await expect(page.getByTestId("report-ai-summary-loading")).toHaveCount(0);

  await page.getByTestId("tab-report").click();
  await page.getByTestId("report-ai-summary-generate").click();
  await expect(page.getByTestId("report-ai-summary-text")).toBeVisible();
  const summaryB = await page.getByTestId("report-ai-summary-text").textContent();
  expect(summaryB).toContain(titleB);
  expect(summaryB).not.toContain(titleA);
});

test("非 owner/无权限者调用生成接口返回 403", async ({ page }) => {
  await register(page, "ai-private-owner");
  const survey = await createSurvey(page, `AI Private ${uniq()}`);
  await setSurveyActive(survey.id, true);
  await submitResponse(page, survey, { single: "Speed", rating: 2, text: "N/A" });

  const ownerGenerate = await page.request.post(`/api/surveys/${survey.id}/results/ai-summary`);
  expect(ownerGenerate.status()).toBe(200);

  await page.context().clearCookies();
  await register(page, "ai-outsider");

  const forbidden = await page.request.post(`/api/surveys/${survey.id}/results/ai-summary`);
  expect(forbidden.status()).toBe(403);
  const body = await forbidden.json();
  expect(JSON.stringify(body)).not.toContain("N/A");

  await page.context().clearCookies();
  const anonymous = await page.request.post(`/api/surveys/${survey.id}/results/ai-summary`);
  expect(anonymous.status()).toBe(401);
});
