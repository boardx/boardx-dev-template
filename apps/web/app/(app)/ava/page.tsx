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
  X,
  CheckCircle2,
  Loader2,
  Search,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  LayoutGrid,
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
import { VoiceInputControl } from "./voice-input";

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
type ComposerMode = "chat" | "research";
type ResearchStatus = "idle" | "draft" | "running" | "complete" | "error";
interface ResearchPhase {
  name: string;
  tasks: string[];
}
interface ResearchTimelineItem {
  phase: string;
  task: string;
  status: "queued" | "running" | "complete";
}
interface ResearchReport {
  title: string;
  conclusion: string;
  sections: Array<{ heading: string; bullets: string[] }>;
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
}
interface AvaCapabilities {
  models: CapabilityOption[];
  agents: CapabilityOption[];
  tools: CapabilityOption[];
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

const FOLLOW_UP_SUGGESTED_ACTIONS: SuggestedAction[] = [
  { id: "make-tasks", label: "拆成任务", prompt: "把上面的建议拆成可执行任务，并按优先级排序。" },
  { id: "find-risks", label: "识别风险", prompt: "基于上面的回复，列出主要风险和缓解措施。" },
  { id: "shorten", label: "压缩摘要", prompt: "把上面的回复压缩成 5 条要点。" },
];

const THREAD_PAGE_SIZE = 20;

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
  const [researchRun, setResearchRun] = useState<ResearchRun | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [billingOpen, setBillingOpen] = useState(false);
  const [capabilities, setCapabilities] = useState<AvaCapabilities | null>(null);
  const [settingsError, setSettingsError] = useState("");
  const [modelId, setModelId] = useState("stub:default");
  const [agentId, setAgentId] = useState("default");
  const [toolIds, setToolIds] = useState<string[]>(["web-search"]);
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
  const [menuThreadId, setMenuThreadId] = useState<number | null>(null);
  const [editingThreadId, setEditingThreadId] = useState<number | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  // 移动端视图切换：list-first。桌面端（md 及以上）始终双栏，此状态被 CSS 忽略。
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const [dragOver, setDragOver] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeReport = researchRun?.research?.report;
  const isResearchMode = composerMode === "research";
  const composerPlaceholder = isResearchMode
    ? "Describe the research topic, audience, and decision…"
    : "Message AVA…";
  const canSend = Boolean(draft.trim()) && !sending && researchRun?.status !== "running";
  const researchStatusLabel = useMemo(() => {
    if (!researchRun) return "";
    if (researchRun.status === "draft") return "Plan ready for review";
    if (researchRun.status === "running") return "Research running";
    if (researchRun.status === "complete") return "Report ready";
    if (researchRun.status === "error") return "Needs attention";
    return "";
  }, [researchRun]);
  const composerRef = useRef<HTMLTextAreaElement>(null);

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
    setModelId((prev) =>
      data.models.some((m) => m.id === prev && !m.disabled) ? prev : data.defaults.modelId
    );
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
    (async () => {
      try {
        const res = await fetch(`/api/ai-store/items/${itemId}`);
        if (!res.ok) return;
        const data = await res.json();
        const name: string = data.item?.name ?? "";
        if (!name) return;
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
  }, []);

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
    setDraft("");
    setResearchRun(null);
    setReportOpen(false);
    setMobileView("chat");
    setMsgCopiedId(null);
    setMsgCopyError(null);
    setFeedbackErrorId(null);
    setRegeneratingId(null);
    setRegenerateErrorId(null);
    attachments.reset();
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
    const text = draft.trim();
    const attachmentIds = attachments.uploadedIds;
    // 文本和附件至少要有一个；上传中/失败的附件会阻塞发送，避免半上传附件随消息发出
    // （失败态附件不阻塞——用户可以移除它继续发送纯文本，只有 uploading 阻塞）。
    if ((!text && attachmentIds.length === 0) || sending || attachments.hasPending) return;
    setSending(true);
    setSendError("");
    setStreamingText("");

    try {
      const threadId = await ensureThread();
      if (threadId == null) return; // guard 已处理未登录跳转

      const res = await fetch(`/api/ava/threads/${threadId}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, attachmentIds, modelId, agentId, toolIds }),
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
        },
        onError: (msg: Message) => {
          setMessages((prev) => [...prev, msg]);
          setStreamingText("");
          setSendError("AVA failed to generate a reply — please try again.");
        },
      });
      await refreshThreads();
    } catch {
      setSendError("Send failed — please try again (your input is preserved)");
    } finally {
      setSending(false);
    }
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
        body: JSON.stringify({ topic, audience: RESEARCH_AUDIENCE }),
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
        status: "draft",
        research: data.research,
        assistantMessage: data.messages.assistant,
        timeline: data.research.timeline.map((item: ResearchTimelineItem, index: number) => ({
          ...item,
          status: index === 0 ? "running" : "queued",
        })),
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

  function confirmResearchPlan() {
    if (!researchRun?.research || researchRun.status !== "draft") return;
    const queued: ResearchTimelineItem[] = researchRun.research.timeline.map((item, index) => ({
      ...item,
      status: index === 0 ? "running" : "queued",
    }));
    setResearchRun({ ...researchRun, status: "running", timeline: queued });

    researchRun.research.timeline.forEach((item, index) => {
      window.setTimeout(() => {
        setResearchRun((current) => {
          if (!current?.research) return current;
          const timeline = current.research.timeline.map((candidate, candidateIndex) => ({
            ...candidate,
            status:
              candidateIndex <= index
                ? "complete"
                : candidateIndex === index + 1
                  ? "running"
                  : "queued",
          })) as ResearchTimelineItem[];
          const isDone = index === current.research.timeline.length - 1;
          if (!isDone) return { ...current, status: "running", timeline };
          const nextMessages = current.assistantMessage ? [current.assistantMessage] : [];
          setMessages((prev) => [...prev, ...nextMessages]);
          setReportOpen(true);
          return { ...current, status: "complete", timeline };
        });
      }, 350 * (index + 1));
    });
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
      setSending(true);
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
      setSending(false);
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
    return FOLLOW_UP_SUGGESTED_ACTIONS;
  }, [latestMessage, sending]);

  function chooseSuggestedAction(prompt: string) {
    setDraft(prompt);
    requestAnimationFrame(() => composerRef.current?.focus());
  }
  const currentShareUrl = shareUrl();
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
                              <Button
                                variant="ghost"
                                size="icon"
                                data-testid={`thread-menu-${t.id}`}
                                className="mr-1 h-8 w-8 rounded-9 transition-colors"
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
        className={`min-w-0 flex-1 flex-col md:flex ${mobileView === "chat" ? "flex" : "hidden"}`}
      >
        {error ? (
          <div className="flex flex-1 items-center justify-center px-6">
            <p role="alert" data-testid="error" className="text-13 text-destructive">
              {error}
            </p>
          </div>
        ) : (
          <>
            <div className="relative flex flex-none items-center gap-2 border-b border-border px-4 py-2.5">
              <Button
                variant="ghost"
                size="icon"
                data-testid="back-to-list"
                className="h-8 w-8 md:hidden"
                onClick={() => setMobileView("list")}
                aria-label="Back to thread list"
              >
                <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
              </Button>
              <span className="text-13 font-medium text-foreground">AVA</span>
              <div className="ml-auto">
                <Button
                  variant="ghost"
                  size="sm"
                  data-testid="ava-share"
                  className="h-8 gap-1.5 transition-colors hover:bg-surface-1"
                  onClick={() => void toggleSharePanel()}
                  disabled={!activeId}
                >
                  <Share2 className="h-4 w-4" strokeWidth={1.5} />
                  Share
                </Button>
              </div>
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

            <div ref={scrollRef} className="flex-1 overflow-auto py-6">
              <div className="mx-auto flex max-w-2xl flex-col gap-5 px-6">
                <div
                  data-testid="ai-low-credits-prompt"
                  className="flex items-center justify-between gap-3 rounded-12 border border-border bg-surface-1 px-4 py-3"
                >
                  <div>
                    <div className="text-13 font-semibold text-foreground">AI credits</div>
                    <div className="text-12 text-muted-foreground">Buy credits or upgrade your plan before a heavy AVA run.</div>
                  </div>
                  <Button data-testid="ai-low-credits-open-billing" size="sm" onClick={() => setBillingOpen(true)}>
                    Upgrade
                  </Button>
                </div>
                {isEmptyThread ? (
                  <div data-testid="empty" className="pt-10 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-12 bg-primary text-primary-foreground">
                      <Sparkles className="h-5 w-5" strokeWidth={1.5} />
                    </div>
                    <h1 className="mt-3.5 text-17 font-semibold text-foreground">How can I help?</h1>
                    <p className="mt-1 text-13 text-muted-foreground">Pick a starting point, or just type below.</p>
                    <SuggestedActions
                      actions={EMPTY_SUGGESTED_ACTIONS}
                      align="center"
                      className="mt-5"
                      onChoose={chooseSuggestedAction}
                    />
                  </div>
                ) : (
                  <ul data-testid="messages" className="flex flex-col gap-5">
                    {messages.map((m) => {
                      const showReplySuggestions =
                        m.id === latestMessage?.id && replySuggestedActions.length > 0;
                      return (
                        <li key={m.id} className="flex flex-col gap-2.5">
                          <div
                            data-testid={`msg-${m.role}`}
                            data-status={m.status}
                            className={`flex items-start gap-2.5 ${m.role === "user" ? "justify-end" : ""}`}
                          >
                            {m.role === "assistant" && (
                              <span className="flex h-7 w-7 flex-none items-center justify-center rounded-7 bg-primary text-11 font-bold text-primary-foreground">
                                AI
                              </span>
                            )}
                            {m.role === "user" ? (
                              <div className="flex max-w-[85%] flex-col items-end gap-2">
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
                                    className="w-full rounded-12 border border-border bg-background p-3"
                                  >
                                    <div
                                      data-testid={`msg-user-content-${m.id}`}
                                      className="mb-2 whitespace-pre-wrap rounded-12 bg-surface-1 px-4 py-2.5 text-sm leading-relaxed text-foreground"
                                    >
                                      {m.content}
                                    </div>
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
                                      className="min-h-20 resize-none"
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
                                    <div className="mt-2 flex justify-end gap-2">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        data-testid="msg-edit-cancel"
                                        onClick={cancelEdit}
                                        disabled={sending}
                                      >
                                        Cancel
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        data-testid="msg-edit-save"
                                        onClick={() => void saveEdit(m.id)}
                                        disabled={sending}
                                      >
                                        {sending ? "Saving…" : "Save"}
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div
                                    data-testid={`msg-user-content-${m.id}`}
                                    className="whitespace-pre-wrap rounded-12 bg-surface-1 px-4 py-2.5 text-sm leading-relaxed text-foreground"
                                  >
                                    {m.content}
                                  </div>
                                )}

                                {m.id === lastUserMessageId && editingId !== m.id && (
                                  <div className="flex flex-col items-end gap-2">
                                    <div className="flex items-center gap-1">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        data-testid="msg-edit"
                                        className="h-7 px-2 text-11 text-muted-foreground"
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
                                        className="h-7 px-2 text-11 text-destructive"
                                        onClick={() => setDeleteConfirmId(m.id)}
                                        disabled={sending || deletingId != null}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                                        Delete last request
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
                              <div className="flex max-w-[85%] flex-col gap-1.5">
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
                    <span className="flex h-7 w-7 flex-none items-center justify-center rounded-7 bg-primary text-11 font-bold text-primary-foreground">
                      AI
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
                    <span className="flex h-7 w-7 flex-none items-center justify-center rounded-7 bg-primary text-11 font-bold text-primary-foreground">
                      AI
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
                    onConfirm={confirmResearchPlan}
                    onOpenReport={() => setReportOpen(true)}
                  />
                )}
              </div>
            </div>

            {reportOpen && activeReport && (
              <ReportPanel report={activeReport} onClose={() => setReportOpen(false)} />
            )}

            {/* composer */}
            <div className="flex-none px-6 pb-5">
              <div
                data-testid="composer-dropzone"
                data-drag-over={dragOver}
                className={`mx-auto max-w-2xl rounded-14 border p-3 transition-colors focus-within:border-foreground ${
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
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={composerMode === "chat" ? "default" : "outline"}
                    data-testid="mode-chat"
                    onClick={() => setComposerMode("chat")}
                    className="gap-1.5 transition-all hover:shadow-sm"
                  >
                    <Sparkles className="h-4 w-4" strokeWidth={1.5} />
                    Chat
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={composerMode === "research" ? "default" : "outline"}
                    data-testid="mode-research"
                    onClick={() => setComposerMode("research")}
                    className="gap-1.5 transition-all hover:shadow-sm"
                  >
                    <Search className="h-4 w-4" strokeWidth={1.5} />
                    Deep Research
                  </Button>
                </div>
                <div className="mb-3 flex flex-col gap-2 rounded-9 bg-surface-1 p-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span data-testid="current-model" className="font-medium text-foreground">
                      Model: {activeModel?.label ?? modelId}
                    </span>
                    <span data-testid="current-agent">Agent: {activeAgent?.label ?? agentId}</span>
                    <span data-testid="current-tools">
                      Tools: {activeTools.length > 0 ? activeTools.join(", ") : "None"}
                    </span>
                  </div>
                  {settingsError && (
                    <p role="alert" data-testid="err-ai-settings" className="text-xs text-destructive">
                      {settingsError}
                    </p>
                  )}
                  {capabilities ? (
                    <div data-testid="ai-settings" className="grid gap-2 md:grid-cols-[1fr_1fr_1.3fr]">
                      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                        Model
                        <Select
                          data-testid="model-select"
                          aria-label="Select AVA model"
                          value={modelId}
                          onChange={(e) => {
                            const next = capabilities.models.find((model) => model.id === e.target.value);
                            if (!next || next.disabled) {
                              setSettingsError("This model is currently unavailable — kept the previous model");
                              return;
                            }
                            setSettingsError("");
                            setModelId(next.id);
                          }}
                        >
                          {capabilities.models.map((model) => (
                            <option key={model.id} value={model.id} disabled={model.disabled}>
                              {model.label}
                              {model.disabled ? " (restricted)" : ""}
                            </option>
                          ))}
                        </Select>
                      </label>
                      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                        Agent
                        <Select
                          data-testid="agent-select"
                          aria-label="Select AVA agent"
                          value={agentId}
                          disabled={!canSwitchAgent}
                          onChange={(e) => {
                            if (!canSwitchAgent) {
                              setSettingsError("Agent can't be switched once a thread has messages");
                              return;
                            }
                            setSettingsError("");
                            setAgentId(e.target.value);
                          }}
                        >
                          {capabilities.agents.map((agent) => (
                            <option key={agent.id} value={agent.id}>
                              {agent.label}
                            </option>
                          ))}
                        </Select>
                      </label>
                      <div className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                        <span>Tools</span>
                        <div className="flex flex-wrap gap-1.5">
                          {capabilities.tools.map((tool) => {
                            const selected = toolIds.includes(tool.id);
                            return (
                              <Button
                                key={tool.id}
                                type="button"
                                variant={selected ? "default" : "outline"}
                                size="sm"
                                data-testid={`tool-${tool.id}`}
                                className="h-9 gap-1.5 rounded-9 px-2.5 text-xs transition-colors"
                                onClick={() => {
                                  setSettingsError("");
                                  setToolIds((prev) =>
                                    prev.includes(tool.id)
                                      ? prev.filter((id) => id !== tool.id)
                                      : [...prev, tool.id]
                                  );
                                }}
                              >
                                <Wrench className="h-3.5 w-3.5" strokeWidth={1.5} />
                                {tool.label}
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div data-testid="loading" className="grid animate-pulse gap-2 md:grid-cols-3">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-9 rounded-md bg-muted" />
                      ))}
                    </div>
                  )}
                  {!canSwitchAgent && (
                    <p data-testid="agent-locked" className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Bot className="h-3.5 w-3.5" strokeWidth={1.5} />
                      Agent is locked after messages exist in this thread.
                    </p>
                  )}
                </div>
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
                <textarea
                  id="ava-composer"
                  ref={composerRef}
                  data-testid="composer"
                  rows={1}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={onComposerKey}
                  placeholder={composerPlaceholder}
                  className="min-h-10 max-h-40 resize-none border-0 bg-transparent px-0 py-0 text-sm shadow-none transition-colors placeholder:text-placeholder focus-visible:ring-2 focus-visible:ring-ring"
                />
                {sendError && (
                  <p role="alert" data-testid="send-error" className="mt-2 text-xs text-destructive">
                    {sendError}
                  </p>
                )}
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <AttachmentTrigger onFiles={(files) => void attachments.addFiles(files)} />
                    <VoiceInputControl
                      disabled={sending}
                      onTranscribed={(text) =>
                        setDraft((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text))
                      }
                    />
                  </div>
                  <Button
                    data-testid="send"
                    size="icon"
                    className="h-8 w-8 rounded-9"
                    onClick={() => void send()}
                    disabled={
                      (!draft.trim() && attachments.uploadedIds.length === 0) ||
                      sending ||
                      attachments.hasPending ||
                      researchRun?.status === "running"
                    }
                    aria-label={isResearchMode ? "Start Deep Research" : "Send message"}
                  >
                    {isResearchMode ? (
                      <Search className="h-4 w-4" strokeWidth={2} />
                    ) : (
                      <ArrowUp className="h-4 w-4" strokeWidth={2} />
                    )}
                  </Button>
                </div>
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
  onConfirm,
  onOpenReport,
}: {
  run: ResearchRun;
  statusLabel: string;
  onConfirm: () => void;
  onOpenReport: () => void;
}) {
  const hasPlan = Boolean(run.research);
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
            <h2 className="text-13 font-semibold text-foreground">Clarifying questions</h2>
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
              </div>
              {run.status === "draft" && (
                <Button
                  type="button"
                  size="sm"
                  data-testid="confirm-research-plan"
                  onClick={onConfirm}
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

function ReportPanel({ report, onClose }: { report: ResearchReport; onClose: () => void }) {
  return (
    <aside
      data-testid="research-report-panel"
      className="flex max-h-80 flex-none flex-col border-t border-border bg-background px-6 py-4"
    >
      <div className="mx-auto flex w-full max-w-2xl items-start justify-between gap-4">
        <div>
          <h2 className="text-17 font-semibold text-foreground">{report.title}</h2>
          <p data-testid="report-conclusion" className="mt-2 text-13 leading-relaxed text-muted-foreground">
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
      <div className="mx-auto mt-4 grid w-full max-w-2xl gap-3 overflow-auto md:grid-cols-2">
        {report.sections.map((section) => (
          <section key={section.heading} className="rounded-9 border border-border bg-surface-1 p-3">
            <h3 className="text-13 font-semibold text-foreground">{section.heading}</h3>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-13 text-muted-foreground">
              {section.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
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
}) {
  return (
    <div data-testid={`msg-actions-${message.id}`} className="flex flex-col gap-1">
      <div className="flex items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          data-testid="msg-copy"
          className="h-7 w-7 text-muted-foreground transition-colors hover:bg-surface-1"
          onClick={onCopy}
          aria-label="Copy message"
        >
          {copied ? <Check className="h-3.5 w-3.5" strokeWidth={1.5} /> : <Copy className="h-3.5 w-3.5" strokeWidth={1.5} />}
        </Button>
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
        {isLast && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            data-testid="msg-regenerate"
            className="h-7 w-7 text-muted-foreground transition-colors hover:bg-surface-1"
            onClick={onRegenerate}
            disabled={disabled}
            aria-label="Regenerate response"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", regenerating && "animate-spin")} strokeWidth={1.5} />
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          data-testid="msg-send-to-board"
          className="h-7 w-7 text-muted-foreground"
          disabled
          aria-label="Send to current Board (coming soon)"
          title="Only available inside a Board — coming soon"
        >
          <LayoutGrid className="h-3.5 w-3.5" strokeWidth={1.5} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          data-testid="msg-send-email"
          className="h-7 w-7 text-muted-foreground"
          disabled
          aria-label="Send via email (coming soon)"
          title="Email delivery coming soon"
        >
          <Mail className="h-3.5 w-3.5" strokeWidth={1.5} />
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
  else if (event === "done") handlers.onDone(parsed.message);
  else if (event === "error") handlers.onError(parsed.message);
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
