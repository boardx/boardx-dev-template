"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import * as echarts from "echarts/core";
import { BarChart, FunnelChart, GaugeChart, HeatmapChart, LineChart, PieChart, RadarChart, ScatterChart, TreemapChart } from "echarts/charts";
import { GridComponent, LegendComponent, RadarComponent, TooltipComponent, VisualMapComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BarChart3,
  ChevronLeft,
  ClipboardList,
  Copy,
  Eye,
  FileText,
  LayoutTemplate,
  ListChecks,
  PauseCircle,
  PanelRightOpen,
  Pencil,
  PlayCircle,
  Plus,
  Send,
  SlidersHorizontal,
  Sparkles,
  Target,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ProfessionalReportDocument } from "@/components/survey/professional-report-document";
import { SurveyAiPanel } from "@/components/survey/survey-ai-panel";
import { SurveyHomeDashboard } from "@/components/survey/survey-home-dashboard";
import { SurveyListScreen } from "@/components/survey/survey-list-screen";
import { SurveyNavigationSidebar, type SurveyNavigationTarget } from "@/components/survey/survey-navigation-sidebar";
import { SurveyOutlinePanel } from "@/components/survey/survey-outline-panel";
import { SurveyDesignWorkbench } from "@/components/survey/survey-design-workbench";
import { SurveyReportVersionHistory } from "@/components/survey/survey-report-version-history";
import { SurveyProfessionalReportWorkbench } from "@/components/survey/survey-professional-report-workbench";
import { SurveyVersionedReportComposer } from "@/components/survey/survey-versioned-report-composer";
import {
  downloadProfessionalWordReport,
  openProfessionalPdfExportWindow,
  type ReportExportPayload,
} from "@/lib/report-export";
import {
  buildReportComposerPreview,
  type ComposerQuestion,
  type ReportComposerPreview,
} from "@/lib/survey-report-category-plan";
import {
  beginSurveyReportCategoryPlanPersistence,
  beginSurveyReportGenerationRequest,
  captureSurveyReportRequestEpoch,
  createSurveyReportRequestState,
  isSurveyReportRequestCurrent,
  settleSurveyReportGenerationRequest,
  settleSurveyReportRefresh,
  type SurveyReportRequestState,
  type SurveyReportGenerationStatus,
} from "@/lib/survey-report-generation";
import type { PlannedReportBlock } from "@/lib/survey-report-planner";
import {
  isTemplateDrivenSurveyReport,
  type SurveyReportDocument,
} from "@/lib/survey-report-document";
import { isExactReportVersionResponse } from "@/lib/survey-report-version-navigation";

echarts.use([
  BarChart,
  FunnelChart,
  GaugeChart,
  HeatmapChart,
  LineChart,
  PieChart,
  RadarChart,
  ScatterChart,
  TreemapChart,
  GridComponent,
  LegendComponent,
  RadarComponent,
  TooltipComponent,
  VisualMapComponent,
  CanvasRenderer,
]);

type QType =
  | "short_text"
  | "text"
  | "email"
  | "number"
  | "phone"
  | "single"
  | "multiple"
  | "dropdown"
  | "rating"
  | "linear_scale"
  | "nps"
  | "date"
  | "time"
  | "file";

interface Question {
  id: string;
  title: string;
  type: QType;
  required: boolean;
  options: string[];
  category?: string;
}

interface Survey {
  id: number;
  title: string;
  description: string;
  scope: string;
  status: "active" | "paused";
  responseMode: "anonymous" | "identified";
  publishStartAt: string | null;
  publishEndAt: string | null;
  responseLimit: number | null;
  oneResponsePerUser: boolean;
  confirmationMessage: string;
  responses: number;
  generatedReports: number;
  teamId: number | null;
  updatedAt: string;
  isOwner: boolean;
  shareUrl: string;
}

interface Team {
  id: number;
  name: string;
}

interface AiMessage {
  role: "assistant" | "user";
  content: string;
}

interface AiDraftQuestion {
  title: string;
  type: QType;
  required: boolean;
  options: string[];
  category?: string;
}

interface ReportTemplateDraft {
  title: string;
  sections: string[];
  metrics: string[];
  chartSlots: string[];
  caveats: string[];
}

type ReportElement = "text" | "image" | "chart";
type ReportInputMode = "text" | "chat" | "chart" | "image";
type ReportCategoryChartType =
  | "bar" | "grouped_bar" | "stacked_bar" | "line" | "area" | "pie" | "doughnut" | "rose"
  | "scatter" | "radar" | "heatmap" | "treemap" | "funnel" | "gauge" | "waterfall"
  | "histogram" | "boxplot" | "matrix" | "kpi" | "text";
type ReportCategoryChartStyle = "auto" | "business" | "minimal" | "editorial" | "presentation" | "dark";

interface ReportCategoryDraft {
  id: string;
  name: string;
  description: string;
  requirement?: string;
  questionIds: number[];
  outputType: ReportElement;
  inputModes: [ReportElement];
  chartTemplateId?:
    | "line-simple"
    | "bar-simple"
    | "pie-simple"
    | "scatter-simple"
    | "radar"
    | "funnel"
    | "gauge"
    | "heatmap-cartesian";
  chartType?: ReportCategoryChartType;
  chartStyle?: ReportCategoryChartStyle;
  chartConfig?: {
    primaryColor: string;
    maxDimensions: number;
    sort: "none" | "asc" | "desc";
    showLabels: boolean;
    showLegend: boolean;
    orientation: "vertical" | "horizontal";
  };
  dataPrompt?: string;
  modulePrompts?: Partial<Record<ReportInputMode, string>>;
  prompt: string;
  order: number;
  isCustom: boolean;
}

interface ReportCategoryPlanDraft {
  title: string;
  description: string;
  categories: ReportCategoryDraft[];
}

const VISIBLE_REPORT_INPUT_MODES: ReportInputMode[] = ["image", "chart", "text"];

function visibleInputModes(modes: ReportInputMode[]) {
  return VISIBLE_REPORT_INPUT_MODES.filter((mode) => modes.includes(mode));
}

interface SurveyTemplate {
  id: string;
  source: "built_in" | "saved";
  name: string;
  category?: string;
  tags?: string[];
  title: string;
  description: string;
  estimatedMinutes?: number;
  questions: Omit<Question, "id">[];
  reportTemplate?: ReportTemplateDraft;
}

interface AiDraft {
  reply: string;
  summary?: string;
  title: string;
  description: string;
  questions: AiDraftQuestion[];
  reportTemplate?: ReportTemplateDraft;
  clarifyingQuestions?: string[];
  reportOutline?: string[];
  assumptions?: string[];
  intentCanvas?: {
    purpose?: {
      goal?: string;
      successMetrics?: string[];
      expectedDecisions?: string[];
    };
    audience?: {
      persona?: string;
      context?: string;
      painPoints?: string[];
    };
    decision?: {
      decision?: string;
      successCriteria?: string[];
    };
    information?: {
      categories?: string[];
      requiredSignals?: string[];
    };
    constraints?: {
      completionTime?: string;
      platform?: string;
      delivery?: string;
      analysis?: string[];
    };
  };
}

interface AiSessionListItem {
  id: string;
  status?: string;
}

interface AiChangeOperation {
  id: string;
  action: "add_question" | "rewrite_question" | "update_required" | "move_question" | "remove_question";
  targetIndex?: number;
  position?: number;
  before?: Record<string, unknown>;
  after?: Partial<AiDraftQuestion>;
  rationale: string;
}

interface AiChangeSet {
  id?: string;
  reply: string;
  summary: string;
  operations: AiChangeOperation[];
  checks: { label: string; status: "pass" | "warning" | "fail"; message: string }[];
}

const TYPE_LABEL: Record<QType, string> = {
  short_text: "短文本",
  text: "段落",
  email: "邮箱",
  number: "数字",
  phone: "手机号",
  single: "单选",
  multiple: "多选",
  dropdown: "下拉",
  rating: "评分",
  linear_scale: "线性量表",
  nps: "NPS",
  date: "日期",
  time: "时间",
  file: "文件上传",
};

const TYPE_GROUPS: { label: string; types: QType[] }[] = [
  { label: "文本", types: ["short_text", "text", "email", "number", "phone"] },
  { label: "选择", types: ["single", "multiple", "dropdown"] },
  { label: "量表", types: ["rating", "linear_scale", "nps"] },
  { label: "时间与文件", types: ["date", "time", "file"] },
];

const CHOICE_TYPES: QType[] = ["single", "multiple", "dropdown"];
const STATUS_LABEL: Record<Survey["status"], string> = {
  active: "回收中",
  paused: "暂停",
};

const TEMPLATE_TAG_LABELS: Record<string, string> = {
  product_safety: "商品安全",
  satisfaction: "满意度",
  user_information: "用户信息",
  market_research: "市场需求",
  event_feedback: "活动反馈",
  employee_feedback: "员工反馈",
  education_feedback: "教育与学习",
  nps_loyalty: "NPS 忠诚度",
  user_info: "用户信息",
  demographics: "人口统计",
  behavior: "行为习惯",
  preference: "偏好",
  safety: "安全认知",
  pricing: "价格感知",
  open_feedback: "开放反馈",
};

function templateTagLabel(tag: string) {
  return TEMPLATE_TAG_LABELS[tag] ?? tag.replaceAll("_", " ");
}

const AI_CREATE_FLOW_KEY = "survey-ai-create-flow";
let qSeq = 0;
function newQuestion(): Question {
  qSeq += 1;
  return { id: `q_${qSeq}_${Math.random().toString(36).slice(2, 7)}`, title: "", type: "short_text", required: false, options: [] };
}

function cleanCategoryLabel(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 24);
}

function mergeCategoryLabels(...groups: Array<Array<string | undefined>>) {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const group of groups) {
    for (const raw of group) {
      const category = cleanCategoryLabel(String(raw ?? ""));
      if (!category || seen.has(category)) continue;
      seen.add(category);
      next.push(category);
    }
  }
  return next;
}

function getTemplateDraftSignature(input: {
  title: string;
  description: string;
  tags: string[];
  questions: Question[];
}) {
  return JSON.stringify({
    title: input.title.trim(),
    description: input.description.trim(),
    tags: input.tags,
    questions: input.questions.map(({ title, type, required, options, category }) => ({
      title,
      type,
      required,
      options,
      category: category ?? "",
    })),
  });
}

function QuestionPreviewAnswer({ question, questionIndex }: { question: Question; questionIndex?: number }) {
  if (["short_text", "email", "number", "phone"].includes(question.type)) {
    return <Input disabled placeholder="短文本回答" className="rounded-none border-x-0 border-t-0 bg-transparent px-0 shadow-none" />;
  }
  if (question.type === "text") {
    return <Textarea disabled placeholder="段落回答" className="min-h-20 rounded-none border-x-0 border-t-0 bg-transparent px-0 shadow-none" />;
  }
  if (CHOICE_TYPES.includes(question.type) && question.type !== "dropdown") {
    return (
      <div className="grid gap-2">
        {(question.options.length ? question.options : ["选项 1"]).map((option, optionIndex) => (
          <div
            key={`${question.id}-${optionIndex}`}
            data-testid={questionIndex == null ? undefined : `preview-option-${questionIndex}-${optionIndex}`}
            className="flex min-h-11 items-center gap-3 rounded-md border-0 bg-muted/40 px-4 py-2.5 text-14 text-foreground"
          >
            <span className={question.type === "multiple" ? "h-4 w-4 rounded border border-border-strong" : "h-4 w-4 rounded-full border border-border-strong"} />
            {option || `选项 ${optionIndex + 1}`}
          </div>
        ))}
      </div>
    );
  }
  if (question.type === "dropdown") {
    return (
      <Select disabled value="" className="max-w-xs bg-muted/30">
        <option value="">请选择</option>
        {(question.options.length ? question.options : ["选项 1"]).map((option, optionIndex) => (
          <option key={`${question.id}-${optionIndex}`} value={option || `选项 ${optionIndex + 1}`}>
            {option || `选项 ${optionIndex + 1}`}
          </option>
        ))}
      </Select>
    );
  }
  if (question.type === "rating") return <div className="text-22 text-border-strong">★ ★ ★ ★ ★</div>;
  if (question.type === "linear_scale") return <div className="text-14 text-muted-foreground">1&nbsp;&nbsp;2&nbsp;&nbsp;3&nbsp;&nbsp;4&nbsp;&nbsp;5</div>;
  if (question.type === "nps") return <div className="text-14 text-muted-foreground">0 1 2 3 4 5 6 7 8 9 10</div>;
  if (question.type === "date") return <Input disabled type="date" className="max-w-xs rounded-none border-x-0 border-t-0 bg-transparent px-0 shadow-none" />;
  if (question.type === "time") return <Input disabled type="time" className="max-w-xs rounded-none border-x-0 border-t-0 bg-transparent px-0 shadow-none" />;
  return <Input disabled type="file" className="max-w-xs rounded-none border-x-0 border-t-0 bg-transparent px-0 shadow-none" />;
}

function questionsFromApi(raw: unknown): Question[] {
  if (!Array.isArray(raw)) return [newQuestion()];
  const mapped = raw.map((item, idx) => {
    const q = (item ?? {}) as Record<string, unknown>;
    const type = (Object.keys(TYPE_LABEL) as QType[]).includes(String(q.type) as QType) ? (q.type as QType) : "text";
    return {
      id: `saved_${String(q.id ?? idx)}`,
      title: String(q.title ?? ""),
      type,
      required: q.required === true,
      options: Array.isArray(q.options) ? q.options.map((o) => String(o ?? "")) : [],
      ...(cleanCategoryLabel(String(q.category ?? "")) ? { category: cleanCategoryLabel(String(q.category ?? "")) } : {}),
    };
  });
  return mapped.length ? mapped : [newQuestion()];
}

