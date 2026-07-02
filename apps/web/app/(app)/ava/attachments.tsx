"use client";
// apps/web/app/(app)/ava/attachments.tsx — AVA composer 附件管理（P9 F08）
//
// 职责：composer 的「添加文件」入口 + 拖拽区 + 预览条（上传中/失败/重试/移除）+
// 客户端预校验（类型/大小/数量，与后端 @repo/storage 的 validateAvaUpload 同一规则，
// 仅做即时反馈，真正把关在服务端二次校验）。
//
// 状态机（每个附件条目）：uploading → uploaded（拿到服务端 attachment record）
//                        uploading → failed（可重试，重试即重新发起上传）
// 发送消息时，只把 uploaded 状态的 attachment id 传给 messages 接口；uploading/failed
// 的条目会阻塞发送（避免半上传附件随消息发出）。
import { useCallback, useRef, useState } from "react";
import { Paperclip, X, Loader2, RotateCw, FileAudio, FileText, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileInput } from "@/components/ui/file-input";

// 与 packages/storage 的 AVA_ALLOWED_EXT / AVA_MAX_BYTES / AVA_MAX_ATTACHMENTS_PER_MESSAGE
// 保持一致（前端预检，非唯一把关；服务端 validateAvaUpload 二次校验防绕过）。
const AVA_ALLOWED_EXT = [
  "png", "jpg", "jpeg", "gif", "webp",
  "mp3", "wav", "m4a", "ogg",
  "pdf", "txt", "md", "doc", "docx", "csv",
];
const AVA_MAX_BYTES = 20 * 1024 * 1024;
const AVA_MAX_ATTACHMENTS_PER_MESSAGE = 5;

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

function kindOf(name: string): "image" | "audio" | "file" {
  const ext = extOf(name);
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) return "image";
  if (["mp3", "wav", "m4a", "ogg"].includes(ext)) return "audio";
  return "file";
}

export interface AttachmentEntry {
  localId: string;
  file: File;
  name: string;
  kind: "image" | "audio" | "file";
  previewUrl?: string; // 图片本地预览（object URL），非图片为 undefined
  status: "uploading" | "uploaded" | "failed";
  attachmentId?: string; // 服务端记录 id（status === "uploaded" 时存在）
  errorMessage?: string;
}

interface UseAvaAttachmentsParams {
  threadId: number | null;
  ensureThread: () => Promise<number | null>;
}

