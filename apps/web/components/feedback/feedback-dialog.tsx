"use client";

import { FormEvent, useRef, useState } from "react";
import { ImagePlus, Loader2, Send, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface AttachmentDraft {
  name: string;
  type: string;
  dataUrl: string;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("附件读取失败，请移除附件或稍后重试"));
    reader.readAsDataURL(file);
  });
}

export function FeedbackDialog({
  open,
  onClose,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  async function onFiles(files: FileList | null) {
    setError("");
    if (!files?.length) return;
    const next: AttachmentDraft[] = [];
    for (const file of Array.from(files).slice(0, 3)) {
      if (!file.type.startsWith("image/")) {
        setError("仅支持图片附件");
        continue;
      }
      try {
        next.push({ name: file.name, type: file.type, dataUrl: await readFileAsDataUrl(file) });
      } catch (err) {
        setError(err instanceof Error ? err.message : "附件读取失败，请移除附件或稍后重试");
      }
    }
    setAttachments((current) => [...current, ...next].slice(0, 3));
    if (inputRef.current) inputRef.current.value = "";
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const trimmed = message.trim();
    if (!trimmed) {
      setError("请先填写反馈内容");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, attachments }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "提交失败，请稍后重试");
        return;
      }
      setMessage("");
      setAttachments([]);
      onSubmitted();
      onClose();
    } catch {
      setError("提交失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-10 border border-border bg-popover p-4 shadow-lg">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="feedback-title" className="text-lg font-semibold text-foreground">
              提交反馈
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">告诉我们你遇到的问题或建议。</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="关闭反馈"
            onClick={onClose}
            disabled={submitting}
            className="shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="feedback-message">反馈内容</Label>
            <Textarea
              id="feedback-message"
              data-testid="feedback-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="描述问题、建议或复现步骤"
              disabled={submitting}
              aria-describedby={error ? "feedback-error" : undefined}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="feedback-file">图片附件</Label>
            <input
              ref={inputRef}
              id="feedback-file"
              data-testid="feedback-file-input"
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => void onFiles(e.target.files)}
              disabled={submitting}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => inputRef.current?.click()}
              disabled={submitting}
              className="w-full"
            >
              <ImagePlus className="h-4 w-4" />
              选择图片
            </Button>
            {attachments.length > 0 && (
              <ul className="flex flex-col gap-2" data-testid="feedback-attachments">
                {attachments.map((file, index) => (
                  <li
                    key={`${file.name}-${index}`}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 truncate text-foreground">{file.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`移除 ${file.name}`}
                      onClick={() => setAttachments((current) => current.filter((_, i) => i !== index))}
                      disabled={submitting}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error && (
            <p id="feedback-error" role="alert" data-testid="err-feedback" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              取消
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {submitting ? "提交中..." : "提交"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
