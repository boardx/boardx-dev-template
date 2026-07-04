"use client";
// p20/F03 房间 Files tab（uc-rr-003，推翻 uc-room-005 的线程绑定建模）——
// 房间统一文件库：上传（预签名直传→confirm）、搜索、按来源线程过滤、预览（签名 URL
// 过期可刷新）、软删（二次确认）。不打开任何聊天线程也能管理文件。
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Upload, Search, FileText, Eye, Loader2, X, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileInput } from "@/components/ui/file-input";

interface RoomFile {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  chat_thread_id: number | null;
  uploader_id: number;
  uploader_email: string;
  created_at: string;
}

interface RoomChat {
  id: number;
  name: string;
}

interface QueueItem {
  key: string;
  name: string;
  size: number;
  pct: number;
  state: "uploading" | "error";
  error?: string;
}

const ALLOWED_EXT = ["pdf", "txt", "md", "doc", "docx", "json", "csv", "xlsx", "xls", "png", "jpg", "jpeg", "gif", "webp"];
const MAX_BYTES = 50 * 1024 * 1024;

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

function fmtDate(value: string): string {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(
    new Date(value)
  );
}

function FilesSkeleton() {
  return (
    <div data-testid="loading" className="animate-pulse overflow-hidden rounded-12 border border-border">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-muted px-4.5 py-3.25 last:border-b-0">
          <div className="h-6.5 w-6.5 rounded-7 bg-muted" />
          <div className="h-3.25 flex-1 rounded-7 bg-muted" />
        </div>
      ))}
    </div>
  );
}

/** presigned PUT 直传，带真实进度事件（fetch 不暴露上传进度，改用 XHR）。 */
function putWithProgress(url: string, file: File, onProgress: (pct: number) => void): Promise<number> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => resolve(xhr.status);
    xhr.onerror = () => reject(new Error("网络错误"));
    xhr.send(file);
  });
}

