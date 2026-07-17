"use client";
// apps/web/app/(app)/ava/page.tsx — AVA 助手聊天主流程（P9 F01：聊天壳 + 新建会话 +
// 发首条消息 + AI 流式回复）
//
// 主流程：线程列表 + 聊天区（user/assistant 气泡，assistant 支持 Markdown/代码块）+
// 空态建议 + composer。新建/进入会话 → 发送消息 → SSE 逐字流式渲染 AI 回复 →
// DB 持久化（ava_threads/ava_messages）。桌面端左右分栏常驻；移动端先列表，
// 选中线程或新建聊天后切到聊天视图（带返回入口）。
//
// OUT OF SCOPE（本 feature 不做，留给后续 F06/F07 等）：
// 分享只读、模型/Agent/工具切换、建议动作个性化、发送到 Board / 邮件。
// 线程重命名/删除（F02）、附件/图片/音频（F08）、消息编辑/删除/重新生成（F03）、
// 建议动作（F10）、Deep Research（F06）已在本文件实现。
//
// P9 F11（本文件新增）：assistant 消息下方操作条——复制（写剪贴板，代码块由
// markdown-message.tsx 内单独复制）、反馈（点赞/点踩，持久化）、重新生成（对最后一条
// assistant 回复重新请求，不丢原问题）。「发送到当前 Board」「发送邮件」跨能力依赖未就绪
// （分别依赖 p6 canvas 与邮件服务），本 feature 按 notes 要求先做禁用态占位，不接真实动作。
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  ArrowUp,
  Sparkles,
  ArrowLeft,
  Bot,
  Wrench,
  Share2,
  Copy,
  Mail,
  FileText,
  MoreHorizontal,
  Pencil,
  Trash2,
  Check,
  Users,
  X,
  CheckCircle2,
  Loader2,
  Search,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  LayoutGrid,
  Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BillingPlanDialog } from "@/components/billing/billing-plan-dialog";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { MarkdownMessage } from "./markdown-message";
import {
  useAvaAttachments,
  AttachmentTrigger,
  AttachmentPreviewStrip,
  RichAttachmentPreview,
} from "./attachments";
import { VoiceInputControl } from "@/components/voice-input";

interface ThreadSummary {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
}
interface MessageAttachment {
  id: string;
  name: string;
  kind: "image" | "audio" | "file";
  mime_type: string;
}
type MessageFeedbackRating = "up" | "down";
interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  status: "complete" | "failed";
  attachments?: MessageAttachment[];
  feedback?: MessageFeedbackRating | null;
}
interface ThreadShare {
  thread_id: number;
  share_token: string;
  share_enabled: boolean;
}
// p18 F11：发送到 Board 选择器候选项（只列有编辑权限的白板，字段取自 @repo/data Board）。
interface EditableBoard {
  id: number;
  name: string;
}
type ComposerMode = "chat" | "research" | "deep-agent";
// p18-F04：新增 'clarified' 中间态——draft（待确认澄清问题）→ clarified（待确认计划）→
// running（后端真实推进执行阶段）→ complete/error。两步确认缺一不可，不能从 draft
// 直接跳到 running。
type ResearchStatus = "idle" | "draft" | "clarified" | "running" | "complete" | "error";
interface ResearchPhase {
  name: string;
  tasks: string[];
}
interface ResearchTimelineItem {
  phase: string;
  task: string;
  status: "queued" | "running" | "complete";
}
// p18-F05：报告双模板。researchType 缺失（历史 F04 数据）时按 undefined 处理，
// ReportPanel 退化为原来的通用 sections 渲染，不因为字段缺失而崩溃。
type ResearchType = "market" | "user-research";
interface ResearchReport {
  researchType?: ResearchType;
  title: string;
  conclusion: string;
  sections: Array<{ heading: string; bullets: string[] }>;
  keyFindings?: string[];
  recommendation?: string;
  personas?: string[];
  topPainPoints?: string[];
  opportunities?: string[];
}
interface ResearchPayload {
  clarifyingQuestions: string[];
  plan: {
    audience: string;
    phases: ResearchPhase[];
  };
  timeline: ResearchTimelineItem[];
  report: ResearchReport;
}
interface ResearchRun {
  topic: string;
  audience: string;
  status: ResearchStatus;
  research?: ResearchPayload;
  error?: string;
  assistantMessage?: Message;
  timeline: ResearchTimelineItem[];
  // p18-F03：持久化会话 id。存在时，status/timeline 的每次变化都会 PATCH 回
  // ava_research_sessions，使刷新页面后 openThread() 能从 GET 恢复到同一阶段。
  sessionId?: number;
}

function keepThroughMessageId(messages: Message[], messageId: number): Message[] {
  const index = messages.findIndex((m) => m.id === messageId);
  return index === -1 ? messages : messages.slice(0, index + 1);
}
interface CapabilityOption {
  id: string;
  label: string;
  description: string;
  disabled?: boolean;
  disabledReason?: string;
  deepAgentEnabled?: boolean;
  storeId?: number;
}
interface AvaCapabilities {
  models: CapabilityOption[];
  agents: CapabilityOption[];
  tools: CapabilityOption[];
  teamId?: number | null;
  deepAgent?: {
    enabled: boolean;
    backendConfigured: boolean;
  };
  defaults: {
    modelId: string;
    agentId: string;
    toolIds: string[];
  };
}

interface SuggestedAction {
  id: string;
  label: string;
  prompt: string;
}

const EMPTY_SUGGESTED_ACTIONS: SuggestedAction[] = [
  { id: "understand-file", label: "理解文件", prompt: "帮我理解这份材料，并总结关键结论。" },
  { id: "draft-email", label: "起草邮件", prompt: "帮我起草一封项目进展同步邮件。" },
  { id: "summarize-trends", label: "总结趋势", prompt: "帮我总结最近用户反馈中的主要趋势。" },
  { id: "brainstorm", label: "头脑风暴", prompt: "围绕这个目标帮我头脑风暴 5 个可执行方案。" },
];

const RESEARCH_AUDIENCE = "Product leaders and user research stakeholders";

// p18-F14：研究类型显式选单（oldcode ResearchTypeSelector 迁移；本 feature 只迁
// deep_research/user_research 两项，web_research/deep_agent 不在范围内）。value 直接
// 复用 F05 报告模板的判别值（深度研究 → market / 用户研究 → user-research），UI 层
// 不再做一次枚举映射；选中的类型随 POST /research 显式下发，驱动对应报告模板。
const RESEARCH_TYPE_OPTIONS: Array<{
  value: ResearchType;
  label: string;
  description: string;
  icon: typeof Search;
}> = [
  {
    value: "market",
    label: "深度研究",
    description: "深入的市场与主题研究：Executive summary、Key findings、Recommendation。",
    icon: Search,
  },
  {
    value: "user-research",
    label: "用户研究",
    description: "以用户为中心的研究：Summary、Personas、Top pain points、Opportunities。",
    icon: Users,
  },
];

const FOLLOW_UP_SUGGESTED_ACTIONS: SuggestedAction[] = [
  { id: "make-tasks", label: "拆成任务", prompt: "把上面的建议拆成可执行任务，并按优先级排序。" },
  { id: "find-risks", label: "识别风险", prompt: "基于上面的回复，列出主要风险和缓解措施。" },
  { id: "shorten", label: "压缩摘要", prompt: "把上面的回复压缩成 5 条要点。" },
];

const THREAD_PAGE_SIZE = 20;
const INITIAL_AVA_MODEL_ID = process.env.NEXT_PUBLIC_AVA_DEFAULT_MODEL_ID || "qwen3.7-max";

function getLegacyBackendAuthHeader(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem("auth-token-data");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed?.token === "string" && parsed.token.trim()) {
        return `Bearer ${parsed.token.trim()}`;
      }
    }
    const loginToken = window.localStorage.getItem("loginToken");
    if (loginToken?.trim()) return `Bearer ${loginToken.trim()}`;
  } catch {
    // localStorage can be unavailable or contain older malformed auth state.
  }
  return undefined;
}