export function useAvaAttachments({ threadId, ensureThread }: UseAvaAttachmentsParams) {
  const [entries, setEntries] = useState<AttachmentEntry[]>([]);
  const [queueError, setQueueError] = useState("");

  const uploadOne = useCallback(
    async (localId: string, file: File, tid: number) => {
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch(`/api/ava/threads/${tid}/attachments`, {
          method: "POST",
          body: form,
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const msg =
            body?.errors?.type || body?.errors?.size || body?.errors?.count || body?.error || "上传失败";
          setEntries((prev) =>
            prev.map((e) => (e.localId === localId ? { ...e, status: "failed", errorMessage: msg } : e))
          );
          return;
        }
        const data = await res.json();
        setEntries((prev) =>
          prev.map((e) =>
            e.localId === localId
              ? { ...e, status: "uploaded", attachmentId: data.attachment.id }
              : e
          )
        );
      } catch {
        setEntries((prev) =>
          prev.map((e) =>
            e.localId === localId ? { ...e, status: "failed", errorMessage: "上传失败，请重试" } : e
          )
        );
      }
    },
    []
  );

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      setQueueError("");
      const list = Array.from(files);
      if (list.length === 0) return;

      const currentCount = entries.filter((e) => e.status !== "failed").length;
      if (currentCount + list.length > AVA_MAX_ATTACHMENTS_PER_MESSAGE) {
        setQueueError(`每条消息最多附加 ${AVA_MAX_ATTACHMENTS_PER_MESSAGE} 个文件`);
        return;
      }

      const tid = await ensureThread();
      if (tid == null) return; // 未登录，ensureThread 内部已处理跳转

      const newEntries: AttachmentEntry[] = list.map((file) => {
        const ext = extOf(file.name);
        const localId = `local_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
        const kind = kindOf(file.name);
        const entry: AttachmentEntry = {
          localId,
          file,
          name: file.name,
          kind,
          previewUrl: kind === "image" ? URL.createObjectURL(file) : undefined,
          status: "uploading",
        };
        if (!AVA_ALLOWED_EXT.includes(ext)) {
          entry.status = "failed";
          entry.errorMessage = `不支持的文件类型 .${ext || "?"}`;
        } else if (file.size > AVA_MAX_BYTES) {
          entry.status = "failed";
          entry.errorMessage = "文件过大（上限 20MB）";
        }
        return entry;
      });

      setEntries((prev) => [...prev, ...newEntries]);

      for (const entry of newEntries) {
        if (entry.status === "uploading") {
          void uploadOne(entry.localId, entry.file, tid);
        }
      }
    },
    [entries, ensureThread, uploadOne]
  );

  const retry = useCallback(
    async (localId: string) => {
      const entry = entries.find((e) => e.localId === localId);
      if (!entry) return;
      const tid = await ensureThread();
      if (tid == null) return;
      setEntries((prev) =>
        prev.map((e) => (e.localId === localId ? { ...e, status: "uploading", errorMessage: undefined } : e))
      );
      void uploadOne(localId, entry.file, tid);
    },
    [entries, ensureThread, uploadOne]
  );

  const remove = useCallback(
    async (localId: string) => {
      const entry = entries.find((e) => e.localId === localId);
      setEntries((prev) => prev.filter((e) => e.localId !== localId));
      if (entry?.previewUrl) URL.revokeObjectURL(entry.previewUrl);
      if (entry?.status === "uploaded" && entry.attachmentId && threadId != null) {
        try {
          await fetch(`/api/ava/threads/${threadId}/attachments/${entry.attachmentId}`, {
            method: "DELETE",
          });
        } catch {
          // 移除按钮的最终一致性优先：即使服务端删除失败，UI 也已移除；
          // 孤儿记录不影响下次发送（未关联的暂存附件不会被发送逻辑捡起）。
        }
      }
    },
    [entries, threadId]
  );

  const reset = useCallback(() => {
    setEntries((prev) => {
      prev.forEach((e) => e.previewUrl && URL.revokeObjectURL(e.previewUrl));
      return [];
    });
    setQueueError("");
  }, []);

  const uploadedIds = entries.filter((e) => e.status === "uploaded").map((e) => e.attachmentId!);
  const hasPending = entries.some((e) => e.status === "uploading");
  const hasFailed = entries.some((e) => e.status === "failed");

  return { entries, queueError, addFiles, retry, remove, reset, uploadedIds, hasPending, hasFailed };
}

function kindIcon(kind: AttachmentEntry["kind"]) {
  if (kind === "audio") return <FileAudio className="h-4 w-4" strokeWidth={1.5} />;
  if (kind === "file") return <FileText className="h-4 w-4" strokeWidth={1.5} />;
  return <ImageIcon className="h-4 w-4" strokeWidth={1.5} />;
}

export function AttachmentTrigger({ onFiles }: { onFiles: (files: FileList) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <FileInput
        ref={inputRef}
        data-testid="attachment-input"
        aria-label="Add file"
        multiple
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) onFiles(e.target.files);
          e.target.value = ""; // 允许连续选择同一文件
        }}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        data-testid="attachment-trigger"
        className="h-8 w-8 flex-none"
        aria-label="Add file"
        onClick={() => inputRef.current?.click()}
      >
        <Paperclip className="h-4 w-4" strokeWidth={1.5} />
      </Button>
    </>
  );
}

export function AttachmentPreviewStrip({
  entries,
  onRetry,
  onRemove,
}: {
  entries: AttachmentEntry[];
  onRetry: (localId: string) => void;
  onRemove: (localId: string) => void;
}) {
  if (entries.length === 0) return null;
  return (
    <ul data-testid="attachment-preview-strip" className="mb-2 flex flex-wrap gap-2">
      {entries.map((e) => (
        <li
          key={e.localId}
          data-testid="attachment-preview-item"
          data-status={e.status}
          className="relative flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded-9 border border-border bg-surface-1"
        >
          {e.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={e.previewUrl} alt={e.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex flex-col items-center justify-center gap-1 px-1 text-center">
              {kindIcon(e.kind)}
              <span className="w-full truncate text-10 text-muted-foreground">{e.name}</span>
            </div>
          )}

          {e.status === "uploading" && (
            <div
              data-testid="attachment-uploading"
              className="absolute inset-0 flex items-center justify-center bg-black/40"
            >
              <Loader2 className="h-4 w-4 animate-spin text-white" strokeWidth={2} />
            </div>
          )}

          {e.status === "failed" && (
            <div
              data-testid="attachment-failed"
              className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-destructive/80 px-1 text-center"
              title={e.errorMessage}
            >
              <span className="line-clamp-2 text-9 leading-tight text-white">
                {e.errorMessage ?? "上传失败"}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                data-testid="attachment-retry"
                aria-label="Retry upload"
                className="h-5 w-5 rounded-4 bg-white/20 p-0.5 text-white hover:bg-white/30 hover:text-white"
                onClick={() => onRetry(e.localId)}
              >
                <RotateCw className="h-3 w-3" strokeWidth={2} />
              </Button>
            </div>
          )}

          <Button
            type="button"
            variant="ghost"
            size="icon"
            data-testid="attachment-remove"
            aria-label={`Remove ${e.name}`}
            className="absolute right-0.5 top-0.5 h-5 w-5 rounded-full bg-black/60 p-0.5 text-white transition-colors hover:bg-black/80 hover:text-white"
            onClick={() => onRemove(e.localId)}
          >
            <X className="h-3 w-3" strokeWidth={2.5} />
          </Button>
        </li>
      ))}
    </ul>
  );
}
