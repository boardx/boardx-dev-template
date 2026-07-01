"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  calculateSurveyReport,
  generateReportTemplate,
  validateSurveyForPublish,
  type DistributionDatum,
  type GeneratedSurveyReport,
  type QuestionOption,
  type SurveyAnswer,
  type QuestionType,
  type SurveyQuestion,
} from "@/lib/survey/survey-engine";
import type { AddQuestionInput, SurveyRecord, SurveyTemplateDefinition } from "@/lib/survey/survey-service";
import { cn } from "@/lib/utils";

type WorkspaceView = "dashboard" | "builder" | "fill" | "report";

const navItems: Array<{ id: WorkspaceView; label: string; mark: string }> = [
  { id: "dashboard", label: "工作台", mark: "⌂" },
  { id: "builder", label: "问卷设计器", mark: "✎" },
  { id: "fill", label: "填写问卷", mark: "◉" },
  { id: "report", label: "报告中心", mark: "▣" },
];

const questionTypes: Array<{ type: QuestionType; label: string; group: "基础题型" | "高级题型" }> = [
  { type: "single_choice", label: "单选题", group: "基础题型" },
  { type: "multiple_choice", label: "多选题", group: "基础题型" },
  { type: "textarea", label: "开放题", group: "基础题型" },
  { type: "rating", label: "评分题", group: "基础题型" },
  { type: "company_size", label: "企业规模", group: "高级题型" },
  { type: "industry_selector", label: "行业选择", group: "高级题型" },
  { type: "satisfaction_score", label: "满意度评分", group: "高级题型" },
  { type: "nps", label: "NPS", group: "高级题型" },
];

