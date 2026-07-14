"use client";
import { useEffect, useState, type CSSProperties } from "react";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  ChevronLeft,
  CheckCircle2,
  Copy,
  Eye,
  FileText,
  PauseCircle,
  Pencil,
  PlayCircle,
  Plus,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownMessage } from "../ava/markdown-message";

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

interface SurveyTemplate {
  id: string;
  source: "built_in" | "saved";
  name: string;
  category?: string;
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
  active: "Active",
  paused: "Paused",
};
const MODEL_INFO: Record<string, { provider: string; quality: string; speed: string; cost: string; fallback?: string }> = {
  "qwen3.7-max": { provider: "Qwen", quality: "高质量", speed: "标准", cost: "中" },
  "mock-survey-fast": { provider: "Mock", quality: "稳定", speed: "快", cost: "低" },
  "mock-survey-quality": { provider: "Mock", quality: "高质量", speed: "标准", cost: "低" },
  "qwen-force-fail": { provider: "Qwen", quality: "故障演练", speed: "失败后切换", cost: "测试", fallback: "mock-survey-fallback" },
};

const surveyThemeStyle = {
  "--primary": "262 74% 54%",
  "--primary-foreground": "0 0% 100%",
  "--ring": "262 74% 54%",
} as CSSProperties;
const AI_CREATE_FLOW_KEY = "survey-ai-create-flow";

let qSeq = 0;
function newQuestion(): Question {
  qSeq += 1;
  return { id: `q_${qSeq}_${Math.random().toString(36).slice(2, 7)}`, title: "", type: "short_text", required: false, options: [] };
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
      ...(typeof q.category === "string" && q.category.trim() ? { category: q.category.trim() } : {}),
    };
  });
  return mapped.length ? mapped : [newQuestion()];
}

