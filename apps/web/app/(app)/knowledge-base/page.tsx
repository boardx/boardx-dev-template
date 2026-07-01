"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Search, FileText, Download, Trash2, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FileInput } from "@/components/ui/file-input";

type Scope = "personal" | "team" | "agent" | "tool";

interface KbFile {
  id: string;
  name: string;
  ext: string;
  size_bytes: number;
  status: "processing" | "ready" | "error";
  scope: Scope;
  created_at: string;
}

// 上传队列项（前端瞬态：上传中 / 处理中 / 失败）
interface QueueItem {
  key: string;
  name: string;
  size: number;
  pct: number;
  state: "uploading" | "processing" | "error";
  error?: string;
}

const ALLOWED_EXT = ["pdf", "txt", "md", "doc", "docx", "json", "csv", "xlsx", "xls"];
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

function KbSkeleton() {
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

/** multipart 上传 + 真实进度事件（fetch 不暴露上传进度，改用 XHR）。 */
function uploadWithProgress(
  file: File,
  scope: Scope,
  onProgress: (pct: number) => void
): Promise<{ status: number; body: { file?: KbFile; error?: string; errors?: Record<string, string> } }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/kb/files");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let body: { file?: KbFile; error?: string; errors?: Record<string, string> } = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // 非 JSON 响应（如网关错误页）时保留空 body，交由调用方按状态码兜底处理。
      }
      resolve({ status: xhr.status, body });
    };
    xhr.onerror = () => reject(new Error("网络错误"));
    const form = new FormData();
    form.append("file", file);
    form.append("scope", scope);
    xhr.send(form);
  });
}