export function SurveyPlatform() {
  const [view, setView] = useState<WorkspaceView>("dashboard");
  const [surveys, setSurveys] = useState<SurveyRecord[]>([]);
  const [surveyTemplates, setSurveyTemplates] = useState<SurveyTemplateDefinition[]>([]);
  const [activeSurveyId, setActiveSurveyId] = useState<string>("");
  const [activeQuestionId, setActiveQuestionId] = useState<string>("");
  const [fillAnswers, setFillAnswers] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState("正在加载真实问卷数据...");
  const [isBusy, setIsBusy] = useState(false);
  const hasLoadedRef = useRef(false);

  const activeSurvey = useMemo(
    () => surveys.find((record) => record.survey.id === activeSurveyId) ?? surveys[0],
    [activeSurveyId, surveys]
  );
  const reportTemplate = useMemo(
    () => (activeSurvey ? activeSurvey.reportTemplate ?? generateReportTemplate(activeSurvey).reportTemplate : undefined),
    [activeSurvey]
  );
  const report = useMemo(() => {
    if (!activeSurvey || !reportTemplate) {
      return undefined;
    }

    const richReport = activeSurvey.reports.find(hasRichReportShape);
    return richReport ?? calculateSurveyReport(activeSurvey, activeSurvey.responses, reportTemplate);
  }, [activeSurvey, reportTemplate]);
  const validation = useMemo(
    () =>
      activeSurvey
        ? validateSurveyForPublish({
            ...activeSurvey,
            reportTemplate,
          })
        : { passed: false, errors: ["暂无问卷"], warnings: [] },
    [activeSurvey, reportTemplate]
  );
  const activeQuestion =
    activeSurvey?.questions.find((question) => question.id === activeQuestionId) ??
    activeSurvey?.questions[0];

  const loadSurveys = useCallback(async (preferredSurveyId?: string, preferredQuestionId?: string) => {
    const result = await api<{ surveys: SurveyRecord[] }>("/api/surveys");
    if (result.surveys.length === 0) {
      setSurveys([]);
      setActiveSurveyId("");
      setActiveQuestionId("");
      setStatusMessage("暂无问卷，请创建一份新问卷。");
      return;
    }

    setSurveys(result.surveys);
    const nextActive =
      result.surveys.find((survey) => survey.survey.id === preferredSurveyId) ??
      result.surveys.find((survey) => survey.responses.length > 0) ??
      result.surveys.find((survey) => survey.survey.status === "published") ??
      result.surveys.find((survey) => survey.reports.length > 0) ??
      result.surveys[0];
    setActiveSurveyId(nextActive?.survey.id ?? "");
    setActiveQuestionId((current) => {
      if (preferredQuestionId && nextActive?.questions.some((question) => question.id === preferredQuestionId)) {
        return preferredQuestionId;
      }

      if (current && nextActive?.questions.some((question) => question.id === current)) {
        return current;
      }

      return nextActive?.questions[0]?.id ?? "";
    });
    setStatusMessage("已连接后端 API，数据变更会持久保存。");
  }, []);

  const loadSurveyTemplates = useCallback(async () => {
    const result = await api<{ templates: SurveyTemplateDefinition[] }>("/api/survey-templates");
    setSurveyTemplates(result.templates);
  }, []);

  useEffect(() => {
    if (hasLoadedRef.current) {
      return;
    }

    hasLoadedRef.current = true;
    void loadSurveyTemplates().catch((error) => {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    });
    void loadSurveys().catch((error) => {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    });
  }, [loadSurveyTemplates, loadSurveys]);

  async function runAction(message: string, action: () => Promise<void>) {
    setIsBusy(true);
    setStatusMessage(message);
    try {
      await action();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function createBlankSurvey(template?: SurveyTemplateDefinition) {
    await runAction("正在创建新问卷...", async () => {
      const created = await api<{ survey: SurveyRecord }>("/api/surveys", {
        method: "POST",
        body: JSON.stringify({
          title: template ? template.title : `新商务调研问卷 ${surveys.length + 1}`,
          description: template?.description ?? "用于收集业务反馈并生成专业报告。",
          category: template?.category ?? "custom",
          businessGoal: template?.businessGoal ?? "收集受访者反馈，识别优先改进方向。",
          targetAudience: template?.targetAudience ?? "目标受访者",
          templateId: template?.id ?? "custom_quick_feedback",
        }),
      });
      await loadSurveys(created.survey.survey.id, created.survey.questions[0]?.id);
      setFillAnswers({});
      setView("builder");
      setStatusMessage(template ? `已使用“${template.title}”模板创建问卷。` : "新问卷已创建并保存。");
    });
  }

  async function addQuestion(type: QuestionType) {
    if (!activeSurvey) return;
    await runAction("正在添加题目...", async () => {
      const input = makeQuestionInput(type);
      const result = await api<{ question: SurveyQuestion }>(
        `/api/surveys/${activeSurvey.survey.id}/questions`,
        {
          method: "POST",
          body: JSON.stringify(input),
        }
      );
      await loadSurveys(activeSurvey.survey.id, result.question.id);
      setStatusMessage("题目已添加并保存。");
    });
  }

  async function saveQuestion(questionId: string, patch: Partial<SurveyQuestion>) {
    if (!activeSurvey) return;
    await runAction("正在保存题目...", async () => {
      await api(`/api/surveys/${activeSurvey.survey.id}/questions/${questionId}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      await loadSurveys(activeSurvey.survey.id, questionId);
      setStatusMessage("题目已保存。");
    });
  }

  async function publishActiveSurvey() {
    if (!activeSurvey) return;
    await runAction("正在发布问卷并生成分享链接...", async () => {
      await api(`/api/surveys/${activeSurvey.survey.id}/publish`, { method: "POST" });
      await loadSurveys(activeSurvey.survey.id, activeQuestionId);
      setStatusMessage("问卷已发布，填写端可通过分享链接提交答卷。");
    });
  }

  async function generateReport() {
    if (!activeSurvey) return;
    await runAction("正在按报告模板生成报告...", async () => {
      await api(`/api/surveys/${activeSurvey.survey.id}/reports`, { method: "POST" });
      await loadSurveys(activeSurvey.survey.id, activeQuestionId);
      setView("report");
      setStatusMessage("报告已根据真实答卷生成。");
    });
  }

  async function submitFillAnswer() {
    if (!activeSurvey) return;
    await runAction("正在提交答卷...", async () => {
      const missingQuestion = activeSurvey.questions.find(
        (question) => question.required && !isDraftAnswered(fillAnswers[question.id])
      );
      if (missingQuestion) {
        throw new Error(`请先完成必填题：“${missingQuestion.title}”。`);
      }

      let published = activeSurvey;
      if (!published.shareLinks[0]) {
        await api(`/api/surveys/${activeSurvey.survey.id}/publish`, { method: "POST" });
        const reloaded = (await api<{ survey: SurveyRecord }>(`/api/surveys/${activeSurvey.survey.id}`)).survey;
        published = reloaded;
      }

      const token = published.shareLinks[0]?.token;
      if (!token) {
        throw new Error("请先发布问卷");
      }
      const answers = published.questions.map((question) => createAnswer(question, fillAnswers[question.id]));

      await api(`/api/s/${token}/submit`, {
        method: "POST",
        body: JSON.stringify({
          durationSeconds: 480,
          metadata: { device: "desktop", channel: "local-preview" },
          answers,
        }),
      });
      await api(`/api/surveys/${published.survey.id}/reports`, { method: "POST" });
      await loadSurveys(published.survey.id, activeQuestionId);
      setFillAnswers({});
      setStatusMessage("答卷已提交，报告已刷新。");
      setView("report");
    });
  }

  return (
    <main className="min-h-screen bg-[#f6f8fb] text-slate-950">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[232px_1fr]">
        <aside className="border-b border-slate-200 bg-white px-4 py-4 lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-3 px-2">
            <div className="grid h-8 w-8 place-items-center rounded-[8px] bg-blue-600 text-sm font-semibold text-white">
              B
            </div>
            <div>
              <p className="text-sm font-semibold">商务问卷平台</p>
              <p className="text-xs text-slate-500">BoardX Research</p>
            </div>
          </div>

          <nav className="mt-6 grid grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setView(item.id)}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-[8px] px-3 text-left text-sm text-slate-600 transition hover:bg-slate-100",
                  view === item.id && "bg-blue-50 font-medium text-blue-700"
                )}
              >
                <span className="grid h-5 w-5 place-items-center text-xs">{item.mark}</span>
                {item.label}
              </button>
            ))}
          </nav>

          <div className="mt-8 hidden rounded-[8px] border border-slate-200 bg-slate-50 p-3 lg:block">
            <p className="text-xs font-medium text-slate-500">发布检查</p>
            <p className={cn("mt-2 text-sm font-semibold", validation.passed ? "text-emerald-700" : "text-red-700")}>
              {validation.passed ? "可发布" : "需修复"}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {reportTemplate?.sections.length ?? 0} 个报告章节 · {reportTemplate?.metrics.length ?? 0} 个指标
            </p>
          </div>

          <div className="mt-8 hidden rounded-[8px] border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-800 lg:block">
            {isBusy ? "处理中..." : statusMessage}
          </div>
        </aside>

        <section className="min-w-0">
          {!activeSurvey || !report ? (
            <div className="grid min-h-screen place-items-center p-6 text-sm text-slate-500">{statusMessage}</div>
          ) : null}
          {activeSurvey && report && view === "dashboard" && (
            <DashboardView
              surveys={surveys}
              templates={surveyTemplates}
              activeSurvey={activeSurvey}
              report={report}
              activeSurveyId={activeSurvey.survey.id}
              onCreateSurvey={createBlankSurvey}
              onActivateSurvey={(surveyId) => {
                const nextSurvey = surveys.find((survey) => survey.survey.id === surveyId);
                setActiveSurveyId(surveyId);
                setActiveQuestionId(nextSurvey?.questions[0]?.id ?? "");
                setStatusMessage(`已切换到问卷：${nextSurvey?.survey.title ?? "当前问卷"}`);
              }}
              onOpenSurvey={(surveyId) => {
                const nextSurvey = surveys.find((survey) => survey.survey.id === surveyId);
                setActiveSurveyId(surveyId);
                setActiveQuestionId(nextSurvey?.questions[0]?.id ?? "");
                setView("builder");
              }}
            />
          )}
          {activeSurvey && report && view === "builder" && (
            <BuilderView
              survey={activeSurvey}
              activeQuestion={activeQuestion}
              activeQuestionId={activeQuestionId}
              validationPassed={validation.passed}
              warningCount={validation.warnings.length}
              onAddQuestion={addQuestion}
              onSelectQuestion={setActiveQuestionId}
              onSaveQuestion={saveQuestion}
              onPublish={publishActiveSurvey}
              onGenerateReport={generateReport}
            />
          )}
          {activeSurvey && report && view === "fill" && (
            <FillView
              survey={activeSurvey}
              answers={fillAnswers}
              onSelectValue={(questionId, value) => {
                setFillAnswers((current) => ({ ...current, [questionId]: value }));
              }}
              onSubmit={submitFillAnswer}
            />
          )}
          {activeSurvey && report && view === "report" && (
            <ReportView survey={activeSurvey} report={report} onGenerateReport={generateReport} />
          )}
        </section>
      </div>
    </main>
  );
}

function DashboardView({
  surveys,
  templates,
  activeSurvey,
  report,
  activeSurveyId,
  onCreateSurvey,
  onActivateSurvey,
  onOpenSurvey,
}: {
  surveys: SurveyRecord[];
  templates: SurveyTemplateDefinition[];
  activeSurvey: SurveyRecord;
  report: GeneratedSurveyReport;
  activeSurveyId: string;
  onCreateSurvey: (template?: SurveyTemplateDefinition) => void;
  onActivateSurvey: (surveyId: string) => void;
  onOpenSurvey: (surveyId: string) => void;
}) {
  const totalResponses = surveys.reduce((sum, survey) => sum + survey.responses.length, 0);
  const reportCount = surveys.reduce((sum, survey) => sum + survey.reports.length, 0);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5 p-4 sm:p-6">
      <header className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-2xl font-semibold">您好，张晓明</h1>
            <p className="mt-2 text-sm text-slate-500">数据来自后端 API，创建、发布、填写和报告都会持久保存。</p>
          </div>
          <button
            type="button"
            onClick={() => onCreateSurvey()}
            className="inline-flex h-10 items-center justify-center rounded-[8px] bg-blue-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            ＋ 创建问卷
          </button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="问卷总数" value={String(surveys.length)} delta="实时" tone="blue" />
          <MetricCard label="填写总数" value={String(totalResponses)} delta="实时" tone="green" />
          <MetricCard label="完成率" value={report.sections[0]?.metrics?.[2]?.value ?? "0%"} delta="实时" tone="violet" />
          <MetricCard label="报告总数" value={String(reportCount)} delta="实时" tone="amber" />
        </div>
      </header>

      <section className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <h2 className="text-base font-semibold">场景模板</h2>
            <p className="mt-1 text-sm text-slate-500">选择模板后会立即生成可编辑、可发布、可填写、可出报告的真实问卷。</p>
          </div>
          <span className="text-sm text-slate-500">{templates.length} 个可用模板</span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {templates.map((template) => (
            <TemplateCard key={template.id} template={template} onUse={() => onCreateSurvey(template)} />
          ))}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">真实问卷列表</h2>
            <span className="text-sm text-slate-500">点击问卷名称切换当前问卷</span>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[680px] border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="bg-slate-50 px-3 py-3 font-medium">问卷名称</th>
                  <th className="bg-slate-50 px-3 py-3 font-medium">状态</th>
                  <th className="bg-slate-50 px-3 py-3 font-medium">题目数</th>
                  <th className="bg-slate-50 px-3 py-3 font-medium">答卷数</th>
                  <th className="bg-slate-50 px-3 py-3 font-medium">更新时间</th>
                  <th className="bg-slate-50 px-3 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {surveys.map((survey) => (
                  <tr
                    key={survey.survey.id}
                    className={cn(survey.survey.id === activeSurveyId && "bg-blue-50/40")}
                  >
                    <td className="border-b border-slate-100 px-3 py-3 font-medium">
                      <button
                        type="button"
                        data-survey-id={survey.survey.id}
                        onClick={() => onActivateSurvey(survey.survey.id)}
                        className={cn(
                          "max-w-[320px] truncate text-left text-sm font-semibold hover:text-blue-700",
                          survey.survey.id === activeSurveyId ? "text-blue-700" : "text-slate-800"
                        )}
                        title={survey.survey.title}
                      >
                        {survey.survey.title}
                      </button>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3">
                      <StatusPill status={statusLabel(survey.survey.status)} />
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-700">{survey.questions.length}</td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-700">{survey.responses.length}</td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-700">{survey.survey.updatedAt.slice(0, 10)}</td>
                    <td className="border-b border-slate-100 px-3 py-3">
                      <button
                        type="button"
                        onClick={() => onOpenSurvey(survey.survey.id)}
                        className={cn("text-sm font-medium", survey.survey.id === activeSurveyId ? "text-blue-700" : "text-slate-600")}
                      >
                        设计 · 分析
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold">当前报告摘要</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">{report.summary}</p>
          <div className="mt-5">
            <ShareLinkBox sharePath={activeSurvey.shareLinks[0]?.url} compact />
          </div>
          <div className="mt-5 grid gap-3">
            {["创建空白问卷", "编辑当前问卷", "填写预览", "生成报告"].map((label) => (
              <button
                key={label}
                type="button"
                onClick={label === "创建空白问卷" ? () => onCreateSurvey() : undefined}
                className="flex items-center justify-between rounded-[8px] border border-slate-200 px-3 py-3 text-left text-sm hover:border-blue-200 hover:bg-blue-50"
              >
                <span className="font-medium text-slate-700">{label}</span>
                <span className="text-blue-600">→</span>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function TemplateCard({
  template,
  onUse,
}: {
  template: SurveyTemplateDefinition;
  onUse: () => void;
}) {
  const questionCount = template.sections.reduce((sum, section) => sum + section.questions.length, 0);

  return (
    <article className="flex min-h-[220px] flex-col rounded-[8px] border border-slate-200 bg-white p-4 transition hover:border-blue-200 hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-blue-700">{categoryLabel(template.category)}</p>
          <h3 className="mt-2 text-sm font-semibold leading-5 text-slate-900">{template.title}</h3>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{template.estimatedMinutes}</span>
      </div>
      <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{template.description}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {template.tags.slice(0, 3).map((tag) => (
          <span key={tag} className="rounded-full bg-slate-50 px-2 py-1 text-xs text-slate-500">
            {tag}
          </span>
        ))}
      </div>
      <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-4">
        <span className="text-xs text-slate-500">{template.sections.length} 个部分 · {questionCount} 题</span>
        <button
          type="button"
          onClick={onUse}
          className="h-8 rounded-[8px] bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-700"
        >
          使用模板
        </button>
      </div>
    </article>
  );
}

function BuilderView({
  survey,
  activeQuestion,
  activeQuestionId,
  validationPassed,
  warningCount,
  onAddQuestion,
  onSelectQuestion,
  onSaveQuestion,
  onPublish,
  onGenerateReport,
}: {
  survey: SurveyRecord;
  activeQuestion?: SurveyQuestion;
  activeQuestionId: string;
  validationPassed: boolean;
  warningCount: number;
  onAddQuestion: (type: QuestionType) => void;
  onSelectQuestion: (id: string) => void;
  onSaveQuestion: (id: string, patch: Partial<SurveyQuestion>) => void;
  onPublish: () => void;
  onGenerateReport: () => void;
}) {
  const [draftTitle, setDraftTitle] = useState(activeQuestion?.title ?? "");

  useEffect(() => {
    setDraftTitle(activeQuestion?.title ?? "");
  }, [activeQuestion?.id, activeQuestion?.title]);

  return (
    <div className="flex h-screen min-h-[760px] flex-col bg-[#f7f9fc]">
      <header className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold">{survey.survey.title}</h1>
            <p className="text-xs text-slate-500">
              {survey.survey.status === "published" ? "已发布，可通过分享链接收集答卷" : "草稿状态"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <TopBarButton label="生成报告" onClick={onGenerateReport} />
            <TopBarButton label="保存题目" onClick={() => activeQuestion && onSaveQuestion(activeQuestion.id, { title: draftTitle })} />
            <button
              type="button"
              onClick={onPublish}
              className="h-9 rounded-[8px] bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
            >
              发布
            </button>
          </div>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[240px_1fr_320px]">
        <aside className="overflow-auto rounded-[8px] border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold">题目组件</h2>
          {(["基础题型", "高级题型"] as const).map((group) => (
            <div key={group} className="mt-4">
              <p className="mb-2 text-xs font-medium text-slate-500">{group}</p>
              <div className="grid grid-cols-2 gap-2">
                {questionTypes
                  .filter((item) => item.group === group)
                  .map((item) => (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => onAddQuestion(item.type)}
                      className="rounded-[8px] border border-slate-200 px-2 py-3 text-xs text-slate-700 hover:border-blue-200 hover:bg-blue-50"
                    >
                      {item.label}
                    </button>
                  ))}
              </div>
            </div>
          ))}
          <div className="mt-5 border-t border-slate-100 pt-4">
            <p className="text-xs font-medium text-slate-500">发布检查</p>
            <p className={cn("mt-2 text-sm font-semibold", validationPassed ? "text-emerald-700" : "text-red-700")}>
              {validationPassed ? "可发布" : "需修复"}
            </p>
            <p className="mt-1 text-xs text-slate-500">{warningCount} 条建议 · {survey.responses.length} 份答卷</p>
          </div>
        </aside>

        <section className="overflow-auto rounded-[8px] border border-slate-200 bg-white p-5">
          {survey.sections.map((section) => (
            <div key={section.id} className="mb-5">
              <h2 className="text-sm font-semibold">{section.title}</h2>
              <p className="mt-1 text-xs text-slate-500">{section.description}</p>
              <div className="mt-3 grid gap-3">
                {survey.questions
                  .filter((question) => question.sectionId === section.id)
                  .map((question, questionIndex) => (
                    <button
                      key={question.id}
                      type="button"
                      onClick={() => onSelectQuestion(question.id)}
                      className={cn(
                        "rounded-[8px] border bg-white p-4 text-left shadow-sm transition",
                        activeQuestionId === question.id ? "border-blue-500 ring-2 ring-blue-100" : "border-slate-200 hover:border-blue-200"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium">
                          {questionIndex + 1}. {question.title}
                          <span className="ml-2 text-xs font-normal text-slate-400">（{questionTypeLabel(question.type)}）</span>
                        </p>
                        <span className="text-xs text-slate-400">{roleLabel(question.analysisConfig?.role)}</span>
                      </div>
                      <div className="mt-3 grid gap-2">
                        {(question.options ?? []).slice(0, 5).map((option) => (
                          <div key={option.id} className="flex items-center gap-2 text-sm text-slate-600">
                            <span className="h-3.5 w-3.5 rounded-full border border-slate-300" />
                            {option.label}
                          </div>
                        ))}
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </section>

        <aside className="overflow-auto rounded-[8px] border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold">发布设置</h2>
          <div className="mt-4">
            <ShareLinkBox sharePath={survey.shareLinks[0]?.url} onPublish={onPublish} />
          </div>
          <div className="my-5 border-t border-slate-100" />
          <h2 className="text-sm font-semibold">题目设置</h2>
          {activeQuestion ? (
            <div className="mt-4 grid gap-4">
              <label className="grid gap-2 text-xs font-medium text-slate-500">
                题目类型
                <input
                  className="h-10 rounded-[8px] border border-slate-200 bg-white px-3 text-sm text-slate-700"
                  value={questionTypeLabel(activeQuestion.type)}
                  readOnly
                />
              </label>
              <label className="grid gap-2 text-xs font-medium text-slate-500">
                题目标题
                <textarea
                  className="min-h-20 rounded-[8px] border border-slate-200 px-3 py-2 text-sm text-slate-700"
                  value={draftTitle}
                  onChange={(event) => setDraftTitle(event.target.value)}
                />
              </label>
              <SettingSwitch label="是否必填" checked={activeQuestion.required} />
              <div className="rounded-[8px] bg-slate-50 p-3">
                <p className="text-xs font-medium text-slate-500">分析角色</p>
                <p className="mt-2 text-sm font-semibold text-slate-800">{roleLabel(activeQuestion.analysisConfig?.role)}</p>
              </div>
              <button
                type="button"
                onClick={() => onSaveQuestion(activeQuestion.id, { title: draftTitle })}
                className="h-10 rounded-[8px] bg-blue-600 text-sm font-medium text-white"
              >
                保存题目
              </button>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function FillView({
  survey,
  answers,
  onSelectValue,
  onSubmit,
}: {
  survey: SurveyRecord;
  answers: Record<string, string>;
  onSelectValue: (questionId: string, value: string) => void;
  onSubmit: () => void;
}) {
  const answeredCount = survey.questions.filter((question) => isDraftAnswered(answers[question.id])).length;
  const progress = survey.questions.length === 0 ? 0 : Math.round((answeredCount / survey.questions.length) * 100);
  const questionNumbers = new Map(survey.questions.map((question, index) => [question.id, index + 1]));

  return (
    <div className="mx-auto grid min-h-screen max-w-7xl gap-5 p-4 sm:p-6 lg:grid-cols-[360px_1fr]">
      <aside className="rounded-[8px] border border-slate-200 bg-white shadow-sm">
        <div className="h-32 rounded-t-[8px] bg-[linear-gradient(135deg,#dbeafe_0%,#e0f2fe_40%,#eef2ff_100%)]">
          <div className="flex h-full items-end gap-2 overflow-hidden px-6">
            {[72, 104, 86, 120, 68, 96].map((height, index) => (
              <span key={index} className="w-8 bg-white/70" style={{ height }} />
            ))}
          </div>
        </div>
        <div className="p-5">
          <h1 className="text-lg font-semibold">{survey.survey.title}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">{survey.survey.description}</p>
          <div className="mt-6 grid gap-3 text-sm">
            <InfoRow label="分享链接" value={survey.shareLinks[0]?.url ?? "发布后生成"} />
            <InfoRow label="题目数量" value={`${survey.questions.length}题`} />
            <InfoRow label="已收答卷" value={`${survey.responses.length}份`} />
          </div>
          <div className="mt-8">
            <div className="flex justify-between text-xs text-slate-500">
              <span>填写进度</span>
              <span>{progress}%</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-slate-100">
              <div className="h-2 rounded-full bg-blue-600" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      </aside>

      <section className="max-h-none rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm sm:p-8 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-5 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-lg font-semibold">填写预览</h2>
            <p className="mt-2 text-sm text-slate-500">右侧一次展示全部问题，可向下滚动查看并提交。</p>
          </div>
          <span className="text-sm text-slate-500">已完成 {answeredCount}/{survey.questions.length}</span>
        </div>

        <div className="mt-6 grid gap-8">
          {survey.sections.map((section) => {
            const sectionQuestions = survey.questions.filter((question) => question.sectionId === section.id);
            if (sectionQuestions.length === 0) {
              return null;
            }

            return (
              <div key={section.id}>
                <p className="text-sm font-semibold text-slate-900">{section.title}</p>
                {section.description ? <p className="mt-1 text-sm text-slate-500">{section.description}</p> : null}
                <div className="mt-4 grid gap-5">
                  {sectionQuestions.map((question) => (
                    <article key={question.id} className="rounded-[8px] border border-slate-200 p-4">
                      <p className="text-base font-medium">
                        {questionNumbers.get(question.id)}. {question.title}
                        <span className="ml-2 text-sm font-normal text-slate-400">（{questionTypeLabel(question.type)}）</span>
                      </p>
                      <div className="mt-4 grid gap-3">
                        {(question.options ?? []).map((option) => (
                          <label
                            key={option.id}
                            className={cn(
                              "flex min-h-12 cursor-pointer items-center gap-3 rounded-[8px] border px-4 py-3 text-sm transition",
                              answers[question.id] === option.value
                                ? "border-blue-500 bg-blue-50 text-blue-800"
                                : "border-slate-200 text-slate-700 hover:border-blue-200"
                            )}
                          >
                            <input
                              type="radio"
                              className="h-4 w-4"
                              checked={answers[question.id] === option.value}
                              onChange={() => onSelectValue(question.id, option.value)}
                            />
                            {option.label}
                          </label>
                        ))}
                        {question.type === "textarea" || question.type === "text" || !question.options?.length ? (
                          <textarea
                            className="min-h-32 rounded-[8px] border border-slate-200 p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            placeholder="请输入您的反馈"
                            value={answers[question.id] ?? ""}
                            onChange={(event) => onSelectValue(question.id, event.target.value)}
                          />
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="sticky bottom-0 mt-8 border-t border-slate-100 bg-white pt-4">
          <button
            type="button"
            onClick={onSubmit}
            className="h-11 w-full rounded-[8px] bg-blue-600 text-sm font-medium text-white hover:bg-blue-700"
          >
            提交预览答卷
          </button>
        </div>
      </section>
    </div>
  );
}

function ReportView({
  survey,
  report,
  onGenerateReport,
}: {
  survey: SurveyRecord;
  report: GeneratedSurveyReport;
  onGenerateReport: () => void;
}) {
  const [activeTab, setActiveTab] = useState("报告概览");
  const tabs = ["报告概览", "报告正文", "诊断结论", "行动路线", "数据分析", "交叉分析", "原始数据", "报告设置"];
  const overviewMetrics = report.sections[0]?.metrics ?? [];
  const insights = report.sections[0]?.insights ?? [];
  const recommendations = report.sections.find((section) => section.id === "generated_recommendations")?.insights ?? [];
  const professionalReport = report as Partial<GeneratedSurveyReport>;
  const charts = report.charts as Partial<GeneratedSurveyReport["charts"]>;
  const industryDistribution = charts.industryDistribution ?? [];
  const companySizeDistribution = charts.companySizeDistribution ?? [];
  const maturityDistribution = charts.maturityDistribution ?? [];
  const blockerDistribution = charts.blockerDistribution ?? [];
  const priorityDistribution = charts.priorityDistribution ?? [];
  const dimensionScores = (charts.dimensionScores ?? []).filter((item) => item.sampleCount > 0);
  const questionDistributions = charts.questionDistributions ?? [];
  const digitalMaturityScore = charts.digitalMaturityScore ?? 0;
  const executiveSummary = professionalReport.executiveSummary ?? {
    headline: report.summary,
    boardMessage: report.sections[0]?.content ?? report.summary,
    maturityScore: digitalMaturityScore,
    maturityLevel: "待诊断",
    confidenceLabel: "待评估",
    recommendedFocus: recommendations[0] ?? "继续收集样本",
    nextReview: "建议补充样本后重新生成报告。",
  };
  const methodology = professionalReport.methodology ?? {
    sampleSize: survey.responses.length,
    validResponses: survey.responses.filter((item) => item.status === "completed").length,
    completionRate: 0,
    averageDuration: "0分0秒",
    confidenceLabel: "待评估",
    confidenceNote: "旧版报告缺少样本可信度说明，请重新生成报告获取完整诊断。",
    dataQualityScore: 0,
    segmentCoverage: [],
    limitations: ["旧版报告缺少方法学字段，请重新生成报告。"],
  };
  const diagnostics = professionalReport.diagnostics ?? {
    strongest: undefined,
    weakest: undefined,
    scoreSpread: 0,
    narratives: [],
  };
  const consultingFindings =
    professionalReport.consultingFindings ??
    insights.map((insight, index) => ({
      id: `legacy_finding_${index}`,
      title: `发现 ${index + 1}`,
      statement: insight,
      evidence: "基于当前报告摘要生成。",
      implication: "请重新生成报告以获得完整业务影响判断。",
      recommendation: recommendations[index] ?? "继续补充样本并复测。",
      severity: "medium" as const,
    }));
  const priorityMatrix = professionalReport.priorityMatrix ?? [];
  const actionPlan = professionalReport.actionPlan ?? [];
  const chapters = professionalReport.chapters ?? [];

  return (
    <div className="grid min-h-screen grid-cols-1 bg-[#f7f9fc] lg:grid-cols-[220px_1fr]">
      <aside className="border-b border-slate-200 bg-white p-4 lg:border-b-0 lg:border-r">
        <nav className="grid gap-1 text-sm">
          {tabs.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setActiveTab(item)}
              className={cn(
                "h-10 rounded-[8px] px-3 text-left text-slate-600 hover:bg-slate-100",
                activeTab === item && "bg-blue-50 font-medium text-blue-700"
              )}
            >
              {item}
            </button>
          ))}
        </nav>
      </aside>

      <section className="min-w-0 p-4 sm:p-6">
        <header className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold">{report.title}</h1>
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">已完成</span>
              </div>
              <p className="mt-2 text-sm text-slate-500">
                生成时间：{report.generatedAt.slice(0, 16).replace("T", " ")} · 样本数量：{survey.responses.length}份 · 报告版本：{survey.reports.length || 1}
              </p>
            </div>
            <button
              type="button"
              onClick={onGenerateReport}
              className="h-9 rounded-[8px] border border-slate-200 px-3 text-sm text-slate-700"
            >
              重新生成报告
            </button>
          </div>
        </header>

        {activeTab === "报告概览" ? (
          <div className="mt-5 grid gap-5">
            <section className="grid gap-5 xl:grid-cols-[1.35fr_0.9fr]">
              <ExecutiveSummaryPanel summary={executiveSummary} />
              <MethodologyPanel methodology={methodology} />
            </section>

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {overviewMetrics.map((metric) => (
                <MetricCard key={metric.label} label={metric.label} value={metric.value} delta="实时" tone={metric.tone} />
              ))}
            </section>

            <section className="grid gap-5 xl:grid-cols-[1.1fr_1fr]">
              <div className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold">企业数字化转型成熟度分布</h2>
                    <p className="mt-1 text-sm text-slate-500">综合战略、流程、数据和系统能力计算。</p>
                  </div>
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                    均分 {digitalMaturityScore.toFixed(1)}
                  </span>
                </div>
                <div className="mt-6 grid gap-5 lg:grid-cols-[240px_1fr]">
                  <DonutChart data={maturityDistribution} score={digitalMaturityScore} />
                  <ChartLegend data={maturityDistribution} />
                </div>
              </div>

              <div className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-base font-semibold">关键发现</h2>
                <InsightList insights={insights} />
                <h3 className="mt-5 text-sm font-semibold">行业分布</h3>
                <BarChart data={industryDistribution} />
              </div>
            </section>

            <section className="grid gap-5 xl:grid-cols-4">
              {dimensionScores.map((item) => (
                <DimensionCard key={item.key} label={item.label} score={item.score} level={item.level} />
              ))}
            </section>
          </div>
        ) : null}

        {activeTab === "报告正文" ? (
          <ReportChapters chapters={chapters} />
        ) : null}

        {activeTab === "诊断结论" ? (
          <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_420px]">
            <section className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold">咨询式关键发现</h2>
              <div className="mt-4 grid gap-3">
                {consultingFindings.map((finding, index) => (
                  <FindingCard key={finding.id} finding={finding} index={index + 1} />
                ))}
              </div>
            </section>
            <section className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold">能力诊断</h2>
              <DiagnosticNarratives narratives={diagnostics.narratives} />
              <div className="mt-5 border-t border-slate-100 pt-4">
                <h3 className="text-sm font-semibold">样本解读边界</h3>
                <InsightList insights={methodology.limitations} tone="amber" />
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === "行动路线" ? (
          <div className="mt-5 grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
            <section className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold">优先级矩阵</h2>
              <PriorityMatrix items={priorityMatrix} />
            </section>
            <section className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold">30/60/90 天行动路线图</h2>
              <ActionPlanTimeline items={actionPlan} />
              <div className="mt-5 border-t border-slate-100 pt-4">
                <h3 className="text-sm font-semibold">管理建议</h3>
                <InsightList insights={recommendations} tone="emerald" />
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === "数据分析" ? (
          <div className="mt-5 grid gap-5">
            <section className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold">数字化能力维度得分</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {dimensionScores.map((item) => (
                  <DimensionScoreRow key={item.key} label={item.label} score={item.score} level={item.level} />
                ))}
              </div>
            </section>
            <section className="grid gap-5 xl:grid-cols-2">
              {questionDistributions.map((item) => (
                <div key={item.questionId} className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="text-sm font-semibold">{item.title}</h3>
                  <HorizontalBarChart data={item.data} />
                </div>
              ))}
            </section>
          </div>
        ) : null}

        {activeTab === "交叉分析" ? (
          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <section className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold">行业画像</h2>
              <HorizontalBarChart data={industryDistribution} />
            </section>
            <section className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold">企业规模画像</h2>
              <HorizontalBarChart data={companySizeDistribution} />
            </section>
            <section className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold">主要阻碍</h2>
              <HorizontalBarChart data={blockerDistribution} />
            </section>
            <section className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold">优先推进方向</h2>
              <HorizontalBarChart data={priorityDistribution} />
            </section>
          </div>
        ) : null}

        {activeTab === "原始数据" ? (
          <section className="mt-5 rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">原始答卷</h2>
              <span className="text-sm text-slate-500">{survey.responses.length} 条记录</span>
            </div>
            <RawResponseTable survey={survey} />
          </section>
        ) : null}

        {activeTab === "报告设置" ? (
          <section className="mt-5 grid gap-5 xl:grid-cols-2">
            <div className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold">报告结构</h2>
              <div className="mt-4 grid gap-3 text-sm">
                {(survey.reportTemplate?.sections ?? []).map((section) => (
                  <div key={section.id} className="flex items-center justify-between rounded-[8px] bg-slate-50 px-3 py-3">
                    <span className="font-medium text-slate-700">{section.title}</span>
                    <span className="text-slate-500">{section.sourceQuestionIds.length} 个题源</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold">生成信息</h2>
              <div className="mt-4 grid gap-3 text-sm text-slate-600">
                <InfoRow label="问卷状态" value={statusLabel(survey.survey.status)} />
                <InfoRow label="报告编号" value={report.id} />
                <InfoRow label="报告模板" value={survey.reportTemplate?.reportType ?? "自动模板"} />
                <InfoRow label="分享链接" value={survey.shareLinks[0]?.url ?? "未发布"} />
              </div>
            </div>
          </section>
        ) : null}
      </section>
    </div>
  );
}

function ReportChapters({ chapters }: { chapters: NonNullable<GeneratedSurveyReport["chapters"]> }) {
  if (chapters.length === 0) {
    return (
      <section className="mt-5 rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold">报告正文</h2>
        <p className="mt-3 text-sm text-slate-500">请重新生成报告以获取完整正文章节。</p>
      </section>
    );
  }

  return (
    <div className="mt-5 grid gap-5">
      {chapters.map((chapter) => (
        <article key={chapter.id} className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="border-b border-slate-100 pb-4">
            <p className="text-xs font-medium text-blue-700">{chapter.subtitle}</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-950">{chapter.title}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-700">{chapter.narrative}</p>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">关键证据</h3>
              <InsightList insights={chapter.evidence} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">建议动作</h3>
              <InsightList insights={chapter.recommendations} tone="emerald" />
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function ExecutiveSummaryPanel({ summary }: { summary: NonNullable<GeneratedSurveyReport["executiveSummary"]> }) {
  return (
    <section className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div className="max-w-3xl">
          <p className="text-xs font-medium text-blue-700">执行摘要</p>
          <h2 className="mt-2 text-lg font-semibold leading-7 text-slate-950">{summary.headline}</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">{summary.boardMessage}</p>
        </div>
        <div className="grid min-w-[220px] grid-cols-2 gap-2 text-sm">
          <InfoBadge label="成熟度" value={`${summary.maturityScore.toFixed(1)} / 5`} />
          <InfoBadge label="阶段" value={summary.maturityLevel} />
          <InfoBadge label="可信度" value={summary.confidenceLabel} />
          <InfoBadge label="复测周期" value="90天" />
        </div>
      </div>
      <div className="mt-5 grid gap-3 border-t border-slate-100 pt-4 md:grid-cols-2">
        <InfoRow label="优先聚焦" value={summary.recommendedFocus} />
        <InfoRow label="下一步复测" value={summary.nextReview} />
      </div>
    </section>
  );
}

function MethodologyPanel({ methodology }: { methodology: NonNullable<GeneratedSurveyReport["methodology"]> }) {
  return (
    <section className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500">样本可信度</p>
          <h2 className="mt-2 text-base font-semibold">{methodology.confidenceLabel}</h2>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
          质量 {methodology.dataQualityScore}/100
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">{methodology.confidenceNote}</p>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <InfoBadge label="有效样本" value={`${methodology.validResponses}/${methodology.sampleSize}`} />
        <InfoBadge label="完成率" value={`${methodology.completionRate}%`} />
        <InfoBadge label="平均用时" value={methodology.averageDuration} />
        <InfoBadge label="覆盖维度" value={`${methodology.segmentCoverage.length}项`} />
      </div>
      <div className="mt-4 grid gap-2">
        {methodology.segmentCoverage.map((item) => (
          <p key={item} className="rounded-[8px] bg-slate-50 px-3 py-2 text-xs text-slate-600">
            {item}
          </p>
        ))}
      </div>
    </section>
  );
}

function InfoBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 truncate font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function FindingCard({
  finding,
  index,
}: {
  finding: NonNullable<GeneratedSurveyReport["consultingFindings"]>[number];
  index: number;
}) {
  const severityClass = {
    high: "bg-red-50 text-red-700",
    medium: "bg-amber-50 text-amber-700",
    low: "bg-emerald-50 text-emerald-700",
  }[finding.severity];

  return (
    <article className="rounded-[8px] border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] bg-blue-50 text-sm font-semibold text-blue-700">
            {index}
          </span>
          <h3 className="truncate text-sm font-semibold text-slate-900">{finding.title}</h3>
        </div>
        <span className={cn("rounded-full px-2 py-1 text-xs font-medium", severityClass)}>{finding.severity.toUpperCase()}</span>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-700">{finding.statement}</p>
      <div className="mt-3 grid gap-3 text-xs leading-5 text-slate-600 md:grid-cols-3">
        <FindingCell label="证据" value={finding.evidence} />
        <FindingCell label="影响" value={finding.implication} />
        <FindingCell label="建议" value={finding.recommendation} />
      </div>
    </article>
  );
}

function FindingCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] bg-slate-50 p-3">
      <p className="font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-slate-700">{value}</p>
    </div>
  );
}

function DiagnosticNarratives({ narratives }: { narratives: NonNullable<GeneratedSurveyReport["diagnostics"]>["narratives"] }) {
  if (narratives.length === 0) {
    return <p className="mt-4 text-sm text-slate-500">暂无能力诊断，请重新生成报告。</p>;
  }

  return (
    <div className="mt-4 grid gap-3">
      {narratives.map((item) => (
        <div key={item.key} className="rounded-[8px] border border-slate-200 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">{item.label}</h3>
              <p className="mt-1 text-xs text-slate-500">{item.evidence}</p>
            </div>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{item.score.toFixed(1)}</span>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">{item.diagnosis}</p>
          <p className="mt-2 text-sm leading-6 text-blue-700">{item.recommendation}</p>
        </div>
      ))}
    </div>
  );
}

function PriorityMatrix({ items }: { items: NonNullable<GeneratedSurveyReport["priorityMatrix"]> }) {
  if (items.length === 0) {
    return <p className="mt-4 text-sm text-slate-500">暂无优先级数据，请重新生成报告。</p>;
  }

  return (
    <div className="mt-4 grid gap-3">
      {items.map((item) => (
        <div key={item.id} className="rounded-[8px] border border-slate-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">{item.label}</h3>
              <p className="mt-1 text-xs text-slate-500">{item.category}</p>
            </div>
            <span className={cn("rounded-full px-2 py-1 text-xs font-semibold", priorityClass(item.priority))}>{item.priority}</span>
          </div>
          <div className="mt-4 grid gap-3">
            <ScoreBar label="影响度" value={item.impact} tone="blue" />
            <ScoreBar label="紧迫度" value={item.urgency} tone="amber" />
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">{item.rationale}</p>
        </div>
      ))}
    </div>
  );
}

function ActionPlanTimeline({ items }: { items: NonNullable<GeneratedSurveyReport["actionPlan"]> }) {
  if (items.length === 0) {
    return <p className="mt-4 text-sm text-slate-500">暂无行动计划，请重新生成报告。</p>;
  }

  return (
    <div className="mt-4 grid gap-4">
      {items.map((item) => (
        <article key={item.phase} className="rounded-[8px] border border-slate-200 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-blue-700">{item.phase}</p>
              <h3 className="mt-1 text-sm font-semibold text-slate-900">{item.title}</h3>
            </div>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{item.owner}</span>
          </div>
          <div className="mt-3 grid gap-2 text-sm leading-6 text-slate-600">
            {item.actions.map((action) => (
              <p key={action} className="rounded-[8px] bg-slate-50 px-3 py-2">
                {action}
              </p>
            ))}
          </div>
          <p className="mt-3 text-xs font-medium text-emerald-700">衡量指标：{item.metric}</p>
        </article>
      ))}
    </div>
  );
}

function ScoreBar({ label, value, tone }: { label: string; value: number; tone: "blue" | "amber" }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-slate-500">{label}</span>
        <span className="font-medium text-slate-700">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100">
        <div className={cn("h-2 rounded-full", tone === "blue" ? "bg-blue-600" : "bg-amber-500")} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function priorityClass(priority: string): string {
  if (priority === "P0") {
    return "bg-red-50 text-red-700";
  }
  if (priority === "P1") {
    return "bg-amber-50 text-amber-700";
  }
  return "bg-emerald-50 text-emerald-700";
}

function InsightList({ insights, tone = "blue" }: { insights: string[]; tone?: "blue" | "emerald" | "amber" }) {
  const color = tone === "emerald" ? "text-emerald-700" : tone === "amber" ? "text-amber-700" : "text-blue-700";
  return (
    <div className="mt-4 grid gap-3 text-sm leading-6 text-slate-600">
      {insights.map((insight, index) => (
        <p key={`${index}-${insight.slice(0, 24)}`} className="border-b border-slate-100 pb-3 last:border-0">
          <span className={cn("font-semibold", color)}>• </span>
          {insight}
        </p>
      ))}
    </div>
  );
}

function InsightCard({ index, text }: { index: number; text: string }) {
  return (
    <div className="rounded-[8px] border border-slate-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] bg-blue-50 text-sm font-semibold text-blue-700">
          {index}
        </span>
        <p className="text-sm leading-6 text-slate-700">{text}</p>
      </div>
    </div>
  );
}

function DimensionCard({ label, score, level }: { label: string; score: number; level: string }) {
  return (
    <div className="rounded-[8px] border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-slate-500">{label}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="text-2xl font-semibold">{score.toFixed(1)}</p>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">{level}</span>
      </div>
      <div className="mt-4 h-2 rounded-full bg-slate-100">
        <div className="h-2 rounded-full bg-blue-600" style={{ width: `${Math.min((score / 5) * 100, 100)}%` }} />
      </div>
    </div>
  );
}

function DimensionScoreRow({ label, score, level }: { label: string; score: number; level: string }) {
  return (
    <div className="rounded-[8px] border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-800">{label}</p>
          <p className="mt-1 text-xs text-slate-500">{level}</p>
        </div>
        <p className="text-xl font-semibold">{score.toFixed(1)}</p>
      </div>
      <div className="mt-4 h-2 rounded-full bg-slate-100">
        <div
          className={cn(
            "h-2 rounded-full",
            score >= 4.2 ? "bg-emerald-500" : score >= 3.6 ? "bg-amber-500" : "bg-blue-600"
          )}
          style={{ width: `${Math.min((score / 5) * 100, 100)}%` }}
        />
      </div>
    </div>
  );
}

function HorizontalBarChart({ data }: { data: DistributionDatum[] }) {
  const chartData = data.length > 0 ? data : [{ label: "暂无数据", value: 0, percent: 0 }];
  return (
    <div className="mt-4 grid gap-3">
      {chartData.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex items-center justify-between gap-3 text-xs">
            <span className="font-medium text-slate-700">{item.label}</span>
            <span className="text-slate-500">{item.percent}%（{item.value}）</span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-100">
            <div className="h-2.5 rounded-full bg-blue-600" style={{ width: `${Math.max(item.percent, item.value > 0 ? 4 : 0)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function RawResponseTable({ survey }: { survey: SurveyRecord }) {
  const displayQuestions = survey.questions.slice(0, 6);
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[920px] border-separate border-spacing-0 text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-500">
            <th className="bg-slate-50 px-3 py-3 font-medium">提交时间</th>
            <th className="bg-slate-50 px-3 py-3 font-medium">渠道</th>
            {displayQuestions.map((question) => (
              <th key={question.id} className="bg-slate-50 px-3 py-3 font-medium">
                {question.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {survey.responses.length === 0 ? (
            <tr>
              <td className="border-b border-slate-100 px-3 py-4 text-slate-500" colSpan={displayQuestions.length + 2}>
                暂无答卷
              </td>
            </tr>
          ) : (
            survey.responses.map((response) => (
              <tr key={response.id}>
                <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                  {(response.submittedAt ?? response.startedAt).slice(0, 16).replace("T", " ")}
                </td>
                <td className="border-b border-slate-100 px-3 py-3 text-slate-700">{response.metadata.channel ?? "未知"}</td>
                {displayQuestions.map((question) => (
                  <td key={question.id} className="border-b border-slate-100 px-3 py-3 text-slate-700">
                    {answerDisplay(question, response.answers.find((answer) => answer.questionId === question.id))}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function MetricCard({
  label,
  value,
  delta,
  tone,
}: {
  label: string;
  value: string;
  delta: string;
  tone: "blue" | "green" | "violet" | "amber";
}) {
  const toneClass = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
    violet: "bg-violet-50 text-violet-700",
    amber: "bg-amber-50 text-amber-700",
  }[tone];

  return (
    <div className="rounded-[8px] border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-2">
        <p className="text-xl font-semibold">{value}</p>
        <span className={cn("rounded-full px-2 py-1 text-xs font-medium", toneClass)}>{delta}</span>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const classes =
    status === "发布中"
      ? "bg-emerald-50 text-emerald-700"
      : status === "草稿"
        ? "bg-slate-100 text-slate-600"
        : "bg-amber-50 text-amber-700";
  return <span className={cn("rounded-full px-2 py-1 text-xs font-medium", classes)}>{status}</span>;
}

function TopBarButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-9 rounded-[8px] border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50"
    >
      {label}
    </button>
  );
}

function SettingSwitch({ label, checked }: { label: string; checked: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-700">{label}</span>
      <span className={cn("relative h-6 w-11 rounded-full", checked ? "bg-blue-600" : "bg-slate-200")}>
        <span className={cn("absolute top-1 h-4 w-4 rounded-full bg-white transition", checked ? "left-6" : "left-1")} />
      </span>
    </div>
  );
}

function ShareLinkBox({
  sharePath,
  compact,
  onPublish,
}: {
  sharePath?: string;
  compact?: boolean;
  onPublish?: () => void;
}) {
  const [copyState, setCopyState] = useState("复制链接");
  const [origin, setOrigin] = useState("");
  const href = sharePath ?? "";
  const displayHref = href && origin && !href.startsWith("http") ? new URL(href, origin).toString() : href;

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  async function copyLink() {
    if (!href) return;
    await navigator.clipboard.writeText(displayHref);
    setCopyState("已复制");
    window.setTimeout(() => setCopyState("复制链接"), 1600);
  }

  if (!href) {
    return (
      <div className="rounded-[8px] border border-dashed border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-medium text-slate-500">分享链接</p>
        <p className="mt-2 text-sm text-slate-600">发布问卷后自动生成填写链接。</p>
        {onPublish ? (
          <button
            type="button"
            onClick={onPublish}
            className="mt-3 h-9 w-full rounded-[8px] bg-blue-600 text-sm font-medium text-white hover:bg-blue-700"
          >
            发布并生成链接
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-[8px] border border-blue-100 bg-blue-50 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-blue-800">分享链接</p>
        <span className="rounded-full bg-white px-2 py-1 text-[11px] font-medium text-emerald-700">可填写</span>
      </div>
      <div
        className={cn(
          "mt-3 flex gap-2",
          compact ? "flex-col" : "flex-col"
        )}
      >
        <input
          className="h-10 min-w-0 rounded-[8px] border border-blue-100 bg-white px-3 text-sm text-slate-700"
          value={displayHref}
          readOnly
          aria-label="分享链接"
        />
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => void copyLink()}
            className="h-9 rounded-[8px] bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700"
          >
            {copyState}
          </button>
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="grid h-9 place-items-center rounded-[8px] border border-blue-200 bg-white px-3 text-sm font-medium text-blue-700"
          >
            打开填写页
          </a>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-700">{value}</span>
    </div>
  );
}

function BarChart({ data }: { data: DistributionDatum[] }) {
  const chartData = data.length > 0 ? data : [{ label: "暂无数据", value: 1, percent: 0 }];
  const max = Math.max(...chartData.map((item) => item.value), 1);
  return (
    <div className="mt-4 flex h-48 items-end gap-5">
      {chartData.map((item) => (
        <div key={item.label} className="flex flex-1 flex-col items-center gap-2">
          <span className="text-xs font-medium text-slate-700">{item.percent}%</span>
          <div className="w-full rounded-t-[8px] bg-blue-600" style={{ height: `${Math.max((item.value / max) * 132, 16)}px` }} />
          <span className="text-center text-xs text-slate-500">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ data, score }: { data: DistributionDatum[]; score: number }) {
  const chartData = data.length > 0 ? data : [{ label: "暂无数据", value: 1, percent: 100 }];
  const colors = ["#2563eb", "#14b8a6", "#f59e0b", "#7c3aed"];
  let offset = 25;
  return (
    <svg viewBox="0 0 120 120" className="mx-auto h-56 w-56" role="img" aria-label="成熟度分布图">
      <circle cx="60" cy="60" r="42" fill="none" stroke="#e2e8f0" strokeWidth="18" />
      {chartData.map((item, index) => {
        const length = item.percent * 2.64;
        const circle = (
          <circle
            key={item.label}
            cx="60"
            cy="60"
            r="42"
            fill="none"
            stroke={colors[index % colors.length]}
            strokeDasharray={`${length} ${264 - length}`}
            strokeDashoffset={-offset}
            strokeLinecap="butt"
            strokeWidth="18"
            transform="rotate(-90 60 60)"
          />
        );
        offset += length;
        return circle;
      })}
      <text x="60" y="63" textAnchor="middle" className="fill-slate-950 text-sm font-semibold">
        {data.length > 0 ? score.toFixed(1) : "0"}
      </text>
    </svg>
  );
}

function ChartLegend({ data }: { data: DistributionDatum[] }) {
  const chartData = data.length > 0 ? data : [{ label: "暂无数据", value: 0, percent: 0 }];
  const colors = ["bg-blue-600", "bg-teal-500", "bg-amber-500", "bg-violet-600"];
  return (
    <div className="grid content-center gap-3">
      {chartData.map((item, index) => (
        <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
          <span className="flex items-center gap-2 text-slate-700">
            <span className={cn("h-2.5 w-2.5 rounded-full", colors[index % colors.length])} />
            {item.label}
          </span>
          <span className="text-slate-500">{item.percent}%（{item.value}）</span>
        </div>
      ))}
    </div>
  );
}

function questionTypeLabel(type: QuestionType): string {
  const labels: Partial<Record<QuestionType, string>> = {
    single_choice: "单选",
    multiple_choice: "多选",
    textarea: "开放题",
    rating: "评分",
    scale: "量表",
    nps: "NPS",
    industry_selector: "行业选择",
    company_size: "企业规模",
    satisfaction_score: "满意度",
  };
  return labels[type] ?? type;
}

function roleLabel(role?: string): string {
  const labels: Record<string, string> = {
    profile: "画像字段",
    metric: "核心指标",
    dimension: "维度分析",
    segment: "分群字段",
    open_feedback: "开放反馈",
    filter: "筛选字段",
    appendix: "附录字段",
  };
  return role ? labels[role] ?? role : "未配置";
}

function statusLabel(status: string): string {
  return status === "published" ? "发布中" : status === "draft" ? "草稿" : status;
}

function categoryLabel(category: string): string {
  const labels: Record<string, string> = {
    customer_satisfaction: "客户满意度",
    market_research: "市场调研",
    product_feedback: "产品反馈",
    brand_research: "品牌研究",
    employee_engagement: "员工敬业度",
    business_diagnosis: "业务诊断",
    event_feedback: "活动反馈",
    custom: "通用反馈",
  };
  return labels[category] ?? category;
}

function hasRichReportShape(report: GeneratedSurveyReport): boolean {
  const charts = report.charts as Partial<GeneratedSurveyReport["charts"]>;
  const professionalReport = report as Partial<GeneratedSurveyReport>;
  return Boolean(
    charts.maturityDistribution &&
      charts.industryDistribution &&
      charts.companySizeDistribution &&
      charts.blockerDistribution &&
      charts.priorityDistribution &&
      charts.dimensionScores &&
      charts.questionDistributions &&
      professionalReport.executiveSummary &&
      professionalReport.methodology &&
      professionalReport.diagnostics &&
      professionalReport.consultingFindings &&
      professionalReport.priorityMatrix &&
      professionalReport.actionPlan &&
      professionalReport.chapters
  );
}

function makeQuestionInput(type: QuestionType): AddQuestionInput {
  const baseOptions: QuestionOption[] = [
    { id: "a", label: "非常低", value: "1", score: 1 },
    { id: "b", label: "较低", value: "2", score: 2 },
    { id: "c", label: "一般", value: "3", score: 3 },
    { id: "d", label: "较高", value: "4", score: 4 },
    { id: "e", label: "非常高", value: "5", score: 5 },
  ];

  if (type === "textarea") {
    return {
      type,
      title: "请补充您的开放反馈",
      required: false,
      analysisRole: "open_feedback",
    };
  }

  return {
    type,
    title: `新增${questionTypeLabel(type)}`,
    required: true,
    options: baseOptions.map(({ id: _id, ...option }) => option),
    analysisRole: type === "company_size" || type === "industry_selector" ? "profile" : "dimension",
    dimensionKey: type === "company_size" || type === "industry_selector" ? undefined : "business_score",
  };
}

function createAnswer(question: SurveyQuestion, rawValue?: string): SurveyAnswer {
  if (question.type === "textarea" || !question.options?.length) {
    const textValue = rawValue?.trim() || "";
    return {
      questionId: question.id,
      value: textValue,
      textValue,
    };
  }

  const selectedOption = question.options.find((option) => option.value === rawValue);
  return {
    questionId: question.id,
    value: selectedOption?.value ?? rawValue ?? "",
    optionIds: selectedOption ? [selectedOption.id] : undefined,
  };
}

function isDraftAnswered(value?: string): boolean {
  return Boolean(value?.trim());
}

function answerDisplay(question: SurveyQuestion, answer?: SurveyAnswer): string {
  if (!answer) {
    return "-";
  }

  if (answer.textValue) {
    return answer.textValue;
  }

  const selectedOptionId = answer.optionIds?.[0];
  const selectedOption =
    question.options?.find((option) => option.id === selectedOptionId) ??
    question.options?.find((option) => option.value === answer.value);

  if (selectedOption) {
    return selectedOption.label;
  }

  if (Array.isArray(answer.value)) {
    return answer.value.join(", ");
  }

  if (typeof answer.value === "object") {
    return JSON.stringify(answer.value);
  }

  return String(answer.value);
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? `Request failed: ${response.status}`);
  }

  return data;
}