function formatUpdated(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Updated just now";
  return `Updated ${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
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

function aiDraftToMarkdown(draft: AiDraft) {
  const lines: string[] = [
    `# ${draft.title || "未命名问卷"}`,
    "",
    draft.description || "暂无问卷说明",
    "",
    "## 问题清单",
  ];

  draft.questions.forEach((question, index) => {
    lines.push("", `### ${index + 1}. ${question.title || `问题 ${index + 1}`}`);
    lines.push(`- 题型：${TYPE_LABEL[question.type] ?? question.type}`);
    lines.push(`- 必填：${question.required ? "是" : "否"}`);
    if (question.category) {
      lines.push(`- 分类：${question.category}`);
    }
    if (CHOICE_TYPES.includes(question.type) && question.options.length > 0) {
      lines.push("- 选项：");
      question.options.forEach((option) => {
        lines.push(`  - ${option}`);
      });
    }
  });

  if (draft.reportOutline?.length) {
    lines.push("", "## 报告大纲");
    draft.reportOutline.forEach((item) => lines.push(`- ${item}`));
  }

  if (draft.reportTemplate) {
    lines.push("", "## 报告模板");
    lines.push(`- 标题：${draft.reportTemplate.title}`);
    draft.reportTemplate.sections.forEach((item) => lines.push(`- 章节：${item}`));
    draft.reportTemplate.chartSlots.forEach((item) => lines.push(`- 图表：${item}`));
    draft.reportTemplate.caveats.forEach((item) => lines.push(`- 边界：${item}`));
  }

  if (draft.clarifyingQuestions?.length) {
    lines.push("", "## 待确认问题");
    draft.clarifyingQuestions.forEach((item) => lines.push(`- ${item}`));
  }

  return lines.join("\n");
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
    <div data-testid="survey-intent-canvas" className="mt-4 rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-14 font-semibold text-foreground">Survey Intent Canvas</p>
          <p className="text-12 text-muted-foreground">先确认设计意图，再生成题目、逻辑和报告。</p>
        </div>
        <Badge variant="outline">5 Intent</Badge>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {items.map((item) => (
          <section key={item.id} data-testid={item.id} className="rounded-md border border-border bg-background px-3 py-2">
            <Badge variant="muted">{item.label}</Badge>
            <p className="mt-2 text-13 font-semibold text-foreground">{item.title}</p>
            <p className="mt-1 text-13 leading-5 text-foreground">{item.body}</p>
            <p className="mt-1 text-12 leading-5 text-muted-foreground">{item.meta}</p>
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

export default function SurveysPage() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"list" | "editor">("list");
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [editorTab, setEditorTab] = useState<"questions" | "responses" | "settings">("questions");
  const [filter, setFilter] = useState<"my" | "team">("my");
  const [workbenchTab, setWorkbenchTab] = useState<"my" | "team" | "templates" | "ai">("my");

  // editor state
  const [editingSurveyId, setEditingSurveyId] = useState<number | null>(null);
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
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamId, setTeamId] = useState<string>("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [created, setCreated] = useState<{ id: number; shareUrl: string } | null>(null);
  const [editorActionMessage, setEditorActionMessage] = useState("");
  const [templates, setTemplates] = useState<SurveyTemplate[]>([]);
  const [templateMessage, setTemplateMessage] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  const [aiCreateFlow, setAiCreateFlow] = useState(false);
  const [aiModel, setAiModel] = useState("qwen3.7-max");
  const [aiInput, setAiInput] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiSessionId, setAiSessionId] = useState<string | null>(null);
  const [pendingAiDraft, setPendingAiDraft] = useState<AiDraft | null>(null);
  const [pendingAiChangeSet, setPendingAiChangeSet] = useState<AiChangeSet | null>(null);
  const [confirmedAiOps, setConfirmedAiOps] = useState<string[]>([]);
  const [aiFallbackNotice, setAiFallbackNotice] = useState("");
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([
    { role: "assistant", content: "告诉我调研目标，我会先理解需求、提出澄清问题，再生成一版待确认的结构化问卷草稿。" },
  ]);

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

  useEffect(() => {
    void load();
    void loadTemplates();
    try {
      const params = new URLSearchParams(window.location.search);
      const editId = Number(params.get("edit"));
      if (Number.isFinite(editId) && editId > 0) {
        window.history.replaceState(null, "", "/surveys");
        void loadSurveyForEditor(editId, "edit");
        return;
      }
      if (window.localStorage.getItem(AI_CREATE_FLOW_KEY) === "1") {
        openEditor({ withAi: true });
      }
    } catch {
      // Ignore local recovery hints when storage is unavailable.
    }
  }, []);

  async function loadTeams() {
    try {
      const res = await fetch("/api/teams");
      if (res.ok) setTeams(((await res.json()).teams ?? []).map((t: Team) => ({ id: t.id, name: t.name })));
    } catch {
      // 团队列表加载失败不阻塞创建（保留 private 作用域可用）
    }
  }

  async function loadTemplates() {
    try {
      const res = await fetch("/api/survey-templates");
      if (res.ok) setTemplates((await res.json()).templates ?? []);
    } catch {
      // 模板加载失败不阻塞 Blank 创建。
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
    setAiMessages([
      {
        role: "assistant",
        content: withAi
          ? "请描述这份问卷的目标、答题人和使用场景。信息不完整也没关系，我会先提炼理解并补充澄清问题。"
          : "告诉我调研目标，我会先理解需求、提出澄清问题，再生成一版待确认的结构化问卷草稿。",
      },
    ]);
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

  function openEditor(options: { withAi?: boolean } = {}) {
    const withAi = options.withAi === true;
    setEditingSurveyId(null);
    setTitle("");
    setDescription("");
    setScope("private");
    setResponseMode("anonymous");
    setPublishStartAt("");
    setPublishEndAt("");
    setResponseLimit("");
    setOneResponsePerUser(false);
    setConfirmationMessage("感谢你的反馈，问卷创建者将可以在结果页查看这份答卷。");
    setPublishSettingsMessage("");
    setTeamId("");
    setQuestions([newQuestion()]);
    setSaveError("");
    setCreated(null);
    setEditorActionMessage("");
    setTemplateMessage("");
    setView("edit");
    setEditorTab("questions");
    setMode("editor");
    setAiCreateFlow(withAi);
    rememberAiCreateFlow(withAi);
    resetAiState(withAi);
    if (withAi) void resumeLatestAiCreateSession();
    void loadTeams();
    void loadTemplates();
  }

  function applyBlankTemplate() {
    setTitle("");
    setDescription("");
    setQuestions([newQuestion()]);
    setTemplateMessage("");
  }

  function applyTemplate(template: SurveyTemplate) {
    setTitle(template.title);
    setDescription(template.description);
    setQuestions(
      template.questions.length
        ? template.questions.map((q) => ({ ...q, id: newQuestion().id }))
        : [newQuestion()]
    );
    setTemplateMessage("");
  }

  async function saveAsTemplate() {
    setTemplateMessage("");
    const res = await fetch("/api/survey-templates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: title, title, description, questions }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setTemplateMessage(d.errors?.title ?? d.errors?.questions ?? d.error ?? "模板保存失败");
      return;
    }
    const { template } = await res.json();
    setTemplates((items) => [template, ...items.filter((item) => !(item.source === "saved" && item.id === template.id))]);
    setTemplateMessage("模板已保存");
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

  async function loadSurveyForEditor(surveyId: number, nextView: "edit" | "preview") {
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
    setQuestions(questionsFromApi(survey.questions));
    setSaveError("");
    setCreated(null);
    setEditorActionMessage("");
    setView(nextView);
    setEditorTab("questions");
    setMode("editor");
    setAiCreateFlow(false);
    rememberAiCreateFlow(false);
    resetAiState(false);
    if (nextView === "edit") void loadTeams();
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

  function patchQuestion(id: string, patch: Partial<Question>) {
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)));
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

  function applyAiDraft(draft: AiDraft) {
    setTitle(draft.title);
    setDescription(draft.description);
    setQuestions(
      draft.questions.length
        ? draft.questions.map((q) => ({
            ...newQuestion(),
            title: q.title,
            type: q.type,
            required: q.required,
            options: CHOICE_TYPES.includes(q.type) ? q.options : [],
            ...(q.category ? { category: q.category } : {}),
          }))
        : questions
    );
  }

  function questionFromAi(raw: Partial<AiDraftQuestion> | undefined): Question {
    const type = Object.keys(TYPE_LABEL).includes(String(raw?.type)) ? (raw!.type as QType) : "short_text";
    return {
      ...newQuestion(),
      title: String(raw?.title ?? "新增问题").trim() || "新增问题",
      type,
      required: raw?.required === true,
      options: CHOICE_TYPES.includes(type) ? (raw?.options ?? []).map((o) => String(o ?? "").trim()).filter(Boolean) : [],
      ...(raw?.category ? { category: raw.category } : {}),
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
      editingSurveyId == null && pendingAiDraft
        ? {
            title: pendingAiDraft.title,
            description: pendingAiDraft.description,
            questions: pendingAiDraft.questions,
            intentCanvas: pendingAiDraft.intentCanvas,
            reportOutline: pendingAiDraft.reportOutline,
            reportTemplate: pendingAiDraft.reportTemplate,
          }
        : { title, description, questions };
    const nextMessages: AiMessage[] = [...aiMessages, { role: "user", content: cleanCommand }];
    setAiMessages(nextMessages);
    setAiInput("");
    setAiBusy(true);
    try {
      const res = await fetch("/api/surveys/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: aiModel,
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
        const message = payload.error ?? "AI 修改失败，请确认 QWEN_API_KEY / DASHSCOPE_API_KEY 已配置。";
        setAiMessages((items) => [...items, { role: "assistant", content: String(message) }]);
        return;
      }
      if (typeof payload.sessionId === "string") setAiSessionId(payload.sessionId);
      if (payload.fallback) {
        setAiFallbackNotice(`模型 ${payload.fallback.from} 失败，已切换到 ${payload.fallback.to}`);
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

  function applyPendingAiDraft() {
    if (!pendingAiDraft) return;
    applyAiDraft(pendingAiDraft);
    setAiCreateFlow(false);
    setAiOpen(false);
    setPendingAiDraft(null);
    setPendingAiChangeSet(null);
    rememberAiCreateFlow(false);
    setAiMessages((items) => [...items, { role: "assistant", content: "已把 AI 草稿应用到 Builder，你可以继续手动编辑后再发布。" }]);
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
      setCreated({ id: survey.id, shareUrl: survey.shareUrl });
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
    setAiMessages((items) => [...items, { role: "assistant", content: `已应用 ${selected.length} 项变更到 Builder，请预览并保存。` }]);
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
      setCreated({ id: survey.id, shareUrl: survey.shareUrl });
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

  const hasValidQuestion = questions.some((q) => q.title.trim().length > 0);
  const canSave = title.trim().length > 0 && (editingSurveyId != null || hasValidQuestion) && (scope !== "team" || teamId);
  const mySurveys = surveys.filter((s) => s.isOwner);
  const teamSurveys = surveys.filter((s) => s.scope === "team");
  const visibleSurveys = workbenchTab === "team" ? teamSurveys : mySurveys;
  const editingSurvey = editingSurveyId == null ? undefined : surveys.find((s) => s.id === editingSurveyId);
  const editingSurveyShareUrl = editingSurveyId == null
    ? ""
    : new URL(`/survey/${editingSurveyId}/answer`, typeof window === "undefined" ? "http://localhost" : window.location.href).toString();

  if (mode === "editor" && aiCreateFlow) {
    const model = MODEL_INFO[aiModel];
    return (
      <div className="min-h-full bg-secondary/40 pb-14" style={surveyThemeStyle}>
        <div className="sticky top-0 z-10 border-b border-border bg-background/95">
          <div className="mx-auto flex max-w-5xl items-center gap-3 px-8 py-4">
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
              <p className="text-12 text-muted-foreground">Chat-only survey drafting workspace</p>
            </div>
            <Select
              aria-label="AI model"
              data-testid="ai-model"
              className="w-52"
              value={aiModel}
              onChange={(e) => setAiModel(e.target.value)}
            >
              <option value="qwen3.7-max">qwen3.7-max</option>
              <option value="mock-survey-fast">Mock Survey Fast</option>
              <option value="mock-survey-quality">Mock Survey Quality</option>
              <option value="qwen-force-fail">Qwen failure drill</option>
            </Select>
          </div>
        </div>

        <main data-testid="ai-create-chat-workspace" className="mx-auto max-w-6xl px-8 py-6">
          <div data-testid="ai-studio-layout" className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
            <aside data-testid="ai-intent-panel" className="h-fit rounded-lg border border-border bg-card p-4 shadow-sm">
              <Badge variant="outline">AI Draft Studio</Badge>
              <h2 className="mt-3 text-18 font-bold text-foreground">需求确认</h2>
              <div className="mt-4 flex flex-col gap-3 text-13">
                {[
                  ["目标", "调研目的和决策场景"],
                  ["人群", "受访对象与筛选条件"],
                  ["题目结构", "题量、题型、必填策略"],
                  ["报告模板", "指标、图表和结论框架"],
                ].map(([label, desc]) => (
                  <div key={label} className="rounded-md border border-border bg-background px-3 py-2">
                    <p className="font-semibold text-foreground">{label}</p>
                    <p className="mt-1 text-12 text-muted-foreground">{desc}</p>
                  </div>
                ))}
              </div>
            </aside>
          <section data-testid="ai-draft-workbench" className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <div className="border-b border-border p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="muted">{model?.provider ?? "Custom"}</Badge>
                    <Badge variant="muted">{model?.quality ?? "标准"}</Badge>
                    <Badge variant="muted">{model?.speed ?? "标准"}</Badge>
                    <Badge variant="muted">成本 {model?.cost ?? "中"}</Badge>
                    {aiSessionId && <Badge variant="outline">已持久化</Badge>}
                  </div>
                  <h1 className="mt-3 text-22 font-bold text-foreground">用对话完成整份问卷</h1>
                  <p className="mt-2 max-w-2xl text-14 leading-6 text-muted-foreground">
                    AI 会保留未完成的 session 和草稿。确认问题结构后，你可以预览，也可以直接发布。
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

            <div data-testid="ai-messages" className="flex max-h-[38vh] min-h-72 flex-col gap-3 overflow-auto p-5">
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
                <div data-testid="ai-draft-preview" className="mb-4 rounded-lg border border-primary/25 bg-primary/5 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p data-testid="ai-summary" className="text-14 font-semibold text-foreground">
                        {pendingAiDraft.summary ?? pendingAiDraft.reply}
                      </p>
                      <p className="mt-1 text-12 text-muted-foreground">
                        你可以继续在下面用自然语言要求 AI 增删题目、改写选项、控制题量或补充报告大纲。
                      </p>
                    </div>
                    <Badge variant="success">{pendingAiDraft.questions.length} 题</Badge>
                  </div>
                  <SurveyIntentCanvas draft={pendingAiDraft} />
                  <div data-testid="ai-draft-markdown" className="mt-3 rounded-md border border-border bg-card p-4">
                    <MarkdownMessage content={aiDraftToMarkdown(pendingAiDraft)} />
                  </div>
                  <div className="mt-3 rounded-md border border-border bg-card p-3">
                    <p data-testid="ai-draft-title" className="text-15 font-semibold text-foreground">
                      {pendingAiDraft.title || "未命名问卷"}
                    </p>
                    <p className="mt-1 text-13 text-muted-foreground">{pendingAiDraft.description}</p>
                    <p data-testid="ai-draft-question-count" className="mt-2 text-12 text-muted-foreground">
                      {pendingAiDraft.questions.length} questions
                    </p>
                  </div>
                  {pendingAiDraft.reportOutline?.length ? (
                    <div data-testid="ai-report-outline" className="mt-3 text-12 text-muted-foreground">
                      报告大纲：{pendingAiDraft.reportOutline.join(" / ")}
                    </div>
                  ) : null}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button data-testid="preview-ai-draft" type="button" size="sm" variant="outline" onClick={previewPendingAiDraft}>
                      <Eye className="h-4 w-4" strokeWidth={1.5} />
                      确认并预览
                    </Button>
                    <Button data-testid="publish-ai-draft" type="button" size="sm" disabled={saving} onClick={() => void publishPendingAiDraft()}>
                      {saving ? "发布中…" : "确认并发布"}
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
                placeholder="例如：商品反馈问卷，面向新用户，控制在 5 题以内，并需要报告大纲"
                className="min-h-28"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {["快速生成商品反馈问卷", "补充目标人群：新用户", "控制在 5 道题以内", "需要报告大纲"].map((prompt) => (
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
    );
  }

  if (mode === "editor") {
    return (
      <div data-testid="survey-editor-shell" className="min-h-full bg-secondary/30 pb-14" style={surveyThemeStyle}>
        <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
          <div data-testid="editor-command-bar" className="mx-auto flex max-w-6xl items-center gap-3 px-8 py-4">
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
              <p className="truncate text-15 font-semibold text-foreground">{title.trim() || "未命名问卷"}</p>
              <p className="text-12 text-muted-foreground">Survey workspace</p>
            </div>
            {editingSurveyId != null && (
              <div className="flex items-center gap-2">
                <Button
                  data-testid="editor-results"
                  variant="outline"
                  size="sm"
                  onClick={() => { window.location.href = `/surveys/${editingSurveyId}/results?from=editor`; }}
                  className="gap-1.5"
                >
                  <BarChart3 className="h-4 w-4" strokeWidth={1.5} />
                  结果
                </Button>
                <Button
                  data-testid="editor-report"
                  variant="outline"
                  size="sm"
                  onClick={() => { window.location.href = `/surveys/${editingSurveyId}/results?from=editor`; }}
                  className="gap-1.5"
                >
                  <FileText className="h-4 w-4" strokeWidth={1.5} />
                  报告
                </Button>
                <Button
                  data-testid="editor-share"
                  variant="outline"
                  size="sm"
                  onClick={() => void copyEditorShareLink()}
                  className="gap-1.5"
                >
                  <Copy className="h-4 w-4" strokeWidth={1.5} />
                  分享
                </Button>
                <Button
                  data-testid="editor-toggle"
                  variant="outline"
                  size="sm"
                  onClick={() => void toggleEditorSurveyStatus()}
                  className="gap-1.5"
                >
                  {editingSurvey?.status === "active" ? (
                    <>
                      <PauseCircle className="h-4 w-4" strokeWidth={1.5} />
                      暂停
                    </>
                  ) : (
                    <>
                      <PlayCircle className="h-4 w-4" strokeWidth={1.5} />
                      启用
                    </>
                  )}
                </Button>
                <Button
                  data-testid="editor-delete"
                  variant="outline"
                  size="sm"
                  onClick={() => void deleteEditorSurvey()}
                  className="gap-1.5 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                  删除
                </Button>
              </div>
            )}
            {!created && (
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
            {!created && view === "edit" && (
              <Button
                data-testid="save-survey"
                size="sm"
                disabled={saving || !canSave}
                onClick={() => void save()}
              >
                {saving ? "保存中…" : editingSurveyId == null ? "发布问卷" : "保存修改"}
              </Button>
            )}
            {!created && view === "preview" && editingSurveyId == null && (
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
          <div className="mx-auto flex max-w-6xl items-center justify-center gap-8 px-8">
            {[
              { id: "questions", label: "问题", testId: "survey-questions-tab" },
              { id: "responses", label: "回答", testId: "survey-responses-tab" },
              { id: "settings", label: "设置", testId: "survey-settings-tab" },
            ].map((tab) => (
              <Button
                key={tab.id}
                data-testid={tab.testId}
                onClick={() => setEditorTab(tab.id as "questions" | "responses" | "settings")}
                variant="ghost"
                size="sm"
                className={`border-b-2 px-4 py-3 text-14 font-semibold ${
                  editorTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </Button>
            ))}
          </div>
        </div>

        {created && (
          <div className="mx-auto mt-8 max-w-3xl px-8">
            <div
              data-testid="survey-created"
              className="rounded-12 border border-border bg-card p-6 shadow-sm"
            >
              <p className="text-18 font-semibold text-foreground">问卷已发布</p>
              <p className="mt-1 text-13 text-muted-foreground">复制链接给答题人，或回到列表查看所有已发布问卷。</p>
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
                <span data-testid="survey-share-link" className="flex-1 truncate text-13 text-foreground">
                  {created.shareUrl}
                </span>
              </div>
              <Button
                data-testid="done-created"
                size="sm"
                className="mt-4"
                onClick={() => setMode("list")}
              >
                返回问卷列表
              </Button>
            </div>
          </div>
        )}

        {!created && editorActionMessage && (
          <div className="mx-auto mt-4 max-w-6xl px-8">
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

        {!created && view === "preview" && (
          <div className="mx-auto mt-8 max-w-3xl px-8" data-testid="survey-preview">
            <div className="overflow-hidden rounded-12 border border-border bg-card shadow-sm">
              <div className="h-2 bg-primary" />
              <div className="p-6">
                <h2 className="text-22 font-bold text-foreground">{title.trim() || "未命名问卷"}</h2>
                {description.trim() && <p className="mt-2 text-14 text-muted-foreground">{description}</p>}
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-3">
              {questions.map((q, idx) => (
                <div key={q.id} data-testid={`preview-question-${idx}`} className="rounded-12 border border-border bg-card p-5 shadow-sm">
                  <p className="text-15 font-semibold text-foreground">
                    {q.title.trim() || `问题 ${idx + 1}`}
                    {q.required && <span className="ml-1 text-destructive">*</span>}
                  </p>
                  <div className="mt-3">
                    {["short_text", "email", "number", "phone"].includes(q.type) && (
                      <Input disabled placeholder="短文本回答" className="bg-muted/30" />
                    )}
                    {q.type === "text" && (
                      <textarea
                        disabled
                        placeholder="段落回答"
                        className="min-h-20 w-full resize-none rounded-lg border border-input bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-placeholder"
                      />
                    )}
                    {CHOICE_TYPES.includes(q.type) && q.type !== "dropdown" && (
                      <div className="flex flex-col gap-2">
                        {(q.options.length ? q.options : ["Option 1"]).map((o, k) => (
                          <label key={k} className="flex items-center gap-2 text-13 text-foreground">
                            <input type="checkbox" disabled className="accent-primary" />
                            {o || `Option ${k + 1}`}
                          </label>
                        ))}
                      </div>
                    )}
                    {q.type === "dropdown" && (
                      <Select disabled value="" className="max-w-xs">
                        <option value="">请选择</option>
                        {(q.options.length ? q.options : ["选项 1"]).map((o, k) => (
                          <option key={k} value={o || `选项 ${k + 1}`}>
                            {o || `选项 ${k + 1}`}
                          </option>
                        ))}
                      </Select>
                    )}
                    {q.type === "rating" && <div className="text-22 text-border-strong">★ ★ ★ ★ ★</div>}
                    {q.type === "linear_scale" && <div className="text-14 text-muted-foreground">1  2  3  4  5</div>}
                    {q.type === "nps" && <div className="text-14 text-muted-foreground">0 1 2 3 4 5 6 7 8 9 10</div>}
                    {q.type === "date" && <Input disabled type="date" className="max-w-xs bg-muted/30" />}
                    {q.type === "time" && <Input disabled type="time" className="max-w-xs bg-muted/30" />}
                    {q.type === "file" && <Input disabled type="file" className="max-w-xs bg-muted/30" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!created && view === "edit" && (
          <div className={`mx-auto grid max-w-6xl gap-4 px-8 py-6 ${aiOpen ? "grid-cols-[minmax(0,1fr)_22rem_64px]" : "grid-cols-[minmax(0,1fr)_64px]"}`}>
            <main data-testid="question-builder-panel" className="min-w-0">
              {editorTab === "settings" && (
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

              {editorTab === "responses" && (
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
                      <p data-testid="editor-responses-count" className="mt-1 text-30 font-bold text-foreground">
                        {editingSurvey?.responses ?? 0}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-surface-1 p-4">
                      <p className="text-12 text-muted-foreground">题目数量</p>
                      <p className="mt-1 text-30 font-bold text-foreground">{questions.length}</p>
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

              {editorTab === "questions" && editingSurveyId == null && (
                <div className="mb-4 rounded-12 border border-border bg-card p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-15 font-semibold text-foreground">模板库</p>
                      <p className="text-12 text-muted-foreground">从空白开始，或套用已保存的问卷结构。</p>
                    </div>
                    <Button data-testid="save-template" variant="outline" size="sm" onClick={() => void saveAsTemplate()}>
                      保存为模板
                    </Button>
                  </div>
                  <div data-testid="template-library" className="mt-3 flex flex-wrap gap-2">
                    <Button data-testid="template-blank" variant="outline" size="sm" onClick={applyBlankTemplate}>
                      空白问卷
                    </Button>
                    {templates.filter((template) => template.source === "built_in").map((template) => (
                      <Button
                        key={template.id}
                        data-testid={`template-${template.id}`}
                        variant="outline"
                        size="sm"
                        onClick={() => applyTemplate(template)}
                        className="h-auto flex-col items-start gap-1 px-3 py-2 text-left"
                      >
                        <span className="text-13 font-semibold">{template.name}</span>
                        <span className="flex items-center gap-1.5 text-11 text-muted-foreground">
                          {template.category && (
                            <Badge data-testid={`template-category-${template.id}`} variant="muted" className="text-11">
                              {template.category}
                            </Badge>
                          )}
                          <span>{template.estimatedMinutes ?? 3} min</span>
                        </span>
                      </Button>
                    ))}
                  </div>
                  <div data-testid="saved-template-list" className="mt-3 flex flex-col gap-2">
                    {templates.filter((template) => template.source === "saved").length === 0 ? (
                      <p className="text-12 text-muted-foreground">还没有保存的团队模板</p>
                    ) : (
                      templates.filter((template) => template.source === "saved").map((template, idx) => (
                        <div key={template.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                          <Button
                            data-testid={`template-saved-${idx}`}
                            variant="ghost"
                            size="sm"
                            onClick={() => applyTemplate(template)}
                            className="min-w-0 flex-1 justify-start"
                          >
                            {template.name}
                          </Button>
                          <Button
                            data-testid={`delete-template-${idx}`}
                            variant="ghost"
                            size="icon"
                            aria-label="删除模板"
                            onClick={() => void deleteTemplate(template)}
                          >
                            <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                  {templateMessage && (
                    <p data-testid="template-saved" className="mt-2 text-12 text-muted-foreground">
                      {templateMessage}
                    </p>
                  )}
                </div>
              )}

              {editorTab === "questions" && <section className="overflow-hidden rounded-12 border border-border bg-card shadow-sm">
                <div className="h-2 bg-primary" />
                <div className="p-6">
                  <Input
                    id="survey-title"
                    data-testid="survey-title"
                    aria-label="Survey title"
                    placeholder="未命名问卷"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="h-auto border-0 border-b border-border px-0 py-2 text-26 font-bold shadow-none focus-visible:ring-0"
                  />
                  <textarea
                    id="survey-desc"
                    data-testid="survey-desc"
                    aria-label="Description"
                    placeholder="添加问卷说明，例如填写对象、预计用时和收集目的"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="mt-3 min-h-12 w-full resize-none rounded-none border-0 border-b border-border bg-transparent px-0 py-2 text-14 text-foreground transition-colors placeholder:text-placeholder focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                  />
                  <div className="mt-5 flex flex-wrap items-end gap-3">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="survey-scope">发布范围</Label>
                      <Select
                        id="survey-scope"
                        data-testid="survey-scope"
                        className="w-48"
                        value={scope}
                        onChange={(e) => setScope(e.target.value as "private" | "team")}
                      >
                        <option value="private">仅自己可管理</option>
                        <option value="team">团队内可查看</option>
                      </Select>
                    </div>
                    {scope === "team" && (
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="survey-team">团队</Label>
                        <Select
                          id="survey-team"
                          data-testid="survey-team"
                          className="w-56"
                          value={teamId}
                          onChange={(e) => setTeamId(e.target.value)}
                        >
                          <option value="">选择团队…</option>
                          {teams.map((t) => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </Select>
                      </div>
                    )}
                    <Badge variant="muted">{questions.length} 题</Badge>
                    <Badge variant="muted">草稿</Badge>
                  </div>
                  {scope === "team" && teams.length === 0 && (
                    <p className="mt-2 text-12 text-muted-foreground">
                      当前还没有团队。先到 Teams 创建团队后，就可以发布为团队问卷。
                    </p>
                  )}
                </div>
              </section>}

              {editorTab === "questions" && <div data-testid="question-list" className="mt-4 flex flex-col gap-3.5">
                {questions.map((q, idx) => (
                  <section
                    key={q.id}
                    data-testid={`question-${idx}`}
                    className="rounded-12 border border-border bg-card shadow-sm transition-colors hover:border-border-strong"
                  >
                    <div className="border-l-4 border-primary p-5">
                      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_192px]">
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
                      </div>

                      {q.category && (
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
              </div>}

              {editorTab === "questions" && (
                <Button
                  data-testid="add-question"
                  variant="outline"
                  onClick={() => setQuestions((qs) => [...qs, newQuestion()])}
                  className="mt-4 w-full gap-1.5 border-dashed border-border-strong bg-card font-medium text-muted-foreground hover:border-primary hover:text-primary"
                >
                  <Plus className="h-4 w-4" strokeWidth={1.5} />
                  添加问题
                </Button>
              )}

              {editorTab === "questions" && saveError && (
                <p role="alert" data-testid="err-save" className="mt-4 text-13 text-destructive">
                  {saveError}
                </p>
              )}
            </main>

            {aiOpen && (
              <aside data-testid="ai-assistant-panel" className="sticky top-32 h-fit overflow-hidden rounded-12 border border-border bg-card shadow-sm">
                <div className="border-b border-border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-15 font-semibold text-foreground">AI 创建助手</p>
                      <p className="text-12 text-muted-foreground">
                        {editingSurveyId == null ? "先生成待确认草稿，点击 Apply 后才写入 Builder。" : "生成待应用变更，逐项确认后才写入 Builder。"}
                      </p>
                    </div>
                    <Sparkles className="h-5 w-5 text-primary" strokeWidth={1.5} />
                  </div>
                  <Select
                    aria-label="AI model"
                    data-testid="ai-model"
                    className="mt-3"
                    value={aiModel}
                    onChange={(e) => setAiModel(e.target.value)}
                  >
                    <option value="qwen3.7-max">qwen3.7-max</option>
                    <option value="mock-survey-fast">Mock Survey Fast</option>
                    <option value="mock-survey-quality">Mock Survey Quality</option>
                    <option value="qwen-force-fail">Qwen failure drill</option>
                  </Select>
                  <div data-testid="ai-model-capabilities" className="mt-2 flex flex-wrap gap-1.5 text-11 text-muted-foreground">
                    <Badge variant="muted">{MODEL_INFO[aiModel]?.provider ?? "Custom"}</Badge>
                    <Badge variant="muted">{MODEL_INFO[aiModel]?.quality ?? "标准"}</Badge>
                    <Badge variant="muted">{MODEL_INFO[aiModel]?.speed ?? "标准"}</Badge>
                    <Badge variant="muted">成本 {MODEL_INFO[aiModel]?.cost ?? "中"}</Badge>
                    {MODEL_INFO[aiModel]?.fallback && <Badge variant="outline">备用 {MODEL_INFO[aiModel]?.fallback}</Badge>}
                  </div>
                  {aiFallbackNotice && (
                    <p data-testid="ai-fallback-notice" className="mt-2 rounded-md border border-border bg-background px-3 py-2 text-12 text-muted-foreground">
                      {aiFallbackNotice}
                    </p>
                  )}
                  <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-12 text-muted-foreground">
                    发送后会创建可恢复的 AI session，并记录 draft 与 model trace。
                  </div>
                </div>
                <div data-testid="ai-messages" className="flex max-h-96 flex-col gap-3 overflow-auto p-4">
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
                    <div data-testid="ai-draft-preview" className="mb-4 rounded-lg border border-border bg-background p-3">
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
                          {pendingAiDraft.title || "未命名问卷"}
                        </p>
                        <p className="mt-1 text-12 text-muted-foreground">{pendingAiDraft.description}</p>
                        <p data-testid="ai-draft-question-count" className="mt-2 text-12 text-muted-foreground">
                          {pendingAiDraft.questions.length} questions
                        </p>
                      </div>
                      {pendingAiDraft.reportOutline?.length ? (
                        <div data-testid="ai-report-outline" className="mt-3 text-12 text-muted-foreground">
                          报告大纲：{pendingAiDraft.reportOutline.join(" / ")}
                        </div>
                      ) : null}
                      <Button data-testid="apply-ai-draft" type="button" size="sm" className="mt-3 w-full" onClick={applyPendingAiDraft}>
                        Apply to Builder
                      </Button>
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
                        Apply confirmed changes
                      </Button>
                    </div>
                  )}
                  <Textarea
                    data-testid="ai-input"
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    disabled={aiBusy}
                    placeholder={editingSurveyId == null ? "例如：商品反馈问卷，面向新用户，控制在 5 题以内" : "例如：控制在 8 题内；加入 NPS；把语气改得更清楚"}
                    className="min-h-24"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(editingSurveyId == null
                      ? ["快速生成商品反馈问卷", "补充目标人群：新用户", "控制在 5 道题以内", "需要报告大纲"]
                      : ["加入 NPS", "控制在 8 题内", "核心问题设为必填", "做发布前检查"]
                    ).map((prompt) => (
                      <Button key={prompt} type="button" variant="outline" size="sm" disabled={aiBusy} onClick={() => void runAiCommand(prompt)}>
                        {prompt}
                      </Button>
                    ))}
                  </div>
                  <Button data-testid="ai-send" type="button" className="mt-3 w-full gap-1.5" disabled={aiBusy || !aiInput.trim()} onClick={sendAiCommand}>
                    <Send className="h-4 w-4" strokeWidth={1.5} />
                    {aiBusy ? "AI 正在生成…" : editingSurveyId == null ? "生成 AI 草稿" : "生成待应用变更"}
                  </Button>
                </div>
              </aside>
            )}

            <aside data-testid="editor-inspector-panel" className="sticky top-32 flex h-fit flex-col items-center gap-2 rounded-full border border-border bg-card p-2 shadow-sm">
              <Button variant="ghost" size="icon" aria-label="添加问题" onClick={() => setQuestions((qs) => [...qs, newQuestion()])}>
                <Plus className="h-4 w-4" strokeWidth={1.5} />
              </Button>
              <Button data-testid="open-ai-assistant" variant={aiOpen ? "default" : "ghost"} size="icon" aria-label="AI 生成" onClick={() => setAiOpen((open) => !open)}>
                AI
              </Button>
              <Button variant="ghost" size="icon" aria-label="预览" onClick={() => setView("preview")}>
                <Eye className="h-4 w-4" strokeWidth={1.5} />
              </Button>
            </aside>
          </div>
        )}
      </div>
    );
  }

  return (
    <div data-testid="survey-professional-dashboard" className="min-h-full bg-secondary/20 pb-14" style={surveyThemeStyle}>
      <div className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-8 py-6">
          <div>
            <h1 className="text-30 font-bold text-foreground">AI Survey</h1>
            <p className="mt-1 text-14 text-muted-foreground">商业版问卷工作台：AI 创建、优化、报告和验收都在这里。</p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button data-testid="create-with-ai" size="sm" onClick={() => openEditor({ withAi: true })} className="gap-1.5">
              <Sparkles className="h-4 w-4" strokeWidth={1.5} />
              Create with AI
            </Button>
            <Button data-testid="new-survey" size="sm" variant="outline" onClick={() => openEditor()} className="gap-1.5">
              <Plus className="h-4 w-4" strokeWidth={1.5} />
              Blank
            </Button>
            <Button data-testid="open-acceptance-panel" size="sm" variant="outline" onClick={() => { window.location.href = "/surveys/acceptance"; }}>
              Acceptance
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-8 pt-6">
        <section data-testid="survey-kpi-strip" className="mb-4 grid gap-3 md:grid-cols-4">
          {[
            ["全部问卷", `${surveys.length} 份问卷`],
            ["已发布", `${surveys.filter((s) => s.status === "active").length} active`],
            ["总回答", `${surveys.reduce((sum, survey) => sum + survey.responses, 0)} responses`],
            ["模板入口", `${templates.filter((template) => template.source === "built_in").length} templates`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-border bg-card px-4 py-3">
              <p className="text-12 text-muted-foreground">{label}</p>
              <p className="mt-1 text-18 font-bold text-foreground">{value}</p>
            </div>
          ))}
        </section>
        <section data-testid="ai-survey-command-center" className="mb-6 overflow-hidden rounded-12 border border-border bg-card shadow-sm">
          <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="border-b border-border p-5 lg:border-b-0 lg:border-r">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Badge variant="success">AI Survey MVP ready</Badge>
                  <h2 className="mt-3 text-22 font-bold text-foreground">AI Survey Command Center</h2>
                  <p className="mt-2 max-w-2xl text-14 leading-6 text-muted-foreground">
                    从自然语言创建问卷，到 AI 优化、报告生成、模型失败切换和 PM/QA 验收，当前核心链路已接入。
                  </p>
                </div>
                <CheckCircle2 className="h-6 w-6 text-emerald-600" strokeWidth={1.5} />
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button data-testid="command-create-with-ai" size="sm" onClick={() => openEditor({ withAi: true })}>
                  <Sparkles className="h-4 w-4" strokeWidth={1.5} />
                  AI 创建问卷
                </Button>
                <Button data-testid="command-acceptance" size="sm" variant="outline" onClick={() => { window.location.href = "/surveys/acceptance"; }}>
                  <FileText className="h-4 w-4" strokeWidth={1.5} />
                  验收面板
                </Button>
              </div>
            </div>
            <div data-testid="ai-capability-grid" className="grid grid-cols-2 gap-0">
              {[
                ["AI 创建", "多轮澄清 + 结构化草稿"],
                ["AI 优化", "待确认变更 + 发布检查"],
                ["AI 报告", "生成 / 改写 / 导出"],
                ["审计恢复", "session / trace / evidence"],
              ].map(([label, desc]) => (
                <div key={label} className="border-b border-r border-border p-4 odd:border-l-0 even:border-r-0 last:border-b-0">
                  <p className="text-14 font-semibold text-foreground">{label}</p>
                  <p className="mt-1 text-12 leading-5 text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mb-6 rounded-12 border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-15 font-semibold text-foreground">从模板开始</p>
              <p className="mt-1 text-13 text-muted-foreground">像 Google Forms 一样先选结构，再进入编辑器微调问题。</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => openEditor()}>空白问卷</Button>
              <Button data-testid="template-create-with-ai" variant="outline" size="sm" onClick={() => openEditor({ withAi: true })}>
                Create with AI
              </Button>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Button
              variant="outline"
              onClick={() => openEditor()}
              className="h-auto flex-col items-start rounded-12 border border-border bg-background p-4 text-left transition-colors hover:border-primary"
            >
              <p className="text-14 font-semibold text-foreground">商品反馈问卷</p>
              <p className="mt-1 text-12 text-muted-foreground">体验、包装、价格、复购意愿</p>
            </Button>
            <Button
              variant="outline"
              onClick={() => openEditor()}
              className="h-auto flex-col items-start rounded-12 border border-border bg-background p-4 text-left transition-colors hover:border-primary"
            >
              <p className="text-14 font-semibold text-foreground">满意度调查</p>
              <p className="mt-1 text-12 text-muted-foreground">NPS、评分、开放反馈</p>
            </Button>
            <Button
              variant="outline"
              onClick={() => openEditor()}
              className="h-auto flex-col items-start rounded-12 border border-border bg-background p-4 text-left transition-colors hover:border-primary"
            >
              <p className="text-14 font-semibold text-foreground">活动报名表</p>
              <p className="mt-1 text-12 text-muted-foreground">信息收集、偏好、确认通知</p>
            </Button>
          </div>
        </section>

        <section data-testid="survey-operations-list" className="rounded-12 border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div data-testid="survey-workbench-tabs" className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Survey workbench">
            <Button
              data-testid="filter-my-surveys"
              size="sm"
              variant={workbenchTab === "my" ? "default" : "outline"}
              onClick={() => {
                setWorkbenchTab("my");
                setFilter("my");
              }}
            >
              <span data-testid="tab-my-surveys">我的问卷</span>
            </Button>
            <Button
              data-testid="filter-team-surveys"
              size="sm"
              variant={workbenchTab === "team" ? "default" : "outline"}
              onClick={() => {
                setWorkbenchTab("team");
                setFilter("team");
              }}
            >
              <span data-testid="tab-team-surveys">团队问卷</span>
            </Button>
            <Button
              data-testid="tab-survey-templates"
              size="sm"
              variant={workbenchTab === "templates" ? "default" : "outline"}
              onClick={() => setWorkbenchTab("templates")}
            >
              Templates
            </Button>
            <Button
              data-testid="tab-ai-create"
              size="sm"
              variant={workbenchTab === "ai" ? "default" : "outline"}
              onClick={() => setWorkbenchTab("ai")}
            >
              AI Create
            </Button>
          </div>
          <p className="text-13 text-muted-foreground">{surveys.length} 份问卷</p>
        </div>

        {error && (
          <p role="alert" data-testid="err-surveys" className="mt-4 text-13 text-destructive">
            {error}
          </p>
        )}

        <div className="mt-4">
          {loading ? (
            <SurveySkeleton />
          ) : workbenchTab === "templates" ? (
            <section data-testid="templates-workbench" className="rounded-12 border border-border bg-card p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-18 font-bold text-foreground">Survey Templates</h2>
                  <p className="mt-1 text-13 text-muted-foreground">按场景选择模板，再进入编辑器微调题目和报告框架。</p>
                </div>
                <Button data-testid="templates-workbench-create-with-ai" size="sm" variant="outline" onClick={() => openEditor({ withAi: true })}>
                  Create with AI
                </Button>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {templates.filter((template) => template.source === "built_in").map((template) => (
                  <Button
                    key={template.id}
                    data-testid={`workbench-template-${template.id}`}
                    type="button"
                    variant="outline"
                    onClick={() => {
                      openEditor();
                      applyTemplate(template);
                    }}
                    className="h-auto flex-col items-start rounded-12 p-4 text-left"
                  >
                    <span className="text-14 font-semibold text-foreground">{template.name}</span>
                    <span className="mt-1 text-12 text-muted-foreground">{template.description}</span>
                    <span className="mt-3 flex flex-wrap gap-1.5">
                      {template.category && <Badge variant="muted">{template.category}</Badge>}
                      <Badge variant="outline">{template.estimatedMinutes ?? 3} min</Badge>
                    </span>
                  </Button>
                ))}
              </div>
            </section>
          ) : workbenchTab === "ai" ? (
            <section data-testid="ai-create-workbench" className="rounded-12 border border-border bg-card p-6 shadow-sm">
              <div className="max-w-2xl">
                <Badge variant="success">AI Create</Badge>
                <h2 className="mt-3 text-22 font-bold text-foreground">从一句话或参考资料生成问卷</h2>
                <p className="mt-2 text-14 leading-6 text-muted-foreground">
                  描述调研目标、目标人群或直接粘贴来自其他 agent 的资料，AI 会生成可预览、可编辑、可绑定报告模板的问卷草稿。
                </p>
                <Button data-testid="ai-workbench-create" className="mt-4 gap-1.5" onClick={() => openEditor({ withAi: true })}>
                  <Sparkles className="h-4 w-4" strokeWidth={1.5} />
                  Create with AI
                </Button>
              </div>
            </section>
          ) : surveys.length === 0 && workbenchTab === "my" ? (
            <div
              data-testid="empty"
              className="flex flex-col items-center gap-3 rounded-12 border border-dashed border-border-strong bg-card px-6 py-15 text-center shadow-sm"
            >
              <p className="text-15 font-semibold text-foreground">No surveys yet</p>
              <p className="text-13 text-muted-foreground">
                还没有发布过的问卷。创建后可以在这里查看、编辑、分享和查看结果。
              </p>
              <Button data-testid="empty-new-survey" size="sm" onClick={() => openEditor()} className="mt-1 gap-1.5">
                <Plus className="h-4 w-4" strokeWidth={1.5} />
                创建问卷
              </Button>
              <Button data-testid="empty-create-with-ai" size="sm" variant="outline" onClick={() => openEditor({ withAi: true })} className="gap-1.5">
                <Sparkles className="h-4 w-4" strokeWidth={1.5} />
                Create with AI
              </Button>
            </div>
          ) : visibleSurveys.length === 0 ? (
            <div
              data-testid={workbenchTab === "team" ? "team-surveys-empty" : "empty-filter"}
              className="rounded-12 border border-dashed border-border-strong bg-card px-6 py-10 text-center"
            >
              <p className="text-13 text-muted-foreground">
                {workbenchTab === "my" ? "当前没有你创建的问卷。" : "当前没有团队问卷。"}
              </p>
            </div>
          ) : (
            <div data-testid="survey-list" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleSurveys.map((s) => (
                <article
                  key={s.id}
                  data-testid={`survey-${s.id}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${s.title}，双击编辑问卷`}
                  onDoubleClick={() => {
                    if (s.isOwner) void loadSurveyForEditor(s.id, "edit");
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && s.isOwner) void loadSurveyForEditor(s.id, "edit");
                  }}
                  className="group overflow-hidden rounded-12 border border-border bg-card shadow-sm outline-none transition-all duration-200 hover:-translate-y-0.5 hover:border-primary hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <div className="h-2 bg-primary" />
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <h2 data-testid={`survey-title-${s.id}`} className="truncate text-15 font-semibold text-foreground">
                          {s.title}
                        </h2>
                        {s.description && (
                          <p className="mt-1 line-clamp-2 text-12 text-muted-foreground">{s.description}</p>
                        )}
                      </div>
                      <Badge data-testid={`survey-status-${s.id}`} variant={s.status === "active" ? "success" : "muted"}>
                        {STATUS_LABEL[s.status]}
                      </Badge>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-secondary/50 p-3 text-12">
                      <div>
                        <p className="text-muted-foreground">范围</p>
                        <p data-testid={`survey-scope-${s.id}`} className="mt-1 font-medium text-foreground">
                          {s.scope === "team" ? "Team" : "Private"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">回答</p>
                        <p data-testid={`survey-responses-${s.id}`} className="mt-1 font-medium text-foreground">
                          {s.responses}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">更新</p>
                        <p data-testid={`survey-updated-${s.id}`} className="mt-1 font-medium text-foreground">
                          {formatUpdated(s.updatedAt)}
                        </p>
                      </div>
                    </div>
                    <p className="mt-4 border-t border-border pt-3 text-12 text-muted-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
                      双击卡片进入编辑
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
        </section>
      </div>
    </div>
  );
}
