"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AudioLines, BarChart3, Download, Presentation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  StudioPanel,
  STUDIO_TYPE_LABEL,
  type StudioArtifact,
  type StudioArtifactType,
  type StudioArtifactSource,
  type StudioSources,
} from "@/components/studio/studio-panel";
import {
  PresentationConfigModal,
  type PresentationSource,
  type PresentationSources,
} from "@/components/presentations/presentation-config-modal";
import {
  PresentationPreviewCard,
  type PresentationArtifact,
} from "@/components/presentations/presentation-preview-card";

interface Chat {
  id: number | string;
  name: string;
}

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
}

const STUDIO_TYPE_ICON: Record<StudioArtifactType, typeof AudioLines> = {
  audio: AudioLines,
  infographic: BarChart3,
  presentation: Presentation,
};

export default function RoomChatDetailPage() {
  const params = useParams<{ id: string; chatId: string }>();
  const router = useRouter();
  const { id: roomId, chatId } = params;
  const [chat, setChat] = useState<Chat | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  // Studio（P12 F01）
  const [studioType, setStudioType] = useState<StudioArtifactType>("audio");
  const [studioSource, setStudioSource] = useState<StudioArtifactSource>("current_chat");
  const [studioPrompt, setStudioPrompt] = useState("");
  const [studioSources, setStudioSources] = useState<StudioSources | null>(null);
  const [studioArtifacts, setStudioArtifacts] = useState<StudioArtifact[]>([]);
  const [studioGenerating, setStudioGenerating] = useState(false);
  const [studioGenError, setStudioGenError] = useState("");

  // 演示文稿生成（P12 F02）
  const [presentationModalOpen, setPresentationModalOpen] = useState(false);
  const [presentationTopic, setPresentationTopic] = useState("");
  const [presentationSource, setPresentationSource] = useState<PresentationSource>("current_chat");
  const [presentationInstructions, setPresentationInstructions] = useState("");
  const [presentationPages, setPresentationPages] = useState(8);
  const [presentationStyle, setPresentationStyle] = useState("minimal");
  const [presentationSources, setPresentationSources] = useState<PresentationSources | null>(null);
  const [presentationArtifacts, setPresentationArtifacts] = useState<PresentationArtifact[]>([]);
  const [presentationGenerating, setPresentationGenerating] = useState(false);
  const [presentationGenError, setPresentationGenError] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await fetch(`/api/rooms/${roomId}/chats/${chatId}`);
      if (!alive) return;
      if (res.status === 401) return router.replace("/login");
      if (res.status === 403) return setError("你不是该房间成员"), setLoading(false);
      if (res.status === 404) return setError("线程不存在"), setLoading(false);
      const d = await res.json();
      setChat(d.chat);
      setCanEdit(!!d.canEdit);
      const mres = await fetch(`/api/rooms/${roomId}/chats/${chatId}/messages`);
      if (!alive) return;
      if (mres.ok) {
        const md = await mres.json();
        setMessages(md.messages ?? []);
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [roomId, chatId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setSendError("");
    try {
      const res = await fetch(`/api/rooms/${roomId}/chats/${chatId}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        setSendError("发送失败，请重试");
        return;
      }
      const d = await res.json();
      setMessages((prev) => [...prev, d.userMessage, d.replyMessage]);
      setDraft("");
    } catch {
      setSendError("发送失败，请重试");
    } finally {
      setSending(false);
    }
  }

  async function loadStudioSources() {
    const res = await fetch(`/api/rooms/${roomId}/chats/${chatId}/studio/sources`);
    if (res.ok) setStudioSources((await res.json()).sources);
  }

  async function loadStudioArtifacts() {
    const res = await fetch(`/api/rooms/${roomId}/chats/${chatId}/studio/artifacts`);
    if (res.ok) setStudioArtifacts((await res.json()).artifacts ?? []);
  }

  // 面板打开后拉取来源可用性 + 制品列表；轮询驱动「生成中 → ready/error」状态刷新
  // （与 knowledge-base 页一致的 2s 轮询模式，异步生成无法瞬时完成）。
  useEffect(() => {
    if (loading || error) return;
    void loadStudioSources();
    void loadStudioArtifacts();
    const t = setInterval(() => {
      void loadStudioSources();
      void loadStudioArtifacts();
    }, 2000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, error, roomId, chatId]);

  async function generateStudio() {
    if (studioGenerating) return;
    setStudioGenerating(true);
    setStudioGenError("");
    try {
      const res = await fetch(`/api/rooms/${roomId}/chats/${chatId}/studio/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: studioType, source: studioSource, prompt: studioPrompt }),
      });
      if (res.status !== 202) {
        const d = await res.json().catch(() => ({}));
        setStudioGenError(d.errors?.source ?? d.errors?.type ?? d.error ?? "生成失败，请重试");
        return;
      }
      const { artifact } = await res.json();
      setStudioArtifacts((prev) => [...prev, artifact]);
      setStudioPrompt("");
      void loadStudioArtifacts();
    } catch {
      setStudioGenError("生成失败，请重试");
    } finally {
      setStudioGenerating(false);
    }
  }

  async function retryStudio(artifactId: string) {
    const res = await fetch(
      `/api/rooms/${roomId}/chats/${chatId}/studio/artifacts/${artifactId}/retry`,
      { method: "POST" }
    );
    if (res.ok) void loadStudioArtifacts();
  }

  async function loadPresentationSources() {
    const res = await fetch(`/api/rooms/${roomId}/chats/${chatId}/presentations/sources`);
    if (res.ok) setPresentationSources((await res.json()).sources);
  }

  async function loadPresentationArtifacts() {
    const res = await fetch(`/api/rooms/${roomId}/chats/${chatId}/presentations/artifacts`);
    if (res.ok) setPresentationArtifacts((await res.json()).artifacts ?? []);
  }

  // 同 Studio：面板打开后拉取来源可用性 + 制品列表；轮询驱动「生成中 → ready/error」
  // 状态刷新（异步生成无法瞬时完成）。
  useEffect(() => {
    if (loading || error) return;
    void loadPresentationSources();
    void loadPresentationArtifacts();
    const t = setInterval(() => {
      void loadPresentationSources();
      void loadPresentationArtifacts();
    }, 2000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, error, roomId, chatId]);

  async function generatePresentation() {
    if (presentationGenerating) return;
    setPresentationGenerating(true);
    setPresentationGenError("");
    try {
      const res = await fetch(`/api/presentations/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          roomId: Number(roomId),
          chatId: Number(chatId),
          topic: presentationTopic,
          source: presentationSource,
          instructions: presentationInstructions,
          pages: presentationPages,
          style: presentationStyle,
        }),
      });
      if (res.status !== 202) {
        const d = await res.json().catch(() => ({}));
        setPresentationGenError(d.errors?.source ?? d.error ?? "生成失败，请重试");
        return;
      }
      const { artifact } = await res.json();
      setPresentationArtifacts((prev) => [...prev, artifact]);
      setPresentationTopic("");
      setPresentationInstructions("");
      setPresentationModalOpen(false);
      void loadPresentationArtifacts();
    } catch {
      setPresentationGenError("生成失败，请重试");
    } finally {
      setPresentationGenerating(false);
    }
  }

  async function retryPresentation(artifactId: string) {
    const res = await fetch(
      `/api/rooms/${roomId}/chats/${chatId}/presentations/artifacts/${artifactId}/retry`,
      { method: "POST" }
    );
    if (res.ok) void loadPresentationArtifacts();
  }

  async function downloadPresentation(artifactId: string, format: "pptx" | "pdf") {
    const res = await fetch(
      `/api/rooms/${roomId}/chats/${chatId}/presentations/artifacts/${artifactId}/download?format=${format}`
    );
    if (!res.ok) return;
    const { url } = await res.json();
    const a = document.createElement("a");
    a.href = url;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  if (loading) {
    return <div data-testid="loading" className="h-[80vh] animate-pulse bg-muted/40" />;
  }
  if (error) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p role="alert" data-testid="err" className="text-sm text-destructive">
          {error}
        </p>
      </div>
    );
  }

  return (
    <div data-testid="chat-workspace" className="flex h-[80vh] flex-col">
      {/* 头部：返回 + 标题 + Agent 选择占位 */}
      <header className="flex items-center justify-between border-b bg-card px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Button data-testid="back-to-room" size="sm" variant="ghost" onClick={() => router.push(`/rooms/${roomId}/chats`)}>
            ← 返回房间
          </Button>
          <span data-testid="chat-name" className="text-base font-semibold text-foreground">
            {chat?.name}
          </span>
          {!canEdit && (
            <Badge variant="muted" data-testid="readonly-badge">
              仅查看
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            data-testid="presentation-generate-open"
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={!canEdit}
            onClick={() => setPresentationModalOpen(true)}
          >
            <Presentation className="h-3.5 w-3.5" />
            生成演示
          </Button>
          <Button data-testid="agent-select" size="sm" variant="secondary" disabled title="Agent 选择将在 p9 接入">
            选择 Agent
          </Button>
        </div>
      </header>

      {/* 三栏工作区 */}
      <div className="grid flex-1 grid-cols-[14rem_1fr_14rem] overflow-hidden">
        {/* 左：Room Files（p10） */}
        <aside data-testid="pane-files" className="flex flex-col gap-2 border-r bg-muted/20 p-4">
          <p className="text-sm font-semibold text-foreground">Room Files</p>
          <p className="text-xs text-muted-foreground">文件能力将在 p10 接入</p>
        </aside>

        {/* 中：AVA 聊天 */}
        <section data-testid="pane-chat" className="flex flex-col">
          <div data-testid="message-list" className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
            {messages.length === 0 && studioArtifacts.length === 0 && presentationArtifacts.length === 0 ? (
              <div data-testid="empty" className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                还没有消息，向 AVA 发送第一条消息开始协作。
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  data-testid={m.role === "user" ? "msg-user" : "msg-ava"}
                  className={
                    m.role === "user"
                      ? "max-w-[80%] self-end rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                      : "max-w-[80%] self-start rounded-lg bg-muted px-3 py-2 text-sm text-foreground"
                  }
                >
                  {m.content}
                </div>
              ))
            )}

            {/* Studio 结果卡片：生成完成/失败的制品出现在聊天中（uc-studio-001 主流程 9-11） */}
            {studioArtifacts
              .filter((a) => a.status === "ready" || a.status === "error")
              .map((a) => {
                const Icon = STUDIO_TYPE_ICON[a.type];
                return (
                  <div
                    key={a.id}
                    data-testid={`studio-result-${a.id}`}
                    className="max-w-[85%] self-start rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-foreground">
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="font-semibold text-foreground">
                        {a.status === "ready" ? a.title ?? STUDIO_TYPE_LABEL[a.type] : `${STUDIO_TYPE_LABEL[a.type]}生成失败`}
                      </span>
                    </div>
                    {a.status === "ready" ? (
                      <StudioResultBody artifact={a} roomId={String(roomId)} chatId={String(chatId)} />
                    ) : (
                      <div className="mt-2 flex flex-col gap-2">
                        <p data-testid={`studio-result-error-${a.id}`} className="text-xs text-destructive">
                          {a.error_message}
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          data-testid={`studio-result-retry-${a.id}`}
                          onClick={() => retryStudio(a.id)}
                        >
                          重试
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}

            {/* 演示预览卡片：生成完成/失败的演示文稿出现在聊天中（uc-presentations-001） */}
            {presentationArtifacts
              .filter((a) => a.status === "ready" || a.status === "error")
              .map((a) => (
                <PresentationPreviewCard
                  key={a.id}
                  artifact={a}
                  onDownload={(id, format) => void downloadPresentation(id, format)}
                  onRetry={(id) => void retryPresentation(id)}
                />
              ))}
            {presentationArtifacts.some((a) => a.status === "queued" || a.status === "processing") && (
              <div
                data-testid="presentation-generating"
                role="status"
                aria-busy="true"
                className="max-w-[85%] self-start rounded-lg border border-border bg-background px-3 py-2.5 text-xs text-muted-foreground"
              >
                正在生成演示文稿…
              </div>
            )}
            <div ref={endRef} />
          </div>
          <div className="border-t p-3">
            {canEdit ? (
              <>
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void send();
                  }}
                >
                  <Input
                    data-testid="chat-input"
                    aria-label="聊天输入"
                    placeholder="输入消息…"
                    value={draft}
                    disabled={sending}
                    onChange={(e) => setDraft(e.target.value)}
                  />
                  <Button data-testid="chat-send" type="submit" size="sm" disabled={sending || !draft.trim()}>
                    {sending ? "发送中…" : "发送"}
                  </Button>
                </form>
                {sendError && (
                  <p role="alert" data-testid="send-error" className="mt-2 text-xs text-destructive">
                    {sendError}
                  </p>
                )}
              </>
            ) : (
              <p data-testid="readonly-input" className="text-center text-xs text-muted-foreground">
                他人创建的线程，当前为只读
              </p>
            )}
          </div>
        </section>

        {/* 右：Studio（p12 F01） */}
        <StudioPanel
          canEdit={canEdit}
          type={studioType}
          onTypeChange={setStudioType}
          source={studioSource}
          onSourceChange={setStudioSource}
          prompt={studioPrompt}
          onPromptChange={setStudioPrompt}
          sources={studioSources}
          pending={studioArtifacts.filter((a) => a.status === "queued" || a.status === "processing")}
          generating={studioGenerating}
          genError={studioGenError}
          onGenerate={() => void generateStudio()}
          onRetry={(id) => void retryStudio(id)}
        />
      </div>

      {/* 演示文稿生成配置弹窗（P12 F02） */}
      <PresentationConfigModal
        open={presentationModalOpen}
        onClose={() => setPresentationModalOpen(false)}
        topic={presentationTopic}
        onTopicChange={setPresentationTopic}
        source={presentationSource}
        onSourceChange={setPresentationSource}
        instructions={presentationInstructions}
        onInstructionsChange={setPresentationInstructions}
        pages={presentationPages}
        onPagesChange={setPresentationPages}
        style={presentationStyle}
        onStyleChange={setPresentationStyle}
        sources={presentationSources}
        generating={presentationGenerating}
        genError={presentationGenError}
        onGenerate={() => void generatePresentation()}
      />
    </div>
  );
}

function StudioResultBody({
  artifact,
  roomId,
  chatId,
}: {
  artifact: StudioArtifact;
  roomId: string;
  chatId: string;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await fetch(
        `/api/rooms/${roomId}/chats/${chatId}/studio/artifacts/${artifact.id}/download`
      );
      if (!alive) return;
      if (res.ok) setUrl((await res.json()).url);
    })();
    return () => {
      alive = false;
    };
  }, [artifact.id, roomId, chatId]);

  if (!url) {
    return <p className="mt-1.5 text-xs text-muted-foreground">加载中…</p>;
  }

  if (artifact.type === "audio") {
    return (
      <audio data-testid={`studio-audio-${artifact.id}`} controls className="mt-2 w-full">
        <source src={url} />
      </audio>
    );
  }

  if (artifact.type === "infographic") {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img alt={artifact.title ?? "信息图"}
        data-testid={`studio-image-${artifact.id}`}
        src={url}
        className="mt-2 max-h-48 rounded-md border border-border"
      />
    );
  }

  return (
    <a
      data-testid={`studio-download-${artifact.id}`}
      href={url}
      download
      className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary transition-colors duration-200 hover:underline"
    >
      <Download className="h-3.5 w-3.5" />
      下载演示文稿
    </a>
  );
}