function formatUpdated(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Updated just now";
  return `Updated ${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

function inferReportPlan(survey: Pick<Survey, "title">) {
  if (survey.title.includes("NPS")) {
    return { name: "满意度 NPS AI 报告规划", meta: "满意度 / 8 Blocks / 商务版" };
  }
  if (survey.title.includes("活动")) {
    return { name: "活动复盘 AI 报告规划", meta: "活动复盘 / 5 Blocks / 商务版" };
  }
  if (survey.title.includes("新品")) {
    return { name: "通用调研 AI 报告规划", meta: "通用调研 / 6 Blocks / 企业版" };
  }
  return { name: "商品安全 AI 报告规划", meta: "商品安全 / 10 Blocks / 企业版" };
}

function savedQuestionId(question: Question): number | null {
  const match = question.id.match(/^saved_(\d+)/);
  const rawId = match?.[1] ?? (/^\d+$/.test(question.id) ? question.id : "");
  if (!rawId) return null;
  const id = Number(rawId);
  return Number.isFinite(id) ? id : null;
}

function workspaceQuestionsForComposer(questions: Question[]): ComposerQuestion[] {
  const out: ComposerQuestion[] = [];
  for (const [index, question] of questions.entries()) {
    const id = savedQuestionId(question) ?? index + 1;
    out.push({ id, title: question.title, type: question.type, options: question.options });
  }
  return out;
}

function fallbackReportCategoryPlan(survey: Survey, questions: Question[]): ReportCategoryPlanDraft {
  const ids = questions.map((question, index) => savedQuestionId(question) ?? index + 1);
  return {
    title: `${survey.title || "问卷"} 专业报告`,
    description: "按业务决策主题组织报告章节，每章从整份问卷与全部授权答卷中自主检索证据。",
    categories: ids.length
      ? [
          {
            id: "cat-1-overview",
            name: "综合分析",
            description: "覆盖完整问卷事实库，生成管理层可读的综合分析。",
            requirement: "面向决策者，先给结论，再展示证据、样本边界和行动建议。",
            questionIds: ids,
            outputType: "text",
            inputModes: ["text"],
            prompt: "基于全部问题和答卷数据生成管理层可读的综合分析。",
            order: 1,
            isCustom: false,
          },
        ]
      : [],
  };
}

function statusBadgeClass(status: Survey["status"]) {
  return status === "active"
    ? "border border-success/30 bg-tag-green text-success"
    : "border border-tag-yellow bg-tag-yellow text-foreground";
}

function toDateTimeLocal(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 16);
}

function isAiDraft(value: unknown): value is AiDraft {
  const item = value as Partial<AiDraft> | null;
  return Boolean(
    item &&
      typeof item === "object" &&
      typeof item.title === "string" &&
      typeof item.description === "string" &&
      typeof item.reply === "string" &&
      Array.isArray(item.questions)
  );
}

function latestDraftFromBundle(value: unknown): AiDraft | null {
  const bundle = value as { drafts?: { draft?: unknown }[] } | null;
  const draft = Array.isArray(bundle?.drafts) ? bundle.drafts[0]?.draft : null;
  return isAiDraft(draft) ? draft : null;
}

function rememberAiCreateFlow(enabled: boolean) {
  try {
    if (enabled) {
      window.localStorage.setItem(AI_CREATE_FLOW_KEY, "1");
    } else {
      window.localStorage.removeItem(AI_CREATE_FLOW_KEY);
    }
  } catch {
    // localStorage may be unavailable in privacy modes; server session recovery still works.
  }
}

function listText(items: string[] | undefined, fallback: string) {
  return items?.length ? items.join(" / ") : fallback;
}

function uniqueDraftQuestionTypes(draft: AiDraft) {
  return Array.from(new Set(draft.questions.map((question) => TYPE_LABEL[question.type] ?? question.type)));
}

function uniqueDraftCategories(draft: AiDraft) {
  return Array.from(new Set(draft.questions.map((question) => question.category).filter(Boolean)));
}

function SurveyIntentCanvas({ draft }: { draft: AiDraft }) {
  const canvas = draft.intentCanvas;
  if (!canvas) return null;
  const items = [
    {
      id: "intent-purpose",
      label: "Purpose",
      title: "为什么做这份问卷？",
      body: canvas.purpose?.goal ?? "待补充问卷目标",
      meta: listText(canvas.purpose?.successMetrics, "成功指标待补充"),
    },
    {
      id: "intent-audience",
      label: "Audience",
      title: "问卷面对谁？",
      body: canvas.audience?.persona ?? "待补充目标答题人",
      meta: canvas.audience?.context ?? listText(canvas.audience?.painPoints, "场景待补充"),
    },
    {
      id: "intent-decision",
      label: "Decision",
      title: "结果支持什么决策？",
      body: canvas.decision?.decision ?? "待补充决策",
      meta: listText(canvas.decision?.successCriteria, "决策标准待补充"),
    },
    {
      id: "intent-information",
      label: "Information",
      title: "希望获得哪些信息？",
      body: listText(canvas.information?.requiredSignals, "信息信号待补充"),
      meta: listText(canvas.information?.categories, "信息分类待补充"),
    },
    {
      id: "intent-constraints",
      label: "Constraints",
      title: "有哪些限制？",
      body: canvas.constraints?.completionTime ?? "时长待补充",
      meta: [canvas.constraints?.platform, canvas.constraints?.delivery, ...(canvas.constraints?.analysis ?? [])].filter(Boolean).join(" / ") || "平台和分析方式待补充",
    },
  ];
  return (
    <div data-testid="survey-intent-canvas" className="rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-14 font-semibold text-foreground">需求快照</p>
          <p className="text-12 text-muted-foreground">Survey Agent 对目标、人群、决策和限制的理解。</p>
        </div>
        <Badge variant="outline">5 Intent</Badge>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {items.map((item) => (
          <section key={item.id} data-testid={item.id} className="min-w-0 rounded-md border border-border bg-background px-3 py-2">
            <Badge variant="muted">{item.label}</Badge>
            <p className="mt-2 text-13 font-semibold text-foreground">{item.title}</p>
            <p className="mt-1 break-words text-13 leading-5 text-foreground">{item.body}</p>
            <p className="mt-1 break-words text-12 leading-5 text-muted-foreground">{item.meta}</p>
          </section>
        ))}
      </div>
    </div>
  );
}

function SurveySkeleton() {
  return (
    <div data-testid="loading" className="mt-5 grid animate-pulse gap-3 md:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-40 rounded-lg border border-border bg-muted/40" />
      ))}
    </div>
  );
}

type WorkspaceTarget = "workspace" | "design" | "template" | "collect" | "report" | "answer";

interface WorkspaceShellProps {
  children: ReactNode;
  active?: WorkspaceTarget;
  dashboardMode?: boolean;
  surveyCount?: number;
  currentSurvey?: Survey;
  workflowMode?: boolean;
  templateLibraryMode?: boolean;
  hideHeader?: boolean;
  hideSidebar?: boolean;
  onCreateWithAi: () => void;
  onCreateFromScene?: () => void;
  onCreateBlank: () => void;
  onNavigate: (target: WorkspaceTarget) => void;
}

function WorkspaceShell({
  children,
  active = "workspace",
  dashboardMode = false,
  surveyCount,
  currentSurvey,
  workflowMode = false,
  templateLibraryMode = false,
  hideHeader = false,
  hideSidebar = false,
  onCreateWithAi,
  onCreateFromScene,
  onCreateBlank,
  onNavigate,
}: WorkspaceShellProps) {
  const inSurveyWorkflow = workflowMode || (active !== "workspace" && active !== "template");
  const focusedMode = inSurveyWorkflow || hideSidebar;
  const workflowSteps: Array<{
    id: Exclude<WorkspaceTarget, "workspace">;
    label: string;
    desc: string;
    icon: LucideIcon;
  }> = [
    { id: "design", label: "设计问卷", desc: "题目与元数据", icon: ClipboardList },
    { id: "template", label: "报告模板", desc: "分类与模块组件", icon: FileText },
    { id: "collect", label: "发布回收", desc: "链接与回收规则", icon: Send },
    { id: "answer", label: "查看答题", desc: "答题页与样本", icon: Eye },
    { id: "report", label: "分析报告", desc: "洞察与导出", icon: BarChart3 },
  ];
  const activeWorkflow = workflowSteps.find((step) => step.id === active) ?? workflowSteps[0]!;
  const activeNav =
    active === "workspace"
      ? { label: "我的问卷" }
      : active === "template" && !inSurveyWorkflow
        ? { label: "问卷模版" }
        : ({ label: activeWorkflow.label });
  const activeNavigation: SurveyNavigationTarget = dashboardMode
    ? "home"
    : templateLibraryMode
      ? "templates"
      : "workspace";
  const headerCopy: Record<WorkspaceTarget, string> = {
    workspace: "查看状态、答卷和下一步操作。",
    design: "维护问卷题目、分类和生成报告所需的基础信息。",
    template: "把题目组织成报告分类、输入方式和 Report Blocks。",
    collect: "配置发布链接、身份策略、时间范围和回收状态。",
    report: "查看统计洞察、AI 报告和导出内容。",
    answer: "预览答题页，查看单份答卷和报告样本来源。",
  };
  return (
    <div data-testid={inSurveyWorkflow ? "survey-workflow-shell" : undefined} className="min-h-full bg-secondary text-foreground">
      <div className={focusedMode ? "grid min-h-screen" : "grid min-h-screen lg:grid-cols-[330px_minmax(0,1fr)]"}>
        {!focusedMode ? (
          <SurveyNavigationSidebar
            active={activeNavigation}
            surveyCount={surveyCount}
            onNavigate={(target) => {
              if (target === "home") {
                window.location.href = "/surveys";
                return;
              }
              if (target === "workspace") {
                window.location.href = "/surveys?view=my";
                return;
              }
              if (target === "templates") {
                window.location.href = "/surveys?view=templates";
                return;
              }
              if (target === "reports") {
                onNavigate("template");
                return;
              }
              window.location.href = currentSurvey
                ? `/surveys/${currentSurvey.id}/results`
                : "/surveys?view=my";
            }}
          />
        ) : null}

        <section className="min-w-0 overflow-auto">
          <div className={focusedMode ? "" : "lg:min-w-survey-workbench"}>
          {!hideHeader && <header className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
            {inSurveyWorkflow ? (
              <div className="grid gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {active === "report" ? (
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="bg-secondary">Survey Workflow</Badge>
                        {currentSurvey ? <span className="truncate text-13 text-muted-foreground">{currentSurvey.title}</span> : null}
                      </div>
                      <h1 className="mt-1 text-22 font-bold tracking-normal">分析报告</h1>
                    </div>
                  ) : (
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="bg-secondary">
                          Survey Workflow
                        </Badge>
                        {currentSurvey ? (
                          <span className="truncate text-13 text-muted-foreground">{currentSurvey.title}</span>
                        ) : null}
                      </div>
                      <div className="mt-1 flex flex-wrap items-baseline gap-3">
                        <h1 className="text-22 font-bold tracking-normal">{activeNav.label}</h1>
                        <p className="text-13 text-muted-foreground">{headerCopy[active]}</p>
                      </div>
                    </div>
                  )}
                  <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5 rounded-lg px-3 text-13" onClick={() => onNavigate("workspace")}>
                    <ChevronLeft className="h-4 w-4" strokeWidth={1.6} />
                    返回列表
                  </Button>
                </div>

                <div className="grid gap-2 border-t border-border pt-3 md:grid-cols-5">
                  {workflowSteps.map((step, index) => {
                    const Icon = step.icon;
                    const isActive = step.id === active;
                    return (
                      <Button
                        key={step.id}
                        data-testid={`workflow-${step.id}`}
                        type="button"
                        aria-current={isActive ? "step" : undefined}
                        variant="outline"
                        onClick={() => onNavigate(step.id)}
                        className={[
                          "h-auto min-h-14 justify-start rounded-lg px-3 py-2 text-left",
                          isActive
                            ? "!border-foreground !bg-foreground !text-background hover:!bg-foreground/90 hover:!text-background"
                            : "border-border bg-background hover:border-foreground/40",
                        ].join(" ")}
                      >
                        <span className={[
                          "mr-3 grid h-7 w-7 shrink-0 place-items-center rounded-md text-12 font-bold",
                          isActive ? "bg-background text-foreground" : "bg-secondary text-foreground",
                        ].join(" ")}
                        >
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5 text-13 font-bold">
                            <Icon className="h-4 w-4" strokeWidth={1.6} />
                            {step.label}
                          </span>
                          <span className={isActive ? "mt-1 block text-11 font-normal text-background/70" : "mt-1 block text-11 font-normal text-muted-foreground"}>
                            {step.desc}
                          </span>
                        </span>
                      </Button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex min-h-10 items-center justify-between gap-4">
                <div>
                  <h1 className="text-22 font-bold tracking-normal">
                    {templateLibraryMode ? "问卷模板" : activeNav.label}
                  </h1>
                  <p className="mt-1 text-13 text-muted-foreground">
                    {templateLibraryMode ? "管理可复用的问卷结构，快速创建新的调查。" : headerCopy[active]}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {templateLibraryMode ? (
                    <Button
                      data-testid="header-create-template"
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onCreateBlank}
                      className="h-9 gap-1.5 rounded-lg border-foreground bg-foreground px-3 text-13 text-background hover:bg-foreground/90 hover:text-background"
                    >
                      <Plus className="h-4 w-4" strokeWidth={1.6} />
                      新建问卷模板
                    </Button>
                  ) : (
                    <>
                      <Button data-testid="header-create-with-ai" type="button" variant="outline" size="sm" onClick={onCreateWithAi} className="h-9 gap-1.5 rounded-lg px-3 text-13">
                        <Sparkles className="h-4 w-4" strokeWidth={1.6} />
                        AI 创建
                      </Button>
                      <Button
                        data-testid="header-create-blank"
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onCreateBlank}
                        className="h-9 gap-1.5 rounded-lg border-foreground bg-foreground px-3 text-13 text-background hover:bg-foreground/90 hover:text-background"
                      >
                        <Plus className="h-4 w-4" strokeWidth={1.6} />
                        新建空白
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}
          </header>}

          <div className={inSurveyWorkflow ? "p-4" : ""}>
            {children}
          </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function WorkspaceModulePanel({
  view,
  survey,
  designContent,
  templateContent,
  collectContent,
  reportContent,
  onOpenEditor,
  onOpenResults,
  onOpenAnswer,
  onOpenResponses,
  onBack,
}: {
  view: Exclude<WorkspaceTarget, "workspace">;
  survey?: Survey;
  designContent?: ReactNode;
  templateContent?: ReactNode;
  collectContent?: ReactNode;
  reportContent?: ReactNode;
  onOpenEditor: (tab: "questions" | "responses" | "settings") => void;
  onOpenResults: () => void;
  onOpenAnswer: () => void;
  onOpenResponses: () => void;
  onBack: () => void;
}) {
  const [answerViewsCollapsed, setAnswerViewsCollapsed] = useState(false);
  const [selectedAnswerView, setSelectedAnswerView] = useState("all");
  const reportPlan = survey ? inferReportPlan(survey) : null;
  const config: Record<Exclude<WorkspaceTarget, "workspace">, { label: string; title: string; copy: string; icon: typeof ClipboardList }> = {
    design: {
      label: "Design",
      title: "设计问卷",
      copy: "维护问卷元数据、题目结构、必填项和选项；保存后会继续影响报告规划和发布回收。",
      icon: ClipboardList,
    },
    template: {
      label: "Report Blocks",
      title: "报告模板",
      copy: "根据问卷目标设计分类、输入方式、图表槽位和 Report Blocks，形成后续 AI 报告的结构基础。",
      icon: FileText,
    },
    collect: {
      label: "Collect",
      title: "发布与回收",
      copy: "配置答题身份、发布时间、答卷上限、提交成功文案和分享方式。",
      icon: SlidersHorizontal,
    },
    report: {
      label: "Report",
      title: "分析报告",
      copy: "查看答卷统计、生成 AI 报告、执行质检并进入导出发布流程。",
      icon: BarChart3,
    },
    answer: {
      label: "Responses",
      title: "查看答题",
      copy: "查看单份答卷、提交时间、样本状态和报告生成所用的真实数据。",
      icon: Eye,
    },
  };
  const item = config[view];
  const Icon = item.icon;

  if (!survey) {
    return (
      <section className="rounded-lg border border-dashed border-border-strong bg-background p-8 text-center">
        <Icon className="mx-auto h-10 w-10 text-muted-foreground" strokeWidth={1.6} />
        <h2 className="mt-3 text-18 font-bold text-foreground">请先选择问卷</h2>
        <p className="mt-1 text-13 text-muted-foreground">选择一份问卷后，再进入{item.title}模块。</p>
        <Button type="button" size="sm" className="mt-4" onClick={onBack}>
          返回问卷列表
        </Button>
      </section>
    );
  }

  if (view === "design" && designContent) {
    return <>{designContent}</>;
  }

  if (view === "template" && templateContent) {
    return <>{templateContent}</>;
  }

  if (view === "collect" && collectContent) {
    return <>{collectContent}</>;
  }

  if (view === "report" && reportContent) {
    return <>{reportContent}</>;
  }

  const responseRows = Array.from({ length: Math.min(4, Math.max(survey.responses, 0)) }, (_, index) => {
    const responseNumber = survey.responses - index;
    return {
      id: `R-${String(responseNumber).padStart(3, "0")}`,
      title: `匿名答卷 ${index + 1}`,
      time: index === 0 ? "最新提交" : `${index + 1} 小时前`,
      status: "已完成",
      source: "用于报告样本",
    };
  });

  return (
    <div data-testid={view === "answer" ? "workspace-answer-workbench" : undefined} className="grid gap-4">
      <a data-testid="workspace-answer-link" href={`/survey/${survey.id}/answer`} className="sr-only">
        打开答题页
      </a>
      <a data-testid="workspace-report-link" href={`/surveys/${survey.id}/results`} className="sr-only">
        打开分析报告
      </a>
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background p-4">
        <div>
          <Badge variant="outline">{item.label}</Badge>
          <h2 className="mt-2 text-18 font-bold text-foreground">{item.title}</h2>
          <p className="text-13 text-muted-foreground">{item.copy}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onBack}>
            返回列表
          </Button>
          {view === "design" && (
            <Button type="button" size="sm" onClick={() => onOpenEditor("questions")}>
              打开题目编辑
            </Button>
          )}
          {view === "template" && (
            <Button type="button" size="sm" onClick={onOpenResults}>
              打开报告规划
            </Button>
          )}
          {view === "collect" && (
            <Button type="button" size="sm" onClick={() => onOpenEditor("settings")}>
              配置发布回收
            </Button>
          )}
          {view === "report" && (
            <Button type="button" size="sm" onClick={onOpenResults}>
              查看分析报告
            </Button>
          )}
          {view === "answer" && (
            <>
              <Button data-testid="answer-open-preview" type="button" size="sm" variant="outline" className="gap-1.5" onClick={onOpenAnswer}>
                <Eye className="h-4 w-4" strokeWidth={1.7} />
                问卷预览
              </Button>
              <Button data-testid="answer-open-responses" type="button" size="sm" className="gap-1.5" onClick={onOpenResponses}>
                <ClipboardList className="h-4 w-4" strokeWidth={1.7} />
                查看用户答卷
              </Button>
            </>
          )}
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-3">
        <section className="rounded-lg border border-border bg-card p-4">
          <p className="text-12 text-muted-foreground">当前问卷</p>
          <p className="mt-1 text-15 font-semibold text-foreground">{survey.title}</p>
          <p className="mt-1 line-clamp-2 text-12 text-muted-foreground">{survey.description || "暂无说明"}</p>
        </section>
        <section className="rounded-lg border border-border bg-card p-4">
          <p className="text-12 text-muted-foreground">回收状态</p>
          <div className="mt-2">
            <Badge variant="outline" className={statusBadgeClass(survey.status)}>
              {STATUS_LABEL[survey.status]}
            </Badge>
          </div>
          <p className="mt-2 text-12 text-muted-foreground">{survey.responses} 份答卷</p>
        </section>
        <section className="rounded-lg border border-border bg-card p-4">
          <p className="text-12 text-muted-foreground">报告规划</p>
          <p className="mt-1 text-13 font-semibold text-foreground">{reportPlan?.name}</p>
          <p className="mt-1 text-12 text-muted-foreground">{reportPlan?.meta}</p>
        </section>
      </div>

      {view === "answer" && (
        <section data-testid="user-responses-workbench" className={answerViewsCollapsed ? "grid min-w-0 gap-3 xl:grid-cols-[56px_minmax(0,1fr)_300px]" : "grid min-w-0 gap-3 xl:grid-cols-[200px_minmax(0,1fr)_300px]"}>
          <SurveyOutlinePanel
            title="答卷视图"
            items={[
              { id: "all", label: "全部答卷", meta: `${survey.responses} 份` },
              { id: "today", label: "今日提交", meta: `${Math.min(18, survey.responses)} 份` },
              { id: "review", label: "需复核", meta: survey.responses ? "待检查" : "0 份" },
              { id: "flagged", label: "已标记", meta: "0 份" },
              { id: "invalid", label: "无效答卷", meta: "0 份" },
            ]}
            selectedId={selectedAnswerView}
            collapsed={answerViewsCollapsed}
            onToggle={() => setAnswerViewsCollapsed((collapsed) => !collapsed)}
            onSelect={setSelectedAnswerView}
          />
          <div className="overflow-hidden rounded-lg border border-border bg-background">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
              <div>
                <Badge variant="outline">Responses</Badge>
                <h3 className="mt-2 text-17 font-bold text-foreground">用户答卷</h3>
                <p className="mt-1 text-13 leading-6 text-muted-foreground">
                  按单份答卷查看提交内容、答题完成状态和报告生成时引用的真实样本。
                </p>
              </div>
              <Button data-testid="answer-open-all-responses" type="button" size="sm" className="gap-1.5" onClick={onOpenResponses}>
                <ClipboardList className="h-4 w-4" strokeWidth={1.7} />
                查看全部答卷
              </Button>
            </div>

            {responseRows.length > 0 ? (
              <div className="divide-y divide-border">
                {responseRows.map((response, index) => (
                  <Button
                    key={response.id}
                    type="button"
                    variant="ghost"
                    className="flex h-auto w-full items-center justify-between gap-3 rounded-none px-4 py-3 text-left font-normal transition-colors hover:bg-muted/20"
                    onClick={onOpenResponses}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-foreground text-12 font-semibold text-background">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-14 font-semibold text-foreground">
                          {response.id} · {response.title}
                        </p>
                        <p className="mt-1 text-12 text-muted-foreground">
                          {response.time} · 已答完 · {response.source}
                        </p>
                      </div>
                    </div>
                    <Badge variant="success">{response.status}</Badge>
                  </Button>
                ))}
              </div>
            ) : (
              <div className="px-4 py-8 text-center">
                <ClipboardList className="mx-auto h-8 w-8 text-muted-foreground" strokeWidth={1.6} />
                <p className="mt-3 text-14 font-semibold text-foreground">暂无用户答卷</p>
                <p className="mt-1 text-13 text-muted-foreground">发布回收后，这里会显示每位用户的提交记录。</p>
              </div>
            )}
          </div>

          <div className="grid gap-3">
            <SurveyAiPanel
              title="答卷质量 AI"
              placeholder="找出可能无效的答卷并说明原因"
              resultLabel="AI 已完成答卷检查"
              changeCount={Math.min(6, survey.responses)}
              onSubmit={onOpenResponses}
              onPreview={onOpenResponses}
              onApply={onOpenResponses}
            />
            <Button
              type="button"
              variant="ghost"
              data-testid="answer-responses-card"
              className="group h-auto flex-col items-stretch rounded-lg border border-border bg-background p-4 text-left font-normal transition-colors hover:border-border-strong hover:bg-muted/20"
              onClick={onOpenResponses}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-foreground">
                  <ClipboardList className="h-5 w-5" strokeWidth={1.7} />
                </div>
                <Badge variant="outline">{survey.responses} 份答卷</Badge>
              </div>
              <h3 className="mt-4 text-17 font-bold text-foreground">单份答卷查看</h3>
              <p className="mt-2 text-13 leading-6 text-muted-foreground">
                进入答卷明细，逐份核对用户提交内容、提交时间和后续报告样本来源。
              </p>
              <span className="mt-4 inline-flex text-13 font-semibold text-foreground group-hover:underline">查看用户答卷</span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              data-testid="answer-preview-card"
              className="group h-auto flex-col items-stretch rounded-lg border border-border bg-background p-4 text-left font-normal transition-colors hover:border-border-strong hover:bg-muted/20"
              onClick={onOpenAnswer}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-foreground">
                  <Eye className="h-5 w-5" strokeWidth={1.7} />
                </div>
                <Badge variant="outline">Preview</Badge>
              </div>
              <h3 className="mt-4 text-17 font-bold text-foreground">问卷预览</h3>
              <p className="mt-2 text-13 leading-6 text-muted-foreground">
                以用户视角打开答题页，检查题目顺序、必填校验、选项显示和提交成功状态。
              </p>
              <span className="mt-4 inline-flex text-13 font-semibold text-foreground group-hover:underline">打开问卷预览</span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              data-testid="answer-report-sample-card"
              className="group h-auto flex-col items-stretch rounded-lg border border-border bg-background p-4 text-left font-normal transition-colors hover:border-border-strong hover:bg-muted/20"
              onClick={onOpenResults}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-foreground">
                  <BarChart3 className="h-5 w-5" strokeWidth={1.7} />
                </div>
                <Badge variant="outline">Report sample</Badge>
              </div>
              <h3 className="mt-4 text-17 font-bold text-foreground">报告样本来源</h3>
              <p className="mt-2 text-13 leading-6 text-muted-foreground">
                跳转到分析报告，确认这些答卷如何参与图表、洞察和风险判断。
              </p>
              <span className="mt-4 inline-flex text-13 font-semibold text-foreground group-hover:underline">查看报告样本</span>
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

function EChartsReportPreview({ chart }: { chart: NonNullable<ReportComposerPreview["sections"][number]["chart"]> }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const instance = echarts.init(container, undefined, { renderer: "canvas" });
    const labels = chart.rows.map((row) => row.label);
    const values = chart.rows.map((row) => row.value);
    const type = chart.type ?? "bar";
    const config = chart.config ?? {
      primaryColor: "#4f6edb",
      maxDimensions: 6,
      sort: "none" as const,
      showLabels: true,
      showLegend: false,
      orientation: "vertical" as const,
    };
    const common: echarts.EChartsCoreOption = {
      animationDuration: 350,
      textStyle: { fontFamily: "inherit" },
      tooltip: { trigger: "item" },
      color: [config.primaryColor],
    };
    let option: echarts.EChartsCoreOption;
    if (["pie", "doughnut", "rose"].includes(type)) {
      option = {
        ...common,
        legend: { bottom: 0, type: "scroll", show: config.showLegend },
        series: [{
          type: "pie",
          radius: type === "doughnut" ? ["42%", "68%"] : ["0%", "68%"],
          roseType: type === "rose" ? "radius" : undefined,
          data: chart.rows.map((row) => ({ name: row.label, value: row.value })),
          label: { show: config.showLabels, formatter: "{b}  {d}%" },
        }],
      };
    } else if (["line", "area"].includes(type)) {
      option = {
        ...common,
        grid: { left: 42, right: 18, top: 24, bottom: 44 },
        xAxis: { type: "category", data: labels, axisLabel: { interval: 0 } },
        yAxis: { type: "value" },
        legend: { show: config.showLegend },
        series: [{ type: "line", data: values, smooth: true, areaStyle: type === "area" ? { opacity: 0.18 } : undefined, label: { show: config.showLabels, position: "top" } }],
      };
    } else if (type === "radar") {
      option = {
        ...common,
        radar: { indicator: chart.rows.map((row) => ({ name: row.label, max: 100 })), radius: "62%" },
        legend: { show: config.showLegend },
        series: [{ type: "radar", data: [{ value: values, name: chart.title }], areaStyle: { opacity: 0.18 }, label: { show: config.showLabels } }],
      };
    } else if (type === "scatter") {
      option = {
        ...common,
        grid: { left: 42, right: 18, top: 22, bottom: 38 },
        xAxis: { type: "value" },
        yAxis: { type: "value" },
        series: [{ type: "scatter", symbolSize: 14, data: values.map((value, index) => [12 + index * 13, value, labels[index]]) }],
      };
    } else if (type === "funnel") {
      option = { ...common, legend: { show: config.showLegend }, series: [{ type: "funnel", left: "15%", width: "70%", data: chart.rows.map((row) => ({ name: row.label, value: row.value })), label: { show: config.showLabels, formatter: "{b}  {c}" } }] };
    } else if (type === "gauge") {
      option = { ...common, series: [{ type: "gauge", progress: { show: true }, detail: { formatter: "{value}%" }, data: [{ value: values[0] ?? 0, name: labels[0] ?? "指标" }] }] };
    } else if (type === "treemap") {
      option = { ...common, series: [{ type: "treemap", roam: false, label: { show: true, formatter: "{b}\n{c}" }, data: chart.rows.map((row) => ({ name: row.label, value: row.value })) }] };
    } else if (["heatmap", "matrix"].includes(type)) {
      const matrix = labels.flatMap((_, x) => labels.slice(0, 4).map((__, y) => [x, y, Number(((values[x] ?? 0) * (y + 1) / 4).toFixed(1))]));
      option = {
        ...common,
        grid: { left: 54, right: 28, top: 20, bottom: 48 },
        xAxis: { type: "category", data: labels },
        yAxis: { type: "category", data: ["低", "中低", "中高", "高"] },
        visualMap: { min: 0, max: 100, calculable: false, orient: "horizontal", left: "center", bottom: 0 },
        series: [{ type: "heatmap", data: matrix, label: { show: config.showLabels } }],
      };
    } else {
      option = {
        ...common,
        grid: { left: 42, right: 18, top: 24, bottom: 52 },
        xAxis: config.orientation === "horizontal"
          ? { type: "value" }
          : { type: "category", data: labels, axisLabel: { interval: 0, rotate: labels.length > 5 ? 20 : 0 } },
        yAxis: config.orientation === "horizontal"
          ? { type: "category", data: labels, axisLabel: { interval: 0 } }
          : { type: "value" },
        legend: { show: config.showLegend },
        series: [{ type: "bar", data: values, stack: type === "stacked_bar" ? "total" : undefined, label: { show: config.showLabels, position: config.orientation === "horizontal" ? "right" : "top" }, barMaxWidth: 42 }],
      };
    }
    instance.setOption(option);
    const resizeObserver = new ResizeObserver(() => instance.resize());
    resizeObserver.observe(container);
    return () => {
      resizeObserver.disconnect();
      instance.dispose();
    };
  }, [chart]);

  return <div ref={containerRef} data-testid="echarts-report-preview" className="h-72 w-full" />;
}

function WorkspaceTemplateWorkbench({
  survey,
  questions,
  template,
  saving,
  status,
  error,
  onBackToDesign,
  onOpenCollect,
  onSaveTemplate,
}: {
  survey: Survey;
  questions: Question[];
  template?: ReportTemplateDraft;
  saving: boolean;
  status: string;
  error: string;
  onBackToDesign: () => void;
  onOpenCollect: () => void;
  onSaveTemplate: (template: ReportTemplateDraft) => void;
}) {
  const reportPlan = inferReportPlan(survey);
  const [goal, blockText, theme = "企业版"] = reportPlan.meta.split(" / ");
  const blockCount = Number(blockText?.match(/(\d+)/)?.[1] ?? 10);
  const pageBlueprints = [
    { title: "01 管理层摘要", desc: "样本质量、关键发现、风险等级和下一步", layout: "Executive Brief", blocks: 3, chart: "摘要看板", image: "商务封面" },
    { title: "02 样本画像", desc: "年龄、地区、完成率和样本偏差", layout: "Dashboard Spread", blocks: 2, chart: "样本画像", image: "信息图" },
    { title: "03 关键指标深描", desc: "核心指标、单题分布和异常波动解释", layout: "Chart Deep-dive", blocks: 2, chart: "条形排行", image: "关闭" },
    { title: "04 多维交叉分析", desc: "人群、关注点、满意度的组合分析", layout: "Matrix Lab", blocks: 3, chart: "交叉矩阵", image: "启用" },
    { title: "05 开放题证据", desc: "文本主题聚类、典型反馈和风险证据", layout: "Evidence Narrative", blocks: 2, chart: "文本洞察", image: "启用" },
    { title: "06 风险与机会", desc: "风险等级、机会窗口和证据缺口", layout: "Risk Review", blocks: 2, chart: "风险矩阵", image: "关闭" },
    { title: "07 行动路线", desc: "优先级、负责人、落地动作和复核点", layout: "Action Roadmap", blocks: 2, chart: "行动路线", image: "启用" },
    { title: "08 附录与口径", desc: "样本口径、限制条件和复核说明", layout: "Method Appendix", blocks: 1, chart: "口径表", image: "关闭" },
  ];
  const savedSections = template?.sections?.length ? template.sections : [];
  const [selectedMode, setSelectedMode] = useState("按当前题目智能规划");
  const [selectedTheme, setSelectedTheme] = useState(theme);
  const [reportElements, setReportElements] = useState<ReportElement[]>(["text", "image", "chart"]);
  const [selectedPageIndex, setSelectedPageIndex] = useState(0);
  const [locked, setLocked] = useState<Record<number, boolean>>({});
  const [pageOverrides, setPageOverrides] = useState<Record<number, Partial<(typeof pageBlueprints)[number]>>>({});
  useEffect(() => {
    setSelectedTheme(theme);
    setReportElements(["text", "image", "chart"]);
    setSelectedPageIndex(0);
    setLocked({});
    setPageOverrides({});
  }, [survey.id, template?.title, theme]);

  const hasText = reportElements.includes("text");
  const hasImage = reportElements.includes("image");
  const hasChart = reportElements.includes("chart");
  const reportElementSummary = [
    hasText ? "文本" : null,
    hasImage ? "图片" : null,
    hasChart ? "报表" : null,
  ].filter(Boolean).join(" + ");
  function toggleReportElement(element: ReportElement) {
    setReportElements((items) => {
      if (items.includes(element)) {
        return items.length === 1 ? items : items.filter((item) => item !== element);
      }
      return [...items, element];
    });
  }

  const pageCount = savedSections.length || Math.max(4, Math.min(8, questions.length + 1));
  const pages = Array.from({ length: pageCount }).map((_, index) => {
    const fallback = pageBlueprints[index % pageBlueprints.length]!;
    const sectionTitle = savedSections[index] ?? fallback.title;
    const chart = hasChart ? template?.chartSlots?.[index] ?? fallback.chart : "不生成报表";
    const desc = template?.metrics?.[index] ?? fallback.desc;
    const elementLayout =
      hasText && !hasImage && !hasChart ? "Text Brief"
      : hasText && hasImage && !hasChart ? "Visual Narrative"
      : hasText && !hasImage && hasChart ? "Data Memo"
      : !hasText && hasImage && !hasChart ? "Image Evidence"
      : !hasText && !hasImage && hasChart ? "Data Board"
      : fallback.layout;
    return {
      ...fallback,
      title: /^\d/.test(sectionTitle) ? sectionTitle : `${String(index + 1).padStart(2, "0")} ${sectionTitle}`,
      desc,
      chart,
      layout: elementLayout,
      image: hasImage ? fallback.image === "关闭" ? "Wan 2.7 章节图" : fallback.image : "关闭",
      blocks: Math.max(1, (hasText ? 1 : 0) + (hasImage ? 1 : 0) + (hasChart ? 1 : 0)),
      ...pageOverrides[index],
    };
  });
  const currentPage = pages[selectedPageIndex] ?? pages[0] ?? pageBlueprints[0]!;
  const layoutOptions = ["Executive Brief", "Dashboard Spread", "Chart Deep-dive", "Matrix Lab", "Visual Story", "Action Roadmap"];
  const chartOptions = ["摘要看板", "样本画像", "条形排行", "交叉矩阵", "文本洞察", "行动路线"];
  const imageOptions = ["商务封面", "信息图", "关闭", "启用", "Wan 2.7 章节图"];
  function cycleCurrentPage(key: "layout" | "chart" | "image", options: string[]) {
    if (locked[selectedPageIndex]) return;
    const currentValue = String(currentPage[key]);
    const nextValue = options[(options.indexOf(currentValue) + 1) % options.length] ?? options[0]!;
    setPageOverrides((items) => ({
      ...items,
      [selectedPageIndex]: { ...items[selectedPageIndex], [key]: nextValue },
    }));
  }
  function buildTemplateDraft(): ReportTemplateDraft {
    return {
      title: template?.title || reportPlan.name,
      sections: pages.map((page) => page.title.replace(/^\d+\s*/, "")),
      metrics: [
        `${selectedMode}：${questions.length} 个题目`,
        `${goal ?? "调研分析"}：核心指标`,
        `${selectedTheme}：输出主题`,
        `内容样式：${reportElementSummary}`,
        ...pages.slice(0, 5).map((page) => page.desc),
      ],
      chartSlots: pages.map((page) => page.chart),
      caveats: [
        "用户不逐字编辑报告正文，只控制生成策略、章节结构、版式、主题和输出格式。",
        `报告只生成已选择的内容模块：${reportElementSummary}。`,
        locked[selectedPageIndex] ? `已锁定页面：${currentPage.title}` : "未锁定页面可由 AI 重新编排。",
        `当前主题：${selectedTheme}`,
      ],
    };
  }
  const generationModes = [
    { title: "按当前题目智能规划", desc: `${questions.length} 个题目 -> 章节 / 图表 / 洞察` },
    { title: "商品安全场景", desc: "证据链、风险、行动建议" },
    { title: "满意度 NPS 场景", desc: "推荐意愿、分层、挽回动作" },
    { title: "通用调研场景", desc: "样本、分布、开放题总结" },
  ];
  const themes: Array<[string, string]> = [
    ["商务版", "深色封面、管理摘要"],
    ["企业版", "稳重数据报告"],
    ["教育版", "清晰解释型"],
    ["政府版", "正式归档型"],
    ["学术版", "研究论文型"],
  ];
  const previewMetrics = [
    ["样本量", String(Math.max(survey.responses, questions.length * 8))],
    ["完成率", survey.responses > 0 ? "74%" : "0%"],
    ["风险等级", goal?.includes("商品") ? "中" : "低"],
  ];
  const previewBars = [
    ["质量关注", 78],
    ["价格敏感", 62],
    ["说明清晰", 54],
    ["售后信任", 46],
  ];
  const insightText = [
    `${currentPage.title.replace(/^\d+\s*/, "")} 将以 ${currentPage.layout} 版式生成。`,
    `图表模块采用「${currentPage.chart}」，用于解释 ${goal ?? "调研"} 的关键证据。`,
    locked[selectedPageIndex] ? "本页已锁定，重新生成不会改动结构。" : "本页可继续由 AI Planner 调整结构与组件顺序。",
  ];
  const executiveFindings = [
    "样本已覆盖核心决策问题，可支持方向性判断。",
    "风险信号集中在说明清晰度、售后信任和价格敏感。",
    "建议优先补充证据链，再进入发布与复核流程。",
  ];
  const evidenceNotes = [
    ["证据完整度", "高", "题目结构与回收数据能够支撑摘要结论。"],
    ["模型处理", hasText ? "已优化" : "关闭", hasText ? "生成专业措辞、风险判断和行动建议。" : "当前报告不生成正文说明。"],
    ["视觉策略", hasImage ? "启用" : "关闭", hasImage ? "按章节生成商务配图与证据说明。" : "当前报告不生成图片模块。"],
  ];
  const reportQualityChecks = [
    ["结构一致", "章节、图表和正文口径保持一致"],
    ["证据可追溯", "每个结论保留样本和题目来源"],
    ["可交付", "PDF / Word 可从同一模板生成"],
  ];
  type TemplatePagePreview = {
    title: string;
    desc: string;
    layout: string;
    blocks: number;
    chart: string;
    image: string;
  };
  const pageInsights = [
    "本页优先给管理层判断，先给结论和证据，再展示核心指标。",
    "本页强调样本结构和数据质量，用并列看板减少来回切换。",
    "本页先暴露差异和排序，再解释为什么这些指标值得关注。",
    "本页用于识别人群差异，把维度组合放在同一张矩阵里。",
    "本页把开放反馈转成证据故事，适合插入图片和典型原话。",
    "本页输出可执行动作，按优先级、负责人和复核点组织。",
  ];

  function renderImageBrief(page: TemplatePagePreview, intent: string) {
    if (!hasImage || page.image === "关闭") return null;
    return (
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="grid md:grid-cols-[220px_minmax(0,1fr)]">
          <div className="bg-foreground p-5 text-background">
            <p className="text-11 font-semibold uppercase tracking-wide text-background/55">Wan 2.7 image slot</p>
            <h5 className="mt-8 text-20 font-bold leading-tight">{page.title.replace(/^\d+\s*/, "")}</h5>
            <p className="mt-3 text-12 leading-5 text-background/65">{page.image}</p>
          </div>
          <div className="grid content-between gap-4 p-4">
            <div>
              <Badge variant="outline" className="border-border bg-tag-blue text-foreground">商务配图</Badge>
              <p className="mt-3 text-13 leading-6 text-muted-foreground">{intent}</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                ["场景", goal ?? "调研分析"],
                ["风格", selectedTheme],
                ["用途", "章节视觉锚点"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md border border-border bg-background px-3 py-2">
                  <p className="text-10 font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                  <p className="mt-1 truncate text-13 font-semibold text-foreground">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderNarrative(page: TemplatePagePreview, heading: string) {
    if (!hasText) return null;
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-11 font-semibold uppercase tracking-wide text-muted-foreground">Professional narrative</p>
            <h5 className="mt-2 text-18 font-bold text-foreground">{heading}</h5>
          </div>
          <Badge variant="muted">文本模块</Badge>
        </div>
        <p className="mt-3 max-w-4xl text-13 leading-6 text-muted-foreground">
          本节围绕「{page.desc}」生成正式报告语言：先说明分析目的和证据基础，再给出正向信号、风险边界和下一步建议。正文由 AI Insight 生成，模板只控制结构和内容类型。
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {executiveFindings.map((finding, findingIndex) => (
            <div key={finding} className="rounded-lg border border-border bg-background p-3">
              <p className="text-10 font-semibold uppercase tracking-wide text-muted-foreground">Finding {findingIndex + 1}</p>
              <p className="mt-2 text-12 leading-5 text-muted-foreground">{finding}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderBarChart(page: TemplatePagePreview, columns = 2) {
    if (!hasChart) return null;
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-11 font-semibold uppercase tracking-wide text-muted-foreground">Data exhibit</p>
            <h5 className="mt-1 text-17 font-bold text-foreground">{page.chart}</h5>
            <p className="mt-1 text-12 text-muted-foreground">报告正文中的可复核报表区块</p>
          </div>
          <Badge variant="outline">Chart Agent</Badge>
        </div>
        <div className={columns === 1 ? "mt-4 grid gap-3" : "mt-4 grid gap-3 md:grid-cols-2"}>
          {previewBars.map(([label, value], barIndex) => {
            const adjustedValue = Math.max(24, Math.min(92, Number(value) - barIndex * 5 + (page.blocks % 3) * 4));
            return (
              <div key={label} className="rounded-lg border border-border bg-background p-3">
                <div className="flex items-center justify-between text-12">
                  <span className="font-semibold text-foreground">{label}</span>
                  <span className="text-muted-foreground">{adjustedValue}%</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted shadow-inner">
                  <div className="h-full rounded-full bg-foreground" style={{ width: `${adjustedValue}%` }} />
                </div>
              </div>
            );
                  })}
                </div>
              </div>
    );
  }

  function renderMatrixChart() {
    if (!hasChart) return null;
    const cells = [
      ["18-24", "中", "高", "低", "中"],
      ["25-34", "高", "高", "中", "中"],
      ["35-44", "中", "中", "高", "低"],
    ];
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-11 font-semibold uppercase tracking-wide text-muted-foreground">Matrix exhibit</p>
            <h5 className="mt-1 text-17 font-bold text-foreground">人群 x 关注点矩阵</h5>
          </div>
          <Badge variant="outline">Chart Agent</Badge>
        </div>
        <div className="mt-4 grid gap-2 text-center text-12">
          <div className="grid grid-cols-[80px_repeat(4,1fr)] gap-2 font-semibold text-foreground">
            <span />
            {["成分", "认证", "日期", "责任"].map((label) => <span key={label}>{label}</span>)}
          </div>
          {cells.map(([group, ...values]) => (
            <div key={group} className="grid grid-cols-[80px_repeat(4,1fr)] gap-2">
              <span className="rounded-md bg-muted px-3 py-2 text-muted-foreground">{group}</span>
              {values.map((value, index) => (
                <span
                  key={`${group}-${index}`}
                  className={[
                    "rounded-md px-3 py-2 font-semibold",
                    value === "高" ? "bg-tag-green text-foreground" : value === "中" ? "bg-tag-blue text-foreground" : "bg-muted text-muted-foreground",
                  ].join(" ")}
                >
                  {value}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderActionRoadmap() {
    if (!hasChart && !hasText) return null;
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-11 font-semibold uppercase tracking-wide text-muted-foreground">Action roadmap</p>
        <div className="mt-4 grid gap-3">
          {["重构详情页安全说明", "补齐认证和检测证据", "建立负向反馈复盘机制", "每周追踪满意度变化"].map((action, index) => (
            <div key={action} className="grid gap-3 rounded-lg border border-border bg-background p-3 md:grid-cols-[32px_1fr_auto] md:items-center">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-foreground text-12 font-bold text-background">{index + 1}</span>
              <div>
                <p className="text-13 font-semibold text-foreground">{action}</p>
                <p className="mt-1 text-12 text-muted-foreground">由运营、法务和客服共同复核，避免报告结论停留在描述层。</p>
              </div>
              <Badge variant={index < 2 ? "destructive" : "outline"}>{index < 2 ? "高优先级" : "跟进"}</Badge>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderInsightAside(page: TemplatePagePreview, pageIndex: number, pageLocked: boolean) {
    return (
      <aside className="grid content-start gap-3">
        {hasText && (
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-11 font-semibold uppercase tracking-wide text-muted-foreground">AI Insight</p>
            <p className="mt-3 text-14 font-semibold leading-6 text-foreground">
              {pageInsights[pageIndex] ?? `${page.title.replace(/^\d+\s*/, "")}需要把数据解释、风险判断和行动建议放在同一个阅读路径里。`}
            </p>
          </div>
        )}
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-11 font-semibold uppercase tracking-wide text-muted-foreground">Page QA</p>
          <div className="mt-3 grid gap-2">
            {reportQualityChecks.map(([label, desc]) => (
              <div key={label} className="rounded-md border border-border bg-background px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-12 font-semibold text-foreground">{label}</p>
                  <Badge variant="success">Pass</Badge>
                </div>
                <p className="mt-1 text-11 leading-4 text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-11 font-semibold uppercase tracking-wide text-muted-foreground">Page settings</p>
          <div className="mt-3 grid gap-2">
            {[
              ["版式", page.layout],
              ["图表", hasChart ? page.chart : "关闭"],
              ["图片", hasImage && page.image !== "关闭" ? page.image : "关闭"],
              ["状态", pageLocked ? "已锁定" : "可重排"],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2 text-12">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-semibold text-foreground">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>
    );
  }

  function renderTemplatePageBody(page: TemplatePagePreview, pageIndex: number, pageLocked: boolean) {
    const pageTitle = page.title.replace(/^\d+\s*/, "");
    if (page.layout === "Dashboard Spread") {
      return (
        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="grid gap-4">
            <div className="grid gap-4 lg:grid-cols-2">
              {renderBarChart(page, 1)}
              {renderImageBrief(page, "样本画像页用信息图承接年龄层、地区和完成率，让读者先判断样本是否可靠，再进入指标分析。")}
            </div>
            {renderNarrative(page, "样本质量与适用范围")}
            <div className="grid gap-3 md:grid-cols-3">
              {evidenceNotes.map(([label, status, desc]) => (
                <div key={label} className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-13 font-bold text-foreground">{label}</p>
                    <Badge variant="outline">{status}</Badge>
                  </div>
                  <p className="mt-2 text-12 leading-5 text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>
          </div>
          {renderInsightAside(page, pageIndex, pageLocked)}
        </div>
      );
    }
    if (page.layout === "Chart Deep-dive") {
      return (
        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid gap-4">
            {renderNarrative(page, "图表阅读说明")}
            {renderBarChart(page, 1)}
            <div className="grid gap-3 md:grid-cols-3">
              {["高关注项", "低信任项", "页面推荐"].map((label, index) => (
                <div key={label} className="rounded-lg border border-border bg-card p-4">
                  <p className="text-15 font-bold text-foreground">{label}</p>
                  <p className="mt-2 text-12 leading-5 text-muted-foreground">{executiveFindings[index] ?? executiveFindings[0]}</p>
                </div>
              ))}
            </div>
          </div>
          {renderInsightAside(page, pageIndex, pageLocked)}
        </div>
      );
    }
    if (page.layout === "Matrix Lab") {
      return (
        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid gap-4">
            {renderNarrative(page, "交叉分析说明")}
            {renderMatrixChart()}
            {renderImageBrief(page, "多维交叉页使用业务看板配图，强调不同人群、证据类型和风险关注之间的组合关系。")}
          </div>
          {renderInsightAside(page, pageIndex, pageLocked)}
        </div>
      );
    }
    if (page.layout === "Visual Story") {
      return (
        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid gap-4">
            {renderImageBrief(page, "视觉叙事页优先承载开放反馈的主题情绪，用图片和短文本帮助客户快速理解问题场景。")}
            {renderNarrative(page, "开放反馈主题故事")}
            <div className="grid gap-3 md:grid-cols-2">
              {["典型反馈", "风险证据"].map((label) => (
                <div key={label} className="rounded-lg border border-border bg-card p-4">
                  <p className="text-15 font-bold text-foreground">{label}</p>
                  <p className="mt-2 text-13 leading-6 text-muted-foreground">将开放文本聚类为可引用证据，并标注对应主题、情绪和后续处理建议。</p>
                </div>
              ))}
            </div>
          </div>
          {renderInsightAside(page, pageIndex, pageLocked)}
        </div>
      );
    }
    if (page.layout === "Action Roadmap") {
      return (
        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid gap-4">
            {renderNarrative(page, "行动建议总览")}
            {renderActionRoadmap()}
            {renderImageBrief(page, "行动页用路线图或执行场景配图，帮助客户把分析结论转化为发布后的工作安排。")}
          </div>
          {renderInsightAside(page, pageIndex, pageLocked)}
        </div>
      );
    }
    return (
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-4">
          {renderNarrative(page, pageIndex === 0 ? "管理层快速判断" : pageTitle)}
          <div className="grid gap-4 lg:grid-cols-2">
            {renderBarChart(page)}
            {renderImageBrief(page, "摘要页以管理层阅读效率为目标，图片用于建立专业语境，图表用于支撑可验证结论。")}
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {["表现较好", "主要风险", "推荐动作"].map((label, index) => (
              <div
                key={label}
                className={[
                  "rounded-lg border p-4",
                  index === 0 ? "border-success/20 bg-tag-green text-foreground" : index === 1 ? "border-destructive/20 bg-tag-pink text-foreground" : "border-border bg-tag-blue text-foreground",
                ].join(" ")}
              >
                <p className="text-15 font-bold">{label}</p>
                <p className="mt-2 text-12 leading-5">{executiveFindings[index] ?? executiveFindings[0]}</p>
              </div>
            ))}
          </div>
        </div>
        {renderInsightAside(page, pageIndex, pageLocked)}
      </div>
    );
  }

  return (
    <div data-testid="workspace-template-workbench" className="grid gap-4">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background p-4">
        <div>
          <Badge variant="outline">AI + Report Block</Badge>
          <h2 className="mt-2 text-18 font-bold text-foreground">为「{survey.title}」规划动态报告</h2>
          <p className="text-13 text-muted-foreground">
            问卷元数据进入 AI Planner，Rule Engine 命中可用组件，再由 Report Composer 生成报告结构。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => onSaveTemplate(buildTemplateDraft())}>
            {saving ? "保存中…" : "保存模板"}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onBackToDesign}>
            返回题目设计
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onOpenCollect}
            className="gap-1.5 border-foreground bg-foreground text-background hover:bg-foreground/90 hover:text-background"
          >
            下一步：发布
            <Send className="h-4 w-4" strokeWidth={1.6} />
          </Button>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-background p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Badge variant="success">Professional report canvas</Badge>
            <h3 className="mt-2 text-18 font-bold text-foreground">报告模板编辑工作台</h3>
            <p className="text-13 text-muted-foreground">
              用户不改正文，只控制生成策略、章节结构、版式、主题和输出格式；AI 根据这些控制项重组页面内容。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{pageCount} pages</Badge>
            <Badge variant="success">{blockCount} blocks</Badge>
            <Badge variant="muted">{selectedTheme}</Badge>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {[
            ["题目输入", `${questions.length} 个`, "题型、选项、必填、业务标签"],
            ["组合分析", "5 组", "基础 / 多维"],
            ["Report Blocks", `${blockCount} 个`, "图表、统计、AI 洞察组件"],
            ["报告页面", `${pageCount} 页`, "PDF / Word / Dashboard 同源输出"],
          ].map(([label, value, helper]) => (
            <div key={label} className="rounded-lg border border-border bg-card p-3">
              <p className="text-12 font-semibold text-foreground">{label}</p>
              <p className="mt-1 text-18 font-bold text-foreground">{value}</p>
              <p className="mt-1 text-12 text-muted-foreground">{helper}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_300px]">
          <aside className="grid gap-3">
            <section className="rounded-lg border border-border bg-card p-3">
              <h4 className="text-13 font-bold text-foreground">生成方式</h4>
              <div className="mt-3 grid gap-2">
                {generationModes.map((mode) => (
                  <Button
                    key={mode.title}
                    type="button"
                    variant="outline"
                    onClick={() => setSelectedMode(mode.title)}
                    className={[
                      "h-auto w-full items-start justify-start whitespace-normal rounded-lg p-3 text-left font-normal transition-colors",
                      selectedMode === mode.title ? "border-foreground bg-background shadow-sm" : "border-border bg-background hover:border-border-strong",
                    ].join(" ")}
                  >
                    <span className="block">
                      <span className="block text-13 font-semibold text-foreground">{mode.title}</span>
                      <span className="mt-1 block text-12 font-normal text-muted-foreground">{mode.desc}</span>
                    </span>
                  </Button>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-13 font-bold text-foreground">报告内容样式</h4>
                <Badge variant="outline">{reportElementSummary}</Badge>
              </div>
              <p className="mt-1 text-12 text-muted-foreground">多选模块后，页面结构和报告正文会按选择重组。</p>
              <div className="mt-3 grid gap-2">
                {([
                  ["text", "文本", "结论、说明、洞察和管理层摘要"],
                  ["image", "图片", "封面图、章节配图和视觉证据"],
                  ["chart", "报表", "指标卡、图表和数据分布"],
                ] as const).map(([key, label, desc]) => {
                  const active = reportElements.includes(key);
                  return (
                    <Button
                      key={key}
                      type="button"
                      variant="outline"
                      onClick={() => toggleReportElement(key)}
                      className={[
                        "h-auto w-full justify-between whitespace-normal rounded-lg px-3 py-2 text-left font-normal",
                        active ? "border-foreground bg-background" : "border-border bg-background",
                      ].join(" ")}
                    >
                      <span>
                        <span className="block text-13 font-semibold text-foreground">{label}</span>
                        <span className="text-12 text-muted-foreground">{desc}</span>
                      </span>
                      <span className="text-13 font-semibold text-muted-foreground">{active ? "✓" : ""}</span>
                    </Button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-13 font-bold text-foreground">主题与输出</h4>
                <Badge variant="outline">{selectedTheme}</Badge>
              </div>
              <div className="mt-3 grid gap-2">
                {themes.map(([name, desc]) => (
                  <Button
                    key={name}
                    type="button"
                    variant="outline"
                    onClick={() => setSelectedTheme(name)}
                    className={[
                      "h-auto w-full justify-between whitespace-normal rounded-lg px-3 py-2 text-left font-normal",
                      name === selectedTheme ? "border-foreground bg-background" : "border-border bg-background",
                    ].join(" ")}
                  >
                    <span>
                      <span className="block text-13 font-semibold text-foreground">{name}</span>
                      <span className="text-12 text-muted-foreground">{desc}</span>
                    </span>
                    {name === selectedTheme ? <span className="text-13 font-normal text-muted-foreground">✓</span> : null}
                  </Button>
                ))}
              </div>
            </section>
          </aside>

          <section className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h4 className="text-14 font-bold text-foreground">页面结构</h4>
                <p className="text-12 text-muted-foreground">点击页面后，在右侧查看该页可控项。</p>
              </div>
              <Badge variant="outline">{pageCount} pages</Badge>
            </div>
            <div className="mt-3 grid gap-2">
              {pages.map((page, index) => (
                <Button
                  key={page.title}
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedPageIndex(index)}
                  className={[
                    "h-auto w-full justify-between gap-3 whitespace-normal rounded-lg bg-background p-3 text-left font-normal transition-colors",
                    index === selectedPageIndex ? "border-foreground" : "border-border hover:border-border-strong",
                  ].join(" ")}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-foreground text-14 font-bold text-background">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-14 font-bold text-foreground">{page.title}</span>
                      <span className="mt-1 block text-12 text-muted-foreground">{page.desc}</span>
                      <span className="mt-2 flex flex-wrap gap-2">
                        <Badge variant="outline" className="border-border bg-tag-blue text-foreground">{page.layout}</Badge>
                        <Badge variant="success">{page.blocks} Blocks</Badge>
                      </span>
                    </span>
                  </span>
                  <span className="hidden shrink-0 text-right text-12 text-muted-foreground md:block">
                    图表：{page.chart}<br />
                    {locked[index] ? "已锁定" : `图片：${page.image}`}
                  </span>
                </Button>
              ))}
            </div>

            <section className="mt-4 rounded-lg border border-border bg-background p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h4 className="text-14 font-bold text-foreground">报告预览</h4>
                  <p className="text-12 text-muted-foreground">当前选中页的生成效果预览，会随右侧控制项即时更新。</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{selectedTheme}</Badge>
                  <Badge variant="outline">{reportElementSummary}</Badge>
                  <Badge variant={locked[selectedPageIndex] ? "muted" : "success"}>{locked[selectedPageIndex] ? "Locked" : "Live preview"}</Badge>
                </div>
              </div>

              <article className="mt-3 overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                <header className="border-b border-border bg-foreground p-4 text-background">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-12 font-semibold uppercase tracking-wide text-background/60">
                        {selectedTheme} / {goal ?? "调研分析"} / Report Page
                      </p>
                      <h5 className="mt-3 text-22 font-bold leading-tight">{currentPage.title}</h5>
                      <p className="mt-2 max-w-2xl text-13 leading-6 text-background/70">{currentPage.desc}</p>
                    </div>
                    <div className="grid min-w-36 gap-2 rounded-lg border border-background/15 bg-background/10 p-3 text-12">
                      <span className="flex items-center justify-between gap-3">
                        <span className="text-background/60">Layout</span>
                        <span className="font-semibold">{currentPage.layout}</span>
                      </span>
                      <span className="flex items-center justify-between gap-3">
                        <span className="text-background/60">Chart</span>
                        <span className="font-semibold">{hasChart ? currentPage.chart : "Off"}</span>
                      </span>
                      <span className="flex items-center justify-between gap-3">
                        <span className="text-background/60">Image</span>
                        <span className="font-semibold">{hasImage && currentPage.image !== "关闭" ? "On" : "Off"}</span>
                      </span>
                    </div>
                  </div>
                </header>

                <div className="grid gap-4 bg-surface-1 p-4 lg:grid-cols-[minmax(0,1fr)_300px]">
                  <section className="rounded-lg border border-border bg-background p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
                      <div>
                        <p className="text-11 font-semibold uppercase tracking-wide text-muted-foreground">Executive preview</p>
                        <h6 className="mt-1 text-18 font-bold text-foreground">{currentPage.title.replace(/^\d+\s*/, "")}</h6>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {hasText && <Badge variant="outline">文本优化</Badge>}
                        {hasImage && <Badge variant="outline">视觉证据</Badge>}
                        {hasChart && <Badge variant="outline">数据报表</Badge>}
                      </div>
                    </div>

                    {hasChart && (
                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        {previewMetrics.map(([label, value]) => (
                          <div key={label} className="rounded-lg border border-border bg-card p-3">
                            <p className="text-11 font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                            <p className="mt-2 text-22 font-bold text-foreground">{value}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {hasText && (
                      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                        <div className="rounded-lg border border-border bg-card p-4">
                          <p className="text-11 font-semibold uppercase tracking-wide text-muted-foreground">Management narrative</p>
                          <h6 className="mt-2 text-17 font-bold text-foreground">管理层可读摘要</h6>
                          <p className="mt-3 text-13 leading-6 text-muted-foreground">
                            基于当前题目、回收数据和报告目标，报告模型会先判断样本质量与关键风险，再把结论压缩成可复核、可执行的管理层摘要。只选择文本时，报告将保持纯文字结构，不混入图表或图片。
                          </p>
                        </div>
                        <div className="rounded-lg border border-border bg-card p-4">
                          <p className="text-11 font-semibold uppercase tracking-wide text-muted-foreground">Key decisions</p>
                          <div className="mt-3 grid gap-2">
                            {executiveFindings.map((finding, index) => (
                              <div key={finding} className="grid grid-cols-[28px_1fr] gap-2 rounded-md border border-border bg-background p-2">
                                <span className="grid h-7 w-7 place-items-center rounded-full bg-foreground text-11 font-bold text-background">{index + 1}</span>
                                <p className="text-12 leading-5 text-muted-foreground">{finding}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {hasImage && (
                      <div className="mt-4 overflow-hidden rounded-lg border border-border bg-card">
                        <div className="grid gap-0 lg:grid-cols-[220px_minmax(0,1fr)]">
                          <div className="border-b border-border bg-foreground p-4 text-background lg:border-b-0 lg:border-r">
                            <p className="text-11 font-semibold uppercase tracking-wide text-background/60">Visual evidence</p>
                            <h6 className="mt-6 text-20 font-bold leading-tight">{currentPage.title.replace(/^\d+\s*/, "")}视觉板</h6>
                            <p className="mt-3 text-12 leading-5 text-background/65">
                              {currentPage.image === "关闭" ? "当前页关闭配图，报告保留文本和数据证据。" : `配图策略：${currentPage.image}`}
                            </p>
                          </div>
                          <div className="p-4">
                            <div className="grid gap-3 sm:grid-cols-3">
                              {evidenceNotes.map(([label, value, desc]) => (
                                <div key={label} className="rounded-lg border border-border bg-background p-3">
                                  <p className="text-11 font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                                  <p className="mt-2 text-15 font-bold text-foreground">{value}</p>
                                  <p className="mt-1 text-12 leading-5 text-muted-foreground">{desc}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {hasChart && (
                      <div className="mt-4 rounded-lg border border-border bg-card p-4">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-11 font-semibold uppercase tracking-wide text-muted-foreground">Data story</p>
                            <p className="mt-1 text-15 font-bold text-foreground">{currentPage.chart}</p>
                          </div>
                          <Badge variant="outline">{currentPage.blocks} blocks</Badge>
                        </div>
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          {previewBars.map(([label, value]) => (
                            <div key={label} className="grid gap-1">
                              <div className="flex items-center justify-between text-12">
                                <span className="text-muted-foreground">{label}</span>
                                <span className="font-semibold text-foreground">{value}%</span>
                              </div>
                              <div className="h-2 overflow-hidden rounded-full bg-muted shadow-inner">
                                <div className="h-full rounded-full bg-foreground" style={{ width: `${value}%` }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </section>

                  <aside className="grid content-start gap-3">
                    {hasText && (
                      <div className="rounded-lg border border-border bg-background p-4">
                        <p className="text-11 font-semibold uppercase tracking-wide text-muted-foreground">AI Insight draft</p>
                        <div className="mt-3 grid gap-2">
                          {insightText.map((item) => (
                            <p key={item} className="rounded-md border border-border bg-card px-3 py-2 text-12 leading-5 text-muted-foreground">
                              {item}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="rounded-lg border border-border bg-background p-4">
                      <p className="text-11 font-semibold uppercase tracking-wide text-muted-foreground">Quality gate</p>
                      <div className="mt-3 grid gap-2">
                        {reportQualityChecks.map(([label, desc]) => (
                          <div key={label} className="rounded-md border border-border bg-card px-3 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-12 font-semibold text-foreground">{label}</p>
                              <Badge variant="success">Pass</Badge>
                            </div>
                            <p className="mt-1 text-11 leading-4 text-muted-foreground">{desc}</p>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 rounded-md bg-foreground px-3 py-2 text-12 text-background">
                        {locked[selectedPageIndex] ? "本页结构已锁定，重新生成时只更新内容。" : "本页可继续重新编排版式与模块顺序。"}
                      </div>
                    </div>
                  </aside>
                </div>
              </article>
            </section>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-background p-3">
                <p className="text-12 text-muted-foreground">题目输入</p>
                <p className="mt-1 text-18 font-bold text-foreground">{questions.length} 个</p>
                <p className="mt-1 text-12 text-muted-foreground">题型和标签驱动规则</p>
              </div>
              <div className="rounded-lg border border-border bg-background p-3">
                <p className="text-12 text-muted-foreground">组件命中</p>
                <p className="mt-1 text-18 font-bold text-foreground">{blockCount} 个</p>
                <p className="mt-1 text-12 text-muted-foreground">Report Block Library</p>
              </div>
              <div className="rounded-lg border border-border bg-background p-3">
                <p className="text-12 text-muted-foreground">输出格式</p>
                <p className="mt-1 text-18 font-bold text-foreground">PDF / Word</p>
                <p className="mt-1 text-12 text-muted-foreground">Dashboard 同源</p>
              </div>
            </div>
          </section>

          <aside className="grid h-fit gap-3">
            <section className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h4 className="text-13 font-bold text-foreground">当前页设置</h4>
                  <p className="text-12 text-muted-foreground">{currentPage.title}</p>
                </div>
                <Badge variant="success">No text edit</Badge>
              </div>
              <div className="mt-3 grid gap-2">
                {[
                  ["版式", currentPage.layout],
                  ["内容模块", reportElementSummary],
                  ["图表类型", hasChart ? currentPage.chart : "不生成"],
                  ["AI 文案", hasText ? "加强优化" : "不生成"],
                  ["配图", hasImage && currentPage.image !== "关闭" ? currentPage.image : "不生成"],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
                    <span className="text-12 text-muted-foreground">{label}</span>
                    <span className="text-13 font-semibold text-foreground">{value}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {["换版式", "换图表", "换配图", "锁本页"].map((label) => (
                  <Button
                    key={label}
                    type="button"
                    size="sm"
                    variant={label === "锁本页" && locked[selectedPageIndex] ? "default" : "outline"}
                    disabled={
                      (label !== "锁本页" && locked[selectedPageIndex])
                      || (label === "换图表" && !hasChart)
                      || (label === "换配图" && !hasImage)
                    }
                    onClick={() => {
                      if (label === "换版式") cycleCurrentPage("layout", layoutOptions);
                      if (label === "换图表" && hasChart) cycleCurrentPage("chart", chartOptions);
                      if (label === "换配图" && hasImage) cycleCurrentPage("image", imageOptions);
                      if (label === "锁本页") setLocked((items) => ({ ...items, [selectedPageIndex]: !items[selectedPageIndex] }));
                    }}
                  >
                    {label === "锁本页" && locked[selectedPageIndex] ? "已锁定" : label}
                  </Button>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-border bg-card p-3">
              <h4 className="text-13 font-bold text-foreground">本页组件</h4>
              <div className="mt-3 grid gap-2">
                {[
                  hasText ? ["专业文本", "摘要、洞察、管理层要点", "AI 分析"] : null,
                  hasImage ? ["章节配图", "封面图、章节图、视觉证据", "Image"] : null,
                  hasChart ? ["数据报表", "指标卡、分布图、矩阵图", "Chart"] : null,
                ].filter(Boolean).map((item) => {
                  const [name, desc, tag] = item as [string, string, string];
                  return (
                    <div key={name} className="rounded-lg border border-border bg-background p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-13 font-bold text-foreground">{name}</p>
                        <Badge variant="muted">{tag}</Badge>
                      </div>
                      <p className="mt-1 text-12 text-muted-foreground">{desc}</p>
                    </div>
                  );
                })}
              </div>
            </section>
          </aside>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {[
            ["自动生成策略", selectedMode, "用户不逐字编辑报告，只选择目标、主题、输出格式；AI Planner 负责结构，AI Insight 负责正文。"],
            ["差异化来源", goal ?? "商品安全", "不同问卷目标会触发不同章节、图形、分析语言、风险提示和行动建议。"],
            ["可控操作", `${Object.values(locked).filter(Boolean).length} locked`, "保留结构锁定、重新生成、换主题、导出和版本回滚入口，不暴露复杂正文编辑器。"],
            ["多智能体生成", "6 agents", "Planner 定章节，Layout 定版式，Chart 定图形，Image 调 Wan 2.7，Insight 写分析，QA 检查一致性。"],
          ].map(([title, badge, desc]) => (
            <section key={title} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-13 font-bold text-foreground">{title}</h4>
                <Badge variant="outline">{badge}</Badge>
              </div>
              <p className="mt-2 text-12 leading-5 text-muted-foreground">{desc}</p>
            </section>
          ))}
        </div>

        <article className="mt-4 overflow-hidden rounded-lg border border-border bg-card p-3 shadow-sm">
          <header className="overflow-hidden rounded-lg border border-foreground bg-foreground p-5 text-background">
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <p className="text-12 font-semibold uppercase tracking-wide text-background/60">
                  {selectedTheme} / {goal ?? "商品安全"} / Final Research Report
                </p>
                <h4 className="mt-4 text-22 font-bold leading-tight">{reportPlan.name.replace("规划", "报告")}</h4>
                <p className="mt-3 max-w-2xl text-14 leading-7 text-background/75">
                  基于问卷回收数据、样本结构、题目组合和开放反馈生成；当前输出模块为「{reportElementSummary}」，报告模型会按所选内容重组正文、配图和报表。
                </p>
                <div className="mt-8 grid gap-2 sm:grid-cols-3">
                  {[
                    ["Pages", String(pageCount), "连续报告页"],
                    ["Evidence", String(blockCount), "已选内容模块"],
                    ["Status", "Draft", "结构预览"],
                  ].map(([label, value, note]) => (
                    <div key={label} className="rounded-lg border border-background/15 bg-background/10 p-3">
                      <p className="text-10 font-semibold uppercase tracking-wide text-background/50">{label}</p>
                      <p className="mt-1 text-22 font-bold">{value}</p>
                      <p className="mt-1 text-11 text-background/60">{note}</p>
                    </div>
                  ))}
                </div>
              </div>
              <aside className="self-end rounded-lg border border-background/15 bg-background/10 p-4">
                <p className="text-12 font-semibold uppercase tracking-wide text-background/55">Generation Stack</p>
                <div className="mt-4 grid gap-2">
                  {[
                    ["Planner", "章节结构"],
                    ["Layout", "页面版式"],
                    ["Chart", hasChart ? "图形表达" : "关闭"],
                    ["Image", hasImage ? "商务配图" : "关闭"],
                    ["Insight", hasText ? "专业分析" : "关闭"],
                    ["QA", "一致性检查"],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-3 rounded-md border border-background/10 bg-background/10 px-3 py-2 text-12">
                      <span className="font-semibold">{label}</span>
                      <span className="text-background/60">{value}</span>
                    </div>
                  ))}
                </div>
              </aside>
            </div>
          </header>

          <nav className="mt-3 rounded-lg border border-border bg-background p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-12 font-semibold uppercase tracking-wide text-muted-foreground">Report Contents</p>
              <Badge variant="outline">{pageCount} sections</Badge>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {pages.slice(0, 6).map((page, index) => (
                <div key={page.title} className="grid grid-cols-[32px_1fr] gap-2 rounded-lg border border-border bg-card p-2">
                  <span className="grid h-8 w-8 place-items-center rounded-md bg-foreground text-12 font-bold text-background">{String(index + 1).padStart(2, "0")}</span>
                  <div className="min-w-0">
                    <p className="truncate text-13 font-semibold text-foreground">{page.title.replace(/^\d+\s*/, "")}</p>
                    <p className="truncate text-11 text-muted-foreground">{page.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </nav>

          <div className="mt-3 grid gap-4">
            {pages.map((page, pageIndex) => {
              const pageLocked = Boolean(locked[pageIndex]);
              return (
                <section
                  key={page.title}
                  className={[
                    "rounded-lg border bg-background p-4 shadow-sm",
                    pageIndex === selectedPageIndex ? "border-foreground" : "border-border",
                  ].join(" ")}
                >
                  <div className="grid gap-4 border-b border-border pb-4 lg:grid-cols-[64px_minmax(0,1fr)_auto]">
                    <div className="grid h-16 w-16 place-items-center rounded-lg bg-foreground text-background">
                      <div className="text-center">
                        <p className="text-10 uppercase opacity-70">Sec</p>
                        <p className="text-20 font-bold">{String(pageIndex + 1).padStart(2, "0")}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-12 font-semibold uppercase tracking-wide text-muted-foreground">{page.layout}</p>
                      <h4 className="mt-1 text-22 font-bold text-foreground">{page.title}</h4>
                      <p className="mt-2 max-w-2xl text-13 leading-5 text-muted-foreground">{page.desc}</p>
                    </div>
                    <div className="flex flex-wrap items-start justify-end gap-1.5">
                      <Badge variant="success">{page.blocks} Blocks</Badge>
                      {hasText && <Badge variant="outline">AI Insight</Badge>}
                      {hasImage && <Badge variant="outline">Image</Badge>}
                      {hasChart && <Badge variant="outline">Chart</Badge>}
                      <Badge variant={pageLocked ? "muted" : "outline"}>{pageLocked ? "Locked" : page.layout}</Badge>
                    </div>
                  </div>

                  <div className="mt-4 rounded-lg border border-border bg-surface-1 px-4 py-3">
                    <div className="grid gap-2 lg:grid-cols-[180px_minmax(0,1fr)_auto] lg:items-center">
                      <div>
                        <p className="text-10 font-semibold uppercase tracking-wide text-muted-foreground">Recommended Structure</p>
                        <p className="mt-1 text-13 font-bold text-foreground">{page.layout}</p>
                      </div>
                      <p className="text-12 leading-5 text-muted-foreground">
                        {`该页根据「${reportElementSummary}」自动选择结构：${hasText ? "生成专业说明" : "不生成正文"}，${hasImage ? "保留视觉证据" : "隐藏配图"}，${hasChart ? "展示数据报表" : "隐藏图表"}。`}
                      </p>
                      <Badge variant="outline">Layout Engine</Badge>
                    </div>
                  </div>

                  {renderTemplatePageBody(page, pageIndex, pageLocked)}
                </section>
              );
            })}
          </div>
        </article>
        {(status || error) && (
          <p
            role={error ? "alert" : "status"}
            data-testid="workspace-template-save-status"
            className={`mt-4 rounded-lg border px-3 py-2 text-13 ${error ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-success/30 bg-tag-green text-success"}`}
          >
            {error || status}
          </p>
        )}
      </section>
    </div>
  );
}