export default function KnowledgeBasePage() {
  const [files, setFiles] = useState<KbFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function load(search = "") {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/kb/files?scope=personal${search ? `&q=${encodeURIComponent(search)}` : ""}`);
    if (res.status === 401) {
      // 未登录 → 跳登录（与 home 一致）
      router.replace("/login");
      return;
    }
    if (!res.ok) {
      setError("加载失败，请重试");
      setLoading(false);
      return;
    }
    setFiles((await res.json()).files ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // 轮询刷新处理中状态（processing → ready 异步完成，与后端 worker 解耦轮询）。
    const t = setInterval(() => void load(q), 2000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function patchQueue(key: string, patch: Partial<QueueItem>) {
    setQueue((qs) => qs.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }

  async function uploadOne(file: File) {
    const key = `${file.name}_${file.size}_${Date.now()}_${Math.random()}`;
    const ext = extOf(file.name);

    // 客户端预校验（类型 / 大小）——失败直接进队列 error 行，不发请求，不产生半条记录。
    if (!ALLOWED_EXT.includes(ext)) {
      setQueue((qs) => [
        ...qs,
        { key, name: file.name, size: file.size, pct: 0, state: "error", error: "不支持的文件类型" },
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
      const { status, body } = await uploadWithProgress(file, "personal", (pct) =>
        patchQueue(key, { pct })
      );

      if (status !== 201) {
        const msg = body.errors ? Object.values(body.errors)[0] : (body.error ?? "上传失败");
        patchQueue(key, { state: "error", error: msg });
        return;
      }

      // 完成 → 处理中（瞬态）→ 从队列移除并刷新列表（真实处理状态见列表行的 status badge）。
      patchQueue(key, { pct: 100, state: "processing" });
      setTimeout(() => {
        setQueue((qs) => qs.filter((it) => it.key !== key));
        void load(q);
      }, 400);
    } catch {
      patchQueue(key, { state: "error", error: "上传失败，请重试" });
    }
  }

  async function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = ""; // 允许再次选择同名文件
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

  return (
    <div
      className="mx-auto max-w-content px-9 pb-14 pt-7"
      data-testid="kb-dropzone"
      onDragOver={(e) => {
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={onDrop}
    >
      {/* 标题 + 上传入口 */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-26 font-bold tracking-tight text-foreground">Knowledge Base</h1>
        <Button data-testid="upload-trigger" size="sm" className="gap-1.5" onClick={() => fileInputRef.current?.click()}>
          <Upload className="h-4 w-4" />
          Upload file
        </Button>
      </div>
      <p className="mt-1.5 text-13 text-muted-foreground">
        上传文件构建个人知识库，供后续 AI 在对应上下文中使用。支持点击上传或将文件拖拽到本页面。
      </p>

      {/* 真实文件选择器（隐藏；封装在 components/ui/file-input） */}
      <FileInput
        ref={fileInputRef}
        data-testid="file-input"
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
        <p role="alert" data-testid="err" className="mt-4 text-13 text-destructive">
          {error}
        </p>
      )}

      {/* 搜索 */}
      <div className="mt-5 flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-placeholder" />
          <Input
            data-testid="search"
            placeholder="Search files…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(q)}
            className="pl-9"
          />
        </div>
        <Button data-testid="search-btn" variant="secondary" onClick={() => load(q)}>
          Search
        </Button>
      </div>

      {/* 上传队列（进度） */}
      {queue.length > 0 && (
        <div data-testid="upload-queue" className="mt-4 flex flex-col gap-2">
          {queue.map((it) => (
            <div
              key={it.key}
              data-testid={`queue-item-${it.state}`}
              className="rounded-10 border border-border bg-surface-1 px-3.5 py-3"
            >
              <div className="flex items-center gap-2.5">
                <span className="flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-7 bg-muted text-muted-foreground">
                  <FileText className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-13 font-medium text-foreground">{it.name}</div>
                  <div className="text-11 text-placeholder">
                    {fmtSize(it.size)} ·{" "}
                    {it.state === "uploading"
                      ? `uploading ${it.pct}%`
                      : it.state === "processing"
                        ? "checking processing status"
                        : (it.error ?? "error")}
                  </div>
                </div>
                {it.state === "processing" ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-foreground" />
                ) : it.state === "error" ? (
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
          <KbSkeleton />
        ) : files.length === 0 ? (
          <div
            data-testid="empty"
            className="flex flex-col items-center gap-3 rounded-12 border border-dashed border-border-strong px-9 py-12 text-center"
          >
            <span className="flex h-10.5 w-10.5 items-center justify-center rounded-12 bg-muted text-muted-foreground">
              <FileText className="h-5 w-5" />
            </span>
            <p className="text-13 text-muted-foreground">No files yet. Upload to build your knowledge base.</p>
            <Button data-testid="empty-upload" variant="outline" size="sm" className="gap-1.5" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4" />
              Upload file
            </Button>
          </div>
        ) : (
          <div data-testid="file-list" className="overflow-hidden rounded-12 border border-border">
            <div className="flex bg-surface-1 px-4.5 py-2.75 text-11 font-semibold text-muted-foreground">
              <div className="flex-[2.6]">Name</div>
              <div className="flex-1">Type</div>
              <div className="flex-[1.4]">Status</div>
              <div className="w-15" />
            </div>
            {files.map((f) => (
              <div
                key={f.id}
                data-testid={`file-${f.id}`}
                className="flex items-center border-b border-muted px-4.5 py-3.25 transition-colors last:border-b-0 hover:bg-surface-1"
              >
                <div className="flex flex-[2.6] items-center gap-2.5">
                  <span className="flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-7 bg-muted text-muted-foreground">
                    <FileText className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-13 font-medium text-foreground">{f.name}</div>
                    <div className="text-11 text-placeholder">{fmtSize(f.size_bytes)}</div>
                  </div>
                </div>
                <div className="flex-1 text-12 uppercase text-muted-foreground">{f.ext}</div>
                <div className="flex flex-[1.4] items-center gap-2">
                  <Badge
                    data-testid={`file-status-${f.id}`}
                    variant={f.status === "ready" ? "success" : f.status === "error" ? "destructive" : "muted"}
                  >
                    {f.status}
                  </Badge>
                  <span className="text-11 text-placeholder">{f.scope}</span>
                </div>
                <div className="flex w-15 items-center gap-3 text-placeholder">
                  <Button variant="ghost" size="icon" aria-label="下载" className="h-7 w-7 hover:text-foreground">
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="删除" className="h-7 w-7 hover:text-foreground">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
