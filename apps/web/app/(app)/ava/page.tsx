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
// 消息反馈、分享只读、Deep Research、模型/Agent/工具切换、建议动作个性化、
// 发送到 Board / 邮件。线程重命名/删除（F02）、附件/图片/音频（F08）、
// 消息编辑/删除/重新生成（F03）、建议动作（F10）已在本文件实现。
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
  FileAudio,
  FileText,
  ImageIcon,
  MoreHorizontal,
  Pencil,
  Trash2,
  Check,
  X,
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
} from "./attachments";

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
interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  status: "complete" | "failed";
  attachments?: MessageAttachment[];
}
interface ThreadShare {
  thread_id: number;
  share_token: string;
  share_enabled: boolean;
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
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [editError, setEditError] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [menuThreadId, setMenuThreadId] = useState<number | null>(null);
  const [editingThreadId, setEditingThreadId] = useState<number | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  // 移动端视图切换：list-first。桌面端（md 及以上）始终双栏，此状态被 CSS 忽略。
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const [dragOver, setDragOver] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
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
      setThreadError("加载更多会话失败，请重试");
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
          setThreadError("加载会话失败，请稍后重试");
          setSettingsError("加载 AI 设置失败，请稍后重试");
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

  useEffect(() => {
    const onFocus = () => {
      void refreshCapabilities().catch(() => setSettingsError("刷新 AI 设置失败，已保留当前选择"));
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
    setEditingId(null);
    setDeleteConfirmId(null);
    setActionError("");
    setMenuThreadId(null);
    setEditingThreadId(null);
    setMessages([]);
    setMobileView("chat");
    attachments.reset();
    try {
      const res = await fetch(`/api/ava/threads/${id}`);
      if (guard(res.status)) return;
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMessages(data.messages ?? []);
    } catch {
      setSendError("加载消息失败，请稍后重试");
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
    setEditingId(null);
    setDeleteConfirmId(null);
    setActionError("");
    setMenuThreadId(null);
    setEditingThreadId(null);
    setDraft("");
    setMobileView("chat");
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
      setActionError("标题不能为空");
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
        setActionError(data?.errors?.title ?? data?.error ?? "重命名失败，请重试");
        return;
      }
      setThreads((prev) => prev.map((t) => (t.id === threadId ? data.thread : t)));
      setEditingThreadId(null);
      setRenameDraft("");
      setActionError("");
    } catch {
      setActionError("重命名失败，请重试");
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
        setActionError(data?.error ?? "删除失败，请重试");
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
      setActionError("删除失败，请重试");
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
          setSendError("发送失败，请重试（你的输入已保留）");
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
          setSendError("AVA 生成回复失败，请重试。");
        },
      });
      await refreshThreads();
    } catch {
      setSendError("发送失败，请重试（你的输入已保留）");
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
        setEditError(errBody?.errors?.text ?? errBody?.error ?? "保存失败，请重试");
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
          setSendError("AVA 生成回复失败，请重试。");
        },
      });
      await refreshThreads();
    } catch {
      setEditError("保存失败，请重试");
    } finally {
      setSending(false);
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
        setSendError(errBody?.error ?? "删除失败，请重试");
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
      setSendError("删除失败，请重试");
    } finally {
      setDeletingId(null);
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
                重试
              </Button>
            </div>
          ) : threads.length === 0 ? (
            <p data-testid="threads-empty" className="px-1 pt-2 text-xs text-muted-foreground">
              还没有会话，开始聊天即可创建。
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
                  分享
                </Button>
              </div>
              {shareOpen && (
                <div
                  data-testid="share-panel"
                  className="absolute right-4 top-12 z-20 w-80 rounded-12 border border-border bg-background p-4 shadow-lg"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-13 font-semibold text-foreground">通过链接分享</h2>
                      <p className="mt-1 text-11 leading-relaxed text-muted-foreground">
                        公开链接仅包含这条聊天中的消息，不包含私有附件或团队私有上下文。
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
                    <Label htmlFor="ava-share-url">分享链接</Label>
                    <Input
                      id="ava-share-url"
                      data-testid="share-link"
                      readOnly
                      value={currentShareUrl}
                      placeholder={shareLoading ? "Loading share link..." : "点击复制链接生成分享"}
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
                      {currentShareUrl ? "复制链接" : "通过链接分享"}
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
                      关闭分享
                    </Button>
                    <Button
                      data-testid="share-email-disabled"
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1.5 transition-colors hover:bg-surface-1"
                      disabled
                    >
                      <Mail className="h-4 w-4" strokeWidth={1.5} />
                      发送到邮箱
                    </Button>
                  </div>
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
                    <h1 className="mt-3.5 text-17 font-semibold text-foreground">我能帮你做什么？</h1>
                    <p className="mt-1 text-13 text-muted-foreground">选一个起点，或直接输入。</p>
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
                                    {m.attachments.map((a) => (
                                      <li
                                        key={a.id}
                                        data-testid="msg-attachment-item"
                                        className="flex items-center gap-1 rounded-9 border border-border bg-surface-1 px-2 py-1 text-11 text-muted-foreground"
                                      >
                                        {a.kind === "image" ? (
                                          <ImageIcon className="h-3 w-3" strokeWidth={1.5} />
                                        ) : a.kind === "audio" ? (
                                          <FileAudio className="h-3 w-3" strokeWidth={1.5} />
                                        ) : (
                                          <FileText className="h-3 w-3" strokeWidth={1.5} />
                                        )}
                                        <span className="max-w-[10rem] truncate">{a.name}</span>
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
                                        取消
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        data-testid="msg-edit-save"
                                        onClick={() => void saveEdit(m.id)}
                                        disabled={sending}
                                      >
                                        {sending ? "保存中…" : "保存"}
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
                                        编辑
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
                                        删除最后一次请求
                                      </Button>
                                    </div>
                                    {deleteConfirmId === m.id && (
                                      <div className="rounded-12 border border-destructive/40 bg-background p-3">
                                        <p data-testid="msg-delete-confirm" className="text-11 text-foreground">
                                          确认删除最后一次请求及其后续回复？
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
                                            取消
                                          </Button>
                                          <Button
                                            type="button"
                                            variant="destructive"
                                            size="sm"
                                            data-testid="msg-delete-confirm-action"
                                            onClick={() => void deleteLastRequest(m.id)}
                                            disabled={deletingId === m.id}
                                          >
                                            {deletingId === m.id ? "删除中…" : "确认删除"}
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
                              <MarkdownMessage content={m.content} />
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
                {sending && (
                  <div data-testid="sending" className="flex items-start gap-2.5">
                    <span className="flex h-7 w-7 flex-none items-center justify-center rounded-7 bg-primary text-11 font-bold text-primary-foreground">
                      AI
                    </span>
                    {streamingText ? (
                      <div data-testid="msg-assistant-streaming">
                        <MarkdownMessage content={streamingText} />
                      </div>
                    ) : (
                      <span className="text-13 text-muted-foreground">AVA 正在思考…</span>
                    )}
                  </div>
                )}
              </div>
            </div>

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
                              setSettingsError("该模型当前不可选，已保留原模型");
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
                              setSettingsError("已有消息的线程不能切换 Agent");
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
                  Message AVA
                </label>
                <textarea
                  id="ava-composer"
                  ref={composerRef}
                  data-testid="composer"
                  rows={1}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={onComposerKey}
                  placeholder="Message AVA…"
                  className="block max-h-40 w-full resize-none bg-transparent text-sm text-foreground transition-colors placeholder:text-placeholder focus-visible:outline-none focus-visible:ring-0"
                />
                {sendError && (
                  <p role="alert" data-testid="send-error" className="mt-2 text-xs text-destructive">
                    {sendError}
                  </p>
                )}
                <div className="mt-2 flex items-center justify-between">
                  <AttachmentTrigger onFiles={(files) => void attachments.addFiles(files)} />
                  <Button
                    data-testid="send"
                    size="icon"
                    className="h-8 w-8 rounded-9"
                    onClick={() => void send()}
                    disabled={
                      (!draft.trim() && attachments.uploadedIds.length === 0) ||
                      sending ||
                      attachments.hasPending
                    }
                    aria-label="Send message"
                  >
                    <ArrowUp className="h-4 w-4" strokeWidth={2} />
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
      aria-label="建议操作"
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
          className="h-auto rounded-9 px-3.5 py-2.5 text-13 font-normal text-foreground transition-colors hover:border-foreground hover:bg-surface-1"
        >
          {action.label}
        </Button>
      ))}
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