function WorkspaceCollectWorkbench({
  survey,
  responseMode,
  publishStartAt,
  publishEndAt,
  responseLimit,
  oneResponsePerUser,
  confirmationMessage,
  message,
  statusTogglePending,
  onResponseModeChange,
  onPublishStartAtChange,
  onPublishEndAtChange,
  onResponseLimitChange,
  onOneResponsePerUserChange,
  onConfirmationMessageChange,
  onToggleStatus,
  onSave,
  onBackToTemplate,
  onOpenReport,
}: {
  survey: Survey;
  responseMode: "anonymous" | "identified";
  publishStartAt: string;
  publishEndAt: string;
  responseLimit: string;
  oneResponsePerUser: boolean;
  confirmationMessage: string;
  message: string;
  statusTogglePending: boolean;
  onResponseModeChange: (value: "anonymous" | "identified") => void;
  onPublishStartAtChange: (value: string) => void;
  onPublishEndAtChange: (value: string) => void;
  onResponseLimitChange: (value: string) => void;
  onOneResponsePerUserChange: (value: boolean) => void;
  onConfirmationMessageChange: (value: string) => void;
  onToggleStatus: () => void;
  onSave: () => void;
  onBackToTemplate: () => void;
  onOpenReport: () => void;
}) {
  const reportPlan = inferReportPlan(survey);
  const isCollecting = survey.status === "active";
  const toggleStatusLabel = isCollecting ? "暂停回收" : "启用回收";
  const shareUrl = survey.shareUrl || `/s/${survey.id}`;
  const responseTarget = responseLimit.trim() ? Number(responseLimit) : null;
  const completionText = responseTarget && responseTarget > 0
    ? `${Math.min(100, Math.round((survey.responses / responseTarget) * 100))}% 目标进度`
    : "未设置上限";
  const channelCards = [
    ["公开链接", "复制后可投放到邮件、社群或运营位", "Ready"],
    ["二维码", "适合线下物料、海报和现场扫码", "Ready"],
    ["定向邀请", responseMode === "identified" ? "实名模式可追踪受访者" : "匿名模式仅统计来源", responseMode === "identified" ? "Enabled" : "Optional"],
  ];

  return (
    <div data-testid="workspace-collect-workbench" className="grid gap-4">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background p-4">
        <div>
          <Badge variant="outline">Collect</Badge>
          <h2 className="mt-2 text-18 font-bold text-foreground">发布回收</h2>
          <p className="text-13 text-muted-foreground">设置链接、回收范围和提交规则。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onBackToTemplate}>
            上一步：报告规划
          </Button>
          <Button
            type="button"
            size="sm"
            variant={isCollecting ? "outline" : "default"}
            onClick={onToggleStatus}
            disabled={statusTogglePending}
            className={isCollecting ? "gap-1.5" : "gap-1.5 bg-foreground text-background hover:bg-foreground/90"}
          >
            {isCollecting ? <PauseCircle className="h-4 w-4" strokeWidth={1.6} /> : <PlayCircle className="h-4 w-4" strokeWidth={1.6} />}
            {statusTogglePending ? "处理中" : toggleStatusLabel}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onSave}>
            保存配置
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onOpenReport}
            className="gap-1.5 border-foreground bg-foreground text-background hover:bg-foreground/90 hover:text-background"
          >
            下一步：分析报告
            <Send className="h-4 w-4" strokeWidth={1.6} />
          </Button>
        </div>
      </section>

      {message && (
        <section
          role={message.startsWith("已保存") ? undefined : "alert"}
          className={`rounded-lg border p-3 text-13 ${
            message.startsWith("已保存")
              ? "border-success/30 bg-tag-green text-success"
              : "border-destructive/30 bg-destructive/5 text-destructive"
          }`}
        >
          {message}
        </section>
      )}

      <section className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-12 text-muted-foreground">当前问卷</p>
          <p className="mt-1 text-15 font-semibold text-foreground">{survey.title}</p>
          <p className="mt-1 line-clamp-2 text-12 text-muted-foreground">{survey.description || "暂无说明"}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-12 text-muted-foreground">回收状态</p>
          <div className="mt-2 flex items-center gap-2">
            <Badge variant="outline" className={statusBadgeClass(survey.status)}>
              {STATUS_LABEL[survey.status]}
            </Badge>
            <span className="text-13 font-semibold text-foreground">{survey.responses} 份答卷</span>
          </div>
          <p className="mt-1 text-12 text-muted-foreground">{completionText}</p>
          <Button
            type="button"
            size="sm"
            variant={isCollecting ? "outline" : "default"}
            onClick={onToggleStatus}
            disabled={statusTogglePending}
            className={`mt-3 w-full gap-1.5 ${isCollecting ? "" : "bg-foreground text-background hover:bg-foreground/90"}`}
          >
            {isCollecting ? <PauseCircle className="h-4 w-4" strokeWidth={1.6} /> : <PlayCircle className="h-4 w-4" strokeWidth={1.6} />}
            {statusTogglePending ? "处理中" : toggleStatusLabel}
          </Button>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-12 text-muted-foreground">报告规划</p>
          <p className="mt-1 text-13 font-semibold text-foreground">{reportPlan.name}</p>
          <p className="mt-1 text-12 text-muted-foreground">{reportPlan.meta}</p>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-4">
          <section className="rounded-lg border border-border bg-background p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Badge variant="success">Publish setup</Badge>
                <h3 className="mt-2 text-18 font-bold text-foreground">回收规则</h3>
                <p className="text-13 text-muted-foreground">这些设置会直接影响答题入口、去重规则和回收时间窗口。</p>
              </div>
              <Badge variant="outline">{responseMode === "identified" ? "实名填写" : "匿名填写"}</Badge>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="workspace-publish-mode">答题身份</Label>
                <Select
                  id="workspace-publish-mode"
                  value={responseMode}
                  onChange={(event) => onResponseModeChange(event.target.value === "identified" ? "identified" : "anonymous")}
                >
                  <option value="anonymous">匿名填写</option>
                  <option value="identified">实名填写</option>
                </Select>
              </div>
              <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-14 text-foreground">
                <span>
                  <span className="block font-semibold">每人一次</span>
                  <span className="text-12 text-muted-foreground">限制重复提交，后续可接入登录态或邀请名单。</span>
                </span>
                <Input
                  type="checkbox"
                  checked={oneResponsePerUser}
                  onChange={(event) => onOneResponsePerUserChange(event.target.checked)}
                  className="h-4 w-4"
                />
              </label>
              <div className="grid gap-1.5">
                <Label htmlFor="workspace-publish-start">开始时间</Label>
                <Input
                  id="workspace-publish-start"
                  type="datetime-local"
                  value={publishStartAt}
                  onChange={(event) => onPublishStartAtChange(event.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="workspace-publish-end">截止时间</Label>
                <Input
                  id="workspace-publish-end"
                  type="datetime-local"
                  value={publishEndAt}
                  onChange={(event) => onPublishEndAtChange(event.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="workspace-response-limit">答卷上限</Label>
                <Input
                  id="workspace-response-limit"
                  type="number"
                  min="1"
                  placeholder="不限制"
                  value={responseLimit}
                  onChange={(event) => onResponseLimitChange(event.target.value)}
                />
              </div>
              <div className="rounded-lg border border-border bg-card p-3">
                <p className="text-12 text-muted-foreground">发布前检查</p>
                <div className="mt-2 grid gap-2 text-13">
                  {["题目可答", "报告规划已绑定", "提交文案已配置"].map((item) => (
                    <div key={item} className="flex items-center gap-2 text-foreground">
                      <span className="h-2 w-2 rounded-full bg-success" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid gap-1.5 md:col-span-2">
                <Label htmlFor="workspace-confirmation-message">提交确认文案</Label>
                <Textarea
                  id="workspace-confirmation-message"
                  value={confirmationMessage}
                  onChange={(event) => onConfirmationMessageChange(event.target.value)}
                  className="min-h-24"
                />
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-background p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Badge variant="outline">Share</Badge>
                <h3 className="mt-2 text-18 font-bold text-foreground">发布入口</h3>
                <p className="text-13 text-muted-foreground">提供链接、二维码和渠道投放入口，方便上线前检查。</p>
              </div>
              <Button type="button" size="sm" variant="outline" className="gap-1.5">
                <Copy className="h-4 w-4" strokeWidth={1.6} />
                复制链接
              </Button>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="grid aspect-square place-items-center rounded-md border border-border bg-muted">
                  <div className="rounded-md bg-background px-3 py-2 text-center text-12 font-semibold text-foreground">QR</div>
                </div>
                <p className="mt-3 text-12 text-muted-foreground">扫码预览答题页</p>
              </div>
              <div className="grid gap-3">
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-12 text-muted-foreground">公开链接</p>
                  <p className="mt-1 truncate text-13 font-semibold text-foreground">{shareUrl}</p>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  {channelCards.map(([title, desc, status]) => (
                    <div key={title} className="rounded-lg border border-border bg-card p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-13 font-semibold text-foreground">{title}</p>
                        <Badge variant={status === "Ready" || status === "Enabled" ? "success" : "muted"}>{status}</Badge>
                      </div>
                      <p className="mt-2 text-12 text-muted-foreground">{desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>

        <aside className="grid h-fit gap-4">
          <SurveyAiPanel
            title="发布 AI"
            placeholder="例如：设置为团队实名问卷，回收 200 份并在周五截止"
            resultLabel="AI 已生成发布方案"
            changeCount={5}
            onSubmit={onSave}
            onPreview={() => undefined}
            onApply={onSave}
          />
          <section className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-15 font-bold text-foreground">回收监控</h3>
              <Badge variant={survey.status === "active" ? "success" : "muted"}>{STATUS_LABEL[survey.status]}</Badge>
            </div>
            <div className="mt-4 grid gap-3">
              {[
                ["已收答卷", `${survey.responses}`],
                ["答卷上限", responseTarget ? `${responseTarget}` : "不限"],
                ["身份模式", responseMode === "identified" ? "实名" : "匿名"],
                ["去重策略", oneResponsePerUser ? "每人一次" : "允许多次"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
                  <span className="text-12 text-muted-foreground">{label}</span>
                  <span className="text-13 font-semibold text-foreground">{value}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-15 font-bold text-foreground">上线检查</h3>
            <div className="mt-3 grid gap-2">
              {[
                ["答题页", "可访问"],
                ["报告模板", "已绑定"],
                ["回收规则", publishEndAt ? "有截止时间" : "长期开放"],
                ["提交反馈", confirmationMessage.trim() ? "已配置" : "待补充"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md border border-border bg-background p-3">
                  <p className="text-12 text-muted-foreground">{label}</p>
                  <p className="mt-1 text-13 font-semibold text-foreground">{value}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-15 font-bold text-foreground">下一步</h3>
            <p className="mt-1 text-12 text-muted-foreground">
              保存配置后可以发布答题链接；回收开始后，分析报告会按报告规划自动补全数据。
            </p>
            <div className="mt-3 grid gap-2">
              <Button
                type="button"
                variant={isCollecting ? "outline" : "default"}
                size="sm"
                onClick={onToggleStatus}
                disabled={statusTogglePending}
                className={`gap-1.5 ${isCollecting ? "" : "bg-foreground text-background hover:bg-foreground/90"}`}
              >
                {isCollecting ? <PauseCircle className="h-4 w-4" strokeWidth={1.6} /> : <PlayCircle className="h-4 w-4" strokeWidth={1.6} />}
                {statusTogglePending ? "处理中" : toggleStatusLabel}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={onSave}>
                保存发布配置
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onOpenReport}
                className="border-foreground bg-foreground text-background hover:bg-foreground/90 hover:text-background"
              >
                进入分析报告
              </Button>
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}

function WorkspaceReportWorkbench({
  survey,
  questions,
  categoryPlan,
  generatedReport,
  professionalReport,
  generation,
  generating,
  error,
  onGenerateReport,
  onSelectVersion,
  onLoadMoreVersions,
}: {
  survey: Survey;
  questions: Question[];
  categoryPlan?: ReportCategoryPlanDraft;
  generatedReport?: unknown;
  professionalReport?: SurveyReportDocument;
  generation?: SurveyReportGenerationStatus;
  generating: boolean;
  error: string;
  onGenerateReport: (instruction?: string, reportCategoryPlan?: ReportCategoryPlanDraft) => void;
  onSelectVersion: (artifactId: string) => Promise<boolean>;
  onLoadMoreVersions: () => Promise<boolean>;
}) {
  const [reportOutlineCollapsed, setReportOutlineCollapsed] = useState(false);
  const [selectedReportSection, setSelectedReportSection] = useState("");
  const composerQuestions = workspaceQuestionsForComposer(questions);
  const effectiveCategoryPlan = categoryPlan?.categories.length ? categoryPlan : fallbackReportCategoryPlan(survey, questions);
  const generatedReportCategoryPlan = (generatedReport as { reportCategoryPlan?: ReportCategoryPlanDraft } | undefined)?.reportCategoryPlan;
  const renderCategoryPlan = generatedReportCategoryPlan?.categories.length ? generatedReportCategoryPlan : effectiveCategoryPlan;
  const plannedPreview = buildReportComposerPreview(
    renderCategoryPlan,
    composerQuestions,
    {
      title: survey.title,
      description: survey.description,
      responses: survey.responses,
    }
  );
  const plannedSections = plannedPreview.sections.length
    ? plannedPreview.sections
    : buildReportComposerPreview(fallbackReportCategoryPlan(survey, questions), composerQuestions, {
        title: survey.title,
        description: survey.description,
        responses: survey.responses,
      }).sections;
  const responseCount = survey.responses;
  const layoutNames: Record<ReportInputMode, string> = {
    text: "文本",
    chat: "QA",
    chart: "报表",
    image: "图片",
  };
  const generatedBlocks = Array.isArray((generatedReport as { blocks?: unknown[] } | undefined)?.blocks)
    ? ((generatedReport as { blocks: PlannedReportBlock[] }).blocks ?? [])
    : [];
  type GeneratedSection = ReportComposerPreview["sections"][number] & { blocks: PlannedReportBlock[] };
  const generatedSections: GeneratedSection[] = plannedSections.map((section) => {
    const blocks = generatedBlocks.filter((block) => {
      const titlePrefix = `${section.title} -`;
      const idPrefix = `category-${section.order}-${section.id}-`;
      const sectionQuestionIds = new Set(
        renderCategoryPlan.categories
          .find((category) => category.id === section.id)
          ?.questionIds.map((id) => String(id)) ?? []
      );
      return (
        block.id.startsWith(idPrefix)
        || block.id.includes(`-${section.id}-`)
        || block.title.startsWith(titlePrefix)
        || block.sourceQuestionIds.some((questionId) => sectionQuestionIds.has(String(questionId)))
      );
    });
    return { ...section, blocks };
  });
  const [, setExportStatus] = useState("");

  function reportGenerationInstruction() {
    return [
      "请生成适合管理层会议使用的专业咨询报告。",
      "每个章节先给结论，再给数据证据，再给业务影响和下一步动作。",
      "章节组织应避免重复观点，每个关键结论必须绑定题目、答卷分布、样本限制或开放反馈证据。",
      "最终建议分为短期行动、中期验证和长期机制，且不得超过真实数据支持范围。",
    ].join("\n");
  }

  function blockForSectionMode(section: GeneratedSection, mode: ReportInputMode) {
    return section.blocks.find((item) => item.id.endsWith(`-${mode}`) || item.title.includes(layoutNames[mode]) || item.title.includes(mode));
  }

  function sectionChartRows(section: GeneratedSection, block?: PlannedReportBlock) {
    return block?.chartData?.length
      ? block.chartData
      : section.chart?.rows ?? [];
  }

  function reportInsightLens(title: string) {
    const text = title.toLowerCase();
    if (/(年龄|性别|地区|城市|画像|人群|职业|身份)/.test(text)) return "profile";
    if (/(购买|买过|下单|复购|转化|了解|认知)/.test(text)) return "purchase";
    if (/(安全信息|关注.*安全|认证|检测|成分|披露|信任)/.test(text)) return "trust";
    if (/(风险|担心|顾虑|阻碍|疑虑|问题)/.test(text)) return "risk";
    if (/(价格|溢价|支付|预算|性价比|费用)/.test(text)) return "price";
    return "general";
  }

  function distributionTextInsights(sectionTitle: string, rows: Array<{ label: string; value: number }>) {
    const validRows = rows.filter((row) => Number.isFinite(row.value));
    if (!validRows.length) return [`样本尚未形成稳定信号，当前章节应作为数据占位，待回收答卷后再输出正式判断。`];
    const sorted = [...validRows].sort((a, b) => b.value - a.value);
    const top = sorted[0]!;
    const second = sorted[1];
    const low = sorted[sorted.length - 1]!;
    const total = validRows.reduce((sum, row) => sum + row.value, 0);
    const topShare = total > 0 ? Math.round((top.value / total) * 100) : 0;
    const gap = Math.max(0, top.value - low.value);
    const secondClause = second ? `，第二梯队为「${second.label}」` : "";
    const lens = reportInsightLens(sectionTitle);
    const templates: Record<string, string[]> = {
      profile: [
        `样本画像判断：当前答卷以「${top.label}」为主要人群（${top.value}，约 ${topShare}%）${secondClause}，报告结论应优先解释这一人群的购买语境，而不是泛化为全市场判断。`,
        `结构含义：「${low.label}」样本仅 ${low.value}，与主力人群相差 ${gap}；若该群体是战略目标客群，需要单独补样，否则会低估其真实诉求。`,
        `运营动作：将后续结论拆成主力人群和低覆盖人群两套口径，主力人群用于当前策略判断，低覆盖人群用于下一轮定向回收。`,
      ],
      purchase: [
        `转化漏斗判断：「${top.label}」是当前最主要状态（${top.value}，约 ${topShare}%）${secondClause}，说明用户仍处在明确的认知/购买阶段，需要按阶段设计运营动作。`,
        `增长含义：「${low.label}」仅 ${low.value}，与最高项相差 ${gap}；这不是简单低需求，可能代表触达不足、信任门槛过高或购买理由不充分。`,
        `运营动作：对「${top.label}」人群推进下一步转化素材，对「${low.label}」人群补充教育内容、试用机制或首单激励，分层验证转化阻力。`,
      ],
      trust: [
        `信任建设判断：「${top.label}」成为最强信号（${top.value}，约 ${topShare}%），说明用户决策更依赖可验证证据，而不是单纯营销表达。`,
        `证据含义：「${low.label}」仅 ${low.value}，与主信号差距 ${gap}；低频项可降级处理，资源应集中在能降低感知风险的认证、检测、追溯或售后背书。`,
        `产品动作：把「${top.label}」前置到详情页和购买链路，并用图表化证据、第三方证明或 FAQ 消除关键疑虑。`,
      ],
      risk: [
        `风险优先级判断：「${top.label}」是当前最突出的阻力源（${top.value}，约 ${topShare}%），应被视为影响购买决策的一级风险。`,
        `管理含义：「${low.label}」仅 ${low.value}，与最高项相差 ${gap}；风险治理不应平均用力，应先处理最高频、最接近成交阻断的问题。`,
        `风控动作：围绕「${top.label}」建立解释、承诺和补偿机制，同时追踪投诉/退货/咨询数据验证该风险是否真实影响转化。`,
      ],
      price: [
        `价值感判断：「${top.label}」是价格相关反馈的主导信号（${top.value}，约 ${topShare}%），说明用户并非只看绝对价格，更关注价格背后的可信理由。`,
        `商业含义：「${low.label}」仅 ${low.value}，与最高项相差 ${gap}；价格策略应避免单一降价，而要区分价值证明不足和支付意愿不足。`,
        `定价动作：围绕「${top.label}」重构价值表达，并用分层权益、认证背书或试用方案验证用户的真实支付阈值。`,
      ],
      general: [
        `业务判断：「${top.label}」是当前最强信号（${top.value}，约 ${topShare}%）${secondClause}，该章节应围绕这一信号建立结论主线。`,
        `结构含义：「${low.label}」仅 ${low.value}，与最高项相差 ${gap}；低频项更适合作为补充假设，而不是当前优先级。`,
        `下一步：先验证「${top.label}」背后的原因，再判断是否需要对低频人群单独补样或追加追问。`,
      ],
    };
    return templates[lens] ?? templates.general ?? [];
  }

  function sectionTextItems(section: GeneratedSection, block?: PlannedReportBlock) {
    const generated = [
      ...(block?.insights ?? []),
      ...(block?.recommendation ? [block.recommendation] : []),
    ]
      .map((item) => item.trim())
      .filter(Boolean);
    const placeholderPatterns = ["基于题目", "覆盖 ", "正式报告会保留", "围绕"];
    const meaningfulGenerated = generated.filter((item) => !placeholderPatterns.some((pattern) => item.includes(pattern)));
    if (meaningfulGenerated.length) return meaningfulGenerated.slice(0, 5);

    return distributionTextInsights(section.title, sectionChartRows(section, block));
  }

  function exportPdf() {
    if (!professionalReport) {
      setExportStatus("专业报告数据仍在加载，请稍后重试。");
      return;
    }
    const opened = openProfessionalPdfExportWindow(professionalReport);
    setExportStatus(opened ? "已打开 A4 PDF 导出窗口，可在打印对话框中保存。" : "浏览器拦截了 PDF 导出窗口，请允许弹窗后重试。");
  }

  function exportWord() {
    if (!professionalReport) {
      setExportStatus("专业报告数据仍在加载，请稍后重试。");
      return;
    }
    downloadProfessionalWordReport(professionalReport);
    setExportStatus("Word 专业报告已开始下载。");
  }

  if (
    professionalReport
    && isTemplateDrivenSurveyReport(professionalReport)
  ) {
    return (
      <SurveyProfessionalReportWorkbench
        report={professionalReport}
        generation={generation}
        generating={generating}
        error={error}
        onGenerateReport={() =>
          onGenerateReport(
            reportGenerationInstruction(),
            effectiveCategoryPlan
          )
        }
        onSelectVersion={onSelectVersion}
        onLoadMoreVersions={onLoadMoreVersions}
        onExportPdf={exportPdf}
        onExportWord={exportWord}
      />
    );
  }

  if (!professionalReport) {
    return (
      <section data-testid="professional-report-loading" className="border border-border bg-background px-8 py-16 text-center">
        <h2 className="text-18 font-bold text-foreground">正在汇总真实答卷</h2>
        <p className="mt-2 text-13 text-muted-foreground">报告只会使用已提交答卷，不会用模拟数据填充图表或结论。</p>
      </section>
    );
  }

  return (
    <div data-testid="workspace-report-workbench" className="grid gap-4">
      <section className="overflow-hidden rounded-lg border border-border bg-background">
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div className="min-w-0">
            <p className="text-11 font-semibold uppercase tracking-[0.14em] text-muted-foreground">Analysis Report</p>
            <h2 className="mt-1 truncate text-20 font-bold text-foreground">{survey.title}</h2>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              size="sm"
              disabled={generating}
              onClick={() => onGenerateReport(reportGenerationInstruction(), effectiveCategoryPlan)}
              className="h-10 gap-2 bg-foreground px-4 text-background hover:bg-foreground/90"
            >
              <Sparkles className="h-4 w-4" strokeWidth={1.6} />
              {generating ? "生成中..." : "生成报告"}
            </Button>
            <div className="flex items-center gap-1 rounded-lg border border-border bg-secondary p-1">
              <Button type="button" variant="ghost" disabled={generating} onClick={exportPdf} className="h-8 gap-1.5 px-2.5 text-12">
                <FileText className="h-3.5 w-3.5" strokeWidth={1.6} />
                PDF
              </Button>
              <Button type="button" variant="ghost" disabled={generating} onClick={exportWord} className="h-8 gap-1.5 px-2.5 text-12">
                <FileText className="h-3.5 w-3.5" strokeWidth={1.6} />
                Word
              </Button>
            </div>
          </div>
        </div>
      </section>

      <SurveyReportVersionHistory
        key={survey.id}
        generation={generation}
        report={professionalReport}
        disabled={generating}
        onSelectVersion={onSelectVersion}
        onLoadMore={onLoadMoreVersions}
      />

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-13 text-destructive"
        >
          {error}
        </p>
      )}

      <div className={reportOutlineCollapsed ? "grid min-w-0 xl:grid-cols-[56px_minmax(0,1fr)_320px]" : "grid min-w-0 xl:grid-cols-[220px_minmax(0,1fr)_320px]"}>
      <SurveyOutlinePanel
        title="报告目录"
        items={generatedSections.map((section) => ({ id: section.id, label: section.title, meta: "已生成" }))}
        selectedId={selectedReportSection || generatedSections[0]?.id}
        collapsed={reportOutlineCollapsed}
        onToggle={() => setReportOutlineCollapsed((collapsed) => !collapsed)}
        onSelect={setSelectedReportSection}
      />
      <div className="min-w-0">
      {professionalReport ? (
        <div className="overflow-hidden border-y border-border bg-background shadow-sm xl:border-x-0">
          <ProfessionalReportDocument report={professionalReport} />
        </div>
      ) : (
      <article className="overflow-hidden border-y border-border bg-background shadow-sm xl:border-x-0">
        <section className="border-b border-border bg-foreground px-8 py-8 text-background">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-4xl">
              <h1 className="text-30 font-bold leading-tight">{survey.title} 分析报告</h1>
            </div>
          </div>
        </section>

        <section className="grid gap-0 bg-background">
          {generatedSections.map((section) => (
            <section key={section.id} className="grid gap-5 border-b border-border px-8 py-8 last:border-b-0">
              <div className="grid gap-4 lg:grid-cols-2">
                {visibleInputModes(section.inputModes).map((mode) => {
                  const block = blockForSectionMode(section, mode);
                  if (mode === "text") {
                    const textItems = sectionTextItems(section, block);
                    return (
                      <div key={mode} className="rounded-lg border border-border bg-card p-4">
                        <h4 className="text-15 font-bold text-foreground">{block?.title ?? `${section.title} 管理层洞察`}</h4>
                        <div className="mt-3 grid gap-2">
                          {textItems.slice(0, 4).map((item, itemIndex) => (
                            <div key={`${item}-${itemIndex}`} className="rounded-md border border-border bg-card px-3 py-2 text-13 leading-6 text-muted-foreground">
                              {item}
                            </div>
                          ))}
                        </div>
                        {block?.recommendation ? <p className="mt-3 rounded-md bg-muted px-3 py-2 text-12 text-muted-foreground">{block.recommendation}</p> : null}
                      </div>
                    );
                  }
                  if (mode === "chart") {
                    const rows = block?.chartData?.length
                      ? block.chartData
                      : section.chart?.rows ?? [{ label: "待生成", value: 0 }];
                    const reportChart = {
                      title: block?.title ?? section.chart?.title ?? `${section.title} 数据报表`,
                      type: (block?.chartType === "none" ? section.chart?.type : block?.chartType) ?? section.chart?.type,
                      style: section.chart?.style,
                      config: section.chart?.config,
                      dataPrompt: section.chart?.dataPrompt,
                      prompt: section.chart?.prompt,
                      sampleSize: section.chart?.sampleSize ?? responseCount,
                      isSimulated: true as const,
                      appliedConstraints: section.chart?.appliedConstraints ?? [],
                      rows,
                    };
                    return (
                      <div key={mode} className="rounded-lg border border-border bg-card p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-13 font-semibold text-foreground">{block?.title ?? `${section.title} 数据报表`}</p>
                        </div>
                        <div className="mt-4 rounded-lg border border-border bg-background p-3">
                          <EChartsReportPreview chart={reportChart} />
                          {section.chart?.rows.length ? (
                            <p className="border-t border-border px-2 pt-2 text-11 text-muted-foreground">
                              预览维度：{section.chart.rows.map((row) => row.label).join(" · ")}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    );
                  }
                  if (mode === "image") {
                    const generatedImageUrl = block?.imageUrl;
                    const visualRows = (block?.chartData?.length ? block.chartData : section.chart?.rows ?? [])
                      .filter((row) => Number.isFinite(row.value))
                      .slice(0, 8);
                    const visualMax = Math.max(...visualRows.map((row) => row.value), 1);
                    const visualLead = [...visualRows].sort((a, b) => b.value - a.value)[0];
                    return (
                      <div key={mode} className="rounded-lg border border-border bg-card p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-13 font-semibold text-foreground">{block?.title ?? `${section.title} 视觉说明`}</p>
                        </div>
                        <div className="mt-4 rounded-lg border border-border bg-background p-4">
                          {generatedImageUrl ? (
                            <div className="grid gap-3">
                              <img src={generatedImageUrl} alt={`${section.title} 报告配图`} className="h-auto w-full rounded-md border border-border object-cover" />
                              <p className="text-11 leading-5 text-muted-foreground">Wan 2.7 已根据该分类问题、答卷分布和报告规划生成。</p>
                            </div>
                          ) : visualRows.length ? (
                            <div className="grid gap-3">
                              <div className="flex items-end justify-between gap-3 border-b border-border pb-3">
                                <div>
                                  <p className="text-12 font-semibold text-foreground">{section.title} 关键分布</p>
                                  <p className="mt-1 text-11 text-muted-foreground">基于当前分类答卷生成的视觉摘要</p>
                                </div>
                                {visualLead ? (
                                  <div className="text-right">
                                    <p className="text-11 text-muted-foreground">主信号</p>
                                    <p className="text-13 font-bold text-foreground">{visualLead.label} · {visualLead.value}</p>
                                  </div>
                                ) : null}
                              </div>
                              <div className="grid gap-2">
                                {visualRows.map((row, rowIndex) => (
                                  <div key={`${row.label}-${rowIndex}`} className="grid grid-cols-[minmax(72px,1fr)_minmax(120px,3fr)_40px] items-center gap-3 text-11">
                                    <span className="truncate text-muted-foreground">{row.label}</span>
                                    <span className="h-2 overflow-hidden rounded-full bg-muted">
                                      <span className="block h-full rounded-full bg-foreground" style={{ width: `${Math.max(4, (row.value / visualMax) * 100)}%` }} />
                                    </span>
                                    <span className="text-right font-semibold text-foreground">{row.value}</span>
                                  </div>
                                ))}
                              </div>
                              <p className="border-t border-border pt-3 text-11 leading-5 text-muted-foreground">
                                视觉摘要仅展示该分类的实际答案分布，具体结论以同章节文本分析为准。
                              </p>
                            </div>
                          ) : (
                            <p className="text-13 leading-6 text-muted-foreground">当前分类暂无可用于生成图片摘要的答案数据。</p>
                          )}
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={mode} className="rounded-lg border border-border bg-card p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-13 font-semibold text-foreground">{block?.title ?? `${section.title} QA 洞察`}</p>
                      </div>
                      <div className="mt-3 grid gap-2">
                        {(block?.evidence?.length ? block.evidence : section.chat?.insights ?? ["按专家问答方式生成追问和解释。"]).slice(0, 4).map((item, itemIndex) => (
                          <div key={`${item}-${itemIndex}`} className="flex gap-2 rounded-md border border-border bg-card p-2 text-13 text-muted-foreground">
                            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-foreground text-10 font-bold text-background">{itemIndex + 1}</span>
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </section>
      </article>
      )}
      </div>
      <SurveyAiPanel
        title="报告 AI"
        placeholder="例如：将当前章节改写得更适合学校管理层阅读"
        resultLabel="AI 已生成报告修订"
        onSubmit={(prompt) => onGenerateReport(prompt, effectiveCategoryPlan)}
        onPreview={() => undefined}
        onApply={() => onGenerateReport(undefined, effectiveCategoryPlan)}
      />
      </div>

    </div>
  );
}

export default function SurveysPage() {
  const searchParams = useSearchParams();
  const initialWorkbenchTab = searchParams.get("view") === "templates"
    ? "templates"
    : searchParams.get("view") === "my"
      ? "my"
      : "home";
  const requestedSurveyId = Number(searchParams.get("survey"));
  const requestedStep = searchParams.get("step");
  const initialSurveyId = Number.isFinite(requestedSurveyId) && requestedSurveyId > 0 ? requestedSurveyId : null;
  const initialWorkspaceView = requestedStep && ["design", "template", "collect", "answer", "report"].includes(requestedStep)
    ? requestedStep as Exclude<WorkspaceTarget, "workspace">
    : "workspace";
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"list" | "editor" | "template">(
    initialWorkspaceView === "design" && initialSurveyId != null ? "editor" : "list"
  );
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [editorTab, setEditorTab] = useState<"questions" | "responses" | "settings">("questions");
  const [filter, setFilter] = useState<"my" | "team">("my");
  const [workbenchTab, setWorkbenchTab] = useState<"home" | "my" | "team" | "templates" | "ai">(initialWorkbenchTab);
  const [workspaceView, setWorkspaceView] = useState<WorkspaceTarget>(initialWorkspaceView);
  const [workspaceSurvey, setWorkspaceSurvey] = useState<Survey | null>(null);
  const [createChooserOpen, setCreateChooserOpen] = useState(false);
  const [templateTagManagerOpen, setTemplateTagManagerOpen] = useState(false);

  // editor state
  const [editingSurveyId, setEditingSurveyId] = useState<number | null>(initialSurveyId);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState<"private" | "team">("private");
  const [responseMode, setResponseMode] = useState<"anonymous" | "identified">("anonymous");
  const [publishStartAt, setPublishStartAt] = useState("");
  const [publishEndAt, setPublishEndAt] = useState("");
  const [responseLimit, setResponseLimit] = useState("");
  const [oneResponsePerUser, setOneResponsePerUser] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState("感谢你的反馈，问卷创建者将可以在结果页查看这份答卷。");
  const [publishSettingsMessage, setPublishSettingsMessage] = useState("");
  const [statusTogglePending, setStatusTogglePending] = useState(false);
  const [currentUserName, setCurrentUserName] = useState("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamId, setTeamId] = useState<string>("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryInput, setCategoryInput] = useState("");
  const [hypothesisComposerOpen, setHypothesisComposerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [created, setCreated] = useState<{ id: number; shareUrl: string; reportReady: boolean } | null>(null);
  const [editorActionMessage, setEditorActionMessage] = useState("");
  const [templates, setTemplates] = useState<SurveyTemplate[]>([]);
  const [templateLoadError, setTemplateLoadError] = useState("");
  const [templateListTag, setTemplateListTag] = useState("all");
  const [templateListSelection, setTemplateListSelection] = useState("blank");
  const [templateMessage, setTemplateMessage] = useState("");
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateTags, setTemplateTags] = useState<string[]>([]);
  const [templateTagInput, setTemplateTagInput] = useState("");
  const [templateBaseQuery, setTemplateBaseQuery] = useState("");
  const [templateBaseId, setTemplateBaseId] = useState("");
  const [templateSavedSignature, setTemplateSavedSignature] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  const [aiCreateFlow, setAiCreateFlow] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [reportTemplateBusy, setReportTemplateBusy] = useState(false);
  const [workspaceTemplateSaving, setWorkspaceTemplateSaving] = useState(false);
  const [workspaceReportGenerating, setWorkspaceReportGenerating] = useState(false);
  const [workspaceTemplateStatus, setWorkspaceTemplateStatus] = useState("");
  const [workspaceTemplateError, setWorkspaceTemplateError] = useState("");
  const reportCategoryPlanRequestVersion = useRef(0);
  const [reportTemplatesBySurveyId, setReportTemplatesBySurveyId] = useState<Record<number, ReportTemplateDraft>>({});
  const [reportCategoryPlansBySurveyId, setReportCategoryPlansBySurveyId] = useState<Record<number, ReportCategoryPlanDraft>>({});
  const [generatedReportsBySurveyId, setGeneratedReportsBySurveyId] = useState<Record<number, unknown>>({});
  const [professionalReportsBySurveyId, setProfessionalReportsBySurveyId] = useState<Record<number, SurveyReportDocument>>({});
  const [professionalReportGenerationBySurveyId, setProfessionalReportGenerationBySurveyId] = useState<Record<number, SurveyReportGenerationStatus>>({});
  const professionalReportRequestStateRef = useRef<Record<number, SurveyReportRequestState>>({});
  const [professionalReportRequestStateBySurveyId, setProfessionalReportRequestStateBySurveyId] =
    useState<Record<number, SurveyReportRequestState>>({});
  const [workspaceReportClassifying, setWorkspaceReportClassifying] = useState(false);
  const [aiSessionId, setAiSessionId] = useState<string | null>(null);
  const [pendingAiDraft, setPendingAiDraft] = useState<AiDraft | null>(null);
  const [pendingAiCommand, setPendingAiCommand] = useState("");
  const [aiDraftApplied, setAiDraftApplied] = useState(false);
  const [pendingAiChangeSet, setPendingAiChangeSet] = useState<AiChangeSet | null>(null);
  const [confirmedAiOps, setConfirmedAiOps] = useState<string[]>([]);
  const [aiFallbackNotice, setAiFallbackNotice] = useState("");
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([
    { role: "assistant", content: "告诉我调研目标，我会先理解需求、提出澄清问题，再生成一版待确认的结构化问卷草稿。" },
  ]);

  useEffect(() => {
    const workflowActive = mode === "editor" || workspaceView !== "workspace";
    document.body.classList.toggle("survey-workflow-active", workflowActive);
    return () => {
      document.body.classList.remove("survey-workflow-active");
    };
  }, [mode, workspaceView]);

  useEffect(() => {
    setCategories((items) => mergeCategoryLabels(items, questions.map((question) => question.category)));
  }, [questions]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/surveys");
      if (res.status === 401) {
        // 未登录/visitor 不进入问卷工作区，转登录页（UC 权限分支）。
        window.location.href = "/login";
        return;
      }
      if (!res.ok) {
        setError("加载问卷失败，请重试");
        setLoading(false);
        return;
      }
      setSurveys((await res.json()).surveys ?? []);
    } catch {
      setError("加载问卷失败，请重试");
    }
    setLoading(false);
  }

  async function loadCurrentUserName() {
    try {
      const response = await fetch("/api/auth/session");
      if (!response.ok) return;
      const payload = await response.json() as {
        user?: { firstName?: string; displayName?: string } | null;
      };
      setCurrentUserName(payload.user?.firstName?.trim() || payload.user?.displayName?.trim() || "");
    } catch {
      setCurrentUserName("");
    }
  }

  useEffect(() => {
    void load();
    void loadTemplates();
    void loadCurrentUserName();
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("create") === "ai") {
        window.history.replaceState(null, "", "/surveys");
        openEditor({ withAi: true });
        return;
      }
      const editId = Number(params.get("edit"));
      if (Number.isFinite(editId) && editId > 0) {
        window.history.replaceState(null, "", "/surveys");
        void loadSurveyForEditor(editId, "edit");
        return;
      }
      const surveyId = Number(params.get("survey"));
      const step = params.get("step");
      if (
        Number.isFinite(surveyId)
        && surveyId > 0
        && step
        && ["design", "template", "collect", "answer", "report"].includes(step)
      ) {
        if (step === "design") {
          void openSurveyDesign(surveyId);
          return;
        }
        setEditingSurveyId(surveyId);
        setWorkspaceView(step as Exclude<WorkspaceTarget, "workspace">);
        void loadSurveyForWorkspace(surveyId);
        if (step === "template" || step === "report") {
          void loadWorkspaceReportCategoryPlan(surveyId);
        }
        return;
      }
      if (window.localStorage.getItem(AI_CREATE_FLOW_KEY) === "1") {
        openEditor({ withAi: true });
      }
    } catch {
      // Ignore local recovery hints when storage is unavailable.
    }
  }, []);

  useEffect(() => {
    setWorkbenchTab(
      searchParams.get("view") === "templates"
        ? "templates"
        : searchParams.get("view") === "my"
          ? "my"
          : "home"
    );
  }, [searchParams]);

  async function loadTeams() {
    try {
      const res = await fetch("/api/teams");
      if (res.ok) setTeams(((await res.json()).teams ?? []).map((t: Team) => ({ id: t.id, name: t.name })));
    } catch {
      // 团队列表加载失败不阻塞创建（保留 private 作用域可用）
    }
  }

  async function loadTemplates() {
    setTemplateLoadError("");
    try {
      const res = await fetch("/api/survey-templates");
      if (!res.ok) {
        setTemplateLoadError("模板加载失败，仍可创建空白问卷或模板。");
        return;
      }
      setTemplates((await res.json()).templates ?? []);
    } catch {
      setTemplateLoadError("模板加载失败，仍可创建空白问卷或模板。");
    }
  }

  function resetAiState(withAi: boolean) {
    setAiOpen(withAi);
    setAiSessionId(null);
    setPendingAiDraft(null);
    setPendingAiChangeSet(null);
    setConfirmedAiOps([]);
    setAiFallbackNotice("");
    setAiInput("");
    setReportTemplateBusy(false);
    setAiMessages([
      {
        role: "assistant",
        content: withAi
          ? "右侧可以像聊天一样描述目标、受访者和修改要求；我会生成建议，你确认后同步到左侧问卷。"
          : "告诉我调研目标，我会先理解需求、提出澄清问题，再生成一版待确认的结构化问卷草稿。",
      },
    ]);
  }

  function getAiIterationIntro(status?: Survey["status"]) {
    if (status === "active") {
      return "当前问卷已经启用回收，也可以继续 AI 迭代。你描述修改目标后，我会先生成待确认变更；应用并保存后，原回收链接继续有效。";
    }
    return "我已打开 AI 迭代面板。你可以直接描述要优化的方向，例如补充用户画像、减少题量、按报告维度重组或改写题目语气。";
  }

  function openAiIterationPanel(status?: Survey["status"]) {
    setAiOpen(true);
    setAiSessionId(null);
    setPendingAiDraft(null);
    setPendingAiChangeSet(null);
    setConfirmedAiOps([]);
    setAiFallbackNotice("");
    setAiInput("");
    setReportTemplateBusy(false);
    setAiMessages([{ role: "assistant", content: getAiIterationIntro(status) }]);
  }

  async function resumeLatestAiCreateSession() {
    try {
      const res = await fetch("/api/surveys/ai/sessions?kind=create_survey&status=open&limit=1");
      if (!res.ok) return;
      const sessions = ((await res.json()).sessions ?? []) as AiSessionListItem[];
      const latest = sessions[0];
      if (!latest?.id) return;

      const bundleRes = await fetch(`/api/surveys/ai/sessions/${latest.id}`);
      if (!bundleRes.ok) return;
      const bundle = await bundleRes.json();
      const draft = latestDraftFromBundle(bundle);
      if (!draft) return;

      setAiSessionId(latest.id);
      setPendingAiDraft(draft);
      setPendingAiChangeSet(null);
      setAiMessages((items) => [
        ...items,
        {
          role: "assistant",
          content: `已恢复上次未完成的 AI 问卷草稿：${draft.title}。你可以继续对话、预览或直接发布。`,
        },
      ]);
    } catch {
      // 恢复失败不阻塞新的 AI 创建流程。
    }
  }

  function openEditor(options: { withAi?: boolean; template?: SurveyTemplate } = {}) {
    const template = options.template;
    setEditingSurveyId(null);
    setEditingTemplateId(null);
    setTemplateTags(template?.tags ?? []);
    setTemplateTagInput("");
    setTemplateBaseQuery("");
    setTemplateBaseId(template?.id ?? "");
    setTitle(template?.title ?? "");
    setDescription(template?.description ?? "");
    setScope("private");
    setResponseMode("anonymous");
    setPublishStartAt("");
    setPublishEndAt("");
    setResponseLimit("");
    setOneResponsePerUser(false);
    setConfirmationMessage("感谢你的反馈，问卷创建者将可以在结果页查看这份答卷。");
    setPublishSettingsMessage("");
    setTeamId("");
    const nextQuestions = template
      ? template.questions.length
        ? template.questions.map((q) => ({ ...q, id: newQuestion().id }))
        : [newQuestion()]
      : [newQuestion()];
    setQuestions(nextQuestions);
    setCategories(template ? mergeCategoryLabels(nextQuestions.map((question) => question.category)) : []);
    setCategoryInput("");
    setHypothesisComposerOpen(false);
    setSaveError("");
    setCreated(null);
    setEditorActionMessage("");
    setTemplateMessage("");
    setTemplateListTag("all");
    setTemplateListSelection("blank");
    setView("edit");
    setEditorTab("questions");
    setMode("editor");
    setAiCreateFlow(false);
    rememberAiCreateFlow(false);
    resetAiState(true);
    void loadTeams();
    void loadTemplates();
  }

  function openCreateChooser() {
    setCreateChooserOpen(true);
  }

  function createWithAiFromChooser() {
    setCreateChooserOpen(false);
    openEditor({ withAi: true });
  }

  function createFromTemplateChooser() {
    setCreateChooserOpen(false);
    window.location.href = "/surveys?view=templates";
  }

  function createBlankFromChooser() {
    setCreateChooserOpen(false);
    openEditor();
  }

  async function openReportTemplateWorkflow(template: SurveyTemplate) {
    setTemplateMessage("");
    const res = await fetch("/api/surveys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: template.title,
        description: template.description,
        scope: "private",
        questions: template.questions,
        reportTemplate: template.reportTemplate,
      }),
    });
    if (!res.ok) {
      setTemplateMessage("无法创建问卷以配置报告模板，请稍后重试。");
      return;
    }
    const { survey } = await res.json();
    setSurveys((items) => [survey, ...items.filter((item) => item.id !== survey.id)]);
    await selectSurveyForWorkspace(survey.id, "template");
  }

  function openTemplateEditor(template?: SurveyTemplate, options: { withAi?: boolean } = {}) {
    setEditingSurveyId(null);
    setEditingTemplateId(template?.source === "saved" ? template.id : null);
    setTitle(template?.title ?? "");
    setDescription(template?.description ?? "");
    const nextQuestions = template
      ? template.questions.length
        ? template.questions.map((q) => ({ ...q, id: newQuestion().id }))
        : [newQuestion()]
      : [newQuestion()];
    setQuestions(nextQuestions);
    setCategories(template ? mergeCategoryLabels(nextQuestions.map((question) => question.category)) : []);
    const nextTags = template?.tags ?? [];
    setTemplateTags(nextTags);
    setTemplateSavedSignature(getTemplateDraftSignature({
      title: template?.title ?? "",
      description: template?.description ?? "",
      tags: nextTags,
      questions: nextQuestions,
    }));
    setTemplateTagInput("");
    setTemplateBaseQuery("");
    setTemplateBaseId(template?.id ?? "");
    setCategoryInput("");
    setSaveError("");
    setCreated(null);
    setEditorActionMessage("");
    setTemplateMessage("");
    setView("edit");
    setEditorTab("questions");
    setMode("template");
    setAiCreateFlow(false);
    rememberAiCreateFlow(false);
    resetAiState(options.withAi === true);
    setAiMessages([
      {
        role: "assistant",
        content: "描述模板的使用场景、目标人群或修改要求；我会生成建议，你确认后同步到左侧模板。",
      },
    ]);
    void loadTemplates();
  }

  function applyBlankTemplate() {
    setTemplateListSelection("blank");
    setTitle("");
    setDescription("");
    setQuestions([newQuestion()]);
    setCategories([]);
    setCategoryInput("");
    setTemplateMessage("");
  }

  function applyTemplate(template: SurveyTemplate) {
    setTemplateListSelection(`${template.source}:${template.id}`);
    setTitle(template.title);
    setDescription(template.description);
    const nextQuestions = template.questions.length
      ? template.questions.map((q) => ({ ...q, id: newQuestion().id }))
      : [newQuestion()];
    setQuestions(nextQuestions);
    setCategories(mergeCategoryLabels(nextQuestions.map((question) => question.category)));
    setTemplateTags(template.tags ?? []);
    setTemplateBaseId(template.id);
    setCategoryInput("");
    setTemplateMessage("");
  }

  function addTemplateTag() {
    const tag = templateTagInput.trim();
    if (!tag || templateTags.includes(tag)) return;
    setTemplateTags((items) => [...items, tag]);
    setTemplateTagInput("");
  }

  function removeTemplateTag(tag: string) {
    setTemplateTags((items) => items.filter((item) => item !== tag));
  }

  async function saveAsTemplate() {
    setTemplateMessage("");
    setSaving(true);
    try {
      const url = editingTemplateId ? `/api/survey-templates/${editingTemplateId}` : "/api/survey-templates";
      const res = await fetch(url, {
        method: editingTemplateId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: title, title, description, tags: templateTags, questions }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setTemplateMessage(d.errors?.title ?? d.errors?.questions ?? d.error ?? "模板保存失败");
        return;
      }
      const { template } = await res.json();
      setTemplates((items) => [template, ...items.filter((item) => !(item.source === "saved" && item.id === template.id))]);
      setTemplateSavedSignature(templateDraftSignature);
      setTemplateMessage(editingTemplateId ? "模板已更新" : "模板已保存");
      setEditingTemplateId(template.id);
      setWorkbenchTab("templates");
      setMode("list");
    } catch {
      setTemplateMessage("模板保存失败，请检查网络后重试");
    } finally {
      setSaving(false);
    }
  }

  async function deleteTemplate(template: SurveyTemplate) {
    if (template.source !== "saved") return;
    const res = await fetch(`/api/survey-templates/${template.id}`, { method: "DELETE" });
    if (!res.ok) {
      setTemplateMessage("模板删除失败");
      return;
    }
    setTemplates((items) => items.filter((item) => !(item.source === "saved" && item.id === template.id)));
    setTemplateMessage("");
  }

  async function loadSurveyForEditor(surveyId: number, nextView: "edit" | "preview", options: { withAi?: boolean } = {}) {
    setError("");
    const res = await fetch(`/api/surveys/${surveyId}`);
    if (!res.ok) {
      setError(res.status === 403 ? "你无权访问该问卷" : "加载问卷失败，请重试");
      return;
    }
    const { survey } = await res.json();
    setEditingSurveyId(nextView === "edit" ? survey.id : null);
    setTitle(survey.title ?? "");
    setDescription(survey.description ?? "");
    setScope(survey.scope === "team" ? "team" : "private");
    setResponseMode(survey.responseMode === "identified" ? "identified" : "anonymous");
    setPublishStartAt(toDateTimeLocal(survey.publishStartAt));
    setPublishEndAt(toDateTimeLocal(survey.publishEndAt));
    setResponseLimit(survey.responseLimit == null ? "" : String(survey.responseLimit));
    setOneResponsePerUser(survey.oneResponsePerUser === true);
    setConfirmationMessage(survey.confirmationMessage || "感谢你的反馈，问卷创建者将可以在结果页查看这份答卷。");
    setPublishSettingsMessage("");
    setTeamId(survey.teamId != null ? String(survey.teamId) : "");
    const loadedQuestions = questionsFromApi(survey.questions);
    setQuestions(loadedQuestions);
    setCategories(mergeCategoryLabels(loadedQuestions.map((question) => question.category)));
    setCategoryInput("");
    setSaveError("");
    setCreated(null);
    setEditorActionMessage("");
    setView(nextView);
    setEditorTab("questions");
    setMode("editor");
    setAiCreateFlow(false);
    rememberAiCreateFlow(false);
    if (nextView === "edit") {
      if (options.withAi === true) openAiIterationPanel(survey.status);
      else resetAiState(true);
    } else resetAiState(false);
    if (nextView === "edit") void loadTeams();
  }

  async function loadSurveyForWorkspace(surveyId: number) {
    setError("");
    const res = await fetch(`/api/surveys/${surveyId}`);
    if (!res.ok) {
      setError(res.status === 403 ? "你无权访问该问卷" : "加载问卷失败，请重试");
      return;
    }
    const { survey } = await res.json();
    setWorkspaceSurvey(survey);
    setSurveys((items) => {
      const existing = items.find((item) => item.id === survey.id);
      if (existing) {
        return items.map((item) => item.id === survey.id ? { ...item, ...survey } : item);
      }
      return [...items, survey];
    });
    setEditingSurveyId(survey.id);
    setTitle(survey.title ?? "");
    setDescription(survey.description ?? "");
    setScope(survey.scope === "team" ? "team" : "private");
    setResponseMode(survey.responseMode === "identified" ? "identified" : "anonymous");
    setPublishStartAt(toDateTimeLocal(survey.publishStartAt));
    setPublishEndAt(toDateTimeLocal(survey.publishEndAt));
    setResponseLimit(survey.responseLimit == null ? "" : String(survey.responseLimit));
    setOneResponsePerUser(survey.oneResponsePerUser === true);
    setConfirmationMessage(survey.confirmationMessage || "感谢你的反馈，问卷创建者将可以在结果页查看这份答卷。");
    setPublishSettingsMessage("");
    setTeamId(survey.teamId != null ? String(survey.teamId) : "");
    const loadedQuestions = questionsFromApi(survey.questions);
    setQuestions(loadedQuestions);
    setCategories(mergeCategoryLabels(loadedQuestions.map((question) => question.category)));
    setCategoryInput("");
    setSaveError("");
    setCreated(null);
    setEditorActionMessage("");
    setAiCreateFlow(false);
    rememberAiCreateFlow(false);
    resetAiState(false);
    void loadTeams();
  }

  async function openSurveyDesign(surveyId: number) {
    window.history.replaceState(null, "", `/surveys?survey=${surveyId}&step=design`);
    setWorkspaceView("design");
    await loadSurveyForEditor(surveyId, "edit");
  }

  async function copyEditorShareLink() {
    if (editingSurveyId == null) return;
    const link = new URL(`/survey/${editingSurveyId}/answer`, window.location.href).toString();
    try {
      await navigator.clipboard?.writeText(link);
      setEditorActionMessage("答题链接已复制");
    } catch {
      setEditorActionMessage(`答题链接：${link}`);
    }
  }

  async function toggleEditorSurveyStatus() {
    if (editingSurveyId == null) return;
    const current = surveys.find((item) => item.id === editingSurveyId);
    const nextActive = current?.status !== "active";
    setEditorActionMessage("");
    const res = await fetch(`/api/surveys/${editingSurveyId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive: nextActive }),
    });
    if (!res.ok) {
      setEditorActionMessage(nextActive ? "启用失败，请重试" : "暂停失败，请重试");
      return;
    }
    const { survey } = await res.json();
    setSurveys((items) =>
      items.map((item) =>
        item.id === editingSurveyId
          ? { ...item, status: survey.status, updatedAt: survey.updatedAt }
          : item
      )
    );
    setEditorActionMessage(nextActive ? "问卷已启用" : "问卷已暂停");
  }

  async function deleteEditorSurvey() {
    if (editingSurveyId == null) return;
    setEditorActionMessage("");
    const res = await fetch(`/api/surveys/${editingSurveyId}`, { method: "DELETE" });
    if (!res.ok) {
      setEditorActionMessage("删除失败，请重试");
      return;
    }
    const deletedId = editingSurveyId;
    setSurveys((items) => items.filter((item) => item.id !== deletedId));
    setMode("list");
    setEditingSurveyId(null);
  }

  async function savePublishSettings() {
    if (editingSurveyId == null) {
      setPublishSettingsMessage("请先保存问卷，再配置发布策略");
      return;
    }
    setPublishSettingsMessage("");
    const res = await fetch(`/api/surveys/${editingSurveyId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        responseMode,
        publishStartAt,
        publishEndAt,
        responseLimit,
        oneResponsePerUser,
        confirmationMessage,
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setPublishSettingsMessage(d.errors?.responseLimit ?? d.errors?.publishStartAt ?? d.errors?.publishEndAt ?? d.error ?? "发布设置保存失败");
      return;
    }
    const { survey } = await res.json();
    setPublishStartAt(toDateTimeLocal(survey.publishStartAt));
    setPublishEndAt(toDateTimeLocal(survey.publishEndAt));
    setResponseLimit(survey.responseLimit == null ? "" : String(survey.responseLimit));
    setSurveys((items) =>
      items.map((item) =>
        item.id === editingSurveyId
          ? {
              ...item,
              responseMode: survey.responseMode,
              publishStartAt: survey.publishStartAt,
              publishEndAt: survey.publishEndAt,
              responseLimit: survey.responseLimit,
              oneResponsePerUser: survey.oneResponsePerUser,
              confirmationMessage: survey.confirmationMessage,
              updatedAt: survey.updatedAt,
            }
          : item
      )
    );
    setPublishSettingsMessage("已保存发布设置");
  }

  async function toggleWorkspaceSurveyStatus() {
    const targetSurvey = currentSurveyForNavigation;
    if (!targetSurvey) {
      setPublishSettingsMessage("请先选择问卷，再设置回收状态");
      return;
    }
    const nextActive = targetSurvey.status !== "active";
    setStatusTogglePending(true);
    setPublishSettingsMessage("");
    try {
      const res = await fetch(`/api/surveys/${targetSurvey.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isActive: nextActive }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setPublishSettingsMessage(data.error ?? (nextActive ? "启用回收失败，请重试" : "暂停回收失败，请重试"));
        return;
      }
      const { survey } = await res.json();
      setSurveys((items) =>
        items.map((item) =>
          item.id === targetSurvey.id
            ? { ...item, status: survey.status, updatedAt: survey.updatedAt }
            : item
        )
      );
      setPublishSettingsMessage(nextActive ? "已启用回收，答题链接现在可以接收答卷" : "已暂停回收，答题链接将显示暂不接受答题");
    } finally {
      setStatusTogglePending(false);
    }
  }

  function patchQuestion(id: string, patch: Partial<Question>) {
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  }
  function addCategory(raw = categoryInput) {
    const category = cleanCategoryLabel(raw);
    if (!category) return;
    setCategories((items) => mergeCategoryLabels(items, [category]));
    setCategoryInput("");
  }
  function setQuestionCategory(id: string, raw: string) {
    const category = cleanCategoryLabel(raw);
    patchQuestion(id, category ? { category } : { category: undefined });
    if (category) setCategories((items) => mergeCategoryLabels(items, [category]));
  }
  function changeQuestionType(id: string, type: QType) {
    setQuestions((qs) =>
      qs.map((q) =>
        q.id === id
          ? {
              ...q,
              type,
              options: CHOICE_TYPES.includes(type) && q.options.length === 0 ? ["选项 1", "选项 2"] : q.options,
            }
          : q
      )
    );
  }
  function moveQuestion(id: string, dir: -1 | 1) {
    setQuestions((qs) => {
      const i = qs.findIndex((q) => q.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= qs.length) return qs;
      const next = qs.slice();
      const tmp = next[i]!;
      next[i] = next[j]!;
      next[j] = tmp;
      return next;
    });
  }
  function removeQuestion(id: string) {
    setQuestions((qs) => qs.filter((q) => q.id !== id));
  }
  function addOption(id: string) {
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, options: [...q.options, ""] } : q)));
  }
  function patchOption(id: string, idx: number, value: string) {
    setQuestions((qs) =>
      qs.map((q) => (q.id === id ? { ...q, options: q.options.map((o, k) => (k === idx ? value : o)) } : q))
    );
  }

  function applyAiDraft(draft: AiDraft, options: { append?: boolean } = {}) {
    if (!options.append || !title.trim()) setTitle(draft.title);
    if (!options.append || !description.trim()) setDescription(draft.description);
    const generatedQuestions = draft.questions.map((q) => ({
            ...newQuestion(),
            title: q.title,
            type: q.type,
            required: q.required,
            options: CHOICE_TYPES.includes(q.type) ? q.options : [],
            ...(cleanCategoryLabel(q.category ?? "") ? { category: cleanCategoryLabel(q.category ?? "") } : {}),
          }));
    const existingTitles = new Set(questions.map((question) => question.title.trim().toLocaleLowerCase()).filter(Boolean));
    const additions = generatedQuestions.filter((question) => !existingTitles.has(question.title.trim().toLocaleLowerCase()));
    const nextQuestions = draft.questions.length
      ? options.append
        ? [...questions, ...additions]
        : generatedQuestions
      : questions;
    setQuestions(nextQuestions);
    setCategories((items) => mergeCategoryLabels(items, nextQuestions.map((question) => question.category)));
  }

  function questionFromAi(raw: Partial<AiDraftQuestion> | undefined): Question {
    const type = Object.keys(TYPE_LABEL).includes(String(raw?.type)) ? (raw!.type as QType) : "short_text";
    return {
      ...newQuestion(),
      title: String(raw?.title ?? "新增问题").trim() || "新增问题",
      type,
      required: raw?.required === true,
      options: CHOICE_TYPES.includes(type) ? (raw?.options ?? []).map((o) => String(o ?? "").trim()).filter(Boolean) : [],
      ...(cleanCategoryLabel(raw?.category ?? "") ? { category: cleanCategoryLabel(raw?.category ?? "") } : {}),
    };
  }

  function applyOperationToQuestions(items: Question[], operation: AiChangeOperation): Question[] {
    const next = items.slice();
    const targetIndex = Number.isFinite(operation.targetIndex) ? Number(operation.targetIndex) : -1;
    if (operation.action === "add_question") {
      const position = Number.isFinite(operation.position) ? Math.max(0, Math.min(next.length, Number(operation.position))) : next.length;
      next.splice(position, 0, questionFromAi(operation.after));
      return next;
    }
    if (targetIndex < 0 || targetIndex >= next.length) return next;
    if (operation.action === "remove_question") {
      next.splice(targetIndex, 1);
      return next.length ? next : items;
    }
    if (operation.action === "move_question") {
      const [item] = next.splice(targetIndex, 1);
      if (!item) return items;
      const position = Number.isFinite(operation.position) ? Math.max(0, Math.min(next.length, Number(operation.position))) : next.length;
      next.splice(position, 0, item);
      return next;
    }
    const current = next[targetIndex]!;
    const after = operation.after ?? {};
    next[targetIndex] = {
      ...current,
      title: after.title != null ? String(after.title) : current.title,
      type: after.type && Object.keys(TYPE_LABEL).includes(after.type) ? after.type : current.type,
      required: after.required != null ? after.required === true : current.required,
      options: after.options && CHOICE_TYPES.includes((after.type ?? current.type) as QType) ? after.options : current.options,
    };
    return next;
  }

  async function runAiCommand(command: string) {
    const cleanCommand = command.trim();
    if (!cleanCommand) return;
    const activeDraft =
      editingSurveyId == null && pendingAiDraft && !aiDraftApplied
        ? {
            title: pendingAiDraft.title,
            description: pendingAiDraft.description,
            questions: pendingAiDraft.questions,
            intentCanvas: pendingAiDraft.intentCanvas,
          }
        : { title, description, questions };
    const nextMessages: AiMessage[] = [...aiMessages, { role: "user", content: cleanCommand }];
    setAiMessages(nextMessages);
    setPendingAiCommand(cleanCommand);
    setAiDraftApplied(false);
    setAiInput("");
    setAiBusy(true);
    try {
      const res = await fetch("/api/surveys/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: editingSurveyId == null ? "create_survey" : "optimize_survey",
          command: cleanCommand,
          sessionId: aiSessionId,
          surveyId: editingSurveyId,
          history: aiMessages,
          draft: activeDraft,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = "AI 服务暂时不可用，请稍后重试或联系管理员检查 AI 配置。";
        setAiMessages((items) => [...items, { role: "assistant", content: String(message) }]);
        return;
      }
      if (typeof payload.sessionId === "string") setAiSessionId(payload.sessionId);
      if (payload.fallback) {
        setAiFallbackNotice("系统已自动切换备用 AI 能力，并保留当前上下文。");
      } else {
        setAiFallbackNotice("");
      }
      if (payload.changeSet) {
        const changeSet = payload.changeSet as AiChangeSet;
        setPendingAiDraft(null);
        setPendingAiChangeSet(changeSet);
        setConfirmedAiOps(changeSet.operations.map((op) => op.id));
        setAiMessages((items) => [...items, { role: "assistant", content: `${changeSet.reply}\n${changeSet.summary}` }]);
      } else {
        const draft = payload.draft as AiDraft;
        setPendingAiChangeSet(null);
        setPendingAiDraft(draft);
        const assumptions = draft.assumptions?.length ? `\n假设：${draft.assumptions.join("；")}` : "";
        const questionsText = draft.clarifyingQuestions?.length ? `\n澄清问题：${draft.clarifyingQuestions.join("；")}` : "";
        setAiMessages((items) => [...items, { role: "assistant", content: `${draft.reply}${questionsText}${assumptions}` }]);
      }
    } catch {
      setAiMessages((items) => [...items, { role: "assistant", content: "AI 服务暂时不可用，请稍后重试。" }]);
    } finally {
      setAiBusy(false);
    }
  }

  function sendAiCommand() {
    const command = aiInput.trim();
    if (!command) return;
    void runAiCommand(command);
  }

  async function generateReportTemplateForDraft() {
    if (!pendingAiDraft) return;
    setSaveError("");
    setReportTemplateBusy(true);
    try {
      const res = await fetch("/api/surveys/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "report",
          command: `为问卷「${pendingAiDraft.title || "未命名问卷"}」生成报告模板`,
          history: aiMessages,
          draft: {
            title: pendingAiDraft.title,
            description: pendingAiDraft.description,
            questions: pendingAiDraft.questions,
          },
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.reportTemplate) {
        setSaveError(payload.errors?.draft ?? payload.error ?? "报告模板生成失败");
        return;
      }
      const reportTemplate = payload.reportTemplate as ReportTemplateDraft;
      setPendingAiDraft((draft) => (draft ? { ...draft, reportTemplate } : draft));
      setAiMessages((items) => [
        ...items,
        { role: "assistant", content: `报告模板 Agent 已生成「${reportTemplate.title}」。报告正文会在发布后的结果页独立呈现，不放在对话流里。` },
      ]);
    } catch {
      setSaveError("报告模板生成失败，请稍后重试");
    } finally {
      setReportTemplateBusy(false);
    }
  }

  function applyPendingAiDraft() {
    if (!pendingAiDraft || aiDraftApplied) return;
    const append = questions.some((question) => question.title.trim().length > 0);
    applyAiDraft(pendingAiDraft, { append });
    setAiDraftApplied(true);
    setAiCreateFlow(false);
    setAiOpen(true);
    setPendingAiChangeSet(null);
    rememberAiCreateFlow(false);
    setAiMessages((items) => [...items, {
      role: "assistant",
      content: mode === "template"
        ? "已应用到左侧模板。你可以继续补充、删减、重排或优化题目。"
        : "已应用到左侧问卷。你可以继续用自然语言要求我补充、删减、重排或优化题目。",
    }]);
  }

  function previewPendingAiDraft() {
    if (!pendingAiDraft) return;
    applyAiDraft(pendingAiDraft);
    setAiCreateFlow(false);
    setAiOpen(false);
    setPendingAiDraft(null);
    setPendingAiChangeSet(null);
    rememberAiCreateFlow(true);
    setView("preview");
  }

  async function publishPendingAiDraft() {
    if (!pendingAiDraft) return;
    setSaveError("");
    if (!pendingAiDraft.reportTemplate) {
      setSaveError("请先由报告模板 Agent 生成报告模板，再发布问卷。");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/surveys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: pendingAiDraft.title,
        description: pendingAiDraft.description,
        scope: "private",
        questions: pendingAiDraft.questions.map((question) => ({
          ...question,
          options: CHOICE_TYPES.includes(question.type) ? question.options : [],
        })),
        reportTemplate: pendingAiDraft.reportTemplate,
      }),
    });
    setSaving(false);
    if (res.status === 201) {
      const { survey } = await res.json();
      applyAiDraft(pendingAiDraft);
      setAiCreateFlow(false);
      rememberAiCreateFlow(false);
      setCreated({ id: survey.id, shareUrl: survey.shareUrl, reportReady: Boolean(pendingAiDraft.reportTemplate) });
      if (aiSessionId) {
        void fetch(`/api/surveys/ai/sessions/${aiSessionId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: "applied" }),
        });
      }
      await load();
      return;
    }
    const d = await res.json().catch(() => ({}));
    setSaveError(d.errors?.title ?? d.errors?.questions ?? d.error ?? "发布失败");
  }

  function toggleAiOperation(id: string, checked: boolean) {
    setConfirmedAiOps((items) => checked ? Array.from(new Set([...items, id])) : items.filter((item) => item !== id));
  }

  function applyPendingAiChangeSet() {
    if (!pendingAiChangeSet) return;
    const selected = pendingAiChangeSet.operations.filter((operation) => confirmedAiOps.includes(operation.id));
    const rejected = pendingAiChangeSet.operations.filter((operation) => !confirmedAiOps.includes(operation.id));
    if (!selected.length) {
      setAiMessages((items) => [...items, { role: "assistant", content: "请至少确认一项变更后再应用。" }]);
      return;
    }
    setQuestions((items) => selected.reduce((next, operation) => applyOperationToQuestions(next, operation), items));
    setAiMessages((items) => [...items, {
      role: "assistant",
      content: mode === "template"
        ? `已应用 ${selected.length} 项变更到模板，请预览并保存。`
        : `已应用 ${selected.length} 项变更到 Builder，请预览并保存。`,
    }]);
    setPendingAiChangeSet(null);
    setConfirmedAiOps([]);
    if (aiSessionId && pendingAiChangeSet.id) {
      void fetch(`/api/surveys/ai/sessions/${aiSessionId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          changeSetId: pendingAiChangeSet.id,
          confirmedOperations: selected,
          rejectedOperations: rejected,
        }),
      });
    }
  }

  async function save() {
    setSaveError("");
    setSaving(true);
    const payload: {
      title: string;
      description: string;
      scope: typeof scope;
      teamId?: number;
      questions: Question[];
      reportTemplate?: ReportTemplateDraft;
    } = {
      title,
      description,
      scope,
      teamId: scope === "team" ? Number(teamId) : undefined,
      questions,
    };
    if (editingSurveyId == null && pendingAiDraft?.reportTemplate) {
      payload.reportTemplate = pendingAiDraft.reportTemplate;
    }
    const res = await fetch(editingSurveyId == null ? "/api/surveys" : `/api/surveys/${editingSurveyId}`, {
      method: editingSurveyId == null ? "POST" : "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.status === 201) {
      const { survey } = await res.json();
      setCreated({ id: survey.id, shareUrl: survey.shareUrl, reportReady: Boolean(payload.reportTemplate) });
      setAiCreateFlow(false);
      rememberAiCreateFlow(false);
      if (aiSessionId) {
        void fetch(`/api/surveys/ai/sessions/${aiSessionId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: "applied" }),
        });
      }
      await load();
    } else if (res.ok) {
      await load();
      setMode("list");
      setEditingSurveyId(null);
    } else {
      const d = await res.json().catch(() => ({}));
      setSaveError(d.errors?.title ?? d.errors?.questions ?? d.errors?.teamId ?? d.error ?? "保存失败");
    }
  }

  async function saveWorkspaceDesign() {
    if (editingSurveyId == null) {
      await save();
      return;
    }
    setSaveError("");
    setEditorActionMessage("");
    setSaving(true);
    const payload = {
      title,
      description,
      scope,
      teamId: scope === "team" ? Number(teamId) : undefined,
      questions,
    };
    const res = await fetch(`/api/surveys/${editingSurveyId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setSaveError(d.errors?.title ?? d.errors?.questions ?? d.errors?.teamId ?? d.error ?? "保存失败");
      return;
    }
    const { survey } = await res.json();
    setSurveys((items) =>
      items.map((item) =>
        item.id === editingSurveyId
          ? {
              ...item,
              title: survey.title,
              description: survey.description,
              scope: survey.scope,
              teamId: survey.teamId,
              updatedAt: survey.updatedAt,
            }
          : item
      )
    );
    setEditorActionMessage("问卷已保存");
  }

  const hasValidQuestion = questions.some((q) => q.title.trim().length > 0);
  const canSave = title.trim().length > 0 && (editingSurveyId != null || hasValidQuestion) && (scope !== "team" || teamId);
  const canSaveTemplate = title.trim().length > 0 && hasValidQuestion;
  const templateDraftSignature = getTemplateDraftSignature({ title, description, tags: templateTags, questions });
  const templateDirty = templateDraftSignature !== templateSavedSignature;
  const mySurveys = surveys.filter((s) => s.isOwner);
  const teamSurveys = surveys.filter((s) => s.scope === "team");
  const visibleSurveys = mySurveys;
  const activeSurveyCount = visibleSurveys.filter((survey) => survey.status === "active").length;
  const totalResponses = visibleSurveys.reduce((sum, survey) => sum + survey.responses, 0);
  const generatedReportCount = visibleSurveys.reduce((sum, survey) => sum + (survey.generatedReports ?? 0), 0);
  const completionRate = null;
  const greeting = new Date().getHours() < 12 ? "上午好" : new Date().getHours() < 18 ? "下午好" : "晚上好";
  const builtInTemplates = templates.filter((template) => template.source === "built_in");
  const savedTemplates = templates.filter((template) => template.source === "saved");
  const allTemplates = [...savedTemplates, ...builtInTemplates];
  const organizationName = teams[0]?.name ?? "个人工作区";
  const templateCategories = Array.from(new Set(allTemplates.map((template) => template.category ?? "通用")));
  const templateListTags = Array.from(new Set(
    allTemplates.flatMap((template) => [
      template.category ?? "通用",
      ...(template.tags ?? []),
    ])
  )).sort((a, b) => a.localeCompare(b));
  const visibleTemplateList = templateListTag === "all"
    ? allTemplates
    : allTemplates.filter((template) => {
        const category = template.category ?? "通用";
        return category === templateListTag || template.tags?.includes(templateListTag);
      });
  const editingSurvey = editingSurveyId == null ? undefined : surveys.find((s) => s.id === editingSurveyId);
  const editingSurveyShareUrl = editingSurveyId == null
    ? ""
    : new URL(`/survey/${editingSurveyId}/answer`, typeof window === "undefined" ? "http://localhost" : window.location.href).toString();
  const currentSurveyForNavigation = editingSurvey ?? workspaceSurvey ?? visibleSurveys[0] ?? surveys[0];
  const currentSurveyId = editingSurveyId ?? currentSurveyForNavigation?.id ?? null;

  function getProfessionalReportRequestState(surveyId: number) {
    return professionalReportRequestStateRef.current[surveyId] ??
      createSurveyReportRequestState();
  }

  function setProfessionalReportRequestState(
    surveyId: number,
    requestState: SurveyReportRequestState
  ) {
    const next = {
      ...professionalReportRequestStateRef.current,
      [surveyId]: requestState,
    };
    professionalReportRequestStateRef.current = next;
    setProfessionalReportRequestStateBySurveyId(next);
  }

  useEffect(() => {
    if (!currentSurveyId || generatedReportsBySurveyId[currentSurveyId]) return;
    let cancelled = false;
    void fetch(`/api/surveys/${currentSurveyId}/ai-report`)
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (cancelled || !payload?.report) return;
        setGeneratedReportsBySurveyId((items) => ({ ...items, [currentSurveyId]: payload.report }));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [currentSurveyId, generatedReportsBySurveyId]);

  useEffect(() => {
    if (
      !currentSurveyId ||
      (professionalReportsBySurveyId[currentSurveyId] &&
        professionalReportGenerationBySurveyId[currentSurveyId])
    ) return;
    const requestEpoch = captureSurveyReportRequestEpoch(
      getProfessionalReportRequestState(currentSurveyId)
    );
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(
          `/api/surveys/${currentSurveyId}/professional-report`
        );
        const payload = await response.json().catch(() => null);
        if (cancelled) return;
        const resolution = settleSurveyReportRefresh(
          getProfessionalReportRequestState(currentSurveyId),
          requestEpoch,
          response.ok && Boolean(payload?.generation)
        );
        if (!resolution.accepted) return;
        setProfessionalReportRequestState(currentSurveyId, resolution.state);
        if (payload.report) {
          setProfessionalReportsBySurveyId((items) => ({ ...items, [currentSurveyId]: payload.report as SurveyReportDocument }));
        }
        setProfessionalReportGenerationBySurveyId((items) => ({
          ...items,
          [currentSurveyId]: payload.generation as SurveyReportGenerationStatus,
        }));
      } catch {
        return;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    currentSurveyId,
    professionalReportsBySurveyId,
    professionalReportGenerationBySurveyId,
  ]);

  async function navigateWorkspace(target: WorkspaceTarget) {
    if (target === "workspace") {
      setMode("list");
      setWorkspaceView("workspace");
      setWorkbenchTab("my");
      setAiCreateFlow(false);
      rememberAiCreateFlow(false);
      setView("edit");
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", "/surveys?view=my");
      }
      return;
    }

    if (target === "design") {
      if (currentSurveyId == null) {
        openEditor();
        return;
      }
      await openSurveyDesign(currentSurveyId);
      return;
    }

    setMode("list");
    setWorkspaceView(target);
    setAiCreateFlow(false);
    rememberAiCreateFlow(false);
    setView("edit");
    if (currentSurveyId != null) {
      window.history.replaceState(null, "", `/surveys?survey=${currentSurveyId}&step=${target}`);
      await loadSurveyForWorkspace(currentSurveyId);
      if (target === "template" || target === "report") {
        await loadWorkspaceReportCategoryPlan(currentSurveyId);
      }
    }
  }

  async function selectSurveyForWorkspace(surveyId: number, target: WorkspaceTarget = "workspace") {
    if (target === "design") {
      await openSurveyDesign(surveyId);
      return;
    }

    setMode("list");
    setEditingSurveyId(surveyId);
    setWorkspaceView(target);
    if (target !== "workspace") {
      window.history.replaceState(null, "", `/surveys?survey=${surveyId}&step=${target}`);
      await loadSurveyForWorkspace(surveyId);
      if (target === "template" || target === "report") {
        await loadWorkspaceReportCategoryPlan(surveyId);
      }
    }
  }

  async function openSelectedSurveyEditor(tab: "questions" | "responses" | "settings", options: { withAi?: boolean } = {}) {
    if (currentSurveyId == null) {
      openEditor({ withAi: options.withAi === true });
      setEditorTab(tab);
      return;
    }
    await loadSurveyForEditor(currentSurveyId, "edit", { withAi: options.withAi === true });
    setEditorTab(tab);
  }

  function openSelectedSurveyResults() {
    if (currentSurveyId == null) {
      openEditor({ withAi: true });
      return;
    }
    window.location.href = `/surveys/${currentSurveyId}/results?from=workflow&tab=report`;
  }

  function openSelectedSurveyAnswer() {
    if (currentSurveyId == null) {
      openEditor();
      setView("preview");
      return;
    }
    window.open(new URL(`/survey/${currentSurveyId}/answer`, window.location.href).toString(), "_blank", "noopener,noreferrer");
  }

  function openSelectedSurveyResponses() {
    if (currentSurveyId == null) {
      openEditor();
      setEditorTab("responses");
      return;
    }
    window.location.href = `/surveys/${currentSurveyId}/results?from=workflow&tab=individual`;
  }

  async function saveWorkspaceReportTemplate(surveyId: number, template: ReportTemplateDraft) {
    setWorkspaceTemplateSaving(true);
    setWorkspaceTemplateStatus("");
    setWorkspaceTemplateError("");
    try {
      const res = await fetch(`/api/surveys/${surveyId}/report-template`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(template),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setWorkspaceTemplateError(payload?.error ?? "报告模板保存失败");
        return;
      }
      const saved = payload.reportTemplate as ReportTemplateDraft;
      setReportTemplatesBySurveyId((items) => ({ ...items, [surveyId]: saved }));
      setWorkspaceTemplateStatus("报告模板已保存。重新生成报告时会使用新的章节、图表和边界设置。");
    } catch {
      setWorkspaceTemplateError("报告模板保存失败，请稍后重试。");
    } finally {
      setWorkspaceTemplateSaving(false);
    }
  }

  async function loadWorkspaceReportCategoryPlan(surveyId: number) {
    const requestVersion = ++reportCategoryPlanRequestVersion.current;
    setWorkspaceTemplateError("");
    try {
      const res = await fetch(`/api/surveys/${surveyId}/report-categories`);
      const payload = await res.json().catch(() => ({}));
      if (requestVersion !== reportCategoryPlanRequestVersion.current) return;
      if (!res.ok) {
        setWorkspaceTemplateError(payload?.error ?? "报告结构加载失败");
        return;
      }
      if (payload.reportCategoryPlan) {
        setReportCategoryPlansBySurveyId((items) => ({ ...items, [surveyId]: payload.reportCategoryPlan as ReportCategoryPlanDraft }));
      }
    } catch {
      if (requestVersion !== reportCategoryPlanRequestVersion.current) return;
      setWorkspaceTemplateError("报告结构加载失败，请稍后重试。");
    }
  }

  async function refreshWorkspaceProfessionalReport(
    surveyId: number,
    requestEpoch: number
  ): Promise<boolean> {
    try {
      const res = await fetch(`/api/surveys/${surveyId}/professional-report`);
      const payload = await res.json().catch(() => ({}));
      const resolution = settleSurveyReportRefresh(
        getProfessionalReportRequestState(surveyId),
        requestEpoch,
        res.ok && Boolean(payload?.generation)
      );
      if (!resolution.accepted) return false;
      setProfessionalReportRequestState(surveyId, resolution.state);
      if (payload.report) {
        setProfessionalReportsBySurveyId((items) => ({
          ...items,
          [surveyId]: payload.report as SurveyReportDocument,
        }));
      }
      setProfessionalReportGenerationBySurveyId((items) => ({
        ...items,
        [surveyId]: payload.generation as SurveyReportGenerationStatus,
      }));
      return true;
    } catch {
      return false;
    }
  }

  async function applyPersistedWorkspaceReportCategoryPlan(input: {
    surveyId: number;
    reportCategoryPlan: ReportCategoryPlanDraft;
    invalidateWhenUnchanged: boolean;
  }): Promise<"unchanged" | "refreshed" | "refresh-failed"> {
    const transition = beginSurveyReportCategoryPlanPersistence({
      state: getProfessionalReportRequestState(input.surveyId),
      previousPlan: reportCategoryPlansBySurveyId[input.surveyId],
      persistedPlan: input.reportCategoryPlan,
      invalidateWhenUnchanged: input.invalidateWhenUnchanged,
    });
    setReportCategoryPlansBySurveyId((items) => ({
      ...items,
      [input.surveyId]: input.reportCategoryPlan,
    }));
    if (!transition.invalidated || transition.requestEpoch == null) {
      return "unchanged";
    }
    setProfessionalReportRequestState(input.surveyId, transition.state);
    return await refreshWorkspaceProfessionalReport(
      input.surveyId,
      transition.requestEpoch
    )
      ? "refreshed"
      : "refresh-failed";
  }

  async function classifyWorkspaceReportCategories(surveyId: number) {
    if (
      workspaceTemplateSaving ||
      workspaceReportClassifying ||
      workspaceReportGenerating
    ) return;
    reportCategoryPlanRequestVersion.current += 1;
    setWorkspaceReportClassifying(true);
    setWorkspaceTemplateStatus("");
    setWorkspaceTemplateError("");
    try {
      const res = await fetch(`/api/surveys/${surveyId}/report-categories`, { method: "POST" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setWorkspaceTemplateError(payload?.error ?? "AI 分类失败，请检查模型配置后重试");
        return;
      }
      const persistence = await applyPersistedWorkspaceReportCategoryPlan({
        surveyId,
        reportCategoryPlan:
          payload.reportCategoryPlan as ReportCategoryPlanDraft,
        invalidateWhenUnchanged: false,
      });
      const status =
        payload?.warning ?? "AI 已按问卷问题生成报告分类结构。";
      setWorkspaceTemplateStatus(
        persistence === "unchanged"
          ? status
          : persistence === "refreshed"
            ? `${status} 正式报告状态已刷新。`
            : `${status} 正式报告状态刷新失败，请稍后重试。`
      );
    } catch {
      setWorkspaceTemplateError("AI 分类失败，请稍后重试。");
    } finally {
      setWorkspaceReportClassifying(false);
    }
  }

  async function saveWorkspaceReportCategoryPlan(surveyId: number, plan: ReportCategoryPlanDraft) {
    if (
      workspaceTemplateSaving ||
      workspaceReportClassifying ||
      workspaceReportGenerating
    ) return;
    reportCategoryPlanRequestVersion.current += 1;
    setWorkspaceTemplateSaving(true);
    setWorkspaceTemplateStatus("");
    setWorkspaceTemplateError("");
    try {
      const res = await fetch(`/api/surveys/${surveyId}/report-categories`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(plan),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setWorkspaceTemplateError(payload?.error ?? "报告结构保存失败");
        return;
      }
      const saved = payload.reportCategoryPlan as ReportCategoryPlanDraft;
      const persistence = await applyPersistedWorkspaceReportCategoryPlan({
        surveyId,
        reportCategoryPlan: saved,
        invalidateWhenUnchanged: true,
      });
      setWorkspaceTemplateStatus(
        persistence === "refreshed"
          ? "报告结构已保存，正式报告状态已刷新。"
          : "报告结构已保存，但正式报告状态刷新失败，请稍后重试。"
      );
    } catch {
      setWorkspaceTemplateError("报告结构保存失败，请稍后重试。");
    } finally {
      setWorkspaceTemplateSaving(false);
    }
  }

  async function generateWorkspaceCategoryReport(
    surveyId: number,
    _instruction = "",
    _reportCategoryPlan?: ReportCategoryPlanDraft
  ) {
    if (
      workspaceReportGenerating ||
      workspaceTemplateSaving ||
      workspaceReportClassifying
    ) return;
    const generationRequest = beginSurveyReportGenerationRequest(
      getProfessionalReportRequestState(surveyId)
    );
    setProfessionalReportRequestState(surveyId, generationRequest.state);
    setWorkspaceReportGenerating(true);
    setWorkspaceTemplateStatus("");
    setWorkspaceTemplateError("");
    try {
      const res = await fetch(`/api/surveys/${surveyId}/professional-report`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const payload = await res.json().catch(() => ({}));
      if (!isSurveyReportRequestCurrent(
        getProfessionalReportRequestState(surveyId),
        generationRequest.requestEpoch
      )) {
        return;
      }
      if (res.status === 202 && payload?.status === "in_progress") {
        setWorkspaceTemplateStatus(
          "相同事实库和报告要求的版本正在生成，请稍后刷新或重试。"
        );
        return;
      }
      if (!res.ok) {
        setWorkspaceTemplateError(payload?.error ?? "正式报告生成失败");
        return;
      }
      if (!payload.report || !payload.generation) {
        setWorkspaceTemplateError("正式报告生成失败");
        return;
      }
      const resolution = settleSurveyReportGenerationRequest(
        getProfessionalReportRequestState(surveyId),
        generationRequest.requestEpoch,
        true
      );
      if (!resolution.accepted) return;
      setProfessionalReportRequestState(surveyId, resolution.state);
      setProfessionalReportsBySurveyId((items) => ({
        ...items,
        [surveyId]: payload.report as SurveyReportDocument,
      }));
      setProfessionalReportGenerationBySurveyId((items) => ({
        ...items,
        [surveyId]: payload.generation as SurveyReportGenerationStatus,
      }));
      setWorkspaceTemplateStatus(
        payload.warning ??
        (payload.reused ? "当前事实库和报告要求未变化，已复用已有版本。" : "专业报告新版本已生成。")
      );
    } catch {
      const resolution = settleSurveyReportGenerationRequest(
        getProfessionalReportRequestState(surveyId),
        generationRequest.requestEpoch,
        false
      );
      if (isSurveyReportRequestCurrent(
        resolution.state,
        generationRequest.requestEpoch
      )) {
        setProfessionalReportRequestState(surveyId, resolution.state);
      } else {
        return;
      }
      setWorkspaceTemplateError("正式报告生成失败，请稍后重试。");
    } finally {
      setWorkspaceReportGenerating(false);
    }
  }

  async function loadWorkspaceProfessionalReportVersion(surveyId: number, artifactId: string): Promise<boolean> {
    const requestEpoch = captureSurveyReportRequestEpoch(
      getProfessionalReportRequestState(surveyId)
    );
    setWorkspaceTemplateError("");
    try {
      const res = await fetch(
        `/api/surveys/${surveyId}/professional-report?artifactId=${encodeURIComponent(artifactId)}`
      );
      const payload = await res.json().catch(() => ({}));
      if (!isSurveyReportRequestCurrent(
        getProfessionalReportRequestState(surveyId),
        requestEpoch
      )) {
        return false;
      }
      if (!res.ok) {
        setWorkspaceTemplateError(payload?.error ?? "报告版本加载失败");
        return false;
      }
      if (!isExactReportVersionResponse(payload, artifactId)) {
        setWorkspaceTemplateError("报告版本加载失败");
        return false;
      }
      setProfessionalReportsBySurveyId((items) => ({
        ...items,
        [surveyId]: payload.report as SurveyReportDocument,
      }));
      if (payload.generation) {
        setProfessionalReportGenerationBySurveyId((items) => ({
          ...items,
          [surveyId]: {
            ...(payload.generation as SurveyReportGenerationStatus),
            versions: Array.from(new Map([
              ...(payload.generation.versions ?? []),
              ...(items[surveyId]?.versions ?? []),
            ].map((version) => [version.id, version])).values()),
            nextHistoryCursor:
              items[surveyId]
                ? items[surveyId].nextHistoryCursor
                : payload.generation.nextHistoryCursor,
          },
        }));
      }
      return true;
    } catch {
      if (!isSurveyReportRequestCurrent(
        getProfessionalReportRequestState(surveyId),
        requestEpoch
      )) {
        return false;
      }
      setWorkspaceTemplateError("报告版本加载失败，请稍后重试。");
      return false;
    }
  }

  async function loadMoreWorkspaceProfessionalReportVersions(
    surveyId: number
  ): Promise<boolean> {
    const cursor =
      professionalReportGenerationBySurveyId[surveyId]?.nextHistoryCursor;
    if (!cursor) return true;
    try {
      const res = await fetch(
        `/api/surveys/${surveyId}/professional-report?historyBefore=${encodeURIComponent(cursor)}`
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !Array.isArray(payload.historyPage)) {
        setWorkspaceTemplateError(payload?.error ?? "历史版本加载失败");
        return false;
      }
      setProfessionalReportGenerationBySurveyId((items) => {
        const current = items[surveyId];
        if (!current) return items;
        return {
          ...items,
          [surveyId]: {
            ...current,
            versions: Array.from(new Map([
              ...current.versions,
              ...payload.historyPage,
            ].map((version) => [version.id, version])).values()),
            nextHistoryCursor: payload.nextHistoryCursor ?? null,
          },
        };
      });
      return true;
    } catch {
      setWorkspaceTemplateError("历史版本加载失败，请稍后重试。");
      return false;
    }
  }

  const useLegacyAiCreateFlow = false;
  if (mode === "editor" && aiCreateFlow && useLegacyAiCreateFlow) {
    return (
      <WorkspaceShell
        active="design"
        currentSurvey={currentSurveyForNavigation}
        workflowMode
        onCreateWithAi={() => openEditor({ withAi: true })}
        onCreateBlank={() => openEditor()}
        onNavigate={(target) => void navigateWorkspace(target)}
      >
        <div data-testid="survey-ai-create-shell" className="pb-8">
        <div className="mb-4 rounded-lg border border-border bg-background">
          <div className="flex items-center gap-3 px-4 py-4">
            <Button
              data-testid="back-to-list"
              variant="ghost"
              size="sm"
              onClick={() => {
                setMode("list");
                setEditingSurveyId(null);
                setAiCreateFlow(false);
                rememberAiCreateFlow(false);
              }}
              className="gap-1 text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
              Surveys
            </Button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-15 font-semibold text-foreground">AI 创建问卷</p>
              <p className="text-12 text-muted-foreground">与原型一致：先生成问卷结构，再进入报告规划、发布回收和分析报告。</p>
            </div>
          </div>
        </div>

        <main data-testid="ai-create-chat-workspace" className="mx-auto">
          <div data-testid="ai-studio-layout" className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
            <aside data-testid="ai-intent-panel" className="h-fit rounded-lg border border-border bg-card p-4 shadow-sm">
              <Badge variant="outline">Agent Workflow</Badge>
              <h2 className="mt-3 text-18 font-bold text-foreground">创建进度</h2>
              <p className="mt-1 text-12 leading-5 text-muted-foreground">
                问卷和报告模板分开生成，避免职责混在一起。
              </p>
              <div className="mt-4 flex flex-col gap-2">
                {[
                  {
                    label: "Survey Agent",
                    desc: pendingAiDraft ? "问卷草稿已生成，可继续迭代。" : "等待你描述目标、人群和题量。",
                    status: pendingAiDraft ? "完成" : "等待",
                  },
                  {
                    label: "Report Agent",
                    desc: pendingAiDraft?.reportTemplate ? "报告模板已生成，可独立预览。" : "问卷确认后点击生成报告模板。",
                    status: pendingAiDraft?.reportTemplate ? "完成" : pendingAiDraft ? "待生成" : "锁定",
                  },
                  {
                    label: "Publish",
                    desc: pendingAiDraft?.reportTemplate ? "可以预览、发布或进入 Builder 微调。" : "生成报告模板后开放发布。",
                    status: pendingAiDraft?.reportTemplate ? "就绪" : "锁定",
                  },
                ].map((item, index) => (
                  <section key={item.label} className="rounded-md border border-border bg-background p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-12 font-semibold text-primary">
                          {index + 1}
                        </span>
                        <p className="truncate text-14 font-semibold text-foreground">{item.label}</p>
                      </div>
                      <Badge variant={item.status === "完成" || item.status === "就绪" ? "success" : "muted"}>{item.status}</Badge>
                    </div>
                    <p className="mt-2 text-12 leading-5 text-muted-foreground">{item.desc}</p>
                  </section>
                ))}
              </div>
            </aside>
          <section data-testid="ai-draft-workbench" className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <div className="border-b border-border p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="muted">系统自动调度 AI</Badge>
                    {aiSessionId && <Badge variant="outline">已持久化</Badge>}
                  </div>
                  <h1 className="mt-3 text-22 font-bold text-foreground">AI 问卷生成工作台</h1>
                  <p className="mt-2 max-w-2xl text-14 leading-6 text-muted-foreground">
                    先由 Survey Agent 生成问卷，再由 Report Agent 单独生成报告模板，最后预览或发布。
                  </p>
                </div>
                <Sparkles className="h-6 w-6 text-primary" strokeWidth={1.5} />
              </div>
              {aiFallbackNotice && (
                <p data-testid="ai-fallback-notice" className="mt-3 rounded-md border border-border bg-background px-3 py-2 text-12 text-muted-foreground">
                  {aiFallbackNotice}
                </p>
              )}
            </div>

            <div data-testid="ai-messages" className="flex max-h-56 min-h-44 flex-col gap-3 overflow-auto bg-secondary/20 p-5">
              {aiMessages.map((message, idx) => (
                <div
                  key={`${message.role}-${idx}`}
                  className={message.role === "user" ? "max-w-3xl self-end rounded-lg bg-primary px-3 py-2 text-13 text-primary-foreground" : "max-w-3xl self-start rounded-lg border border-border bg-background px-3 py-2 text-13 text-foreground"}
                >
                  {message.content}
                </div>
              ))}
            </div>

            <div className="border-t border-border p-5">
              {pendingAiDraft && (
                <div data-testid="ai-draft-preview" className="mb-4 rounded-lg border border-border bg-background p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p data-testid="ai-summary" className="text-14 font-semibold text-foreground">
                        {pendingAiDraft.summary ?? pendingAiDraft.reply}
                      </p>
                      <p className="mt-1 text-12 text-muted-foreground">
                        你可以继续在下面用自然语言要求 AI 增删题目、改写选项或控制题量；报告模板由独立 Agent 生成。
                      </p>
                    </div>
                    <Badge variant="success">{pendingAiDraft.questions.length} 题</Badge>
                  </div>
                  <div data-testid="ai-iteration-summary" className="mt-3 rounded-md border border-border bg-card p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p data-testid="ai-draft-title" className="text-15 font-semibold text-foreground">
                          {pendingAiDraft.title || "未命名问卷"}
                        </p>
                        <p className="mt-1 text-13 text-muted-foreground">{pendingAiDraft.description}</p>
                      </div>
                      <Badge variant="outline">第 {aiMessages.filter((message) => message.role === "assistant").length} 轮</Badge>
                    </div>
                    <div className="mt-3 grid gap-2 md:grid-cols-3">
                      <div className="rounded-md bg-secondary/60 px-3 py-2">
                        <p className="text-12 text-muted-foreground">题目数量</p>
                        <p data-testid="ai-draft-question-count" className="mt-1 text-14 font-semibold text-foreground">
                          {pendingAiDraft.questions.length} questions
                        </p>
                      </div>
                      <div className="rounded-md bg-secondary/60 px-3 py-2">
                        <p className="text-12 text-muted-foreground">题型覆盖</p>
                        <p className="mt-1 text-14 font-semibold text-foreground">
                          {uniqueDraftQuestionTypes(pendingAiDraft).join(" / ")}
                        </p>
                      </div>
                      <div className="rounded-md bg-secondary/60 px-3 py-2">
                        <p className="text-12 text-muted-foreground">分类覆盖</p>
                        <p className="mt-1 text-14 font-semibold text-foreground">
                          {uniqueDraftCategories(pendingAiDraft).join(" / ") || "待分类"}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <SurveyIntentCanvas draft={pendingAiDraft} />
                  </div>
                  <div data-testid="ai-draft-markdown" className="mt-3 rounded-md border border-border bg-card p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-14 font-semibold text-foreground">问题清单</p>
                        <p className="mt-1 text-12 text-muted-foreground">
                          目标答题人：{pendingAiDraft.intentCanvas?.audience?.persona ?? "待确认"}
                        </p>
                      </div>
                      <Badge variant="outline">{pendingAiDraft.questions.length} questions</Badge>
                    </div>
                    <div className="mt-3 grid gap-2">
                      {pendingAiDraft.questions.map((question, index) => (
                        <section key={`${question.title}-${index}`} className="rounded-md border border-border bg-background p-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-13 font-semibold text-foreground">
                                {index + 1}. {question.title || `问题 ${index + 1}`}
                              </p>
                              <p className="mt-1 text-12 text-muted-foreground">
                                题型：{TYPE_LABEL[question.type] ?? question.type} · 必填：{question.required ? "是" : "否"} · 分类：{question.category ?? "未分类"}
                              </p>
                            </div>
                            <Badge variant="muted">{TYPE_LABEL[question.type] ?? question.type}</Badge>
                          </div>
                          {CHOICE_TYPES.includes(question.type) && question.options.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {question.options.map((option) => (
                                <Badge key={option} variant="outline">{option}</Badge>
                              ))}
                            </div>
                          ) : null}
                        </section>
                      ))}
                    </div>
                    {pendingAiDraft.clarifyingQuestions?.length ? (
                      <div className="mt-3 rounded-md bg-secondary/60 p-3">
                        <p className="text-13 font-semibold text-foreground">待确认问题</p>
                        <ul className="mt-2 space-y-1 text-12 text-muted-foreground">
                          {pendingAiDraft.clarifyingQuestions.map((question) => (
                            <li key={question}>- {question}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-3 rounded-md border border-border bg-card p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <Badge variant={pendingAiDraft.reportTemplate ? "success" : "muted"}>Report Agent</Badge>
                        <p className="mt-2 text-14 font-semibold text-foreground">
                          {pendingAiDraft.reportTemplate ? "报告模板已由报告 Agent 生成" : "报告模板尚未生成"}
                        </p>
                        <p className="mt-0.5 text-12 text-muted-foreground">
                          问卷 Agent 只负责题目草稿；报告模板点击按钮后由报告 Agent 单独生成并绑定。
                        </p>
                      </div>
                      {pendingAiDraft.reportTemplate ? (
                        <Badge variant="outline">发布后进入专业报告页</Badge>
                      ) : (
                        <Button
                          data-testid="generate-report-template"
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={reportTemplateBusy}
                          onClick={() => void generateReportTemplateForDraft()}
                        >
                          <FileText className="h-4 w-4" strokeWidth={1.5} />
                          {reportTemplateBusy ? "生成中…" : "生成报告模板"}
                        </Button>
                      )}
                    </div>
                    {!pendingAiDraft.reportTemplate ? (
                      <div className="mt-3 grid gap-2 md:grid-cols-3">
                        {["章节结构", "核心指标", "图表槽位"].map((item) => (
                          <div key={item} className="rounded-md bg-secondary/60 px-3 py-2">
                            <p className="text-12 font-semibold text-foreground">{item}</p>
                            <p className="mt-1 text-12 text-muted-foreground">等待报告 Agent 生成</p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {pendingAiDraft.reportTemplate ? (
                      <div data-testid="ai-report-template-ready" className="mt-3 grid gap-2 md:grid-cols-3">
                        <div className="rounded-md bg-secondary/60 px-3 py-2">
                          <p className="text-12 font-semibold text-foreground">报告蓝图</p>
                          <p className="mt-1 text-12 text-muted-foreground">{pendingAiDraft.reportTemplate.sections.length} 个章节已绑定</p>
                        </div>
                        <div className="rounded-md bg-secondary/60 px-3 py-2">
                          <p className="text-12 font-semibold text-foreground">图表槽位</p>
                          <p className="mt-1 text-12 text-muted-foreground">{pendingAiDraft.reportTemplate.chartSlots.length} 个 Chart.js 图表</p>
                        </div>
                        <div className="rounded-md bg-secondary/60 px-3 py-2">
                          <p className="text-12 font-semibold text-foreground">报告位置</p>
                          <p className="mt-1 text-12 text-muted-foreground">发布后在结果页生成</p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button data-testid="preview-ai-draft" type="button" size="sm" variant="outline" onClick={previewPendingAiDraft}>
                      <Eye className="h-4 w-4" strokeWidth={1.5} />
                      确认并预览
                    </Button>
                    <Button data-testid="publish-ai-draft" type="button" size="sm" disabled={saving || !pendingAiDraft.reportTemplate} onClick={() => void publishPendingAiDraft()}>
                      {saving ? "发布中…" : pendingAiDraft.reportTemplate ? "确认并发布" : "先生成报告模板"}
                    </Button>
                    <Button data-testid="apply-ai-draft" type="button" size="sm" variant="ghost" onClick={applyPendingAiDraft}>
                      进入 Builder 微调
                    </Button>
                  </div>
                  {saveError && (
                    <p role="alert" data-testid="err-save" className="mt-3 text-13 text-destructive">
                      {saveError}
                    </p>
                  )}
                </div>
              )}

              <Textarea
                data-testid="ai-input"
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                disabled={aiBusy}
                placeholder="例如：商品反馈问卷，面向新用户，控制在 5 题以内"
                className="min-h-28"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {["快速生成商品反馈问卷", "补充目标人群：新用户", "控制在 5 道题以内", "改成更适合手机填写"].map((prompt) => (
                  <Button key={prompt} type="button" variant="outline" size="sm" disabled={aiBusy} onClick={() => void runAiCommand(prompt)}>
                    {prompt}
                  </Button>
                ))}
              </div>
              <Button data-testid="ai-send" type="button" className="mt-3 w-full gap-1.5" disabled={aiBusy || !aiInput.trim()} onClick={sendAiCommand}>
                <Send className="h-4 w-4" strokeWidth={1.5} />
                {aiBusy ? "AI 正在生成…" : "发送给 AI"}
              </Button>
            </div>
          </section>
          </div>
        </main>
      </div>
      </WorkspaceShell>
    );
  }

  if (mode === "editor" || mode === "template") {
    const isTemplateEditor = mode === "template";
    const searchableTemplateOptions = allTemplates.filter((template) => {
      const q = templateBaseQuery.trim().toLowerCase();
      if (!q) return true;
      return [
        template.name,
        template.title,
        template.description,
        template.category ?? "",
        ...(template.tags ?? []),
      ].join(" ").toLowerCase().includes(q);
    });
    const editorWorkflowSteps: Array<{
      id: Exclude<WorkspaceTarget, "workspace">;
      label: string;
      description: string;
    }> = [
      { id: "design", label: "设计问卷", description: "题目与元数据" },
      { id: "template", label: "报告模板", description: "分类与模块组件" },
      { id: "collect", label: "发布回收", description: "链接与回收规则" },
      { id: "answer", label: "查看答题", description: "答题页与样本" },
      { id: "report", label: "分析报告", description: "洞察与导出" },
    ];
    const openEditorWorkflowStep = (target: Exclude<WorkspaceTarget, "workspace">) => {
      if (target === "design") {
        setView("edit");
        return;
      }
      if (target === "answer" && editingSurveyId == null) {
        setView("preview");
        return;
      }
      if (editingSurveyId == null) {
        setEditorActionMessage("请先发布问卷，再进入后续工作流。");
        return;
      }
      if (target === "report") {
        window.location.href = `/surveys?survey=${editingSurveyId}&step=report`;
        return;
      }
      void navigateWorkspace(target);
    };
    return (
      <WorkspaceShell
        active={isTemplateEditor ? "template" : "design"}
        currentSurvey={currentSurveyForNavigation}
        workflowMode={!isTemplateEditor}
        templateLibraryMode={isTemplateEditor}
        hideHeader
        hideSidebar={isTemplateEditor}
        onCreateWithAi={() => openEditor({ withAi: true })}
        onCreateBlank={() => openTemplateEditor()}
        onNavigate={(target) => void navigateWorkspace(target)}
      >
      <div data-testid={isTemplateEditor ? "template-editor-shell" : "survey-editor-screen"} className={isTemplateEditor ? "pb-8" : "mx-auto max-w-survey-editor px-4 pb-10 sm:px-6 lg:px-8"}>
        <div data-testid={isTemplateEditor ? undefined : "survey-editor-shell"} className={isTemplateEditor ? "mb-4 rounded-lg border border-border bg-background" : "mb-4"}>
          <div data-testid={isTemplateEditor ? undefined : "survey-editor-reference-header"}>
          <div data-testid="editor-command-bar" className="flex flex-wrap items-center gap-3 py-4">
            <Button
              data-testid="back-to-list"
              variant="ghost"
              size="sm"
              onClick={() => {
                setMode("list");
                setEditingSurveyId(null);
                setEditingTemplateId(null);
                setWorkbenchTab(isTemplateEditor ? "templates" : workbenchTab);
                setAiCreateFlow(false);
                rememberAiCreateFlow(false);
              }}
              className="gap-1 text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
              {isTemplateEditor ? "返回模版" : "返回列表"}
            </Button>
            {!isTemplateEditor && <Badge variant="outline" className="bg-secondary">Survey Workflow</Badge>}
            {isTemplateEditor ? (
              <div className="min-w-0 flex-1">
                <p className="truncate text-15 font-semibold text-foreground">{title.trim() || "未命名模版"}</p>
                <p className="text-12 text-muted-foreground">
                  {questions.length} 题 · {templateTags.length} 个标签 ·{" "}
                  <span data-testid="template-save-state" className={templateDirty ? "text-foreground" : undefined}>
                    {editingTemplateId ? (templateDirty ? "未保存更改" : "已保存") : "未保存"}
                  </span>
                </p>
              </div>
            ) : <div className="min-w-2 flex-1" />}
            {isTemplateEditor && (
              <div className="flex items-center rounded-lg border border-border bg-secondary p-1">
                <Button
                  data-testid="template-edit-mode"
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setView("edit")}
                  className={view === "edit" ? "h-7 gap-1.5 bg-foreground px-3 text-12 text-background hover:bg-foreground/90 hover:text-background" : "h-7 gap-1.5 px-3 text-12 text-muted-foreground"}
                >
                  <Pencil className="h-3.5 w-3.5" strokeWidth={1.6} />
                  编辑
                </Button>
                <Button
                  data-testid="template-preview-mode"
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setView("preview")}
                  className={view === "preview" ? "h-7 gap-1.5 bg-foreground px-3 text-12 text-background hover:bg-foreground/90 hover:text-background" : "h-7 gap-1.5 px-3 text-12 text-muted-foreground"}
                >
                  <Eye className="h-3.5 w-3.5" strokeWidth={1.6} />
                  预览
                </Button>
              </div>
            )}
            {!created && !isTemplateEditor && (
              <Button
                data-testid={view === "edit" ? "preview-survey" : "edit-survey"}
                variant="outline"
                size="sm"
                onClick={() => setView(view === "edit" ? "preview" : "edit")}
                className="gap-1.5"
              >
                {view === "edit" ? (
                  <>
                    <Eye className="h-4 w-4" strokeWidth={1.5} />
                    预览
                  </>
                ) : (
                  <>
                    <Pencil className="h-4 w-4" strokeWidth={1.5} />
                    编辑
                  </>
                )}
              </Button>
            )}
            {!created && !isTemplateEditor && (
              <Button
                data-testid="editor-report-template"
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (editingSurveyId == null) {
                    setEditorActionMessage("请先发布问卷，再配置报告模版。");
                    return;
                  }
                  void navigateWorkspace("template");
                }}
                className="gap-1.5"
              >
                <FileText className="h-4 w-4" strokeWidth={1.5} />
                报告模版
              </Button>
            )}
            {!created && (view === "edit" || isTemplateEditor) && (
              <Button
                data-testid={isTemplateEditor ? "save-template-editor" : "save-survey"}
                size="sm"
                disabled={saving || !(isTemplateEditor ? canSaveTemplate : canSave)}
                onClick={() => void (isTemplateEditor ? saveAsTemplate() : save())}
                className={isTemplateEditor ? "bg-foreground text-background hover:bg-foreground/90" : undefined}
              >
                {saving ? "保存中…" : isTemplateEditor ? "保存模版" : editingSurveyId == null ? "发布问卷" : "保存修改"}
              </Button>
            )}
            {!created && view === "preview" && editingSurveyId == null && !isTemplateEditor && (
              <Button
                data-testid="save-survey"
                size="sm"
                disabled={saving || !canSave}
                onClick={() => void save()}
              >
                {saving ? "发布中…" : "发布问卷"}
              </Button>
            )}
          </div>
          {isTemplateEditor && templateMessage && (
            <p role="alert" data-testid="template-editor-message" className="border-t border-border px-4 py-2 text-12 text-destructive">
              {templateMessage}
            </p>
          )}
          </div>
          {!isTemplateEditor && (
            <div data-testid="survey-editor-stepper" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {editorWorkflowSteps.map((step, index) => {
                const isActive = step.id === "design";
                return (
                  <Button
                    key={step.id}
                    data-testid={`workflow-${step.id}`}
                    type="button"
                    variant="outline"
                    aria-current={isActive ? "step" : undefined}
                    onClick={() => openEditorWorkflowStep(step.id)}
                    className={[
                      "h-auto min-h-14 justify-start gap-2 rounded-lg px-3 py-2 text-left",
                      isActive
                        ? "!border-foreground !bg-foreground !text-background hover:!bg-foreground/90 hover:!text-background"
                        : "border-border bg-background hover:border-foreground/40",
                    ].join(" ")}
                  >
                    <span className={isActive
                      ? "grid h-7 w-7 shrink-0 place-items-center rounded-md bg-background/15 text-11 font-bold text-background"
                      : "grid h-7 w-7 shrink-0 place-items-center rounded-md bg-secondary text-11 font-bold text-foreground"}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-13 font-semibold">{step.label}</span>
                      <span className={isActive ? "block text-11 font-normal text-background/70" : "block text-11 font-normal text-muted-foreground"}>
                        {step.description}
                      </span>
                    </span>
                  </Button>
                );
              })}
            </div>
          )}
        </div>

        {created && (
          <div className="mx-auto mt-4 max-w-3xl">
            <div
              data-testid="survey-created"
              className="rounded-12 border border-border bg-card p-6 shadow-sm"
            >
              <p className="text-18 font-semibold text-foreground">问卷已发布</p>
              <p className="mt-1 text-13 text-muted-foreground">
                问卷和报告模板已保存为真实数据。你可以先分享答题链接，也可以进入正式报告页生成 AI 报告。
              </p>
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
                <span data-testid="survey-share-link" className="flex-1 truncate text-13 text-foreground">
                  {created.shareUrl}
                </span>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <Button
                  data-testid="open-created-report"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    window.location.href = `/surveys?survey=${created.id}&step=report`;
                  }}
                >
                  <FileText className="h-4 w-4" strokeWidth={1.5} />
                  进入正式报告
                </Button>
                <Button
                  data-testid="done-created"
                  size="sm"
                  variant="outline"
                  onClick={() => setMode("list")}
                >
                  返回问卷列表
                </Button>
              </div>
              {created.reportReady && (
                <p data-testid="created-report-template-ready" className="mt-3 rounded-lg border border-success/20 bg-tag-green px-3 py-2 text-12 text-success">
                  Report Agent 生成的报告模板已绑定，正式报告页会按该模板生成章节、指标和图表。
                </p>
              )}
            </div>
          </div>
        )}

        {!created && editorActionMessage && (
          <div className="mx-auto mt-4">
            <p
              data-testid="editor-action-message"
              className={`rounded-lg border px-3 py-2 text-13 ${
                editorActionMessage.includes("失败")
                  ? "border-destructive/30 bg-destructive/5 text-destructive"
                  : "border-border bg-card text-muted-foreground"
              }`}
            >
              {editorActionMessage}
            </p>
          </div>
        )}

        {!created && view === "preview" && !isTemplateEditor && (
          <div className="mx-auto mt-4 max-w-6xl px-4 pb-12" data-testid="survey-preview">
            <section data-testid="survey-preview-sheet" className="overflow-hidden rounded-lg border-0 bg-background shadow-sm">
              <div data-testid="preview-brand-banner" className="relative h-24 overflow-hidden">
                <Image src="/survey/fluent-research-header.webp" alt="" fill sizes="(max-width: 1024px) 100vw, 1024px" className="object-cover" />
                <div className="relative flex h-full items-center justify-between px-7 text-white">
                  <div className="flex items-center gap-3">
                    <ListChecks className="h-6 w-6" strokeWidth={1.8} />
                    <span className="text-15 font-bold">BoardX 调查</span>
                  </div>
                  <span className="rounded-md bg-white/15 px-3 py-1 text-12 font-medium">问卷预览</span>
                </div>
              </div>
              <div className="mx-auto max-w-4xl px-7 pb-10">
                <header className="pb-8 pt-8">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-12 text-muted-foreground">
                    <span className="font-semibold text-foreground">问卷进度</span>
                    <span>0 / {questions.length}</span>
                  </div>
                  <progress aria-label="问卷预览进度" className="survey-progress mt-3 h-1 w-full" value={0} max={Math.max(questions.length, 1)} />
                  <h2 className="mt-8 text-30 font-bold tracking-tight text-foreground">{title.trim() || "未命名问卷"}</h2>
                  {description.trim() && <p className="mt-2 text-14 leading-6 text-muted-foreground">{description}</p>}
                </header>
                <div data-testid="preview-question-list" className="space-y-0">
                  {questions.map((q, idx) => (
                    <section key={q.id} data-testid={`preview-question-${idx}`} className="py-3">
                      <div className="flex flex-wrap items-baseline gap-x-1.5">
                        <p className="text-15 font-semibold text-foreground">
                          {idx + 1}. {q.title.trim() || `问题 ${idx + 1}`}
                          {q.required && <span className="ml-1 text-destructive">*</span>}
                        </p>
                        <span data-testid={`preview-question-type-${idx}`} className="text-12 text-muted-foreground">
                          （{TYPE_LABEL[q.type]}）
                        </span>
                      </div>
                      <div className="mt-2"><QuestionPreviewAnswer question={q} questionIndex={idx} /></div>
                    </section>
                  ))}
                </div>
              </div>
            </section>
          </div>
        )}

        {!created && (view === "edit" || isTemplateEditor) && (
          <div
            data-testid={isTemplateEditor ? "template-editor-workspace" : "survey-editor-workspace"}
            className={isTemplateEditor
              ? "mx-auto grid items-start gap-4 py-0 xl:grid-cols-[minmax(0,3fr)_minmax(360px,2fr)]"
              : `mx-auto grid gap-4 ${
                  aiOpen
                    ? "grid-cols-1 xl:grid-cols-[minmax(0,1fr)_400px]"
                    : "grid-cols-1 xl:grid-cols-[minmax(0,1fr)_56px]"
                }`}
          >
            <main data-testid={isTemplateEditor ? "template-editor-main" : "question-builder-panel"} className="min-w-0">
              {isTemplateEditor && view === "preview" && (
                <div data-testid="template-editor-preview" className="rounded-lg border border-border bg-card p-5 shadow-sm">
                  <div className="border-b border-border pb-4">
                    <Badge variant="outline">模板预览</Badge>
                    <h2 className="mt-3 text-22 font-bold text-foreground">{title.trim() || "未命名模板"}</h2>
                    {description.trim() ? (
                      <p className="mt-2 text-13 leading-6 text-muted-foreground">{description}</p>
                    ) : (
                      <p className="mt-2 text-13 text-muted-foreground">暂无模板说明</p>
                    )}
                    {templateTags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {templateTags.map((tag) => <Badge key={tag} variant="muted">{tag}</Badge>)}
                      </div>
                    )}
                  </div>
                  <div className="mt-4 grid gap-3">
                    {questions.map((q, idx) => (
                      <section key={q.id} className="rounded-lg border border-border bg-background p-4">
                        <p className="text-14 font-semibold text-foreground">
                          <span className="mr-2 text-12 text-muted-foreground">{String(idx + 1).padStart(2, "0")}</span>
                          {q.title.trim() || `问题 ${idx + 1}`}
                          {q.required && <span className="ml-1 text-destructive">*</span>}
                        </p>
                        {q.category && <Badge variant="muted" className="mt-2">{q.category}</Badge>}
                        <div className="mt-3"><QuestionPreviewAnswer question={q} /></div>
                      </section>
                    ))}
                  </div>
                </div>
              )}
              {!isTemplateEditor && editorTab === "settings" && (
                <section data-testid="publish-settings-panel" className="rounded-12 border border-border bg-card p-6 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-18 font-semibold text-foreground">发布与回收策略</p>
                      <p className="mt-1 text-13 text-muted-foreground">
                        控制公开答题页何时开放、最多回收多少答卷，以及提交后给答题人的确认文案。
                      </p>
                    </div>
                    <Badge variant="outline">Survey Settings</Badge>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="publish-mode">答题身份</Label>
                      <Select
                        id="publish-mode"
                        data-testid="publish-mode"
                        value={responseMode}
                        onChange={(e) => setResponseMode(e.target.value === "identified" ? "identified" : "anonymous")}
                      >
                        <option value="anonymous">匿名填写</option>
                        <option value="identified">实名填写</option>
                      </Select>
                    </div>
                    <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-14 text-foreground">
                      <Input
                        data-testid="publish-one-response-per-user"
                        type="checkbox"
                        checked={oneResponsePerUser}
                        onChange={(e) => setOneResponsePerUser(e.target.checked)}
                        className="h-4 w-4"
                      />
                      每人一次（首版保存策略，严格去重后续增强）
                    </label>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="publish-start-at">开始时间</Label>
                      <Input
                        id="publish-start-at"
                        data-testid="publish-start-at"
                        type="datetime-local"
                        value={publishStartAt}
                        onChange={(e) => setPublishStartAt(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="publish-end-at">截止时间</Label>
                      <Input
                        id="publish-end-at"
                        data-testid="publish-end-at"
                        type="datetime-local"
                        value={publishEndAt}
                        onChange={(e) => setPublishEndAt(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="publish-response-limit">答卷上限</Label>
                      <Input
                        id="publish-response-limit"
                        data-testid="publish-response-limit"
                        type="number"
                        min="1"
                        placeholder="不限制"
                        value={responseLimit}
                        onChange={(e) => setResponseLimit(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5 md:col-span-2">
                      <Label htmlFor="publish-confirmation-message">提交确认文案</Label>
                      <Textarea
                        id="publish-confirmation-message"
                        data-testid="publish-confirmation-message"
                        value={confirmationMessage}
                        onChange={(e) => setConfirmationMessage(e.target.value)}
                        className="min-h-20"
                      />
                    </div>
                  </div>

                  {publishSettingsMessage && (
                    <p
                      data-testid={publishSettingsMessage.startsWith("已保存") ? "publish-settings-saved" : "err-publish-settings"}
                      role={publishSettingsMessage.startsWith("已保存") ? undefined : "alert"}
                      className={`mt-4 text-13 ${publishSettingsMessage.startsWith("已保存") ? "text-success" : "text-destructive"}`}
                    >
                      {publishSettingsMessage}
                    </p>
                  )}

                  <Button data-testid="save-publish-settings" type="button" className="mt-4" onClick={() => void savePublishSettings()}>
                    保存发布设置
                  </Button>
                </section>
              )}

              {!isTemplateEditor && editorTab === "responses" && (
                <section data-testid="survey-responses-panel" className="rounded-12 border border-border bg-card p-6 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-18 font-semibold text-foreground">回答与分析</p>
                      <p className="mt-1 text-13 text-muted-foreground">
                        查看答卷明细、生成调研报告，或把答题链接发送给受访者。
                      </p>
                    </div>
                    <Badge variant={editingSurvey?.status === "active" ? "success" : "muted"}>
                      {editingSurvey?.status === "active" ? "Active" : "Paused"}
                    </Badge>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-3">
                    <div className="rounded-lg border border-border bg-surface-1 p-4">
                      <p className="text-12 text-muted-foreground">已收集答卷</p>
                      <p data-testid="editor-responses-count" className="mt-1 text-22 font-bold text-foreground">
                        {editingSurvey?.responses ?? 0}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-surface-1 p-4">
                      <p className="text-12 text-muted-foreground">题目数量</p>
                      <p className="mt-1 text-22 font-bold text-foreground">{questions.length}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-surface-1 p-4">
                      <p className="text-12 text-muted-foreground">发布范围</p>
                      <p className="mt-2 text-15 font-semibold text-foreground">{scope === "team" ? "Team" : "Private"}</p>
                    </div>
                  </div>

                  {editingSurveyId == null ? (
                    <div className="mt-5 rounded-lg border border-dashed border-border-strong p-5 text-13 text-muted-foreground">
                      保存问卷后即可收集回答、查看结果和生成报告。
                    </div>
                  ) : (
                    <>
                      <div className="mt-5 flex flex-wrap gap-2">
                        <Button
                          data-testid="responses-open-results"
                          type="button"
                          className="gap-1.5"
                          onClick={() => { window.location.href = `/surveys/${editingSurveyId}/results?from=editor`; }}
                        >
                          <BarChart3 className="h-4 w-4" strokeWidth={1.5} />
                          查看答卷
                        </Button>
                        <Button
                          data-testid="responses-open-report"
                          type="button"
                          variant="outline"
                          className="gap-1.5"
                          onClick={() => { window.location.href = `/surveys/${editingSurveyId}/results?from=editor`; }}
                        >
                          <FileText className="h-4 w-4" strokeWidth={1.5} />
                          生成报告
                        </Button>
                        <Button
                          data-testid="responses-open-answer"
                          type="button"
                          variant="outline"
                          className="gap-1.5"
                          onClick={() => { window.open(editingSurveyShareUrl, "_blank", "noopener,noreferrer"); }}
                        >
                          <Eye className="h-4 w-4" strokeWidth={1.5} />
                          打开答题页
                        </Button>
                        <Button
                          data-testid="responses-copy-share"
                          type="button"
                          variant="outline"
                          className="gap-1.5"
                          onClick={() => void copyEditorShareLink()}
                        >
                          <Copy className="h-4 w-4" strokeWidth={1.5} />
                          复制链接
                        </Button>
                      </div>

                      <div className="mt-5 rounded-lg border border-border bg-background px-3 py-2">
                        <p className="text-12 text-muted-foreground">答题链接</p>
                        <p data-testid="responses-share-link" className="mt-1 truncate text-13 text-foreground">
                          {editingSurveyShareUrl}
                        </p>
                      </div>
                    </>
                  )}
                </section>
              )}

              {isTemplateEditor && view === "edit" && (
                <div className="mb-3 rounded-lg border border-border bg-card p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-15 font-semibold text-foreground">模板设置</p>
                      <p className="mt-0.5 text-12 text-muted-foreground">选择一个基础模板，或从空白结构开始编辑。</p>
                    </div>
                    <Badge variant={editingTemplateId ? "outline" : "muted"}>
                      {editingTemplateId ? "编辑自定义模版" : "新建模版"}
                    </Badge>
                  </div>
                  <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.8fr)]">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="template-base-search">搜索模板</Label>
                      <Input
                        id="template-base-search"
                        data-testid="template-base-search"
                        value={templateBaseQuery}
                        onChange={(e) => setTemplateBaseQuery(e.target.value)}
                        placeholder="搜索名称、分类或标签"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="template-base-select">选择基础模板</Label>
                      <Select
                        id="template-base-select"
                        data-testid="template-base-select"
                        value={templateBaseId}
                        onChange={(e) => {
                          if (!e.target.value) {
                            setTemplateBaseId("");
                            applyBlankTemplate();
                            setTemplateTags([]);
                            return;
                          }
                          const selected = allTemplates.find((template) => template.id === e.target.value);
                          setTemplateBaseId(e.target.value);
                          if (selected) applyTemplate(selected);
                        }}
                      >
                        <option value="">空白模板</option>
                        {searchableTemplateOptions.map((template) => (
                          <option key={`${template.source}-${template.id}`} value={template.id}>
                            {template.name} · {template.source === "saved" ? "自定义" : "系统"} · {(template.tags ?? [template.category ?? "通用"]).join(", ")}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>
                  <div className="mt-3 border-t border-border pt-3">
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="min-w-64 flex-1">
                        <Label htmlFor="template-tag-input">标签</Label>
                        <Input
                          id="template-tag-input"
                          data-testid="template-tag-input"
                          value={templateTagInput}
                          onChange={(e) => setTemplateTagInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addTemplateTag();
                            }
                          }}
                          placeholder="例如：用户画像、满意度、NPS"
                          className="mt-1.5"
                        />
                      </div>
                      <Button data-testid="add-template-tag" type="button" variant="outline" size="sm" onClick={() => addTemplateTag()} className="gap-1.5">
                        <Plus className="h-4 w-4" strokeWidth={1.5} />
                        添加标签
                      </Button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {templateTags.length ? (
                        templateTags.map((tag) => (
                          <Button
                            key={tag}
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeTemplateTag(tag)}
                            aria-label={`移除标签 ${tag}`}
                            className="h-7 gap-1.5 rounded-full px-3 text-12"
                          >
                            {tag}
                            <X className="h-3 w-3" strokeWidth={1.6} />
                          </Button>
                        ))
                      ) : (
                        <p className="text-12 text-muted-foreground">添加标签后，可在模板列表中快速搜索和筛选。</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {!isTemplateEditor && editorTab === "questions" && editingSurveyId == null && (
                <div className="hidden">
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <p className="text-15 font-semibold text-foreground">模板库</p>
                      <p className="text-12 text-muted-foreground">按标签筛选并选择一套问卷结构。</p>
                    </div>
                    <Button data-testid="save-template" variant="outline" size="sm" onClick={() => void saveAsTemplate()}>
                      保存为模板
                    </Button>
                  </div>
                  <div data-testid="template-library" className="mt-3 grid gap-3 sm:grid-cols-[minmax(160px,0.35fr)_minmax(260px,1fr)]">
                      <div>
                        <Label htmlFor="template-list-tag" className="text-11 text-muted-foreground">标签</Label>
                        <Select
                          id="template-list-tag"
                          data-testid="template-tag-filter"
                          value={templateListTag}
                          onChange={(event) => {
                            setTemplateListTag(event.target.value);
                            setTemplateListSelection("blank");
                          }}
                          className="mt-1"
                        >
                          <option value="all">全部标签</option>
                          {templateListTags.map((tag) => (
                            <option key={tag} value={tag}>{tag}</option>
                          ))}
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="template-list-select" className="text-11 text-muted-foreground">选择模板</Label>
                        <Select
                          id="template-list-select"
                          data-testid="template-select"
                          value={templateListSelection}
                          onChange={(event) => {
                            const value = event.target.value;
                            if (value === "blank") {
                              applyBlankTemplate();
                              return;
                            }
                            const selected = visibleTemplateList.find(
                              (template) => `${template.source}:${template.id}` === value
                            );
                            if (selected) applyTemplate(selected);
                          }}
                          className="mt-1"
                        >
                          <option value="blank">空白问卷</option>
                          {visibleTemplateList.map((template) => (
                            <option key={`${template.source}-${template.id}`} value={`${template.source}:${template.id}`}>
                              {template.name} · {template.category ?? template.tags?.[0] ?? "通用"} · {template.questions.length} 题 · {template.estimatedMinutes ?? 3} min
                            </option>
                          ))}
                        </Select>
                      </div>
                  </div>
                  <div data-testid="saved-template-list" className="sr-only">
                    {savedTemplates.length === 0 && <span>还没有保存的团队模板</span>}
                  </div>
                  {templateMessage && (
                    <p data-testid="template-saved" className="mt-2 text-12 text-muted-foreground">
                      {templateMessage}
                    </p>
                  )}
                </div>
              )}

              {view === "edit" && editorTab === "questions" && <section
                data-testid={isTemplateEditor ? undefined : "survey-diagnostic-summary"}
                aria-labelledby={isTemplateEditor ? undefined : "survey-diagnostic-summary-title"}
                className={isTemplateEditor ? "overflow-hidden rounded-lg border border-border bg-card shadow-sm" : "overflow-hidden rounded-lg border border-border bg-background"}
              >
                {!isTemplateEditor && <div className="h-1.5 bg-survey" />}
                <div className={isTemplateEditor ? "p-4" : "p-6"}>
                  {!isTemplateEditor && <h2 id="survey-diagnostic-summary-title" className="sr-only">诊断摘要</h2>}
                  <div className="flex items-center gap-2">
                    <Input
                      id="survey-title"
                      data-testid="survey-title"
                      aria-label="Survey title"
                      placeholder={isTemplateEditor ? "未命名模版" : "未命名问卷"}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className={isTemplateEditor
                        ? "h-auto flex-1 border-0 border-b border-border px-0 py-2 text-20 font-bold shadow-none focus-visible:ring-0"
                        : "h-9 flex-1 border-0 px-0 py-0 text-22 font-bold shadow-none focus-visible:ring-0"}
                    />
                    {!isTemplateEditor && (
                      <>
                        <Label htmlFor="survey-scope" className="sr-only">发布范围</Label>
                        <Select
                          id="survey-scope"
                          data-testid="survey-scope"
                          className="h-7 w-40 text-12"
                          value={scope}
                          onChange={(e) => setScope(e.target.value as "private" | "team")}
                        >
                          <option value="private">仅自己可管理</option>
                          <option value="team">团队内可查看</option>
                        </Select>
                        <Badge variant="muted">草稿</Badge>
                      </>
                    )}
                  </div>
                  <textarea
                    id="survey-desc"
                    data-testid="survey-desc"
                    aria-label="Description"
                    placeholder={isTemplateEditor ? "添加模版说明，例如适用场景、目标人群和推荐用法" : "添加问卷说明，例如填写对象、预计用时和收集目的"}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className={isTemplateEditor
                      ? "mt-3 min-h-12 w-full resize-none rounded-none border-0 border-b border-border bg-transparent px-0 py-2 text-14 text-foreground transition-colors placeholder:text-placeholder focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                      : "mt-1 h-9 min-h-0 w-full resize-none rounded-none border-0 border-b border-border bg-transparent px-0 py-1 text-13 text-foreground transition-colors placeholder:text-placeholder focus-visible:border-survey focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"}
                  />
                  {isTemplateEditor && (
                    <div data-testid="category-manager" className="mt-4 rounded-lg border border-border bg-secondary/30 p-3">
                      <div className="flex flex-wrap items-end gap-3">
                        <div className="min-w-64 flex-1">
                          <Label htmlFor="category-input">诊断分类</Label>
                          <Input
                            id="category-input"
                            data-testid="category-input"
                            value={categoryInput}
                            onChange={(e) => setCategoryInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                addCategory();
                              }
                            }}
                            placeholder="例如：使用场景、学习情况、心理健康"
                            className="mt-1.5"
                          />
                        </div>
                        <Button data-testid="add-category" type="button" variant="outline" onClick={() => addCategory()} className="gap-1.5">
                          <Plus className="h-4 w-4" strokeWidth={1.5} />
                          添加分类
                        </Button>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {categories.length ? categories.map((category) => (
                          <Badge key={category} data-testid={`category-chip-${category}`} variant="muted">
                            {templateTagLabel(category)}
                          </Badge>
                        )) : <p className="text-12 text-muted-foreground">添加分类后，可在每道题中选择归类。</p>}
                      </div>
                    </div>
                  )}
                  <section
                    data-testid={isTemplateEditor ? undefined : "survey-diagnostic-dimensions"}
                    aria-label={isTemplateEditor ? undefined : "问卷设置"}
                    className={isTemplateEditor ? "mt-5 flex flex-wrap items-end gap-3" : "mt-3 flex flex-wrap items-center gap-2"}
                  >
                    {!isTemplateEditor && (
                      <>
                        <div className="flex w-full flex-wrap items-center gap-2">
                          <span className="text-12 text-muted-foreground">诊断维度：</span>
                          {categories.length ? categories.slice(0, 5).map((category) => (
                            <Badge key={category} variant="muted" className="bg-tag-purple text-survey">{templateTagLabel(category)}</Badge>
                          )) : <span className="text-12 text-muted-foreground">尚未设置</span>}
                          {categories.length > 5 && <Badge variant="muted">+{categories.length - 5}</Badge>}
                          <Badge variant="outline">{questions.length} 题</Badge>
                          <Badge variant="outline">约 {Math.max(1, Math.ceil(questions.length / 2))} 分钟</Badge>
                        </div>
                        <div className="flex w-full flex-wrap items-center gap-2">
                          <span className="text-12 text-muted-foreground">分层变量：</span>
                          <Badge variant={scope === "private" ? "default" : "outline"}>匿名 / 个人</Badge>
                          <Badge variant={scope === "team" ? "default" : "outline"}>团队</Badge>
                          <span className="text-11 text-muted-foreground">报告图表将按可用身份信息进行切片。</span>
                        {scope === "team" && (
                          <>
                            <Label htmlFor="survey-team" className="ml-auto text-12 font-normal text-muted-foreground">团队：</Label>
                            <Select
                              id="survey-team"
                              data-testid="survey-team"
                              className="h-7 w-48"
                              value={teamId}
                              onChange={(e) => setTeamId(e.target.value)}
                            >
                              <option value="">选择团队…</option>
                              {teams.map((t) => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                              ))}
                            </Select>
                          </>
                        )}
                        </div>
                      </>
                    )}
                    {isTemplateEditor && <Badge variant="muted">模版草稿</Badge>}
                  </section>
                  {!isTemplateEditor && scope === "team" && teams.length === 0 && (
                    <p className="mt-2 text-12 text-muted-foreground">
                      当前还没有团队。先到 Teams 创建团队后，就可以发布为团队问卷。
                    </p>
                  )}
                </div>
              </section>}

              {!isTemplateEditor && view === "edit" && editorTab === "questions" && (
                <section
                  data-testid="survey-hypotheses"
                  aria-labelledby="survey-hypotheses-label"
                  className="mt-3 rounded-lg border border-border bg-background px-5 py-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 id="survey-hypotheses-label" className="flex items-center gap-2 text-14 font-bold text-foreground">
                      <Target className="h-4 w-4 text-survey" strokeWidth={1.7} />
                      诊断假设
                      <span className="text-11 font-normal text-muted-foreground">报告将自动生成「假设验证」模块</span>
                    </h2>
                    <div className="flex items-center gap-2">
                      {categories.length > 3 && <Badge variant="muted">另有 {categories.length - 3} 个维度</Badge>}
                      <Button
                        data-testid="open-hypothesis-composer"
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 px-2 text-12 text-survey hover:text-survey"
                        onClick={() => setHypothesisComposerOpen((open) => !open)}
                      >
                        <Plus className="h-3.5 w-3.5" strokeWidth={1.6} />
                        添加假设
                      </Button>
                    </div>
                  </div>
                  {hypothesisComposerOpen && <div data-testid="category-manager" className="mt-2 flex flex-wrap items-center gap-2">
                    <Input
                      id="category-input"
                      data-testid="category-input"
                      aria-label="新增诊断假设"
                      value={categoryInput}
                      onChange={(e) => setCategoryInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (cleanCategoryLabel(categoryInput)) {
                            addCategory();
                            setHypothesisComposerOpen(false);
                          }
                        }
                      }}
                      placeholder="输入诊断假设或维度"
                      className="h-8 min-w-64 flex-1"
                    />
                    <Button
                      data-testid="add-category"
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (!cleanCategoryLabel(categoryInput)) return;
                        addCategory();
                        setHypothesisComposerOpen(false);
                      }}
                      className="gap-1.5 text-survey hover:text-survey"
                    >
                      <Plus className="h-4 w-4" strokeWidth={1.5} />
                      添加假设
                    </Button>
                  </div>}
                  <div className="mt-2">
                    {categories.length ? categories.slice(0, 3).map((category, index) => (
                      <div key={category} className="flex items-center gap-3 border-t border-border py-2.5 first:border-t-0">
                        <span className="text-11 font-bold text-muted-foreground">H{index + 1}</span>
                        <span className="min-w-0 flex-1 truncate text-13 text-foreground">{templateTagLabel(category)}</span>
                        <Badge data-testid={`category-chip-${category}`} variant="muted" className="bg-tag-purple text-survey">
                          {templateTagLabel(category)}
                        </Badge>
                      </div>
                    )) : (
                      <p className="py-2 text-12 text-muted-foreground">添加假设后，可在每道题中选择归类。</p>
                    )}
                  </div>
                </section>
              )}

              {view === "edit" && editorTab === "questions" && <section
                data-testid={isTemplateEditor ? undefined : "survey-question-canvas"}
                aria-labelledby={isTemplateEditor ? undefined : "survey-question-canvas-title"}
                className="mt-3"
              >
                {!isTemplateEditor && <h2 id="survey-question-canvas-title" className="sr-only">问卷题目</h2>}
                <div data-testid="question-list" className="flex flex-col gap-3">
                {questions.map((q, idx) => (
                  <section
                    key={q.id}
                    data-testid={`question-${idx}`}
                    aria-labelledby={isTemplateEditor ? undefined : `survey-question-heading-${q.id}`}
                    className={isTemplateEditor
                      ? "rounded-lg border border-border bg-card shadow-sm transition-colors hover:border-border-strong"
                      : "rounded-lg border border-border border-l-3 border-l-survey/30 bg-background p-5 transition-colors duration-200 hover:border-l-survey"}
                  >
                    {!isTemplateEditor && <h3 id={`survey-question-heading-${q.id}`} className="sr-only">问题 {idx + 1}</h3>}
                    <div className={isTemplateEditor ? "border-l-4 border-primary p-5" : ""}>
                      {!isTemplateEditor && (
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <span className="text-12 font-bold text-muted-foreground">Q{idx + 1}</span>
                          <Badge variant="outline">{TYPE_LABEL[q.type]}</Badge>
                          {q.category ? <Badge variant="muted" className="bg-tag-purple text-survey">{templateTagLabel(q.category)}</Badge> : null}
                        </div>
                      )}
                      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_176px_176px]">
                        <Input
                          data-testid={`question-title-${idx}`}
                          placeholder={`问题 ${idx + 1}`}
                          value={q.title}
                          onChange={(e) => patchQuestion(q.id, { title: e.target.value })}
                          className="h-11 text-15 font-semibold"
                        />
                        <Select
                          aria-label="Question type"
                          data-testid={`question-type-${idx}`}
                          className="h-11"
                          value={q.type}
                          onChange={(e) => changeQuestionType(q.id, e.target.value as QType)}
                        >
                          {TYPE_GROUPS.map((group) => (
                            <optgroup key={group.label} label={group.label}>
                              {group.types.map((t) => (
                                <option key={t} value={t}>{TYPE_LABEL[t]}</option>
                              ))}
                            </optgroup>
                          ))}
                        </Select>
                        <Select
                          aria-label="Question category"
                          data-testid={`question-category-select-${idx}`}
                          className="h-11"
                          value={q.category ?? ""}
                          onChange={(e) => setQuestionCategory(q.id, e.target.value)}
                        >
                          <option value="">未分类</option>
                          {categories.map((category) => (
                            <option key={category} value={category}>
                              {templateTagLabel(category)}
                            </option>
                          ))}
                        </Select>
                      </div>

                      {isTemplateEditor && q.category && (
                        <Badge data-testid={`question-category-${idx}`} variant="muted" className="mt-3">
                          {q.category}
                        </Badge>
                      )}

                      {CHOICE_TYPES.includes(q.type) && (
                        <div className="mt-4 flex flex-col gap-2">
                          {q.options.map((o, k) => (
                            <div key={k} className="flex items-center gap-3">
                              <span className={q.type === "multiple" ? "h-4 w-4 rounded border border-border-strong" : "h-4 w-4 rounded-full border border-border-strong"} />
                              <Input
                                data-testid={`question-${idx}-option-${k}`}
                                placeholder={`选项 ${k + 1}`}
                                value={o}
                                onChange={(e) => patchOption(q.id, k, e.target.value)}
                                className="h-9 border-0 border-b border-border px-0 shadow-none focus-visible:ring-0"
                              />
                            </div>
                          ))}
                          <Button
                            data-testid={`question-add-option-${idx}`}
                            variant="ghost"
                            size="sm"
                            onClick={() => addOption(q.id)}
                            className="self-start gap-1 text-muted-foreground hover:text-foreground"
                          >
                            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
                            添加选项
                          </Button>
                        </div>
                      )}
                      {["short_text", "email", "number", "phone"].includes(q.type) && (
                        <div className="mt-4 border-b border-dashed border-border-strong py-3 text-14 text-muted-foreground">
                          {TYPE_LABEL[q.type]}回答
                        </div>
                      )}
                      {q.type === "text" && (
                        <div className="mt-4 border-b border-dashed border-border-strong py-3 text-14 text-muted-foreground">
                          段落回答
                        </div>
                      )}
                      {q.type === "rating" && (
                        <div className="mt-4 text-22 text-border-strong">★ ★ ★ ★ ★</div>
                      )}
                      {q.type === "linear_scale" && (
                        <div className="mt-4 flex gap-3 text-14 text-muted-foreground">
                          {[1, 2, 3, 4, 5].map((score) => <span key={score}>{score}</span>)}
                        </div>
                      )}
                      {q.type === "nps" && (
                        <div className="mt-4 flex flex-wrap gap-2 text-13 text-muted-foreground">
                          {Array.from({ length: 11 }).map((_, score) => <span key={score}>{score}</span>)}
                        </div>
                      )}
                      {q.type === "date" && <Input disabled type="date" className="mt-4 max-w-xs bg-muted/30" />}
                      {q.type === "time" && <Input disabled type="time" className="mt-4 max-w-xs bg-muted/30" />}
                      {q.type === "file" && <Input disabled type="file" className="mt-4 max-w-xs bg-muted/30" />}

                      <div className="mt-5 flex items-center justify-end gap-2 border-t border-border pt-4">
                        <Button data-testid={`question-up-${idx}`} variant="outline" size="sm" onClick={() => moveQuestion(q.id, -1)}>
                          <ArrowUp className="h-4 w-4" strokeWidth={1.5} />
                          上移
                        </Button>
                        <Button data-testid={`question-down-${idx}`} variant="outline" size="sm" onClick={() => moveQuestion(q.id, 1)}>
                          <ArrowDown className="h-4 w-4" strokeWidth={1.5} />
                          下移
                        </Button>
                        <Button data-testid={`question-delete-${idx}`} variant="outline" size="sm" onClick={() => removeQuestion(q.id)}>
                          <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                          删除
                        </Button>
                        <label className="ml-2 flex cursor-pointer items-center gap-1.5 text-13 text-muted-foreground">
                          <Input
                            type="checkbox"
                            data-testid={`question-required-${idx}`}
                            checked={q.required}
                            onChange={(e) => patchQuestion(q.id, { required: e.target.checked })}
                            className="h-3.5 w-3.5 accent-primary"
                          />
                          必填
                        </label>
                      </div>
                    </div>
                  </section>
                ))}
                </div>
              </section>}

              {view === "edit" && editorTab === "questions" && (
                <Button
                  data-testid="add-question"
                  variant="outline"
                  onClick={() => setQuestions((qs) => [...qs, newQuestion()])}
                  className="mt-4 w-full gap-1.5 border-dashed border-border-strong bg-card font-medium text-muted-foreground hover:border-survey hover:text-survey"
                >
                  <Plus className="h-4 w-4" strokeWidth={1.5} />
                  添加问题
                </Button>
              )}

              {view === "edit" && editorTab === "questions" && saveError && (
                <p role="alert" data-testid="err-save" className="mt-4 text-13 text-destructive">
                  {saveError}
                </p>
              )}
            </main>

            {aiOpen && (
              <aside
                data-testid={isTemplateEditor ? "template-ai-assistant" : "ai-assistant-panel"}
                className={`flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm xl:sticky xl:top-6 xl:h-[calc(100vh-3rem)] ${isTemplateEditor ? "min-h-[38.75rem]" : ""}`}
              >
                <div data-testid={isTemplateEditor ? undefined : "survey-ai-assistant"} className="flex min-h-0 flex-1 flex-col">
                <div className="border-b border-border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-15 font-semibold text-foreground">AI 助手</p>
                        <Badge variant="muted">默认开启</Badge>
                      </div>
                      <p className="text-12 text-muted-foreground">
                        {isTemplateEditor
                          ? "用对话生成、改写或检查模板题目，确认后同步到左侧。"
                          : editingSurveyId == null
                            ? "用自然语言生成或优化左侧问卷，确认后同步到左侧。"
                            : "用自然语言生成待确认变更，逐项应用到左侧问卷。"}
                      </p>
                    </div>
                    <Sparkles className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
                  </div>
                  {aiFallbackNotice && (
                    <p data-testid="ai-fallback-notice" className="mt-2 rounded-md border border-border bg-background px-3 py-2 text-12 text-muted-foreground">
                      {aiFallbackNotice}
                    </p>
                  )}
                  <div className="mt-3 rounded-lg border border-border bg-background px-3 py-2 text-12 leading-5 text-muted-foreground">
                    {isTemplateEditor
                      ? `当前模板：${title.trim() || "未命名模板"} · ${questions.length} 题。AI 建议不会直接覆盖内容。`
                      : "AI 先生成可确认的建议，不会直接覆盖左侧问卷。"}
                  </div>
                  {editingSurvey?.status === "active" && (
                    <div className="mt-3 rounded-lg border border-survey/20 bg-tag-yellow px-3 py-2 text-12 text-foreground">
                      当前问卷正在回收中。AI 迭代会先生成待确认变更；应用并保存后，现有答题链接继续有效。
                    </div>
                  )}
                </div>
                <div data-testid="ai-scroll-region" className="min-h-0 flex-1 overflow-y-auto">
                <div data-testid="ai-messages" className="flex flex-col gap-3 p-4">
                  {aiMessages.map((message, idx) => (
                    <div
                      key={`${message.role}-${idx}`}
                      className={message.role === "user" ? "self-end rounded-lg bg-primary px-3 py-2 text-13 text-primary-foreground" : "self-start rounded-lg border border-border bg-background px-3 py-2 text-13 text-foreground"}
                    >
                      {message.content}
                    </div>
                  ))}
                </div>
                <div className="border-t border-border p-4">
                  {pendingAiDraft && (
                    <div data-testid="survey-ai-preview" className="mb-4">
                    <div data-testid="ai-draft-preview" className="rounded-lg border border-border bg-background p-3">
                      <p data-testid="ai-summary" className="text-13 font-semibold text-foreground">
                        {pendingAiDraft.summary ?? pendingAiDraft.reply}
                      </p>
                      {pendingAiDraft.clarifyingQuestions?.length ? (
                        <ul data-testid="ai-clarifying-questions" className="mt-2 flex flex-col gap-1 text-12 text-muted-foreground">
                          {pendingAiDraft.clarifyingQuestions.map((question) => (
                            <li key={question}>- {question}</li>
                          ))}
                        </ul>
                      ) : null}
                      <SurveyIntentCanvas draft={pendingAiDraft} />
                      <div className="mt-3 rounded-md border border-border bg-card p-3">
                        <p data-testid="ai-draft-title" className="text-14 font-semibold text-foreground">
                          {pendingAiDraft.title || (isTemplateEditor ? "未命名模板" : "未命名问卷")}
                        </p>
                        <p className="mt-1 text-12 text-muted-foreground">{pendingAiDraft.description}</p>
                        <p data-testid="ai-draft-question-count" className="mt-2 text-12 text-muted-foreground">
                          {pendingAiDraft.questions.length} questions
                        </p>
                        <div data-testid="ai-draft-question-list" className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
                          {pendingAiDraft.questions.map((question, index) => (
                            <div
                              key={`${question.title}-${index}`}
                              data-testid={`ai-draft-question-${index}`}
                              className="rounded-md border border-border bg-background px-3 py-2"
                            >
                              <div className="flex min-w-0 items-start gap-2">
                                <span className="shrink-0 text-11 font-semibold text-muted-foreground">Q{index + 1}</span>
                                <p className="min-w-0 flex-1 break-words text-12 font-medium leading-5 text-foreground">
                                  {question.title}
                                </p>
                              </div>
                              <div className="mt-1 flex flex-wrap gap-1.5 pl-7">
                                <Badge variant="muted">{TYPE_LABEL[question.type] ?? question.type}</Badge>
                                {question.category ? <Badge variant="outline">{question.category}</Badge> : null}
                              </div>
                              {CHOICE_TYPES.includes(question.type) && question.options.length > 0 ? (
                                <div data-testid={`ai-draft-question-options-${index}`} className="mt-2 flex flex-col gap-1.5 pl-7">
                                  {question.options.map((option, optionIndex) => (
                                    <div key={`${option}-${optionIndex}`} className="flex items-center gap-2 text-12 text-muted-foreground">
                                      <span
                                        aria-hidden="true"
                                        className={question.type === "multiple" ? "h-3.5 w-3.5 shrink-0 rounded-sm border border-border" : "h-3.5 w-3.5 shrink-0 rounded-full border border-border"}
                                      />
                                      <span className="break-words">{option}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : question.type === "nps" ? (
                                <div data-testid={`ai-draft-question-options-${index}`} className="mt-2 grid grid-cols-6 gap-1 pl-7 sm:grid-cols-11">
                                  {Array.from({ length: 11 }, (_, score) => (
                                    <span key={score} className="flex h-7 items-center justify-center rounded-md border border-border bg-card text-11 text-muted-foreground">
                                      {score}
                                    </span>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                      {pendingAiDraft.reportOutline?.length ? (
                        <div data-testid="ai-report-outline" className="mt-3 text-12 text-muted-foreground">
                          报告大纲：{pendingAiDraft.reportOutline.join(" / ")}
                        </div>
                      ) : null}
                      <Button data-testid="apply-ai-draft" type="button" size="sm" disabled={aiDraftApplied} className="mt-3 w-full bg-primary text-primary-foreground hover:bg-primary/90" onClick={applyPendingAiDraft}>
                        {aiDraftApplied ? "已应用到左侧" : isTemplateEditor ? "应用到左侧模板" : "应用到左侧问卷"}
                      </Button>
                    </div>
                    </div>
                  )}
                  {pendingAiChangeSet && (
                    <div data-testid="ai-change-set" className="mb-4 rounded-lg border border-border bg-background p-3">
                      <p data-testid="ai-change-summary" className="text-13 font-semibold text-foreground">
                        {pendingAiChangeSet.summary}
                      </p>
                      <div data-testid="ai-change-operations" className="mt-3 flex flex-col gap-2">
                        {pendingAiChangeSet.operations.map((operation, idx) => (
                          <label key={operation.id} data-testid={`ai-change-operation-${idx}`} className="flex gap-2 rounded-md border border-border bg-card p-2 text-12 text-foreground">
                            <Input
                              type="checkbox"
                              data-testid={`ai-change-confirm-${idx}`}
                              checked={confirmedAiOps.includes(operation.id)}
                              onChange={(event) => toggleAiOperation(operation.id, event.target.checked)}
                              className="mt-0.5 h-3.5 w-3.5 accent-primary"
                            />
                            <span>
                              <span className="font-semibold">{operation.action}</span>
                              {operation.after?.title ? `: ${operation.after.title}` : ""}
                              <span className="block text-muted-foreground">{operation.rationale}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                      {pendingAiChangeSet.checks.length ? (
                        <div data-testid="ai-prepublish-checks" className="mt-3 flex flex-col gap-1 text-12 text-muted-foreground">
                          {pendingAiChangeSet.checks.map((check) => (
                            <p key={`${check.label}-${check.message}`}>
                              {check.label}: {check.status} - {check.message}
                            </p>
                          ))}
                        </div>
                      ) : null}
                      <Button data-testid="apply-ai-change-set" type="button" size="sm" className="mt-3 w-full" onClick={applyPendingAiChangeSet}>
                        应用选中的变更
                      </Button>
                    </div>
                  )}
                  <Textarea
                    data-testid="ai-input"
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    disabled={aiBusy}
                    placeholder={isTemplateEditor ? "例如：补充 3 道满意度题，并按主题分类" : editingSurveyId == null ? "例如：商品反馈问卷，面向新用户，控制在 5 题以内" : "例如：控制在 8 题内；加入 NPS；把语气改得更清楚"}
                    className="min-h-24"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(isTemplateEditor
                      ? ["优化题目表达", "补充 3 道选择题", "按主题重新分类", "检查模板完整性"]
                      : editingSurveyId == null
                        ? ["快速生成商品反馈问卷", "补充目标人群：新用户", "控制在 5 道题以内", "改成更适合手机填写"]
                        : ["加入 NPS", "控制在 8 题内", "核心问题设为必填", "做发布前检查"]
                    ).map((prompt) => (
                      <Button key={prompt} type="button" variant="outline" size="sm" disabled={aiBusy} onClick={() => void runAiCommand(prompt)}>
                        {prompt}
                      </Button>
                    ))}
                  </div>
                  <Button
                    data-testid="ai-send"
                    type="button"
                    className={`mt-3 w-full gap-1.5 ${isTemplateEditor ? "bg-foreground text-background hover:bg-foreground/90" : ""}`}
                    disabled={aiBusy || !aiInput.trim()}
                    onClick={sendAiCommand}
                  >
                    <Send className="h-4 w-4" strokeWidth={1.5} />
                    {aiBusy ? "AI 正在生成…" : isTemplateEditor ? "生成模板建议" : editingSurveyId == null ? "生成/优化问卷" : "生成待应用变更"}
                  </Button>
                </div>
                </div>
                </div>
              </aside>
            )}

            {!isTemplateEditor && !aiOpen && <aside data-testid="editor-inspector-panel" className="sticky top-32 hidden h-fit flex-col items-center gap-2 rounded-full border border-border bg-card p-2 shadow-sm xl:flex">
              <Button variant="ghost" size="icon" aria-label="添加问题" onClick={() => setQuestions((qs) => [...qs, newQuestion()])}>
                <Plus className="h-4 w-4" strokeWidth={1.5} />
              </Button>
              <Button
                data-testid="open-ai-assistant"
                variant={aiOpen ? "default" : "ghost"}
                size="icon"
                aria-label="AI 生成"
                onClick={() => {
                  if (aiOpen) {
                    setAiOpen(false);
                  } else {
                    openAiIterationPanel(editingSurvey?.status);
                  }
                }}
              >
                AI
              </Button>
              <Button variant="ghost" size="icon" aria-label="预览" onClick={() => setView("preview")}>
                <Eye className="h-4 w-4" strokeWidth={1.5} />
              </Button>
            </aside>}
          </div>
        )}
      </div>
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell
      active={workbenchTab === "templates" ? "template" : workspaceView}
      dashboardMode={workbenchTab === "home"}
      surveyCount={visibleSurveys.length}
      currentSurvey={currentSurveyForNavigation}
      workflowMode={workspaceView !== "workspace"}
      templateLibraryMode={workbenchTab === "templates"}
      hideHeader={workspaceView === "workspace" || workspaceView === "template"}
      onCreateWithAi={openCreateChooser}
      onCreateFromScene={() => void navigateWorkspace("template")}
      onCreateBlank={() => (workbenchTab === "templates" ? openTemplateEditor() : openCreateChooser())}
      onNavigate={(target) => void navigateWorkspace(target)}
    >
      {workspaceView !== "workspace" ? (
        <WorkspaceModulePanel
          view={workspaceView}
          survey={currentSurveyForNavigation}
          designContent={
            currentSurveyForNavigation ? (
              <div data-testid="survey-editor-screen">
                <SurveyDesignWorkbench
                  survey={currentSurveyForNavigation}
                  title={title || currentSurveyForNavigation.title}
                  description={description || currentSurveyForNavigation.description}
                  questions={questions}
                  categories={categories}
                  saving={saving}
                  saveError={saveError}
                  actionMessage={editorActionMessage}
                  onTitleChange={setTitle}
                  onDescriptionChange={setDescription}
                  patchQuestion={patchQuestion}
                  changeQuestionType={changeQuestionType}
                  setQuestionCategory={setQuestionCategory}
                  moveQuestion={moveQuestion}
                  removeQuestion={removeQuestion}
                  addQuestion={() => setQuestions((qs) => [...qs, newQuestion()])}
                  addOption={addOption}
                  patchOption={patchOption}
                  onSave={() => void saveWorkspaceDesign()}
                  onOpenAi={() => void openSelectedSurveyEditor("questions", { withAi: true })}
                  onOpenAnswer={openSelectedSurveyAnswer}
                  onOpenTemplate={() => void navigateWorkspace("template")}
                  typeLabel={TYPE_LABEL}
                  typeGroups={TYPE_GROUPS}
                  choiceTypes={CHOICE_TYPES}
                />
              </div>
            ) : undefined
          }
          templateContent={
            currentSurveyForNavigation ? (
              <div data-testid="workspace-template-workbench">
                <SurveyVersionedReportComposer
                  survey={currentSurveyForNavigation}
                  plan={
                    reportCategoryPlansBySurveyId[currentSurveyForNavigation.id] ??
                    fallbackReportCategoryPlan(currentSurveyForNavigation, questions)
                  }
                  generation={professionalReportGenerationBySurveyId[currentSurveyForNavigation.id]}
                  requirementsChangedOverride={
                    professionalReportRequestStateBySurveyId[currentSurveyForNavigation.id]
                      ?.requirementsChangedOverride ?? false
                  }
                  saving={workspaceTemplateSaving}
                  classifying={workspaceReportClassifying}
                  generating={workspaceReportGenerating}
                  status={workspaceTemplateStatus}
                  error={workspaceTemplateError}
                  onClassify={() => void classifyWorkspaceReportCategories(currentSurveyForNavigation.id)}
                  onSavePlan={(plan) =>
                    void saveWorkspaceReportCategoryPlan(
                      currentSurveyForNavigation.id,
                      plan as ReportCategoryPlanDraft
                    )
                  }
                  onGenerateReport={() => void generateWorkspaceCategoryReport(currentSurveyForNavigation.id)}
                  onBackToDesign={() => {
                    window.location.href = "/surveys?view=templates";
                  }}
                  onOpenCollect={() => void navigateWorkspace("collect")}
                />
              </div>
            ) : undefined
          }
          collectContent={
            currentSurveyForNavigation ? (
              <WorkspaceCollectWorkbench
                survey={currentSurveyForNavigation}
                responseMode={responseMode}
                publishStartAt={publishStartAt}
                publishEndAt={publishEndAt}
                responseLimit={responseLimit}
                oneResponsePerUser={oneResponsePerUser}
                confirmationMessage={confirmationMessage}
                message={publishSettingsMessage}
                statusTogglePending={statusTogglePending}
                onResponseModeChange={setResponseMode}
                onPublishStartAtChange={setPublishStartAt}
                onPublishEndAtChange={setPublishEndAt}
                onResponseLimitChange={setResponseLimit}
                onOneResponsePerUserChange={setOneResponsePerUser}
                onConfirmationMessageChange={setConfirmationMessage}
                onToggleStatus={() => void toggleWorkspaceSurveyStatus()}
                onSave={() => void savePublishSettings()}
                onBackToTemplate={() => void navigateWorkspace("template")}
                onOpenReport={() => void navigateWorkspace("report")}
              />
            ) : undefined
          }
          reportContent={
            currentSurveyForNavigation ? (
              <div>
                <a data-testid="workspace-report-link" href={`/surveys/${currentSurveyForNavigation.id}/results`} className="sr-only">
                  打开分析报告
                </a>
                <WorkspaceReportWorkbench
                  survey={currentSurveyForNavigation}
                  questions={questions}
                  categoryPlan={reportCategoryPlansBySurveyId[currentSurveyForNavigation.id]}
                  generatedReport={generatedReportsBySurveyId[currentSurveyForNavigation.id]}
                  professionalReport={professionalReportsBySurveyId[currentSurveyForNavigation.id]}
                  generation={professionalReportGenerationBySurveyId[currentSurveyForNavigation.id]}
                  generating={workspaceReportGenerating}
                  error={workspaceTemplateError}
                  onGenerateReport={(instruction, reportCategoryPlan) =>
                    void generateWorkspaceCategoryReport(currentSurveyForNavigation.id, instruction, reportCategoryPlan)
                  }
                  onSelectVersion={(artifactId) =>
                    loadWorkspaceProfessionalReportVersion(
                      currentSurveyForNavigation.id,
                      artifactId
                    )
                  }
                  onLoadMoreVersions={() =>
                    loadMoreWorkspaceProfessionalReportVersions(
                      currentSurveyForNavigation.id
                    )
                  }
                />
              </div>
            ) : undefined
          }
          onOpenEditor={(tab) => void openSelectedSurveyEditor(tab)}
          onOpenResults={openSelectedSurveyResults}
          onOpenAnswer={openSelectedSurveyAnswer}
          onOpenResponses={openSelectedSurveyResponses}
          onBack={() => {
            setWorkspaceView("workspace");
          }}
        />
      ) : (
      <div data-testid="survey-professional-dashboard" className="grid gap-4">
        {workbenchTab === "home" ? (
          <SurveyHomeDashboard
            greeting={greeting}
            userName={currentUserName || null}
            activeSurveyCount={activeSurveyCount}
            totalResponses={totalResponses}
            generatedReportCount={generatedReportCount}
            completionRate={completionRate}
            organizationName={organizationName}
            templates={allTemplates.slice(0, 4).map((template) => ({
              id: template.id,
              category: templateTagLabel(template.category ?? "诊断模版"),
              name: template.name,
              questionCount: template.questions.length,
              estimatedMinutes: template.estimatedMinutes ?? 3,
            }))}
            recentSurveys={visibleSurveys.slice(0, 4).map((survey) => ({
              id: survey.id,
              title: survey.title,
              description: survey.description,
              status: survey.status,
              statusLabel: STATUS_LABEL[survey.status],
              responseCount: survey.responses,
              responseLimit: survey.responseLimit,
              publishedAt: survey.status === "active" ? survey.publishStartAt ?? survey.updatedAt : null,
              updatedLabel: formatUpdated(survey.updatedAt),
            }))}
            onCreate={openCreateChooser}
            onBrowseTemplates={() => {
              window.location.href = "/surveys?view=templates";
            }}
            onBrowseSurveys={() => {
              window.location.href = "/surveys?view=my";
            }}
            onUseTemplate={(templateId) => {
              const template = allTemplates.find((item) => item.id === templateId);
              if (template) openEditor({ template });
            }}
            onOpenSurvey={(surveyId, target) => void selectSurveyForWorkspace(surveyId, target)}
          />
        ) : workbenchTab === "templates" ? (
          <section data-testid="templates-workbench" className="mx-auto grid w-full max-w-survey-dashboard gap-4 px-4 py-8 sm:px-6 lg:px-10 lg:py-9">
            {loading ? (
              <div className="rounded-lg border border-border bg-background p-4">
                <SurveySkeleton />
              </div>
            ) : (
              <>
                <section data-testid="survey-template-center">
                  <div data-testid="diagnostic-template-center">
                    <header className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h1 className="text-22 font-bold text-foreground">诊断模版中心</h1>
                        <p className="mt-1.5 max-w-3xl text-13 leading-6 text-muted-foreground">
                          问卷模版与配套报告模版成对管理：回收完成后按报告模版自动生成洞察。
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          data-testid="template-create-ai"
                          type="button"
                          onClick={() => openTemplateEditor(undefined, { withAi: true })}
                          className="h-10 gap-2 bg-survey px-4 text-survey-foreground hover:bg-survey/90"
                        >
                          <Sparkles className="h-4 w-4" strokeWidth={1.7} />
                          用 AI 生成模版
                        </Button>
                        <Button
                          data-testid="template-create-manual"
                          type="button"
                          variant="outline"
                          onClick={() => openTemplateEditor()}
                          className="h-10 gap-2 px-4"
                        >
                          <Plus className="h-4 w-4" strokeWidth={1.7} />
                          手工新建
                        </Button>
                      </div>
                    </header>

                    <div data-testid="template-tag-filter" className="my-5 flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={templateListTag === "all" ? "default" : "outline"}
                        className="rounded-full"
                        aria-pressed={templateListTag === "all"}
                        onClick={() => setTemplateListTag("all")}
                      >
                        全部
                      </Button>
                      {Array.from(new Set([...templateCategories, ...templateListTags])).map((tag) => (
                        <Button
                          key={tag}
                          type="button"
                          size="sm"
                          variant={templateListTag === tag ? "default" : "outline"}
                          className="rounded-full"
                          aria-pressed={templateListTag === tag}
                          onClick={() => setTemplateListTag(tag)}
                        >
                          {templateTagLabel(tag)}
                        </Button>
                      ))}
                      <Button
                        data-testid="template-manage-tags"
                        type="button"
                        size="sm"
                        variant="outline"
                        className="rounded-full border-dashed text-muted-foreground"
                        onClick={() => setTemplateTagManagerOpen(true)}
                      >
                        <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.7} />
                        管理标签
                      </Button>
                    </div>

                    {templateLoadError ? (
                      <p role="alert" data-testid="err-template" className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-13 text-destructive">
                        {templateLoadError}
                      </p>
                    ) : null}

                    {visibleTemplateList.length ? (
                      <div data-testid="diagnostic-template-grid" className="grid gap-4 md:grid-cols-2">
                        {visibleTemplateList.map((template, idx) => {
                          const dimensions = Array.from(new Set(
                            template.questions
                              .map((question) => question.category?.trim())
                              .filter((category): category is string => Boolean(category))
                          ));
                          const cardTags = template.tags?.length
                            ? template.tags
                            : [template.category ?? "通用"];
                          return (
                            <article
                              key={`${template.source}-${template.id}`}
                              data-testid={`template-card-${template.id}`}
                              className="flex min-h-64 flex-col rounded-lg border border-border bg-background p-5 transition-colors duration-200 hover:border-border-strong"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex flex-wrap gap-1.5">
                                  {cardTags.map((tag) => (
                                    <Badge
                                      key={tag}
                                      data-testid={tag === (template.category ?? "通用") ? `template-category-${template.id}` : undefined}
                                      variant="muted"
                                    >
                                      {templateTagLabel(tag)}
                                    </Badge>
                                  ))}
                                  <Badge
                                    variant={template.source === "saved" ? "outline" : "muted"}
                                    className={template.source === "saved" ? undefined : "bg-tag-purple text-survey"}
                                  >
                                    {template.source === "saved" ? "自定义" : "系统"}
                                  </Badge>
                                </div>
                                <span className="shrink-0 text-12 text-muted-foreground">
                                  {template.questions.length} 题 · {template.estimatedMinutes ?? 3} min
                                </span>
                              </div>
                              <h2 className="mt-3 text-15 font-bold text-foreground">{template.name}</h2>
                              <p className="mt-2 min-h-11 text-13 leading-6 text-muted-foreground">
                                {template.description || "暂无模版说明。"}
                              </p>
                              <div className="mt-3 rounded-lg bg-secondary px-3 py-2.5 text-12 leading-5 text-muted-foreground">
                                <p>三级框架：维度 → 指标 → 题目</p>
                                <p>诊断维度：{dimensions.length ? dimensions.map(templateTagLabel).join("、") : "按题目分类自动生成"}</p>
                                <p>
                                  配套报告：
                                  {template.reportTemplate
                                    ? `${template.reportTemplate.title} · ${template.reportTemplate.sections.length} 个章节`
                                    : "使用后配置报告章节"}
                                </p>
                              </div>
                              <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
                                <Button data-testid={`use-template-${template.id}`} type="button" size="sm" onClick={() => openEditor({ template })}>
                                  用此模版建问卷
                                </Button>
                                <Button
                                  data-testid={`view-report-template-${template.id}`}
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => void openReportTemplateWorkflow(template)}
                                >
                                  查看报告模版
                                </Button>
                                {template.source === "saved" ? (
                                  <div className="ml-auto flex items-center gap-1">
                                    <Button
                                      data-testid={`template-edit-${idx}`}
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      aria-label={`编辑模版 ${template.name}`}
                                      title="编辑模版"
                                      onClick={() => openTemplateEditor(template)}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      data-testid={`template-delete-${idx}`}
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      aria-label={`删除模版 ${template.name}`}
                                      title="删除模版"
                                      onClick={() => void deleteTemplate(template)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ) : null}
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    ) : (
                      <div data-testid="empty" className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border-strong px-4 py-12 text-center">
                        <p className="text-13 text-muted-foreground">没有匹配此标签的诊断模版。</p>
                        <Button type="button" size="sm" variant="outline" onClick={() => setTemplateListTag("all")}>
                          重置筛选
                        </Button>
                      </div>
                    )}
                  </div>
                </section>

                {templateMessage && (
                  <p data-testid="template-saved" className="rounded-lg border border-border bg-background px-4 py-3 text-12 text-muted-foreground">
                    {templateMessage}
                  </p>
                )}
              </>
            )}
          </section>
        ) : (
          <SurveyListScreen
            loading={loading}
            error={error}
            surveys={visibleSurveys.map((survey) => ({
              id: survey.id,
              title: survey.title,
              description: survey.description,
              status: survey.status,
              statusLabel: STATUS_LABEL[survey.status],
              responseCount: survey.responses,
              responseLimit: survey.responseLimit,
              updatedLabel: formatUpdated(survey.updatedAt),
            }))}
            onOpenCreateChooser={openCreateChooser}
            onCreateWithAi={createWithAiFromChooser}
            onCreateFromTemplate={createFromTemplateChooser}
            onCreateBlank={createBlankFromChooser}
            onOpenSurvey={(surveyId) => {
              const survey = visibleSurveys.find((item) => item.id === surveyId);
              void selectSurveyForWorkspace(surveyId, survey?.responses ? "report" : "design");
            }}
          />
        )}

        <Dialog
          open={templateTagManagerOpen}
          onClose={() => setTemplateTagManagerOpen(false)}
          title="管理标签"
          description="选择标签筛选模版；标签随自定义模版保存。"
          testId="template-tag-manager-dialog"
          className="max-w-xl rounded-lg"
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {Array.from(new Set([...templateCategories, ...templateListTags])).map((tag) => {
              const count = allTemplates.filter((template) =>
                (template.category ?? "通用") === tag || template.tags?.includes(tag)
              ).length;
              return (
                <Button
                  key={tag}
                  type="button"
                  variant="outline"
                  className="h-auto justify-between px-3 py-2"
                  onClick={() => {
                    setTemplateListTag(tag);
                    setTemplateTagManagerOpen(false);
                  }}
                >
                  <span>{tag}</span>
                  <Badge variant="muted">{count}</Badge>
                </Button>
              );
            })}
          </div>
        </Dialog>

        <Dialog
          open={createChooserOpen}
          onClose={() => setCreateChooserOpen(false)}
          title="新建问卷"
          description="选择一种方式开始你的诊断问卷。"
          testId="new-survey-dialog"
          className="max-h-full max-w-3xl gap-5 overflow-y-auto rounded-lg"
        >
          <div className="grid gap-4 md:grid-cols-3">
            <Button
              data-testid="new-survey-ai"
              data-dialog-autofocus
              type="button"
              variant="outline"
              autoFocus
              onClick={createWithAiFromChooser}
              className="group h-auto min-h-0 min-w-0 items-stretch justify-start whitespace-normal border-survey/30 bg-tag-purple/30 px-4 py-4 text-left transition-all duration-200 hover:border-survey hover:bg-tag-purple/50 active:bg-tag-purple/50 md:min-h-56 md:px-5 md:py-5"
            >
              <span className="flex w-full min-w-0 items-start gap-3 md:flex-col md:gap-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-survey/20 bg-background text-survey">
                  <Sparkles className="h-5 w-5" strokeWidth={1.6} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col self-stretch">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-15 font-semibold text-foreground">AI 对话生成</span>
                    <Badge
                      data-testid="new-survey-ai-recommended"
                      variant="outline"
                      className="border-survey/30 bg-background text-survey"
                    >
                      推荐
                    </Badge>
                  </span>
                  <span className="mt-2 block break-words text-12 font-normal leading-5 text-muted-foreground">
                    描述目标和受访者，AI 生成第一版后继续迭代。
                  </span>
                  <span
                    data-testid="new-survey-ai-action"
                    className="mt-4 flex items-center gap-1 text-12 font-semibold text-survey md:mt-auto md:pt-5"
                  >
                    开始对话
                    <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" strokeWidth={1.8} />
                  </span>
                </span>
              </span>
            </Button>
            <Button
              data-testid="new-survey-template"
              type="button"
              variant="outline"
              onClick={createFromTemplateChooser}
              className="group h-auto min-h-0 min-w-0 items-stretch justify-start whitespace-normal px-4 py-4 text-left transition-all duration-200 hover:border-foreground/30 hover:bg-accent active:bg-accent md:min-h-56 md:px-5 md:py-5"
            >
              <span className="flex w-full min-w-0 items-start gap-3 md:flex-col md:gap-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-1 text-foreground">
                  <LayoutTemplate className="h-5 w-5" strokeWidth={1.6} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col self-stretch">
                  <span className="text-15 font-semibold text-foreground">从模板开始</span>
                  <span className="mt-2 block break-words text-12 font-normal leading-5 text-muted-foreground">
                    从诊断模板中心选择成熟结构，再按项目调整。
                  </span>
                  <span
                    data-testid="new-survey-template-action"
                    className="mt-4 flex items-center gap-1 text-12 font-semibold text-foreground md:mt-auto md:pt-5"
                  >
                    浏览模板
                    <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" strokeWidth={1.8} />
                  </span>
                </span>
              </span>
            </Button>
            <Button
              data-testid="new-survey-blank"
              type="button"
              variant="outline"
              onClick={createBlankFromChooser}
              className="group h-auto min-h-0 min-w-0 items-stretch justify-start whitespace-normal px-4 py-4 text-left transition-all duration-200 hover:border-foreground/30 hover:bg-accent active:bg-accent md:min-h-56 md:px-5 md:py-5"
            >
              <span className="flex w-full min-w-0 items-start gap-3 md:flex-col md:gap-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-1 text-foreground">
                  <FileText className="h-5 w-5" strokeWidth={1.6} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col self-stretch">
                  <span className="text-15 font-semibold text-foreground">空白问卷</span>
                  <span className="mt-2 block break-words text-12 font-normal leading-5 text-muted-foreground">
                    从零搭建题目，过程中仍可随时召唤 AI 助手。
                  </span>
                  <span
                    data-testid="new-survey-blank-action"
                    className="mt-4 flex items-center gap-1 text-12 font-semibold text-foreground md:mt-auto md:pt-5"
                  >
                    从空白开始
                    <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" strokeWidth={1.8} />
                  </span>
                </span>
              </span>
            </Button>
          </div>
        </Dialog>
      </div>
      )}
    </WorkspaceShell>
  );
}
