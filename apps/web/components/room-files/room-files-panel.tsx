"use client";
// p20/F03 聊天工作区左栏 Room Files 面板（uc-rr-003 主流程 3-6）——
// 展示与房间 Files tab 同一份文件库（不按 chat_thread_id 过滤，默认全量展示，
// chat_thread_id 只是来源标注维度，见 room_files 数据模型）；支持勾选文件作为
// AI 上下文 sources（内容进入 RAG 的细节归 p10，这里只做勾选状态与数量展示）；
// 支持在本面板直接上传，落到房间文件库（附 chat_thread_id 标注来源）。
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FileText, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileInput } from "@/components/ui/file-input";

interface RoomFile {
  id: string;
  file_name: string;
  file_size: number;
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

function putWithProgress(url: string, file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.onload = () => resolve(xhr.status);
    xhr.onerror = () => reject(new Error("网络错误"));
    xhr.send(file);
  });
}

// p22/F03：这是"轻量引用视图"——只做勾选 AI 上下文 + 简单上传，不做搜索/预览/删除
// （这是产品决策，非能力缺失）。权威管理视图是房间 Files tab，本面板始终提供一个
// 明确的跳转入口，不再只靠空态文案兜底。
export function RoomFilesPanel({ roomId, chatId }: { roomId: string; chatId: string }) {
  const [files, setFiles] = useState<RoomFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/rooms/${roomId}/files`);
      if (!res.ok) {
        setError("加载失败");
        return;
      }
      const body = (await res.json()) as { files?: RoomFile[] };
      setFiles(body.files ?? []);
    } catch {
      setError("加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  function toggleSelected(fileId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  }

  async function uploadOne(file: File) {
    setUploadError("");
    const ext = extOf(file.name);
    if (!ALLOWED_EXT.includes(ext)) {
      setUploadError("Unsupported file type");
      return;
    }
    if (file.size > MAX_BYTES) {
      setUploadError("文件过大（上限 50MB）");
      return;
    }
    setUploading(true);
    try {
      const presignRes = await fetch(`/api/rooms/${roomId}/files`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fileName: file.name, fileSize: file.size, contentType: file.type }),
      });
      const presignBody = await presignRes.json().catch(() => ({}));
      if (!presignRes.ok) {
        const msg = presignBody.errors ? Object.values(presignBody.errors)[0] : (presignBody.error ?? "上传失败");
        setUploadError(String(msg));
        return;
      }
      const { fileId, objectKey, uploadUrl } = presignBody as { fileId: string; objectKey: string; uploadUrl: string };

      const status = await putWithProgress(uploadUrl, file);
      if (status < 200 || status >= 300) {
        setUploadError("对象存储直传失败");
        return;
      }

      const confirmRes = await fetch(`/api/rooms/${roomId}/files/confirm`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fileId,
          objectKey,
          fileName: file.name,
          fileSize: file.size,
          chatThreadId: Number(chatId),
        }),
      });
      if (!confirmRes.ok) {
        const confirmBody = await confirmRes.json().catch(() => ({}));
        setUploadError(confirmBody.error ?? "确认落库失败");
        return;
      }

      await load();
    } catch {
      setUploadError("上传失败，请重试");
    } finally {
      setUploading(false);
    }
  }

  async function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    for (const f of picked) await uploadOne(f);
  }

  return (
    <div data-testid="room-files-panel" className="flex h-full flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">Room Files</p>
        <div className="flex items-center gap-1">
          <Link
            href={`/rooms/${roomId}/files`}
            data-testid="room-files-panel-open-files-tab"
            className="text-xs text-primary hover:underline"
          >
            查看全部 →
          </Link>
          <Button
            data-testid="room-files-panel-upload"
            variant="ghost"
            size="icon"
            aria-label="上传文件到房间文件库"
            className="h-6.5 w-6.5"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
      <FileInput
        ref={fileInputRef}
        data-testid="room-files-panel-file-input"
        accept={ALLOWED_EXT.map((e) => `.${e}`).join(",")}
        aria-label="选择要上传到房间文件库的文件"
        onChange={onPickFiles}
      />

      {uploadError && (
        <p role="alert" data-testid="room-files-panel-upload-err" className="text-xs text-destructive">
          {uploadError}
        </p>
      )}

      {selected.size > 0 && (
        <p data-testid="room-files-panel-selected-count" className="text-xs text-muted-foreground">
          {selected.size} sources selected as context
        </p>
      )}

      {loading ? (
        <div data-testid="loading" className="flex flex-1 items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <p role="alert" data-testid="err" className="text-xs text-destructive">
          {error}
        </p>
      ) : files.length === 0 ? (
        <p data-testid="empty" className="text-xs text-muted-foreground">
          房间文件库还没有文件，点击右上角上传，或{" "}
          <Link href={`/rooms/${roomId}/files`} className="text-primary hover:underline">
            前往 Files tab
          </Link>
          。
        </p>
      ) : (
        <ul data-testid="room-files-panel-list" className="flex flex-1 flex-col gap-1 overflow-y-auto">
          {files.map((f) => (
            <li
              key={f.id}
              data-testid={`room-files-panel-item-${f.id}`}
              className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs transition-colors hover:bg-muted"
            >
              <input
                type="checkbox"
                data-testid="room-files-source-toggle"
                data-file-id={f.id}
                data-checkbox-id={`room-files-panel-checkbox-${f.id}`}
                aria-label={`勾选 ${f.file_name} 作为 AI 上下文`}
                checked={selected.has(f.id)}
                onChange={() => toggleSelected(f.id)}
                className="h-3.5 w-3.5 shrink-0 accent-primary"
              />
              <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-foreground">{f.file_name}</span>
              <span className="shrink-0 text-placeholder">{fmtSize(f.file_size)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