export default function AvaPage() {
  const router = useRouter();
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [hasMoreThreads, setHasMoreThreads] = useState(false);
  const [nextThreadCursor, setNextThreadCursor] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMoreThreads, setLoadingMoreThreads] = useState(false);
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [error, setError] = useState("");
  const [threadError, setThreadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [sendError, setSendError] = useState("");
  const [composerMode, setComposerMode] = useState<ComposerMode>("chat");
  // p18-F14：当前研究类型 + 类型选单开合。类型跨线程保持（对齐 oldcode 的
  // pendingResearchType 语义：用户选过 用户研究 后新开的研究默认沿用），
  // 打开历史线程时由该线程最近一次研究会话的 researchType 覆盖（刷新恢复保持类型）。
  const [researchType, setResearchType] = useState<ResearchType>("market");
  const [researchTypeMenuOpen, setResearchTypeMenuOpen] = useState(false);
  const [researchRun, setResearchRun] = useState<ResearchRun | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [billingOpen, setBillingOpen] = useState(false);
  const [capabilities, setCapabilities] = useState<AvaCapabilities | null>(null);
  const [settingsError, setSettingsError] = useState("");
  const [modelId, setModelId] = useState(INITIAL_AVA_MODEL_ID);
  const [agentId, setAgentId] = useState("default");
  const [toolIds, setToolIds] = useState<string[]>(["web-search"]);
  const [storeRecommendations, setStoreRecommendations] = useState<Array<{ id: number; name: string; description: string }>>([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [share, setShare] = useState<ThreadShare | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  // p18 F08：邮件发送提示独立于「复制链接」的提示（share-email-status / err-share-email）。
  const [emailStatus, setEmailStatus] = useState("");
  const [emailError, setEmailError] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [editError, setEditError] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [msgCopiedId, setMsgCopiedId] = useState<number | null>(null);
  const [msgCopyError, setMsgCopyError] = useState<number | null>(null);
  const [feedbackPendingId, setFeedbackPendingId] = useState<number | null>(null);
  const [feedbackErrorId, setFeedbackErrorId] = useState<number | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<number | null>(null);
  const [regenerateErrorId, setRegenerateErrorId] = useState<number | null>(null);
  // p18 F11：发送到 Board——选择器打开状态 + 候选白板（懒加载）+ 每条消息独立的成功/错误提示。
  const [boardPickerForMessageId, setBoardPickerForMessageId] = useState<number | null>(null);
  const [editableBoards, setEditableBoards] = useState<EditableBoard[] | null>(null);
  const [boardsLoading, setBoardsLoading] = useState(false);
  const [boardsLoadError, setBoardsLoadError] = useState(false);
  const [sendBoardPendingId, setSendBoardPendingId] = useState<number | null>(null);
  const [sendBoardStatusId, setSendBoardStatusId] = useState<number | null>(null);
  const [sendBoardStatusText, setSendBoardStatusText] = useState("");
  const [sendBoardErrorId, setSendBoardErrorId] = useState<number | null>(null);
  const [sendBoardErrorText, setSendBoardErrorText] = useState("");
  // p18 F11：发送邮件——每条消息独立的 pending/成功/失败（含频控命中）状态。
  const [sendEmailPendingId, setSendEmailPendingId] = useState<number | null>(null);
  const [sendEmailStatusId, setSendEmailStatusId] = useState<number | null>(null);
  const [sendEmailStatusText, setSendEmailStatusText] = useState("");
  const [sendEmailErrorId, setSendEmailErrorId] = useState<number | null>(null);
  const [sendEmailErrorText, setSendEmailErrorText] = useState("");
  const [menuThreadId, setMenuThreadId] = useState<number | null>(null);
  // p18-F13：composer 底部「# Skill」pill 弹出的技能/工具选单（迁移自 oldcode
  // AIToolSelector 的弹层形态：条目 = 名称 + 描述 + 选中勾）。
  const [skillMenuOpen, setSkillMenuOpen] = useState(false);
  const [editingThreadId, setEditingThreadId] = useState<number | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  // 移动端视图切换：list-first。桌面端（md 及以上）始终双栏，此状态被 CSS 忽略。
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const [dragOver, setDragOver] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeReport = researchRun?.research?.report;
  const isResearchMode = composerMode === "research";
  const isDeepAgentMode = composerMode === "deep-agent";
  const composerPlaceholder = isResearchMode
    ? "Describe the research topic, audience, and decision…"
    : isDeepAgentMode
      ? "Ask Deep Agent to plan, use tools, and synthesize a result…"
    : "Message AVA…";
  const canSend = Boolean(draft.trim()) && !sending && researchRun?.status !== "running";
  const researchStatusLabel = useMemo(() => {
    if (!researchRun) return "";
    if (researchRun.status === "draft") return "Clarify to continue";
    if (researchRun.status === "clarified") return "Plan ready for review";
    if (researchRun.status === "running") return "Research running";
    if (researchRun.status === "complete") return "Report ready";
    if (researchRun.status === "error") return "Needs attention";
    return "";
  }, [researchRun]);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const settingsInitializedRef = useRef(false);
  // P18 F02：停止生成用的 AbortController，跨真实/stub provider 通用。
  // 只在一次流式请求生命周期内存在；stop() 触发后 fetch 的底层 TCP 连接被真实中断
  // （服务端 request signal abort → reply-stream 的 for-await 循环停止 → 不再写入消息）。
  const streamAbortRef = useRef<AbortController | null>(null);

  const attachments = useAvaAttachments({
    threadId: activeId,
    ensureThread: () => ensureThread(),
  });

  const guard = useCallback(
    (status: number) => {
      if (status === 401) {
        router.replace("/login");
        return true;
      }
      return false;
    },
    [router]
  );

  const refreshThreads = useCallback(async () => {
    setThreadError("");
    const res = await fetch(`/api/ava/threads?limit=${THREAD_PAGE_SIZE}`);
    if (guard(res.status)) return;
    if (!res.ok) throw new Error("加载失败");
    const data = await res.json();
    setThreads(data.threads ?? []);
    setHasMoreThreads(Boolean(data.hasMore));
    setNextThreadCursor(data.nextCursor ?? null);
  }, [guard]);

  const refreshCapabilities = useCallback(async () => {
    const res = await fetch("/api/ava/capabilities");
    if (guard(res.status)) return;
    if (!res.ok) throw new Error("加载能力失败");
    const data = (await res.json()) as AvaCapabilities;
    setCapabilities(data);
    setModelId((prev) => {
      if (!settingsInitializedRef.current) {
        settingsInitializedRef.current = true;
        return data.defaults.modelId;
      }
      return data.models.some((m) => m.id === prev && !m.disabled) ? prev : data.defaults.modelId;
    });
    setAgentId((prev) => (data.agents.some((a) => a.id === prev) ? prev : data.defaults.agentId));
    setToolIds((prev) => {
      const allowed = new Set(data.tools.map((tool) => tool.id));
      const next = prev.filter((tool) => allowed.has(tool));
      return next.length > 0 ? next : data.defaults.toolIds;
    });
  }, [guard]);

  const loadMoreThreads = useCallback(async () => {
    if (!hasMoreThreads || !nextThreadCursor || loadingMoreThreads) return;
    setLoadingMoreThreads(true);
    setThreadError("");
    try {
      const res = await fetch(
        `/api/ava/threads?limit=${THREAD_PAGE_SIZE}&cursor=${encodeURIComponent(nextThreadCursor)}`
      );
      if (guard(res.status)) return;
      if (!res.ok) throw new Error("加载失败");
      const data = await res.json();
      setThreads((prev) => [...prev, ...(data.threads ?? [])]);
      setHasMoreThreads(Boolean(data.hasMore));
      setNextThreadCursor(data.nextCursor ?? null);
    } catch {
      setThreadError("Failed to load more conversations — please try again");
    } finally {
      setLoadingMoreThreads(false);
    }
  }, [guard, hasMoreThreads, loadingMoreThreads, nextThreadCursor]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      setSettingsError("");
      try {
        await Promise.all([refreshThreads(), refreshCapabilities()]);
      } catch {
        if (!cancelled) {
          setThreadError("Failed to load conversations — please try again later");
          setSettingsError("Failed to load AI settings — please try again later");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // uc-ai-store-003：AI Store「使用 Agent / 使用 AI Tool」入口——带 agentItemId/toolItemId
  // 查询参数进入 /ava 时，把该 Store 项目的名称/描述预填进 composer 草稿，用户确认后发送即
  // 带着该资源上下文开启新会话（新建线程 + 首条消息里显式带入资源信息）。
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const agentItemId = params.get("agentItemId");
    const toolItemId = params.get("toolItemId");
    const itemId = agentItemId ?? toolItemId;
    if (!itemId) return;
    const kind = agentItemId ? "agent" : "tool";
    if (!capabilities) return;
    (async () => {
      try {
        const res = await fetch(`/api/ai-store/items/${itemId}/use`, { method: "POST" });
        if (!res.ok) return;
        const data = await res.json();
        const name: string = data.item?.name ?? "";
        if (!name) return;
        if (agentItemId) setAgentId(`store-${agentItemId}`);
        if (toolItemId) setToolIds([`store-skill-${toolItemId}`]);
        setDraft(
          kind === "agent"
            ? `Use the "${name}" agent to help me: `
            : `Use the "${name}" tool on: `
        );
        setMobileView("chat");
        composerRef.current?.focus();
      } catch {
        // 静默失败：composer 保持空白，不阻塞用户手动开始新会话。
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capabilities]);

  useEffect(() => {
    const onFocus = () => {
      void refreshCapabilities().catch(() => setSettingsError("Failed to refresh AI settings — kept current selection"));
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshCapabilities]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, streamingText, sending]);

  async function openThread(id: number) {
    setActiveId(id);
    setSendError("");
    setShareOpen(false);
    setShare(null);
    setShareError("");
    setCopyStatus("");
    setEmailStatus("");
    setEmailError("");
    setEditingId(null);
    setDeleteConfirmId(null);
    setActionError("");
    setMenuThreadId(null);
    setEditingThreadId(null);
    setSkillMenuOpen(false);
    setResearchTypeMenuOpen(false);
    setMessages([]);
    setResearchRun(null);
    setReportOpen(false);
    setMobileView("chat");
    setMsgCopiedId(null);
    setMsgCopyError(null);
    setFeedbackErrorId(null);
    setRegeneratingId(null);
    setRegenerateErrorId(null);
    attachments.reset();
    try {
      const res = await fetch(`/api/ava/threads/${id}`);
      if (guard(res.status)) return;
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMessages(data.messages ?? []);
      // p18-F03：恢复最近一次研究会话，让 research-card 回到中断前的阶段与内容
      // （而不是刷新后消失/从头开始）。assistantMessage 留空——已完成的研究其报告
      // 通知消息已经在上面 listAvaMessages 里，不需要再次推入。
      try {
        const researchRes = await fetch(`/api/ava/threads/${id}/research`);
        if (researchRes.ok) {
          const researchData = await researchRes.json();
          const session = researchData.session;
          if (session) {
            setResearchRun({
              topic: session.topic,
              audience: session.audience,
              status: session.status,
              research: session.research_payload ?? undefined,
              error: session.error ?? undefined,
              timeline: session.timeline ?? [],
              sessionId: session.id,
            });
            // p18-F14：刷新恢复后类型保持——research_payload 的 report.researchType
            // 随 F03 持久化回流（不需要新增列），用它恢复研究类型 pill 的选中态；
            // 历史会话（F04 时期、无此字段）不覆盖当前选择。
            const restoredType = session.research_payload?.report?.researchType;
            if (restoredType === "market" || restoredType === "user-research") {
              setResearchType(restoredType);
            }
          }
        }
      } catch {
        // 研究恢复失败不阻塞聊天历史加载；用户仍能正常收发消息，只是看不到旧研究卡片。
      }
    } catch {
      setSendError("Failed to load messages — please try again later");
    }
  }

  function newChat() {
    setActiveId(null);
    setMessages([]);
    setSendError("");
    setShareOpen(false);
    setShare(null);
    setShareError("");
    setCopyStatus("");
    setEmailStatus("");
    setEmailError("");
    setEditingId(null);
    setDeleteConfirmId(null);
    setActionError("");
    setMenuThreadId(null);
    setEditingThreadId(null);
    setSkillMenuOpen(false);
    setResearchTypeMenuOpen(false);
    setDraft("");
    setResearchRun(null);
    setReportOpen(false);
    if (capabilities) {
      setModelId(capabilities.defaults.modelId);
      setAgentId(capabilities.defaults.agentId);
      setToolIds(capabilities.defaults.toolIds);
    }
    setMobileView("chat");
    setMsgCopiedId(null);
    setMsgCopyError(null);
    setFeedbackErrorId(null);
    setRegeneratingId(null);
    setRegenerateErrorId(null);
    attachments.reset();
    // 已在空态时点击 New chat 原本毫无可见变化（线程要到首条消息才创建），
    // 用户会以为按钮坏了；聚焦 composer 让点击始终有可感知的反馈。
    // rAF：移动端 chat 面板要等本次 setMobileView 重渲染后才可见/可聚焦。
    requestAnimationFrame(() => composerRef.current?.focus());
  }

  function startRename(thread: ThreadSummary) {
    setMenuThreadId(null);
    setEditingThreadId(thread.id);
    setRenameDraft(thread.title);
    setActionError("");
  }

  async function saveRename(threadId: number) {
    const title = renameDraft.trim().replace(/\s+/g, " ");
    if (!title) {
      setActionError("Title can't be empty");
      return;
    }
    try {
      const res = await fetch(`/api/ava/threads/${threadId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (guard(res.status)) return;
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError(data?.errors?.title ?? data?.error ?? "Rename failed — please try again");
        return;
      }
      setThreads((prev) => prev.map((t) => (t.id === threadId ? data.thread : t)));
      setEditingThreadId(null);
      setRenameDraft("");
      setActionError("");
    } catch {
      setActionError("Rename failed — please try again");
    }
  }

  async function deleteThread(threadId: number) {
    setMenuThreadId(null);
    setEditingThreadId(null);
    setActionError("");
    try {
      const res = await fetch(`/api/ava/threads/${threadId}`, { method: "DELETE" });
      if (guard(res.status)) return;
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setActionError(data?.error ?? "Delete failed — please try again");
        return;
      }
      setThreads((prev) => prev.filter((t) => t.id !== threadId));
      if (activeId === threadId) {
        setActiveId(null);
        setMessages([]);
        setDraft("");
        setSendError("");
        setMobileView("chat");
      }
    } catch {
      setActionError("Delete failed — please try again");
    }
  }

  async function ensureThread(): Promise<number | null> {
    if (activeId != null) return activeId;
    const res = await fetch("/api/ava/threads", { method: "POST" });
    if (guard(res.status)) return null;
    if (!res.ok) throw new Error("创建线程失败");
    const data = await res.json();
    const id: number = data.thread.id;
    setActiveId(id);
    return id;
  }

  async function send() {
    if (composerMode === "research") {
      await startResearch();
      return;
    }
    if (composerMode === "deep-agent") {
      await sendDeepAgent();
      return;
    }
    const text = draft.trim();
    const attachmentIds = attachments.uploadedIds;
    // 文本和附件至少要有一个；上传中/失败的附件会阻塞发送，避免半上传附件随消息发出
    // （失败态附件不阻塞——用户可以移除它继续发送纯文本，只有 uploading 阻塞）。
    if ((!text && attachmentIds.length === 0) || sending || attachments.hasPending) return;
    setSending(true);
    setSendError("");
    setStreamingText("");
    const abortController = new AbortController();
    streamAbortRef.current = abortController;

    try {
      const threadId = await ensureThread();
      if (threadId == null) return; // guard 已处理未登录跳转

      const res = await fetch(`/api/ava/threads/${threadId}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, attachmentIds, modelId, agentId, toolIds }),
        signal: abortController.signal,
      });
      if (guard(res.status)) return;
      if (!res.ok || !res.body) {
        const errBody = await res.json().catch(() => ({}));
        if (errBody?.errors?.text) {
          setSendError(errBody.errors.text);
        } else {
          setSendError("Send failed — please try again (your input is preserved)");
        }
        return;
      }

      setDraft(""); // 请求已受理（用户消息即将持久化），清空草稿；失败态由下面 SSE error 分支处理
      attachments.reset(); // 附件已随消息发出，清空 composer 预览条
      await consumeSse(res.body, {
        onUser: (msg: Message, msgAttachments?: MessageAttachment[]) => {
          setMessages((prev) => [...prev, { ...msg, attachments: msgAttachments }]);
        },
        onToken: (token: string) => {
          setStreamingText((prev) => prev + token);
        },
        onDone: (msg: Message) => {
          setMessages((prev) => [...prev, msg]);
          setStreamingText("");
          const storeSkill = toolIds.find((id) => id.startsWith("store-skill-"));
          if (storeSkill) {
            const skillId = storeSkill.slice("store-skill-".length);
            void fetch(`/api/ai-store/items/${skillId}/recommendations`)
              .then((response) => response.ok ? response.json() : { items: [] })
              .then((data) => setStoreRecommendations(data.items ?? []))
              .catch(() => setStoreRecommendations([]));
          } else {
            setStoreRecommendations([]);
          }
        },
        onError: (msg: Message) => {
          setMessages((prev) => [...prev, msg]);
          setStreamingText("");
          setSendError("AVA failed to generate a reply — please try again.");
        },
      });
      await refreshThreads();
    } catch (err) {
      // 用户主动点击停止会走这里（fetch 因 AbortController.abort() 抛 AbortError）——
      // 这是预期行为，不展示失败提示。客户端一旦 abort，这条连接就收不到服务端后续任何
      // SSE 事件了（包括服务端为了落库而尝试发送的 done/error），所以已经流出来的部分
      // 内容（streamingText）要在这里就地落定成一条 assistant 消息，不能指望服务端回包。
      // 服务端那边（reply-stream.ts）会独立把同样的部分内容持久化到数据库，reload 后一致。
      if (err instanceof DOMException && err.name === "AbortError") {
        setStreamingText((current) => {
          setMessages((prev) => {
            // 客户端临时负数 id：仅用于本地渲染，reload 后会被服务端持久化的真实记录替换。
            // 用现有消息里最小的 id 再减一，避免同一渲染帧内两次停止生成时 id 撞车。
            const minId = prev.reduce((min, m) => Math.min(min, m.id), 0);
            return [
              ...prev,
              {
                id: minId - 1,
                role: "assistant",
                content: current,
                status: "complete",
              },
            ];
          });
          return "";
        });
      } else {
        setSendError("Send failed — please try again (your input is preserved)");
      }
    } finally {
      setSending(false);
      streamAbortRef.current = null;
    }
  }

  async function sendDeepAgent() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setSendError("");
    setStreamingText("");
    setReportOpen(false);
    setResearchTypeMenuOpen(false);
    const abortController = new AbortController();
    streamAbortRef.current = abortController;

    try {
      const threadId = await ensureThread();
      if (threadId == null) return;

      const res = await fetch("/api/v1/deep-agent/execute", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "text/event-stream",
          "X-Chat-Thread-Id": String(threadId),
          ...(getLegacyBackendAuthHeader() ? { Authorization: getLegacyBackendAuthHeader()! } : {}),
        },
        body: JSON.stringify({
          input: text,
          chatId: String(threadId),
          chatThreadId: String(threadId),
          teamId: capabilities?.teamId == null ? "" : String(capabilities.teamId),
          userId: "current",
          model: modelId,
          storeId: activeAgent?.storeId ? String(activeAgent.storeId) : undefined,
          executionMode: "tool-auto",
          toolScope: activeAgent?.storeId ? "agent" : "global",
          responseFormat: "markdown",
        }),
        signal: abortController.signal,
      });
      if (guard(res.status)) return;
      if (!res.ok || !res.body) {
        const errBody = await res.json().catch(() => ({}));
        setSendError(errBody?.error ?? "Deep Agent failed to start — please try again");
        return;
      }

      setDraft("");
      await consumeSse(res.body, {
        onUser: (msg: Message, msgAttachments?: MessageAttachment[]) => {
          setMessages((prev) => [...prev, { ...msg, attachments: msgAttachments }]);
        },
        onToken: (token: string) => {
          setStreamingText((prev) => prev + token);
        },
        onDone: (msg: Message) => {
          setMessages((prev) => [...prev, msg]);
          setStreamingText("");
        },
        onError: (msg: Message) => {
          setMessages((prev) => [...prev, msg]);
          setStreamingText("");
          setSendError("Deep Agent failed — please try again.");
        },
      });
      await refreshThreads();
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setSendError("Deep Agent failed — please try again (your input is preserved)");
      }
    } finally {
      setSending(false);
      streamAbortRef.current = null;
    }
  }

  /** P18 F02：停止生成。真实中断底层请求（AbortController.abort()），
   *  而不是等待流式回显完成后再忽略结果。 */
  function stop() {
    streamAbortRef.current?.abort();
  }

  async function startResearch() {
    const topic = draft.trim();
    if (!topic || sending) return;
    setSending(true);
    setSendError("");
    setStreamingText("");
    setReportOpen(false);
    setResearchRun({
      topic,
      audience: RESEARCH_AUDIENCE,
      status: "idle",
      timeline: [],
    });

    try {
      const threadId = await ensureThread();
      if (threadId == null) return;

      const res = await fetch(`/api/ava/threads/${threadId}/research`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        // p18-F04：带上当前选中的 modelId，研究生成与聊天走同一套模型设置
        // （真实 provider 或 stub），不再是与模型选择无关的固定文案。
        // p18-F14：显式带上用户选中的研究类型（深度研究 → market / 用户研究 →
        // user-research），报告模板由用户选择驱动，不再靠主题关键词推断。
        body: JSON.stringify({ topic, audience: RESEARCH_AUDIENCE, modelId, researchType }),
      });
      if (guard(res.status)) return;
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = String(data?.error ?? "研究任务启动失败，请重试（你的主题已保留）");
        setSendError(message);
        setResearchRun({
          topic,
          audience: RESEARCH_AUDIENCE,
          status: "error",
          error: message,
          timeline: [],
        });
        return;
      }

      setDraft("");
      setMessages((prev) => [...prev, data.messages.user]);
      setResearchRun({
        topic,
        audience: RESEARCH_AUDIENCE,
        // p18-F04：新会话总是从 'draft' 开始——只展示澄清问题待确认，计划/执行都还
        // 没开始，两步确认必须依次显式完成（见 confirmResearchClarify/confirmResearchPlan）。
        status: "draft",
        research: data.research,
        assistantMessage: data.messages.assistant,
        // 服务端已经把 draft 阶段的 timeline 计算好并落库（data.session.timeline，此时
        // 全部 queued——执行尚未开始），前端直接采用同一份而不是自己重算。
        timeline: data.session?.timeline ?? data.research.timeline,
        sessionId: data.session?.id,
      });
      await refreshThreads();
    } catch {
      const message = "研究任务启动失败，请重试（你的主题已保留）";
      setSendError(message);
      setResearchRun({
        topic,
        audience: RESEARCH_AUDIENCE,
        status: "error",
        error: message,
        timeline: [],
      });
    } finally {
      setSending(false);
    }
  }

  function startEdit(message: Message) {
    setEditingId(message.id);
    setEditText(message.content);
    setEditError("");
    setDeleteConfirmId(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditText("");
    setEditError("");
  }

  async function saveEdit(messageId: number) {
    const text = editText.trim();
    if (!text) {
      setEditError("消息不能为空");
      return;
    }
    if (activeId == null || sending) return;

    setSending(true);
    setSendError("");
    setEditError("");
    setStreamingText("");

    try {
      const res = await fetch(`/api/ava/threads/${activeId}/messages/${messageId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (guard(res.status)) return;
      if (!res.ok || !res.body) {
        const errBody = await res.json().catch(() => ({}));
        setEditError(errBody?.errors?.text ?? errBody?.error ?? "Save failed — please try again");
        return;
      }

      setMessages((prev) =>
        keepThroughMessageId(
          prev.map((m) => (m.id === messageId ? { ...m, content: text, status: "complete" } : m)),
          messageId
        )
      );
      setEditingId(null);
      setEditText("");
      await consumeSse(res.body, {
        onUser: () => {},
        onUpdated: (msg: Message) => {
          setMessages((prev) =>
            keepThroughMessageId(
              prev.map((m) => (m.id === msg.id ? msg : m)),
              msg.id
            )
          );
        },
        onToken: (token: string) => {
          setStreamingText((prev) => prev + token);
        },
        onDone: (msg: Message) => {
          setMessages((prev) => [...prev, msg]);
          setStreamingText("");
        },
        onError: (msg: Message) => {
          setMessages((prev) => [...prev, msg]);
          setStreamingText("");
          setSendError("AVA failed to generate a reply — please try again.");
        },
      });
      await refreshThreads();
    } catch {
      setEditError("Save failed — please try again");
    } finally {
      setSending(false);
    }
  }

  // p18-F04：两步确认 + 后端真实阶段进度都通过这一个动作化 PATCH 端点，服务端校验
  // 当前 status 是否允许该 action、并计算下一个 timeline 快照——前端不再自己维护一份
  // 并行的定时器状态机，只负责把服务端返回的 session 渲染出来。
  async function callResearchAction(
    sessionId: number | undefined,
    action: "confirm-clarify" | "confirm-plan" | "advance"
  ): Promise<{ session: { status: ResearchStatus; timeline: ResearchTimelineItem[] }; done?: boolean } | null> {
    if (activeId == null || sessionId == null) return null;
    try {
      const res = await fetch(`/api/ava/threads/${activeId}/research/${sessionId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  /** 第一步确认：确认澄清问题。draft → clarified，计划从此才可确认——
   *  不允许从提交主题直接跳到能确认计划/进入执行。 */
  async function confirmResearchClarify() {
    if (!researchRun?.research || researchRun.status !== "draft") return;
    const sessionId = researchRun.sessionId;
    const result = await callResearchAction(sessionId, "confirm-clarify");
    const nextStatus = result?.session.status ?? "clarified";
    setResearchRun((current) => (current ? { ...current, status: nextStatus } : current));
  }

  /** 第二步确认：确认研究计划。clarified → running，服务端把 timeline 首阶段置为
   *  running、其余 queued 并返回；随后用 advanceResearch 轮询式地真实推进各阶段
   *  （每次调用都是一次服务端计算 + 持久化，不是前端凭空猜测下一步该显示什么）。 */
  async function confirmResearchPlan() {
    if (!researchRun?.research || researchRun.status !== "clarified") return;
    const sessionId = researchRun.sessionId;
    const assistantMessage = researchRun.assistantMessage;
    const result = await callResearchAction(sessionId, "confirm-plan");
    if (!result?.session) return;
    const session = result.session;
    setResearchRun((current) =>
      current ? { ...current, status: session.status, timeline: session.timeline } : current
    );

    // 逐阶段真实推进：每一步都调用后端 advance（服务端计算 + 持久化下一个 timeline
    // 快照），前端只按节奏发起调用、渲染返回结果——不是自己算好整段动画再回放。
    const stageCount = session.timeline.length;
    for (let i = 0; i < stageCount; i += 1) {
      // 给用户一个可感知的推进节奏（每阶段之间留出可见间隔），但推进内容本身来自
      // 服务端下一次调用的返回值，不是这个延时算出来的。
      await new Promise((resolve) => window.setTimeout(resolve, 350));
      const advanceResult = await callResearchAction(sessionId, "advance");
      if (!advanceResult?.session) break;
      const advanced = advanceResult.session;
      const isDone = Boolean(advanceResult.done);
      setResearchRun((current) => {
        if (!current?.research) return current;
        if (isDone) {
          const nextMessages = assistantMessage ? [assistantMessage] : [];
          setMessages((prev) => [...prev, ...nextMessages]);
          setReportOpen(true);
        }
        return { ...current, status: advanced.status, timeline: advanced.timeline };
      });
      if (isDone) break;
    }
  }

  async function deleteLastRequest(messageId: number) {
    if (activeId == null || deletingId != null) return;
    setDeletingId(messageId);
    setSendError("");
    setEditError("");

    try {
      const res = await fetch(`/api/ava/threads/${activeId}/messages/${messageId}`, {
        method: "DELETE",
      });
      if (guard(res.status)) return;
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        setSendError(errBody?.error ?? "Delete failed — please try again");
        return;
      }
      setMessages((prev) => {
        const index = prev.findIndex((m) => m.id === messageId);
        return index === -1 ? prev : prev.slice(0, index);
      });
      setDeleteConfirmId(null);
      setEditingId(null);
      await refreshThreads();
    } catch {
      setSendError("Delete failed — please try again");
    } finally {
      setDeletingId(null);
    }
  }

  // ─── P9 F11：消息结果操作（复制/反馈/重新生成）──────────────────────────

  async function copyMessage(message: Message) {
    setMsgCopyError(null);
    try {
      if (!navigator.clipboard) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(message.content);
      setMsgCopiedId(message.id);
      setTimeout(() => setMsgCopiedId((prev) => (prev === message.id ? null : prev)), 1500);
    } catch {
      // 剪贴板不可用（权限被拒/非安全上下文）：提示手动复制，原消息保持不变。
      setMsgCopyError(message.id);
      setTimeout(() => setMsgCopyError((prev) => (prev === message.id ? null : prev)), 3000);
    }
  }

  async function submitFeedback(message: Message, rating: MessageFeedbackRating) {
    if (activeId == null || feedbackPendingId != null) return;
    setFeedbackPendingId(message.id);
    setFeedbackErrorId(null);
    const previous = message.feedback ?? null;
    // 乐观更新；失败时回滚，原消息始终保持可见。
    setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, feedback: rating } : m)));
    try {
      const res = await fetch(`/api/ava/threads/${activeId}/messages/${message.id}/feedback`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rating }),
      });
      if (guard(res.status)) return;
      if (!res.ok) throw new Error();
    } catch {
      setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, feedback: previous } : m)));
      setFeedbackErrorId(message.id);
      setTimeout(() => setFeedbackErrorId((prev) => (prev === message.id ? null : prev)), 3000);
    } finally {
      setFeedbackPendingId(null);
    }
  }

  async function regenerateReply(message: Message) {
    if (activeId == null || sending || regeneratingId != null) return;
    setRegeneratingId(message.id);
    setRegenerateErrorId(null);
    setSendError("");
    setStreamingText("");

    try {
      const res = await fetch(
        `/api/ava/threads/${activeId}/messages/${message.id}/regenerate`,
        { method: "POST" }
      );
      if (guard(res.status)) return;
      if (!res.ok || !res.body) {
        setRegenerateErrorId(message.id);
        return;
      }

      // 重新生成中：从消息列表移除旧回复，展示"生成中"，原问题（前一条 user 消息）不受影响。
      setMessages((prev) => prev.filter((m) => m.id !== message.id));
      await consumeSse(res.body, {
        onUser: () => {},
        onToken: (token: string) => setStreamingText((prev) => prev + token),
        onDone: (msg: Message) => {
          setMessages((prev) => [...prev, msg]);
          setStreamingText("");
        },
        onError: (msg: Message) => {
          setMessages((prev) => [...prev, msg]);
          setStreamingText("");
          setSendError("AVA failed to generate a reply — please try again.");
        },
      });
      await refreshThreads();
    } catch {
      setRegenerateErrorId(message.id);
    } finally {
      setRegeneratingId(null);
    }
  }

  function onComposerKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  function shareUrl(nextShare = share): string {
    if (!activeId || !nextShare?.share_enabled) return "";
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/chatShare/${activeId}?shareToken=${encodeURIComponent(nextShare.share_token)}`;
  }

  async function loadShare() {
    if (!activeId) return;
    setShareLoading(true);
    setShareError("");
    try {
      const res = await fetch(`/api/ava/threads/${activeId}/share`);
      if (guard(res.status)) return;
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { share: ThreadShare | null };
      setShare(data.share);
    } catch {
      setShareError("加载分享状态失败，请重试");
    } finally {
      setShareLoading(false);
    }
  }

  async function toggleSharePanel() {
    const nextOpen = !shareOpen;
    setShareOpen(nextOpen);
    setShareError("");
    setCopyStatus("");
    setEmailStatus("");
    setEmailError("");
    if (nextOpen && activeId) await loadShare();
  }

  async function enableShareAndCopy() {
    if (!activeId) return;
    setShareLoading(true);
    setShareError("");
    setCopyStatus("");
    try {
      const res = await fetch(`/api/ava/threads/${activeId}/share`, { method: "POST" });
      if (guard(res.status)) return;
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { share: ThreadShare };
      setShare(data.share);
      const url = shareUrl(data.share);
      await navigator.clipboard.writeText(url);
      setCopyStatus("已复制分享链接");
    } catch {
      setShareError("生成或复制分享链接失败，请重试");
    } finally {
      setShareLoading(false);
    }
  }

  async function copyShareLink() {
    const url = shareUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopyStatus("已复制分享链接");
      setShareError("");
    } catch {
      setShareError("复制失败，请手动复制链接");
    }
  }

  async function disableShare() {
    if (!activeId) return;
    setShareLoading(true);
    setShareError("");
    setCopyStatus("");
    try {
      const res = await fetch(`/api/ava/threads/${activeId}/share`, { method: "DELETE" });
      if (guard(res.status)) return;
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { share: ThreadShare | null };
      setShare(data.share);
      setCopyStatus("分享已关闭，原链接已失效");
    } catch {
      setShareError("关闭分享失败，请重试");
    } finally {
      setShareLoading(false);
    }
  }

  // p18 F08：分享聊天「发送到我的邮箱」。未开启分享时后端自动生成链接再发送。
  async function sendShareEmail() {
    if (!activeId) return;
    setEmailSending(true);
    setEmailStatus("");
    setEmailError("");
    try {
      const res = await fetch(`/api/ava/threads/${activeId}/share/email`, { method: "POST" });
      if (guard(res.status)) return;
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { ok: boolean; to: string; share: ThreadShare };
      setShare(data.share);
      setEmailStatus(`分享链接已发送到 ${data.to}`);
    } catch {
      setEmailError("发送邮件失败，请重试");
    } finally {
      setEmailSending(false);
    }
  }

  // p18 F11：打开/关闭「发送到 Board」选择器；打开时懒加载有编辑权限的白板列表。
  async function toggleBoardPicker(message: Message) {
    const opening = boardPickerForMessageId !== message.id;
    setBoardPickerForMessageId(opening ? message.id : null);
    setSendBoardErrorId(null);
    if (opening && editableBoards === null) {
      setBoardsLoading(true);
      setBoardsLoadError(false);
      try {
        const res = await fetch("/api/boards?scope=editable");
        if (guard(res.status)) return;
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { boards: EditableBoard[] };
        setEditableBoards(data.boards);
      } catch {
        setBoardsLoadError(true);
      } finally {
        setBoardsLoading(false);
      }
    }
  }

  // p18 F11：发送到 Board——把该条 AI 消息内容写入选中白板的一个便利贴 item。
  async function sendMessageToBoard(message: Message, boardId: number) {
    if (activeId == null || sendBoardPendingId != null) return;
    setSendBoardPendingId(message.id);
    setSendBoardErrorId(null);
    try {
      const res = await fetch(
        `/api/ava/threads/${activeId}/messages/${message.id}/send-to-board`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ boardId }),
        }
      );
      if (guard(res.status)) return;
      if (res.status === 403) {
        setSendBoardErrorId(message.id);
        setSendBoardErrorText("无编辑权限，无法发送到该白板");
        return;
      }
      if (!res.ok) throw new Error();
      const board = editableBoards?.find((b) => b.id === boardId);
      setSendBoardStatusId(message.id);
      setSendBoardStatusText(`已发送到「${board?.name ?? "Board"}」`);
      setBoardPickerForMessageId(null);
      setTimeout(() => setSendBoardStatusId((prev) => (prev === message.id ? null : prev)), 3000);
    } catch {
      setSendBoardErrorId(message.id);
      setSendBoardErrorText("发送到 Board 失败，请重试");
    } finally {
      setSendBoardPendingId(null);
    }
  }

  // p18 F11：发送邮件——把该条 AI 消息内容发到当前用户邮箱。频控命中时展示独立提示。
  async function sendMessageEmail(message: Message) {
    if (activeId == null || sendEmailPendingId != null) return;
    setSendEmailPendingId(message.id);
    setSendEmailErrorId(null);
    try {
      const res = await fetch(
        `/api/ava/threads/${activeId}/messages/${message.id}/send-email`,
        { method: "POST" }
      );
      if (guard(res.status)) return;
      if (res.status === 429) {
        setSendEmailErrorId(message.id);
        setSendEmailErrorText("发送太频繁，请稍后再试");
        return;
      }
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { ok: boolean; to: string };
      setSendEmailStatusId(message.id);
      setSendEmailStatusText(`已发送到 ${data.to}`);
      setTimeout(() => setSendEmailStatusId((prev) => (prev === message.id ? null : prev)), 3000);
    } catch {
      setSendEmailErrorId(message.id);
      setSendEmailErrorText("发送邮件失败，请重试");
    } finally {
      setSendEmailPendingId(null);
    }
  }

  const isEmptyThread = messages.length === 0 && !sending;
  const activeModel = capabilities?.models.find((model) => model.id === modelId);
  const activeAgent = capabilities?.agents.find((agent) => agent.id === agentId);
  const activeTools =
    capabilities?.tools.filter((tool) => toolIds.includes(tool.id)).map((tool) => tool.label) ?? [];
  const canSwitchAgent = messages.length === 0;
  const latestMessage = messages.at(-1);
  const replySuggestedActions = useMemo(() => {
    if (!latestMessage || latestMessage.role !== "assistant" || latestMessage.status !== "complete" || sending) {
      return [];
    }
    if (storeRecommendations.length > 0) {
      return storeRecommendations.slice(0, 3).map((item) => ({
        id: `store-agent-${item.id}`,
        label: item.name,
        prompt: `Continue this work with the "${item.name}" agent: `,
      }));
    }
    return FOLLOW_UP_SUGGESTED_ACTIONS;
  }, [latestMessage, sending, storeRecommendations]);

  function chooseSuggestedAction(prompt: string) {
    setDraft(prompt);
    requestAnimationFrame(() => composerRef.current?.focus());
  }
  const currentShareUrl = shareUrl();
  // p18-F13：线程头部标题（prototype：Agent 头像 + 线程标题 + agent · 角色副标题）。
  const activeThreadTitle = threads.find((t) => t.id === activeId)?.title ?? "New chat";
  const lastUserMessageId = [...messages].reverse().find((m) => m.role === "user")?.id ?? null;
  const lastAssistantMessageId =
    [...messages].reverse().find((m) => m.role === "assistant")?.id ?? null;
  const groupedThreads = groupThreadsByDate(threads);

  return (
    <div className="flex h-full overflow-hidden">
      {/* thread list：移动端 list 视图或桌面端常驻 */}
      <aside
        className={`w-full flex-none flex-col border-r border-border p-3 md:flex md:w-60 ${
          mobileView === "list" ? "flex" : "hidden"
        }`}
      >
        <Button data-testid="new-chat" size="sm" className="h-9 w-full gap-1.5" onClick={newChat}>
          <Plus className="h-4 w-4" strokeWidth={1.5} />
          New chat
        </Button>
        <div className="mt-3 flex-1 overflow-auto">
          {loading ? (
            <div data-testid="loading" className="animate-pulse space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 rounded-9 bg-muted" />
              ))}
            </div>
          ) : threadError && threads.length === 0 ? (
            <div className="space-y-2 px-1 pt-2">
              <p role="alert" data-testid="err-threads" className="text-xs text-destructive">
                {threadError}
              </p>
              <Button data-testid="threads-retry" size="sm" variant="outline" className="h-8 transition-colors" onClick={() => void refreshThreads()}>
                Retry
              </Button>
            </div>
          ) : threads.length === 0 ? (
            <p data-testid="threads-empty" className="px-1 pt-2 text-xs text-muted-foreground">
              No conversations yet — start chatting to create one.
            </p>
          ) : (
            <div className="space-y-3">
              {actionError && (
                <p role="alert" data-testid="err-thread-action" className="px-1 text-xs text-destructive">
                  {actionError}
                </p>
              )}
              {threadError && (
                <p role="alert" data-testid="err-threads" className="px-1 text-xs text-destructive">
                  {threadError}
                </p>
              )}
              <div data-testid="thread-list" className="space-y-3">
                {groupedThreads.map((group) => (
                  <section key={group.key} data-testid={`thread-group-${group.key}`} className="space-y-1">
                    <h2 className="px-1 text-11 font-semibold uppercase text-muted-foreground">{group.label}</h2>
                    <ul className="space-y-1">
                      {group.threads.map((t) => (
                        <li key={t.id} className="relative">
                          {editingThreadId === t.id ? (
                            <div data-testid={`thread-rename-${t.id}`} className="flex items-center gap-1 rounded-9 bg-surface-1 p-1.5">
                              <Input
                                data-testid="thread-rename-input"
                                aria-label="Thread title"
                                value={renameDraft}
                                onChange={(e) => setRenameDraft(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") void saveRename(t.id);
                                  if (e.key === "Escape") setEditingThreadId(null);
                                }}
                                className="h-8 flex-1 text-13"
                              />
                              <Button data-testid="thread-rename-save" size="icon" className="h-8 w-8 rounded-9 transition-colors" onClick={() => void saveRename(t.id)} aria-label="Save thread title">
                                <Check className="h-4 w-4" strokeWidth={1.5} />
                              </Button>
                              <Button data-testid="thread-rename-cancel" size="icon" variant="ghost" className="h-8 w-8 rounded-9 transition-colors" onClick={() => setEditingThreadId(null)} aria-label="Cancel rename">
                                <X className="h-4 w-4" strokeWidth={1.5} />
                              </Button>
                            </div>
                          ) : (
                            <div className={cn("group flex items-center rounded-9 transition-colors hover:bg-surface-1", activeId === t.id ? "bg-surface-1" : "")}>
                              <Button
                                variant="ghost"
                                data-testid={`thread-${t.id}`}
                                onClick={() => void openThread(t.id)}
                                className="h-auto min-w-0 flex-1 justify-start rounded-9 px-3 py-2 text-left font-normal transition-colors hover:bg-transparent"
                              >
                                <span className="block w-full truncate text-13 font-medium text-foreground">{t.title}</span>
                              </Button>
                              {/* p18-F13：「…」菜单按钮 hover 才浮现（prototype/oldcode 的
                                  thread hover menu 形态）。opacity-0 对 Playwright 仍是
                                  可见可点击的，thread-menu-* 直接 click 不受影响。 */}
                              <Button
                                variant="ghost"
                                size="icon"
                                data-testid={`thread-menu-${t.id}`}
                                className={cn(
                                  "mr-1 h-8 w-8 rounded-9 transition-opacity",
                                  menuThreadId === t.id
                                    ? "opacity-100"
                                    : "opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
                                )}
                                onClick={() => setMenuThreadId((prev) => (prev === t.id ? null : t.id))}
                                aria-label="Thread actions"
                              >
                                <MoreHorizontal className="h-4 w-4" strokeWidth={1.5} />
                              </Button>
                            </div>
                          )}
                          {menuThreadId === t.id && (
                            <div data-testid={`thread-actions-${t.id}`} className="absolute right-1 top-9 z-10 flex min-w-28 flex-col rounded-9 border border-border bg-background p-1 shadow-md">
                              <Button data-testid="thread-rename" variant="ghost" size="sm" className="h-8 justify-start transition-colors" onClick={() => startRename(t)}>
                                <Pencil className="h-4 w-4" strokeWidth={1.5} />
                                Rename
                              </Button>
                              <Button data-testid="thread-delete" variant="ghost" size="sm" className="h-8 justify-start text-destructive transition-colors" onClick={() => void deleteThread(t.id)}>
                                <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                                Delete
                              </Button>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
              {hasMoreThreads && (
                <Button data-testid="threads-load-more" variant="outline" size="sm" className="h-8 w-full transition-colors" disabled={loadingMoreThreads} onClick={() => void loadMoreThreads()}>
                  {loadingMoreThreads ? "Loading..." : "Load more"}
                </Button>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* chat：移动端 chat 视图或桌面端常驻 */}
      <section
        className={`min-w-0 flex-1 flex-col bg-background md:flex ${mobileView === "chat" ? "flex" : "hidden"}`}
      >
        {error ? (
          <div className="flex flex-1 items-center justify-center px-6">
            <p role="alert" data-testid="error" className="text-13 text-destructive">
              {error}
            </p>
          </div>
        ) : (
          <>
            {/* p18-F13：线程头部对齐 prototype——左侧 Agent 头像 + 线程标题 +
                「agent · Agent」副标题；右侧「模型名 ▾」pill 模型选择器 + Share。
                model-select 从 composer 区迁到这里（仍是 ui/select 的原生 select，
                Playwright selectOption / option[disabled] 断言不变）。 */}
            <div
              data-testid="thread-header"
              className="relative flex h-14 flex-none items-center gap-2.5 border-b border-border px-4"
            >
              <Button
                variant="ghost"
                size="icon"
                data-testid="back-to-list"
                className="h-8 w-8 flex-none md:hidden"
                onClick={() => setMobileView("list")}
                aria-label="Back to thread list"
              >
                <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
              </Button>
              <span
                aria-hidden
                className="flex h-8 w-8 flex-none items-center justify-center rounded-9 bg-surface-1 text-foreground"
              >
                <Bot className="h-4 w-4" strokeWidth={1.5} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-13 font-semibold text-foreground">{activeThreadTitle}</div>
                <div
                  data-testid="thread-header-agent"
                  className="truncate text-11 text-muted-foreground"
                >
                  {activeAgent?.label ?? agentId} · Agent
                </div>
              </div>
              <div data-testid="thread-header-model-pill" className="flex flex-none items-center">
                <Select
                  data-testid="model-select"
                  aria-label="Select AVA model"
                  value={modelId}
                  onChange={(e) => {
                    const next = capabilities?.models.find((model) => model.id === e.target.value);
                    if (!next || next.disabled) {
                      setSettingsError("This model is currently unavailable — kept the previous model");
                      return;
                    }
                    setSettingsError("");
                    setModelId(next.id);
                  }}
                  className="h-8 w-auto rounded-full border-border bg-background px-3 text-12 shadow-none"
                >
                  {(capabilities?.models ?? [{ id: modelId, label: modelId } as CapabilityOption]).map(
                    (model) => (
                      <option key={model.id} value={model.id} disabled={model.disabled}>
                        {model.label}
                        {model.disabled ? " (restricted)" : ""}
                      </option>
                    )
                  )}
                </Select>
              </div>
              <Button
                variant="outline"
                size="sm"
                data-testid="ava-share"
                className="h-8 flex-none gap-1.5 rounded-full transition-colors hover:bg-surface-1"
                onClick={() => void toggleSharePanel()}
                disabled={!activeId}
              >
                <Share2 className="h-4 w-4" strokeWidth={1.5} />
                Share
              </Button>
              {shareOpen && (
                <div
                  data-testid="share-panel"
                  className="absolute right-4 top-12 z-20 w-80 rounded-12 border border-border bg-background p-4 shadow-lg"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-13 font-semibold text-foreground">Share via link</h2>
                      <p className="mt-1 text-11 leading-relaxed text-muted-foreground">
                        The public link only includes messages in this chat, not private attachments or team context.
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 transition-colors hover:bg-surface-1"
                      onClick={() => setShareOpen(false)}
                      aria-label="Close share panel"
                    >
                      <X className="h-4 w-4" strokeWidth={1.5} />
                    </Button>
                  </div>

                  <div className="mt-4 space-y-2">
                    <Label htmlFor="ava-share-url">Share link</Label>
                    <Input
                      id="ava-share-url"
                      data-testid="share-link"
                      readOnly
                      value={currentShareUrl}
                      placeholder={shareLoading ? "Loading share link..." : "Click to generate a share link"}
                    />
                  </div>

                  {shareError && (
                    <p role="alert" data-testid="err-share" className="mt-2 text-xs text-destructive">
                      {shareError}
                    </p>
                  )}
                  {copyStatus && (
                    <p data-testid="share-copy-status" className="mt-2 text-xs text-muted-foreground">
                      {copyStatus}
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      data-testid="share-copy"
                      size="sm"
                      className="h-8 gap-1.5 transition-colors"
                      onClick={() => (currentShareUrl ? void copyShareLink() : void enableShareAndCopy())}
                      disabled={shareLoading}
                    >
                      <Copy className="h-4 w-4" strokeWidth={1.5} />
                      {currentShareUrl ? "Copy link" : "Share via link"}
                    </Button>
                    <Button
                      data-testid="share-disable"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 transition-colors hover:bg-surface-1"
                      onClick={() => void disableShare()}
                      disabled={shareLoading || !currentShareUrl}
                    >
                      <X className="h-4 w-4" strokeWidth={1.5} />
                      Turn off sharing
                    </Button>
                    <Button
                      data-testid="share-email"
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1.5 transition-colors hover:bg-surface-1"
                      onClick={() => void sendShareEmail()}
                      disabled={shareLoading || emailSending}
                    >
                      <Mail className="h-4 w-4" strokeWidth={1.5} />
                      {emailSending ? "Sending..." : "Send via email"}
                    </Button>
                  </div>

                  {emailError && (
                    <p role="alert" data-testid="err-share-email" className="mt-2 text-xs text-destructive">
                      {emailError}
                    </p>
                  )}
                  {emailStatus && (
                    <p data-testid="share-email-status" className="mt-2 text-xs text-muted-foreground">
                      {emailStatus}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div ref={scrollRef} className="flex-1 overflow-auto bg-background px-4 py-6 md:px-8">
              <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
                {/* p18-F13：AI credits 横幅按 prototype 视觉收敛为一行浅提示（保留功能）。 */}
                <div
                  data-testid="ai-low-credits-prompt"
                  className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 rounded-12 border border-border bg-card px-4 py-2 shadow-sm"
                >
                  <span className="text-11 text-muted-foreground">
                    AI credits — buy credits or upgrade your plan before a heavy AVA run.
                  </span>
                  <Button
                    data-testid="ai-low-credits-open-billing"
                    size="sm"
                    variant="ghost"
                    className="h-7 flex-none px-2 text-11 font-semibold"
                    onClick={() => setBillingOpen(true)}
                  >
                    Upgrade
                  </Button>
                </div>
                {isEmptyThread ? (
                  <div data-testid="empty" className="mx-auto flex max-w-2xl flex-col items-center pt-16 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-12 bg-primary text-primary-foreground shadow-sm">
                      <Sparkles className="h-5 w-5" strokeWidth={1.5} />
                    </div>
                    <h1 className="mt-4 text-xl font-semibold text-foreground">How can I help?</h1>
                    <p className="mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
                      Ask a question, attach context, or start a structured research run.
                    </p>
                    <SuggestedActions
                      actions={EMPTY_SUGGESTED_ACTIONS}
                      align="center"
                      className="mt-5"
                      onChoose={chooseSuggestedAction}
                    />
                  </div>
                ) : (
                  <ul data-testid="messages" className="flex flex-col gap-6">
                    {messages.map((m) => {
                      const showReplySuggestions =
                        m.id === latestMessage?.id && replySuggestedActions.length > 0;
                      return (
                        <li key={m.id} className="flex flex-col gap-2.5">
                          {/* p18-F13：data-align 是 ava-ui-parity 的结构锚点——用户消息
                              右对齐灰气泡 / AI 消息左对齐带头像（prototype 消息区形态）。 */}
                          <div
                            data-testid={`msg-${m.role}`}
                            data-status={m.status}
                            data-align={m.role === "user" ? "end" : "start"}
                            className={`group flex items-start gap-3 ${m.role === "user" ? "justify-end" : ""}`}
                          >
                            {m.role === "assistant" && (
                              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-9 bg-primary text-11 font-bold text-primary-foreground shadow-sm">
                                A
                              </span>
                            )}
                            {m.role === "user" ? (
                              <div
                                className={cn(
                                  "flex max-w-2xl flex-col items-end gap-2",
                                  editingId === m.id ? "w-full" : "w-fit"
                                )}
                              >
                                {m.attachments && m.attachments.length > 0 && (
                                  <ul
                                    data-testid="msg-attachments"
                                    className="flex flex-wrap justify-end gap-1.5"
                                  >
                                    {/* p18 F10: 富附件预览接线（图片缩略图/lightbox + 音频播放器，
                                        签名 URL 失败时组件内部降级为文件名 chip；文件类附件同样由
                                        RichAttachmentPreview 内部渲染为 chip + 文件名）。 */}
                                    {m.attachments.map((a) => (
                                      <li key={a.id} data-testid="msg-attachment-item">
                                        <RichAttachmentPreview attachment={a} />
                                      </li>
                                    ))}
                                  </ul>
                                )}
                                {editingId === m.id ? (
                                  <div
                                    data-testid="msg-edit-panel"
                                    className="w-full rounded-14 border border-input bg-muted px-3 py-2.5 shadow-sm transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-ring"
                                  >
                                    <label htmlFor={`msg-edit-${m.id}`} className="sr-only">
                                      Edit message
                                    </label>
                                    <Textarea
                                      id={`msg-edit-${m.id}`}
                                      data-testid="msg-edit-input"
                                      value={editText}
                                      onChange={(e) => {
                                        setEditText(e.target.value);
                                        if (editError) setEditError("");
                                      }}
                                      className="min-h-20 resize-none border-0 bg-transparent px-0 py-0 text-sm leading-relaxed shadow-none outline-none placeholder:text-placeholder focus:border-0 focus:outline-none focus:ring-0 focus-visible:border-0 focus-visible:ring-0"
                                      disabled={sending}
                                    />
                                    {editError && (
                                      <p
                                        role="alert"
                                        data-testid="msg-edit-error"
                                        className="mt-2 text-xs text-destructive"
                                      >
                                        {editError}
                                      </p>
                                    )}
                                    <div className="mt-3 flex items-center justify-end gap-2">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        data-testid="msg-edit-cancel"
                                        onClick={cancelEdit}
                                        disabled={sending}
                                        className="h-8 rounded-9 px-3 text-12"
                                      >
                                        Cancel
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        data-testid="msg-edit-save"
                                        onClick={() => void saveEdit(m.id)}
                                        disabled={sending}
                                        className="h-8 rounded-9 px-3 text-12"
                                      >
                                        {sending ? "Saving…" : "Save"}
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div
                                    data-testid={`msg-user-content-${m.id}`}
                                    className="whitespace-pre-wrap rounded-14 bg-muted px-4 py-2.5 text-sm leading-relaxed text-foreground shadow-sm"
                                  >
                                    {m.content}
                                  </div>
                                )}

                                {m.id === lastUserMessageId && editingId !== m.id && (
                                  <div className="flex flex-col items-end gap-2">
                                    {/* p18-F13：Edit/Delete 改为 hover 才浮现的内联文本操作
                                        （prototype 用户气泡 footer 形态）。opacity-0 对
                                        Playwright 仍可直接 click。确认框打开时保持常显。 */}
                                    <div
                                      data-testid="msg-user-actions"
                                      className={cn(
                                        "flex items-center gap-1 transition-opacity",
                                        deleteConfirmId === m.id
                                          ? "opacity-100"
                                          : "opacity-0 focus-within:opacity-100 group-hover:opacity-100"
                                      )}
                                    >
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        data-testid="msg-edit"
                                        className="h-7 gap-1 px-2 text-11 font-normal text-muted-foreground hover:text-foreground"
                                        onClick={() => startEdit(m)}
                                        disabled={sending || deletingId != null}
                                      >
                                        <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
                                        Edit
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        data-testid="msg-delete"
                                        className="h-7 gap-1 px-2 text-11 font-normal text-destructive"
                                        onClick={() => setDeleteConfirmId(m.id)}
                                        disabled={sending || deletingId != null}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                                        Delete
                                      </Button>
                                    </div>
                                    {deleteConfirmId === m.id && (
                                      <div className="rounded-12 border border-destructive/40 bg-background p-3">
                                        <p data-testid="msg-delete-confirm" className="text-11 text-foreground">
                                          Delete the last request and its replies?
                                        </p>
                                        <div className="mt-2 flex justify-end gap-2">
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            data-testid="msg-delete-cancel"
                                            onClick={() => setDeleteConfirmId(null)}
                                            disabled={deletingId === m.id}
                                          >
                                            Cancel
                                          </Button>
                                          <Button
                                            type="button"
                                            variant="destructive"
                                            size="sm"
                                            data-testid="msg-delete-confirm-action"
                                            onClick={() => void deleteLastRequest(m.id)}
                                            disabled={deletingId === m.id}
                                          >
                                            {deletingId === m.id ? "Deleting…" : "Confirm delete"}
                                          </Button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : m.status === "failed" ? (
                              <div data-testid="msg-failed" className="text-sm leading-relaxed text-destructive">
                                {m.content}
                              </div>
                            ) : (
                              <div className="flex w-full max-w-3xl flex-col gap-2">
                                <MarkdownMessage content={m.content} />
                                <MessageActionsBar
                                  message={m}
                                  isLast={m.id === lastAssistantMessageId}
                                  copied={msgCopiedId === m.id}
                                  copyError={msgCopyError === m.id}
                                  feedbackPending={feedbackPendingId === m.id}
                                  feedbackError={feedbackErrorId === m.id}
                                  regenerating={regeneratingId === m.id}
                                  regenerateError={regenerateErrorId === m.id}
                                  disabled={sending || regeneratingId != null}
                                  onCopy={() => void copyMessage(m)}
                                  onFeedback={(rating) => void submitFeedback(m, rating)}
                                  onRegenerate={() => void regenerateReply(m)}
                                  boardPickerOpen={boardPickerForMessageId === m.id}
                                  onToggleBoardPicker={() => void toggleBoardPicker(m)}
                                  editableBoards={editableBoards}
                                  boardsLoading={boardsLoading}
                                  boardsLoadError={boardsLoadError}
                                  sendBoardPending={sendBoardPendingId === m.id}
                                  sendBoardStatus={sendBoardStatusId === m.id ? sendBoardStatusText : ""}
                                  sendBoardError={sendBoardErrorId === m.id ? sendBoardErrorText : ""}
                                  onChooseBoard={(boardId) => void sendMessageToBoard(m, boardId)}
                                  sendEmailPending={sendEmailPendingId === m.id}
                                  sendEmailStatus={sendEmailStatusId === m.id ? sendEmailStatusText : ""}
                                  sendEmailError={sendEmailErrorId === m.id ? sendEmailErrorText : ""}
                                  onSendEmail={() => void sendMessageEmail(m)}
                                />
                              </div>
                            )}
                          </div>
                          {showReplySuggestions && (
                            <SuggestedActions
                              actions={replySuggestedActions}
                              className="pl-9"
                              onChoose={chooseSuggestedAction}
                            />
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {regeneratingId != null && (
                  <div data-testid="regenerating" className="flex items-start gap-2.5">
                    <span className="flex h-8 w-8 flex-none items-center justify-center rounded-9 bg-primary text-11 font-bold text-primary-foreground shadow-sm">
                      A
                    </span>
                    {streamingText ? (
                      <div data-testid="msg-assistant-streaming">
                        <MarkdownMessage content={streamingText} />
                      </div>
                    ) : (
                      <span className="text-13 text-muted-foreground">AVA is regenerating…</span>
                    )}
                  </div>
                )}
                {sending && regeneratingId == null && (
                  <div data-testid="sending" className="flex items-start gap-2.5">
                    <span className="flex h-8 w-8 flex-none items-center justify-center rounded-9 bg-primary text-11 font-bold text-primary-foreground shadow-sm">
                      A
                    </span>
                    {streamingText ? (
                      <div data-testid="msg-assistant-streaming">
                        <MarkdownMessage content={streamingText} />
                      </div>
                    ) : (
                      <span className="text-13 text-muted-foreground">AVA is thinking…</span>
                    )}
                  </div>
                )}
                {researchRun && (
                  <ResearchWorkspace
                    run={researchRun}
                    statusLabel={researchStatusLabel}
                    onConfirmClarify={confirmResearchClarify}
                    onConfirmPlan={confirmResearchPlan}
                    onOpenReport={() => setReportOpen(true)}
                  />
                )}
              </div>
            </div>

            {reportOpen && activeReport && (
              <ReportPanel report={activeReport} onClose={() => setReportOpen(false)} />
            )}

            {/* composer */}
            <div className="flex-none border-t border-border bg-background/95 px-4 py-4 shadow-sm backdrop-blur md:px-8">
              <div
                data-testid="composer-dropzone"
                data-drag-over={dragOver}
                className={`mx-auto w-full max-w-4xl rounded-14 border bg-card p-3 shadow-lg transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-ring ${
                  dragOver ? "border-primary bg-surface-1" : "border-border"
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  if (e.dataTransfer.files.length > 0) void attachments.addFiles(e.dataTransfer.files);
                }}
              >
                <AttachmentPreviewStrip
                  entries={attachments.entries}
                  onRetry={attachments.retry}
                  onRemove={attachments.remove}
                />
                {attachments.queueError && (
                  <p role="alert" data-testid="attachment-queue-error" className="mb-2 text-xs text-destructive">
                    {attachments.queueError}
                  </p>
                )}
                <label htmlFor="ava-composer" className="sr-only">
                  {isResearchMode ? "Deep Research topic" : "Message AVA"}
                </label>
                <Textarea
                  id="ava-composer"
                  ref={composerRef}
                  data-testid="composer"
                  rows={1}
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    // p18-F14：开始输入主题即收起研究类型选单（选单不该挡住正在输入的
                    // 上下文；同值 setState 由 React 去重，不产生多余渲染）。
                    setResearchTypeMenuOpen(false);
                  }}
                  onKeyDown={onComposerKey}
                  placeholder={composerPlaceholder}
                  // p18-F14 顺带修复：此前只有 focus ring、没关默认 outline，聚焦时浏览器
                  // 默认轮廓（Chrome 下为橙色 auto ring）叠在设计系统样式之上；对齐
                  // components/ui/textarea.tsx 的口径显式关掉默认轮廓，焦点高亮保留
                  // focus-visible:ring（外层 composer 容器另有 focus-within 边框反馈）。
                  className="block w-full min-h-16 max-h-40 appearance-none resize-none !border-0 bg-transparent px-0 py-1 text-sm leading-relaxed !shadow-none !outline-none !ring-0 transition-colors placeholder:text-placeholder focus:!border-0 focus:!outline-none focus:!ring-0 focus-visible:!border-0 focus-visible:!outline-none focus-visible:ring-1 focus-visible:ring-transparent"
                />
                {sendError && (
                  <p role="alert" data-testid="send-error" className="mt-2 text-xs text-destructive">
                    {sendError}
                  </p>
                )}
                {/* p18-F13：composer 底部一行对齐 prototype——左侧附件/语音图标 +
                    「@ Expert」「# Skill」「✦ Deep Research」pill 入口，右侧圆形发送按钮。
                    Chat/Deep Research 不再是 composer 顶部的两个 tab：mode-research 落在
                    Deep Research pill 上（点击进入/退出研究模式），研究模式下旁边出现
                    mode-chat（✕ 返回聊天）。ai-settings 区域即这一行（模型选择在线程
                    头部，agent/工具入口在这里）。 */}
                <div data-testid="ai-settings" className="mt-3 flex flex-wrap items-center gap-2">
                  <AttachmentTrigger onFiles={(files) => void attachments.addFiles(files)} />
                  <VoiceInputControl
                    disabled={sending}
                    onTranscribed={(text) =>
                      setDraft((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text))
                    }
                  />
                  <span aria-hidden className="mx-1 hidden h-4 w-px bg-border md:inline-block" />
                  {capabilities ? (
                    <>
                      <label
                        data-testid="composer-agent-pill"
                        className={cn(
                          "flex h-8 items-center gap-0.5 rounded-full border border-border bg-background pl-2.5 pr-1 text-12 font-medium transition-colors",
                          canSwitchAgent ? "text-foreground hover:bg-accent" : "text-muted-foreground"
                        )}
                      >
                        <span aria-hidden>@</span>
                        <Select
                          data-testid="agent-select"
                          aria-label="Select AVA agent (expert)"
                          value={agentId}
                          disabled={!canSwitchAgent}
                          onChange={(e) => {
                            if (!canSwitchAgent) {
                              setSettingsError("Agent can't be switched once a thread has messages");
                              return;
                            }
                            setSettingsError("");
                            const nextAgentId = e.target.value;
                            setAgentId(nextAgentId);
                            const nextAgent = capabilities.agents.find((agent) => agent.id === nextAgentId);
                            if (nextAgent?.deepAgentEnabled) {
                              setComposerMode("deep-agent");
                              setResearchTypeMenuOpen(false);
                            }
                          }}
                          className="h-7 w-auto rounded-full border-0 bg-transparent px-1 text-12 shadow-none"
                        >
                          {capabilities.agents.map((agent) => (
                            <option key={agent.id} value={agent.id}>
                              {agent.label}
                            </option>
                          ))}
                        </Select>
                      </label>
                      <div className="relative">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          data-testid="composer-skill-trigger"
                          aria-expanded={skillMenuOpen}
                          aria-haspopup="menu"
                          onClick={() => setSkillMenuOpen((open) => !open)}
                          className="h-8 gap-1 rounded-full px-3 text-12 font-medium transition-colors hover:bg-accent"
                        >
                          <span aria-hidden>#</span>
                          Skill
                        </Button>
                        {skillMenuOpen && (
                          <div
                            data-testid="composer-skill-menu"
                            className="absolute bottom-10 left-0 z-20 w-64 rounded-12 border border-border bg-background p-1.5 shadow-lg"
                          >
                            <p className="px-2 py-1 text-10 font-semibold uppercase tracking-wide text-muted-foreground">
                              Skills &amp; tools
                            </p>
                            {capabilities.tools.map((tool) => {
                              const selected = toolIds.includes(tool.id);
                              return (
                                <Button
                                  key={tool.id}
                                  type="button"
                                  variant="ghost"
                                  data-testid={`tool-${tool.id}`}
                                  aria-pressed={selected}
                                  className="h-auto w-full flex-col items-start gap-0.5 px-2 py-1.5 text-left transition-colors"
                                  onClick={() => {
                                    setSettingsError("");
                                    setToolIds((prev) =>
                                      prev.includes(tool.id)
                                        ? prev.filter((id) => id !== tool.id)
                                        : [...prev, tool.id]
                                    );
                                  }}
                                >
                                  <span className="flex w-full items-center gap-1.5 text-12 font-medium text-foreground">
                                    <Wrench className="h-3.5 w-3.5" strokeWidth={1.5} />
                                    {tool.label}
                                    {selected && (
                                      <Check className="ml-auto h-3.5 w-3.5" strokeWidth={1.5} />
                                    )}
                                  </span>
                                  <span className="whitespace-normal text-11 font-normal text-muted-foreground">
                                    {tool.description}
                                  </span>
                                </Button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div data-testid="loading" className="h-8 w-40 animate-pulse rounded-full bg-muted" />
                  )}
                  {/* p18-F14：Deep Research pill 从单一开关升级为研究类型选单（oldcode
                      ResearchTypeSelector 迁移，形态同 F13 skill menu：名称 + 描述 + 选中勾）。
                      未进入研究模式时点击 pill 直接以当前类型进入（mode-research testid 保持
                      「一次点击进入研究模式」的既有契约，既有 spec 不需要二次点击）；已在
                      研究模式时点击 pill 打开/收起类型选单以切换 深度研究/用户研究；✕
                      （mode-chat）退出回普通聊天。pill 文案显示当前激活的研究类型。 */}
                  <span data-testid="composer-deep-research-pill" className="relative flex items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant={isResearchMode ? "default" : "outline"}
                      data-testid="mode-research"
                      aria-pressed={isResearchMode}
                      aria-haspopup="menu"
                      aria-expanded={researchTypeMenuOpen}
                      onClick={() => {
                        if (isResearchMode) {
                          setResearchTypeMenuOpen((open) => !open);
                        } else {
                          setComposerMode("research");
                          setResearchTypeMenuOpen(true);
                        }
                      }}
                      className="h-8 gap-1 rounded-full px-3 text-12 font-medium transition-colors"
                    >
                      <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} />
                      {isResearchMode
                        ? RESEARCH_TYPE_OPTIONS.find((o) => o.value === researchType)?.label ??
                          "Deep Research"
                        : "Deep Research"}
                    </Button>
                    {researchTypeMenuOpen && (
                      <div
                        data-testid="research-type-menu"
                        className="absolute bottom-10 left-0 z-20 w-72 rounded-12 border border-border bg-background p-1.5 shadow-lg"
                      >
                        <p className="px-2 py-1 text-10 font-semibold uppercase tracking-wide text-muted-foreground">
                          Research type
                        </p>
                        {RESEARCH_TYPE_OPTIONS.map((option) => {
                          const selected = researchType === option.value;
                          const OptionIcon = option.icon;
                          return (
                            <Button
                              key={option.value}
                              type="button"
                              variant="ghost"
                              data-testid={`research-type-${option.value}`}
                              aria-pressed={selected}
                              className="h-auto w-full flex-col items-start gap-0.5 px-2 py-1.5 text-left transition-colors"
                              onClick={() => {
                                setResearchType(option.value);
                                setComposerMode("research");
                                setResearchTypeMenuOpen(false);
                              }}
                            >
                              <span className="flex w-full items-center gap-1.5 text-12 font-medium text-foreground">
                                <OptionIcon className="h-3.5 w-3.5" strokeWidth={1.5} />
                                {option.label}
                                {selected && (
                                  <Check className="ml-auto h-3.5 w-3.5" strokeWidth={1.5} />
                                )}
                              </span>
                              <span className="whitespace-normal text-11 font-normal text-muted-foreground">
                                {option.description}
                              </span>
                            </Button>
                          );
                        })}
                      </div>
                    )}
                    {isResearchMode && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        data-testid="mode-chat"
                        aria-label="Back to chat"
                        onClick={() => {
                          setComposerMode("chat");
                          setResearchTypeMenuOpen(false);
                        }}
                        className="h-7 w-7 rounded-full transition-colors hover:bg-accent"
                      >
                        <X className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </Button>
                    )}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant={isDeepAgentMode ? "default" : "outline"}
                    data-testid="mode-deep-agent"
                    aria-pressed={isDeepAgentMode}
                    onClick={() => {
                      setComposerMode(isDeepAgentMode ? "chat" : "deep-agent");
                      setResearchTypeMenuOpen(false);
                    }}
                    className="h-8 gap-1 rounded-full px-3 text-12 font-medium transition-colors"
                  >
                    <Bot className="h-3.5 w-3.5" strokeWidth={1.5} />
                    Deep Agent
                  </Button>
                  {isDeepAgentMode && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      data-testid="mode-chat"
                      aria-label="Back to chat"
                      onClick={() => setComposerMode("chat")}
                      className="h-7 w-7 rounded-full transition-colors hover:bg-accent"
                    >
                      <X className="h-3.5 w-3.5" strokeWidth={1.5} />
                    </Button>
                  )}
                  <div className="ml-auto">
                    {sending && !isResearchMode ? (
                      // P18 F02：流式回复进行中，Send 变成 Stop——点击真实中断请求
                      // （AbortController.abort()），而不是等回显自然结束。
                      <Button
                        data-testid="stop"
                        size="icon"
                        variant="outline"
                        className="h-9 w-9 rounded-full transition-colors hover:bg-accent"
                        onClick={stop}
                        aria-label="Stop generating"
                      >
                        <Square className="h-3.5 w-3.5" strokeWidth={2} fill="currentColor" />
                      </Button>
                    ) : (
                      <Button
                        data-testid="send"
                        size="icon"
                        className="h-9 w-9 rounded-full shadow-sm transition-colors"
                        onClick={() => void send()}
                        disabled={
                          (!draft.trim() && attachments.uploadedIds.length === 0) ||
                          sending ||
                          attachments.hasPending ||
                          researchRun?.status === "running"
                        }
                        aria-label={
                          isResearchMode
                            ? "Start Deep Research"
                            : isDeepAgentMode
                              ? "Run Deep Agent"
                              : "Send message"
                        }
                      >
                        {isResearchMode ? (
                          <Search className="h-4 w-4" strokeWidth={2} />
                        ) : isDeepAgentMode ? (
                          <Bot className="h-4 w-4" strokeWidth={2} />
                        ) : (
                          <ArrowUp className="h-4 w-4" strokeWidth={2} />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
                {/* p18-F13：当前 AI 设置的低调 caption（current-* 回归锚点保留），
                    以及 agent 锁定提示 / 设置错误提示。 */}
                <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-11 text-muted-foreground">
                  <span data-testid="current-model">{activeModel?.label ?? modelId}</span>
                  <span aria-hidden>·</span>
                  <span data-testid="current-agent">{activeAgent?.label ?? agentId}</span>
                  <span aria-hidden>·</span>
                  <span data-testid="current-tools">
                    {activeTools.length > 0 ? activeTools.join(", ") : "None"}
                  </span>
                  {!canSwitchAgent && (
                    <span data-testid="agent-locked" className="flex items-center gap-1">
                      <Bot className="h-3.5 w-3.5" strokeWidth={1.5} />
                      Agent is locked after messages exist in this thread.
                    </span>
                  )}
                </div>
                {settingsError && (
                  <p role="alert" data-testid="err-ai-settings" className="mt-1 text-xs text-destructive">
                    {settingsError}
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </section>
      <BillingPlanDialog open={billingOpen} onClose={() => setBillingOpen(false)} />
    </div>
  );
}

function ResearchWorkspace({
  run,
  statusLabel,
  onConfirmClarify,
  onConfirmPlan,
  onOpenReport,
}: {
  run: ResearchRun;
  statusLabel: string;
  onConfirmClarify: () => void;
  onConfirmPlan: () => void;
  onOpenReport: () => void;
}) {
  const hasPlan = Boolean(run.research);
  // p18-F04：澄清确认（research-clarify）与计划确认（confirm-research-plan）是两个
  // 独立的、必须显式确认的步骤——draft 阶段只能确认澄清问题，计划要等澄清确认后
  // （status === 'clarified'）才能确认，不能从提交主题直接跳到执行。
  const canConfirmClarify = run.status === "draft";
  const canConfirmPlan = run.status === "clarified";
  return (
    <div
      data-testid="research-card"
      data-status={run.status}
      className="rounded-12 border border-border bg-surface-1 p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-13 font-semibold text-foreground">
            {run.status === "running" ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
            ) : (
              <Search className="h-4 w-4" strokeWidth={1.5} />
            )}
            Deep Research
          </div>
          <p className="mt-1 text-13 text-muted-foreground">{run.topic}</p>
        </div>
        <span data-testid="research-status" className="rounded-full bg-muted px-2.5 py-1 text-11 text-muted-foreground">
          {statusLabel}
        </span>
      </div>

      {run.status === "error" && (
        <p role="alert" data-testid="err-research" className="mt-3 text-13 text-destructive">
          {run.error}
        </p>
      )}

      {hasPlan && run.research && (
        <div className="mt-4 flex flex-col gap-4">
          <section data-testid="research-clarify" className="rounded-9 border border-border bg-background p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-13 font-semibold text-foreground">Clarifying questions</h2>
              {canConfirmClarify && (
                <Button
                  type="button"
                  size="sm"
                  data-testid="confirm-research-clarify"
                  onClick={onConfirmClarify}
                  className="gap-1.5 transition-all hover:shadow-sm"
                >
                  <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />
                  Confirm clarification
                </Button>
              )}
            </div>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-13 text-muted-foreground">
              {run.research.clarifyingQuestions.map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ul>
          </section>

          <section data-testid="research-plan" className="rounded-9 border border-border bg-background p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-13 font-semibold text-foreground">Research plan</h2>
                <p className="mt-1 text-13 text-muted-foreground">Audience: {run.research.plan.audience}</p>
                {canConfirmClarify && (
                  <p className="mt-1 text-11 text-muted-foreground">
                    Confirm the clarifying questions above before you can confirm this plan.
                  </p>
                )}
              </div>
              {canConfirmPlan && (
                <Button
                  type="button"
                  size="sm"
                  data-testid="confirm-research-plan"
                  onClick={onConfirmPlan}
                  className="gap-1.5 transition-all hover:shadow-sm"
                >
                  <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />
                  Confirm plan
                </Button>
              )}
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              {run.research.plan.phases.map((phase) => (
                <div key={phase.name} className="rounded-7 border border-border p-2.5">
                  <h3 className="text-13 font-medium text-foreground">{phase.name}</h3>
                  <ul className="mt-2 space-y-1 text-11 text-muted-foreground">
                    {phase.tasks.map((task) => (
                      <li key={task}>{task}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <section data-testid="research-timeline" className="rounded-9 border border-border bg-background p-3">
            <h2 className="text-13 font-semibold text-foreground">Execution timeline</h2>
            <ol className="mt-3 space-y-2">
              {run.timeline.map((item) => (
                <li key={`${item.phase}-${item.task}`} className="flex items-start gap-2">
                  <TimelineDot status={item.status} />
                  <div>
                    <p className="text-13 font-medium text-foreground">{item.phase}</p>
                    <p className="text-11 text-muted-foreground">
                      {item.task} · {item.status}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {run.status === "complete" && (
            <div
              data-testid="research-report-notice"
              className="flex flex-wrap items-center justify-between gap-3 rounded-9 border border-border bg-background p-3"
            >
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-foreground" strokeWidth={1.5} />
                <span className="text-13 font-medium text-foreground">Research report is ready</span>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                data-testid="open-report"
                onClick={onOpenReport}
                className="transition-all hover:shadow-sm"
              >
                Open report
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SuggestedActions({
  actions,
  align = "start",
  className = "",
  onChoose,
}: {
  actions: SuggestedAction[];
  align?: "start" | "center";
  className?: string;
  onChoose: (prompt: string) => void;
}) {
  if (actions.length === 0) return null;

  return (
    <div
      data-testid="suggested-actions"
      aria-label="Suggested actions"
      className={`${className} flex flex-wrap gap-2.5 ${align === "center" ? "justify-center" : ""}`}
    >
      {actions.map((action) => (
        <Button
          key={action.id}
          variant="outline"
          size="sm"
          data-testid="suggested-action"
          data-action-id={action.id}
          onClick={() => onChoose(action.prompt)}
          className="h-auto rounded-9 px-3.5 py-2.5 text-13 font-normal text-foreground transition-all hover:border-foreground hover:bg-surface-1 hover:shadow-sm"
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
}

function TimelineDot({ status }: { status: ResearchTimelineItem["status"] }) {
  if (status === "running") {
    return (
      <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} />
      </span>
    );
  }
  if (status === "complete") {
    return (
      <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-primary text-primary-foreground">
        <CheckCircle2 className="h-3 w-3" strokeWidth={1.5} />
      </span>
    );
  }
  return <span className="mt-0.5 h-5 w-5 flex-none rounded-full border border-border bg-muted" />;
}

// p18-F05：报告面板按 researchType 渲染两套结构。market → Executive summary /
// Key findings / Recommendation；user-research → Summary / Personas / Top pain points /
// Opportunities。缺失 researchType（历史 F04 数据）时退化为原来的通用 sections 渲染。
function BulletCard({
  testId,
  heading,
  bullets,
}: {
  testId: string;
  heading: string;
  bullets: string[];
}) {
  return (
    <section data-testid={testId} className="rounded-9 border border-border bg-surface-1 p-3">
      <h3 className="text-13 font-semibold text-foreground">{heading}</h3>
      <ul className="mt-2 list-disc space-y-1 pl-4 text-13 text-muted-foreground">
        {bullets.map((bullet) => (
          <li key={bullet}>{bullet}</li>
        ))}
      </ul>
    </section>
  );
}

function ReportPanel({ report, onClose }: { report: ResearchReport; onClose: () => void }) {
  const summaryLabel = report.researchType === "user-research" ? "Summary" : "Executive summary";

  return (
    <aside
      data-testid="research-report-panel"
      data-report-type={report.researchType ?? "generic"}
      className="flex max-h-80 flex-none flex-col border-t border-border bg-background px-6 py-4"
    >
      <div className="mx-auto flex w-full max-w-2xl items-start justify-between gap-4">
        <div>
          <h2 className="text-17 font-semibold text-foreground">{report.title}</h2>
          <p data-testid="report-summary-label" className="mt-2 text-11 font-medium uppercase tracking-wide text-muted-foreground">
            {summaryLabel}
          </p>
          <p data-testid="report-conclusion" className="mt-1 text-13 leading-relaxed text-muted-foreground">
            {report.conclusion}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onClose}
          className="transition-all hover:bg-muted"
        >
          Close
        </Button>
      </div>

      {report.researchType === "market" && (
        <div className="mx-auto mt-4 grid w-full max-w-2xl gap-3 overflow-auto md:grid-cols-2">
          <BulletCard testId="report-key-findings" heading="Key findings" bullets={report.keyFindings ?? []} />
          <section data-testid="report-recommendation" className="rounded-9 border border-border bg-surface-1 p-3">
            <h3 className="text-13 font-semibold text-foreground">Recommendation</h3>
            <p className="mt-2 text-13 text-muted-foreground">{report.recommendation}</p>
          </section>
        </div>
      )}

      {report.researchType === "user-research" && (
        <div className="mx-auto mt-4 grid w-full max-w-2xl gap-3 overflow-auto md:grid-cols-3">
          <BulletCard testId="report-personas" heading="Personas" bullets={report.personas ?? []} />
          <BulletCard
            testId="report-top-pain-points"
            heading="Top pain points"
            bullets={report.topPainPoints ?? []}
          />
          <BulletCard testId="report-opportunities" heading="Opportunities" bullets={report.opportunities ?? []} />
        </div>
      )}

      {report.researchType == null && (
        <div className="mx-auto mt-4 grid w-full max-w-2xl gap-3 overflow-auto md:grid-cols-2">
          {report.sections.map((section) => (
            <BulletCard key={section.heading} testId={`report-section-${section.heading}`} heading={section.heading} bullets={section.bullets} />
          ))}
        </div>
      )}
    </aside>
  );
}

// ─── P9 F11：消息结果操作条（复制/反馈/重新生成/发送到Board/发送邮件）───────
//
// 「发送到当前 Board」「发送邮件」在本 feature 中始终禁用：分别依赖 p6 canvas（board 存在
// 且有编辑权）与邮件服务，跨能力依赖未就绪，按 feature notes 要求先做占位，能力就绪后再点亮。
function MessageActionsBar({
  message,
  isLast,
  copied,
  copyError,
  feedbackPending,
  feedbackError,
  regenerating,
  regenerateError,
  disabled,
  onCopy,
  onFeedback,
  onRegenerate,
  boardPickerOpen,
  onToggleBoardPicker,
  editableBoards,
  boardsLoading,
  boardsLoadError,
  sendBoardPending,
  sendBoardStatus,
  sendBoardError,
  onChooseBoard,
  sendEmailPending,
  sendEmailStatus,
  sendEmailError,
  onSendEmail,
}: {
  message: Message;
  isLast: boolean;
  copied: boolean;
  copyError: boolean;
  feedbackPending: boolean;
  feedbackError: boolean;
  regenerating: boolean;
  regenerateError: boolean;
  disabled: boolean;
  onCopy: () => void;
  onFeedback: (rating: MessageFeedbackRating) => void;
  onRegenerate: () => void;
  boardPickerOpen: boolean;
  onToggleBoardPicker: () => void;
  editableBoards: EditableBoard[] | null;
  boardsLoading: boolean;
  boardsLoadError: boolean;
  sendBoardPending: boolean;
  sendBoardStatus: string;
  sendBoardError: string;
  onChooseBoard: (boardId: number) => void;
  sendEmailPending: boolean;
  sendEmailStatus: string;
  sendEmailError: string;
  onSendEmail: () => void;
}) {
  return (
    // p18-F13：AI 消息下方一行内联文本操作（prototype footer：⧉ Copy / ↻ Regenerate /
    // 👍 / 👎 / → Send to board / Email），由图标按钮阵改为文本操作行；testid 全部保留。
    <div data-testid={`msg-actions-${message.id}`} className="relative flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-11 text-muted-foreground">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          data-testid="msg-copy"
          className="h-7 gap-1 px-1.5 text-11 font-normal text-muted-foreground transition-colors hover:bg-surface-1 hover:text-foreground"
          onClick={onCopy}
          aria-label="Copy message"
        >
          {copied ? <Check className="h-3.5 w-3.5" strokeWidth={1.5} /> : <Copy className="h-3.5 w-3.5" strokeWidth={1.5} />}
          Copy
        </Button>
        {isLast && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            data-testid="msg-regenerate"
            className="h-7 gap-1 px-1.5 text-11 font-normal text-muted-foreground transition-colors hover:bg-surface-1 hover:text-foreground"
            onClick={onRegenerate}
            disabled={disabled}
            aria-label="Regenerate response"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", regenerating && "animate-spin")} strokeWidth={1.5} />
            Regenerate
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          data-testid="msg-feedback-up"
          className={cn(
            "h-7 w-7 transition-colors hover:bg-surface-1",
            message.feedback === "up" ? "text-primary" : "text-muted-foreground"
          )}
          onClick={() => onFeedback("up")}
          disabled={feedbackPending}
          aria-label="Good response"
          aria-pressed={message.feedback === "up"}
        >
          <ThumbsUp className="h-3.5 w-3.5" strokeWidth={1.5} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          data-testid="msg-feedback-down"
          className={cn(
            "h-7 w-7 transition-colors hover:bg-surface-1",
            message.feedback === "down" ? "text-destructive" : "text-muted-foreground"
          )}
          onClick={() => onFeedback("down")}
          disabled={feedbackPending}
          aria-label="Bad response"
          aria-pressed={message.feedback === "down"}
        >
          <ThumbsDown className="h-3.5 w-3.5" strokeWidth={1.5} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          data-testid="msg-send-to-board"
          className="h-7 gap-1 px-1.5 text-11 font-normal text-muted-foreground transition-colors hover:bg-surface-1 hover:text-foreground"
          onClick={onToggleBoardPicker}
          disabled={sendBoardPending}
          aria-label="Send to a Board"
          title="Send this message to a Board you can edit"
        >
          <LayoutGrid className="h-3.5 w-3.5" strokeWidth={1.5} />
          Send to board
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          data-testid="msg-send-email"
          className="h-7 gap-1 px-1.5 text-11 font-normal text-muted-foreground transition-colors hover:bg-surface-1 hover:text-foreground"
          onClick={onSendEmail}
          disabled={sendEmailPending}
          aria-label="Send via email"
          title="Send this message to your email"
        >
          <Mail className="h-3.5 w-3.5" strokeWidth={1.5} />
          Email
        </Button>
      </div>
      {copied && (
        <p data-testid="msg-copy-status" className="text-11 text-muted-foreground">
          文本已被复制
        </p>
      )}
      {copyError && (
        <p role="alert" data-testid="msg-copy-error" className="text-11 text-destructive">
          Copy failed — please copy manually
        </p>
      )}
      {feedbackError && (
        <p role="alert" data-testid="msg-feedback-error" className="text-11 text-destructive">
          Feedback failed to submit — please try again
        </p>
      )}
      {regenerateError && (
        <p role="alert" data-testid="msg-regenerate-error" className="text-11 text-destructive">
          Regenerate failed — please try again
        </p>
      )}
      {sendBoardStatus && (
        <p data-testid="msg-board-status" className="text-11 text-muted-foreground">
          {sendBoardStatus}
        </p>
      )}
      {sendBoardError && (
        <p role="alert" data-testid="err-msg-board" className="text-11 text-destructive">
          {sendBoardError}
        </p>
      )}
      {sendEmailStatus && (
        <p data-testid="msg-email-status" className="text-11 text-muted-foreground">
          {sendEmailStatus}
        </p>
      )}
      {sendEmailError && (
        <p role="alert" data-testid="err-msg-email" className="text-11 text-destructive">
          {sendEmailError}
        </p>
      )}
      {boardPickerOpen && (
        <div
          data-testid="board-picker"
          className="absolute left-0 top-full z-20 mt-1 w-64 rounded-12 border border-border bg-background p-3 shadow-lg"
        >
          <p className="text-11 font-medium text-foreground">Send to Board</p>
          {boardsLoading && (
            <p className="mt-2 text-11 text-muted-foreground">Loading boards…</p>
          )}
          {boardsLoadError && (
            <p role="alert" data-testid="err-board-list" className="mt-2 text-11 text-destructive">
              Failed to load boards — please try again
            </p>
          )}
          {!boardsLoading && !boardsLoadError && editableBoards && editableBoards.length === 0 && (
            <p data-testid="board-picker-empty" className="mt-2 text-11 text-muted-foreground">
              No editable boards yet — create a Board first
            </p>
          )}
          {!boardsLoading && !boardsLoadError && editableBoards && editableBoards.length > 0 && (
            <ul className="mt-2 max-h-48 space-y-0.5 overflow-y-auto">
              {editableBoards.map((board) => (
                <li key={board.id}>
                  <Button
                    type="button"
                    variant="ghost"
                    data-testid={`board-picker-option-${board.id}`}
                    className="h-auto w-full justify-start truncate px-2 py-1.5 text-left text-12 font-normal text-foreground hover:bg-surface-1"
                    onClick={() => onChooseBoard(board.id)}
                    disabled={sendBoardPending}
                  >
                    {board.name}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ─── SSE 消费（POST body 是 ReadableStream，浏览器原生 EventSource 不支持 POST，手动解析）──

interface SseHandlers {
  onUser: (msg: Message, attachments?: MessageAttachment[]) => void;
  onUpdated?: (msg: Message) => void;
  onToken: (token: string) => void;
  onDone: (msg: Message) => void;
  onError: (msg: Message) => void;
}

async function consumeSse(body: ReadableStream<Uint8Array>, handlers: SseHandlers): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sepIndex: number;
    while ((sepIndex = buffer.indexOf("\n\n")) !== -1) {
      const rawEvent = buffer.slice(0, sepIndex);
      buffer = buffer.slice(sepIndex + 2);
      dispatchSseEvent(rawEvent, handlers);
    }
  }
}

function dispatchSseEvent(raw: string, handlers: SseHandlers): void {
  let event = "message";
  let data = "";
  for (const line of raw.split("\n")) {
    if (line.startsWith("event: ")) event = line.slice("event: ".length);
    else if (line.startsWith("data: ")) data += line.slice("data: ".length);
  }
  if (!data) return;
  const parsed = JSON.parse(data);
  if (event === "user") handlers.onUser(parsed.message, parsed.attachments);
  else if (event === "updated") handlers.onUpdated?.(parsed.message);
  else if (event === "token") handlers.onToken(parsed.token);
  else if (event === "chunk") {
    const token =
      typeof parsed.content === "string"
        ? parsed.content
        : typeof parsed.token === "string"
          ? parsed.token
          : typeof parsed.data === "string"
            ? parsed.data
            : typeof parsed.data?.content === "string"
              ? parsed.data.content
              : "";
    if (token) handlers.onToken(token);
  } else if (event === "result") {
    const content =
      typeof parsed.data?.content === "string"
        ? parsed.data.content
        : typeof parsed.content === "string"
          ? parsed.content
          : "";
    if (parsed.message) {
      handlers.onDone(parsed.message);
    } else if (content) {
      handlers.onDone({
        id: -Date.now(),
        role: "assistant",
        content,
        status: "complete",
      });
    }
  } else if (event === "done" && parsed.message) handlers.onDone(parsed.message);
  else if (event === "error" && parsed.message) handlers.onError(parsed.message);
}

interface ThreadGroup {
  key: string;
  label: string;
  threads: ThreadSummary[];
}

function groupThreadsByDate(threads: ThreadSummary[]): ThreadGroup[] {
  const groups = new Map<string, ThreadGroup>();
  for (const thread of threads) {
    const { key, label } = threadDateGroup(thread.updated_at);
    const existing = groups.get(key);
    if (existing) existing.threads.push(thread);
    else groups.set(key, { key, label, threads: [thread] });
  }
  return Array.from(groups.values());
}

function threadDateGroup(value: string): { key: string; label: string } {
  const date = new Date(value);
  const today = startOfLocalDay(new Date());
  const day = startOfLocalDay(date);
  const diffDays = Math.round((today.getTime() - day.getTime()) / 86_400_000);
  if (diffDays === 0) return { key: "today", label: "Today" };
  if (diffDays === 1) return { key: "yesterday", label: "Yesterday" };
  if (diffDays < 7) return { key: "last-7-days", label: "Last 7 days" };
  return { key: "older", label: "Older" };
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