export default function RoomFilesPage() {
  const params = useParams<{ id: string }>();
  const roomId = params.id;

  const [files, setFiles] = useState<RoomFile[]>([]);
  const [chats, setChats] = useState<RoomChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState("");
  const [q, setQ] = useState("");
  const [threadFilter, setThreadFilter] = useState("");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [previewFileId, setPreviewFileId] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewExpired, setPreviewExpired] = useState(false);
  const [previewRefreshing, setPreviewRefreshing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qRef = useRef("");
  const threadRef = useRef("");

  async function load({ search = qRef.current, thread = threadRef.current, quiet = false } = {}) {
    if (!quiet) setLoading(true);
    setError("");
    try {
      const p = new URLSearchParams();
      if (search.trim()) p.set("q", search.trim());
      if (thread) p.set("chatThreadId", thread);
      const res = await fetch(`/api/rooms/${roomId}/files?${p.toString()}`);
      if (res.status === 401) {
        // 未登录：与房间壳（layout.tsx）及其他 room 子页（boards/chats）一致，不做客户端
        // 重定向——由父级 layout 的 errorCode 分支统一展示"请先登录"提示；本页保持空态即可。
        return;
      }
      if (!res.ok) {
        setError("加载失败，请重试");
        return;
      }
      const body = (await res.json()) as { files?: RoomFile[] };
      setFiles(body.files ?? []);
    } catch {
      setError("加载失败，请重试");
    } finally {
      setLoading(false);
    }
  }

  async function loadChats() {
    const res = await fetch(`/api/rooms/${roomId}/chats`);
    if (!res.ok) return;
    const body = (await res.json()) as { chats?: RoomChat[] };
    setChats(body.chats ?? []);
  }

  useEffect(() => {
    void load();
    void loadChats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  useEffect(() => {
    qRef.current = q;
  }, [q]);

  useEffect(() => {
    threadRef.current = threadFilter;
  }, [threadFilter]);

  function patchQueue(key: string, patch: Partial<QueueItem>) {
    setQueue((qs) => qs.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }

  async function uploadOne(file: File) {
    const key = `${file.name}_${file.size}_${Date.now()}_${Math.random()}`;
    const ext = extOf(file.name);

    if (!ALLOWED_EXT.includes(ext)) {
      setQueue((qs) => [
        ...qs,
        { key, name: file.name, size: file.size, pct: 0, state: "error", error: "Unsupported file type" },
      ]);
      return;
    }
    if (file.size > MAX_BYTES) {
      setQueue((qs) => [
        ...qs,
        { key, name: file.name, size: file.size, pct: 0, state: "error", error: "文件过大（上限 50MB）" },
      ]);
      return;
    }

    setQueue((qs) => [...qs, { key, name: file.name, size: file.size, pct: 0, state: "uploading" }]);

    try {
      // 第一步：请求预签名直传 URL（服务端二次校验类型/大小）。
      const presignRes = await fetch(`/api/rooms/${roomId}/files`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fileName: file.name, fileSize: file.size, contentType: file.type }),
      });
      const presignBody = await presignRes.json().catch(() => ({}));
      if (!presignRes.ok) {
        const msg = presignBody.errors ? Object.values(presignBody.errors)[0] : (presignBody.error ?? "上传失败");
        patchQueue(key, { state: "error", error: String(msg) });
        return;
      }
      const { fileId, objectKey, uploadUrl } = presignBody as {
        fileId: string;
        objectKey: string;
        uploadUrl: string;
      };

      // 第二步：直传对象存储。
      const status = await putWithProgress(uploadUrl, file, (pct) => patchQueue(key, { pct }));
      if (status < 200 || status >= 300) {
        patchQueue(key, { state: "error", error: "对象存储直传失败" });
        return;
      }

      // 第三步：confirm 落库（附来源线程标注，若当前有过滤线程选中则带上）。
      const confirmRes = await fetch(`/api/rooms/${roomId}/files/confirm`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fileId,
          objectKey,
          fileName: file.name,
          fileSize: file.size,
          chatThreadId: threadRef.current ? Number(threadRef.current) : null,
        }),
      });
      if (!confirmRes.ok) {
        const confirmBody = await confirmRes.json().catch(() => ({}));
        patchQueue(key, { state: "error", error: confirmBody.error ?? "确认落库失败" });
        return;
      }

      setQueue((qs) => qs.filter((it) => it.key !== key));
      void load({ search: qRef.current, thread: threadRef.current });
    } catch {
      patchQueue(key, { state: "error", error: "上传失败，请重试" });
    }
  }

  async function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    for (const f of picked) void uploadOne(f);
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    const dropped = Array.from(e.dataTransfer.files ?? []);
    for (const f of dropped) void uploadOne(f);
  }

  function removeQueueItem(key: string) {
    setQueue((qs) => qs.filter((it) => it.key !== key));
  }

  async function refresh() {
    setRefreshing(true);
    await load({ search: q, thread: threadFilter, quiet: true });
    setRefreshing(false);
  }

  /** 签发签名 URL 后立即用 GET 校验其真实可用性——签名 URL 过期是对象存储层的真实
   *  403/AccessDenied，不是靠猜测响应体判断（与 uc-rr-009 expireRoomInvite 制造真实过期
   *  同一思路：断言真实过期状态，而不是 mock 一个"看起来过期"的 UI）。 */
  async function fetchAndValidatePreview(
    fileId: string,
    expiresInSeconds?: number
  ): Promise<{ ok: boolean; url?: string }> {
    const qs = expiresInSeconds ? `?expiresInSeconds=${expiresInSeconds}` : "";
    const res = await fetch(`/api/rooms/${roomId}/files/${encodeURIComponent(fileId)}/preview${qs}`);
    const body = (await res.json().catch(() => ({}))) as { previewUrl?: string; error?: string };
    if (!res.ok || !body.previewUrl) return { ok: false };

    try {
      const check = await fetch(body.previewUrl, { method: "GET" });
      if (!check.ok) return { ok: false };
    } catch {
      return { ok: false };
    }
    return { ok: true, url: body.previewUrl };
  }

  async function openPreview(file: RoomFile, forceExpiresInSeconds?: number) {
    setPreviewFileId(file.id);
    setPreviewExpired(false);
    setPreviewUrl("");
    const result = await fetchAndValidatePreview(file.id, forceExpiresInSeconds);
    if (!result.ok || !result.url) {
      setPreviewExpired(true);
      return;
    }
    setPreviewUrl(result.url);
  }

  function closePreview() {
    setPreviewFileId("");
    setPreviewUrl("");
    setPreviewExpired(false);
  }

  /** 签名 URL 过期提示的"刷新"动作：重新调用 preview 接口换取新签名 URL（契约缺口②）。 */
  async function refreshPreviewUrl() {
    if (!previewFileId) return;
    setPreviewRefreshing(true);
    try {
      const result = await fetchAndValidatePreview(previewFileId);
      if (!result.ok || !result.url) {
        setPreviewExpired(true);
        return;
      }
      setPreviewUrl(result.url);
      setPreviewExpired(false);
    } finally {
      setPreviewRefreshing(false);
    }
  }

  function requestDelete(fileId: string) {
    setDeleteError("");
    setConfirmDeleteId(fileId);
  }

  function cancelDelete() {
    setConfirmDeleteId("");
  }

  async function confirmDelete(file: RoomFile) {
    setDeleteError("");
    setDeletingId(file.id);
    setConfirmDeleteId("");
    try {
      const res = await fetch(`/api/rooms/${roomId}/files/${encodeURIComponent(file.id)}`, { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setDeleteError(body.error ?? "删除失败，请重试");
        return;
      }
      setFiles((current) => current.filter((f) => f.id !== file.id));
    } catch {
      setDeleteError("删除失败，请重试");
    } finally {
      setDeletingId("");
    }
  }

  return (
    <div
      data-testid="room-files-tab"
      className="mx-auto max-w-content px-9 pb-14 pt-7"
      onDragOver={(e) => {
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={onDrop}
    >
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-26 font-bold tracking-tight text-foreground">房间文件库</h1>
        <Button
          data-testid="room-files-upload"
          size="sm"
          className="gap-1.5"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-4 w-4" />
          上传文件
        </Button>
      </div>
      <p className="mt-1.5 text-13 text-muted-foreground">
        文件属于整个房间，所有聊天线程的左侧文件面板共享同一份文件库；支持点击上传或拖拽文件到本页面。
      </p>

      <FileInput
        ref={fileInputRef}
        data-testid="room-files-file-input"
        multiple
        accept={ALLOWED_EXT.map((e) => `.${e}`).join(",")}
        aria-label="选择要上传的文件"
        onChange={onPickFiles}
      />

      {dragActive && (
        <div
          data-testid="drag-overlay"
          className="mt-4 flex items-center justify-center rounded-12 border-2 border-dashed border-primary bg-surface-1 py-6 text-13 text-primary transition-colors duration-200"
        >
          松开鼠标上传文件
        </div>
      )}

      {error && (
        <div
          role="alert"
          data-testid="err"
          className="mt-4 flex items-center justify-between gap-3 rounded-10 border border-destructive/30 bg-surface-1 px-3.5 py-3 text-13 text-destructive"
        >
          <span>{error}</span>
          <Button data-testid="retry" variant="outline" size="sm" onClick={() => void load({ search: q, thread: threadFilter })}>
            Retry
          </Button>
        </div>
      )}

      {deleteError && (
        <p role="alert" data-testid="err-delete" className="mt-4 text-13 text-destructive">
          {deleteError}
        </p>
      )}

      {/* 搜索 + 来源线程过滤 */}
      <div className="mt-5 flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-placeholder" />
          <Input
            data-testid="room-files-search"
            placeholder="搜索文件名…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void load({ search: q, thread: threadFilter })}
            className="pl-9"
          />
        </div>
        <Select
          data-testid="room-files-thread-filter"
          aria-label="按来源线程过滤"
          value={threadFilter}
          onChange={(e) => {
            setThreadFilter(e.target.value);
            void load({ search: qRef.current, thread: e.target.value });
          }}
          className="h-9 w-44"
        >
          <option value="">全部来源</option>
          {chats.map((c) => (
            <option key={c.id} value={String(c.id)}>
              {c.name}
            </option>
          ))}
        </Select>
        <Button
          data-testid="room-files-refresh"
          variant="outline"
          size="icon"
          aria-label="Refresh files"
          onClick={() => void refresh()}
          disabled={refreshing}
          className="shrink-0"
        >
          <RefreshCw className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
        </Button>
      </div>

      {/* 上传队列（进度） */}
      {queue.length > 0 && (
        <div data-testid="room-files-upload-queue" className="mt-4 flex flex-col gap-2">
          {queue.map((it) => (
            <div
              key={it.key}
              data-testid={`room-files-queue-item-${it.state}`}
              className="rounded-10 border border-border bg-surface-1 px-3.5 py-3"
            >
              <div className="flex items-center gap-2.5">
                <span className="flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-7 bg-muted text-muted-foreground">
                  <FileText className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-13 font-medium text-foreground">{it.name}</div>
                  <div className="text-11 text-placeholder">
                    {fmtSize(it.size)} · {it.state === "uploading" ? `uploading ${it.pct}%` : (it.error ?? "error")}
                  </div>
                </div>
                {it.state === "error" ? (
                  <Badge variant="destructive">error</Badge>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="移除"
                    className="h-7 w-7 text-placeholder hover:text-foreground"
                    onClick={() => removeQueueItem(it.key)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {it.state === "uploading" && (
                <div className="mt-2.25 h-1 overflow-hidden rounded-7 bg-muted">
                  <div className="h-full bg-primary transition-all duration-200" style={{ width: `${it.pct}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 文件列表 / 空状态 */}
      <div className="mt-4.5">
        {loading ? (
          <FilesSkeleton />
        ) : files.length === 0 ? (
          <div
            data-testid="empty"
            className="flex flex-col items-center gap-3 rounded-12 border border-dashed border-border-strong px-9 py-12 text-center"
          >
            <span className="flex h-10.5 w-10.5 items-center justify-center rounded-12 bg-muted text-muted-foreground">
              <FileText className="h-5 w-5" />
            </span>
            <p className="text-13 text-muted-foreground">还没有文件，上传第一个文件建立房间文件库。</p>
            <Button
              data-testid="room-files-empty-upload"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              上传文件
            </Button>
          </div>
        ) : (
          <div data-testid="room-files-list" className="overflow-hidden rounded-12 border border-border">
            <div className="flex bg-surface-1 px-4.5 py-2.75 text-11 font-semibold text-muted-foreground">
              <div className="flex-[2.6]">Name</div>
              <div className="flex-1">Type</div>
              <div className="flex-[1.4]">Uploader</div>
              <div className="flex-[1.2]">Uploaded</div>
              <div className="w-24" />
            </div>
            {files.map((f) => (
              <div
                key={f.id}
                data-testid="room-files-item"
                className="flex items-center border-b border-muted px-4.5 py-3.25 transition-colors last:border-b-0 hover:bg-surface-1"
              >
                <div className="flex flex-[2.6] items-center gap-2.5">
                  <span className="flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-7 bg-muted text-muted-foreground">
                    <FileText className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <div data-testid="room-files-item-name" className="truncate text-13 font-medium text-foreground">
                      {f.file_name}
                    </div>
                    <div className="text-11 text-placeholder">{fmtSize(f.file_size)}</div>
                  </div>
                </div>
                <div className="flex-1 text-11 uppercase text-muted-foreground">{f.file_type}</div>
                <div className="flex-[1.4] truncate text-11 text-muted-foreground">{f.uploader_email}</div>
                <div className="flex-[1.2] text-11 text-muted-foreground">{fmtDate(f.created_at)}</div>
                <div className="flex w-24 items-center justify-end gap-1 text-placeholder">
                  {confirmDeleteId === f.id ? (
                    <div data-testid={`room-files-confirm-delete-${f.id}`} className="flex items-center gap-1.5">
                      <span className="text-11 text-muted-foreground">Delete?</span>
                      <Button
                        data-testid={`room-files-confirm-delete-yes-${f.id}`}
                        variant="destructive"
                        size="sm"
                        className="h-7 px-2 text-11"
                        disabled={deletingId === f.id}
                        onClick={() => void confirmDelete(f)}
                      >
                        {deletingId === f.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Delete"}
                      </Button>
                      <Button
                        data-testid={`room-files-confirm-delete-no-${f.id}`}
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-11"
                        onClick={cancelDelete}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Button
                        data-testid={`room-files-preview-${f.id}`}
                        variant="ghost"
                        size="icon"
                        aria-label={`Preview ${f.file_name}`}
                        className="h-7 w-7 hover:text-foreground"
                        // Shift+click 签发一个 1 秒短过期的签名 URL 用于确定性演练"过期→
                        // 提示→刷新"路径（e2e room-rr-003 用这个入口断言真实过期，而非 mock）。
                        onClick={(e) => void openPreview(f, e.shiftKey ? 1 : undefined)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        data-testid={`room-files-delete-${f.id}`}
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${f.file_name}`}
                        className="h-7 w-7 hover:text-destructive"
                        disabled={deletingId === f.id}
                        onClick={() => requestDelete(f.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 预览弹层：签名 URL 展示；过期后提示可刷新（契约缺口②） */}
      {previewFileId && (
        <div
          data-testid="room-files-preview-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-surface-dark-2/40 p-6"
          onClick={closePreview}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-2xl flex-col gap-3 rounded-16 border border-border bg-card p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-15 font-semibold text-foreground">文件预览</h2>
              <Button variant="ghost" size="icon" aria-label="关闭预览" onClick={closePreview}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            {previewExpired ? (
              <div className="flex flex-col items-center gap-3 rounded-12 border border-dashed border-border-strong py-10 text-center">
                <p data-testid="room-files-preview-expired" className="text-13 text-muted-foreground">
                  预览链接已过期
                </p>
                <Button
                  data-testid="room-files-preview-refresh"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={previewRefreshing}
                  onClick={() => void refreshPreviewUrl()}
                >
                  {previewRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  刷新
                </Button>
              </div>
            ) : previewUrl ? (
              <a
                data-testid="room-files-preview-link"
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-13 text-primary underline"
              >
                {previewUrl}
              </a>
            ) : (
              <div data-testid="room-files-preview-loading" className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
