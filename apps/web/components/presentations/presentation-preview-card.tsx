"use client";
// 演示预览卡片（P12 F02）：出现在聊天中的生成结果——翻页缩略图 + 全屏预览翻页 +
// 下载 PPTX/PDF。data-testid 对齐 phases/requirements/mockups/presentation-preview.html
// （聊天内预览卡片 + 全屏预览翻页），供 e2e/presentations-001-generate-presentation.spec.ts。
import { useState } from "react";
import { Download, Presentation as PresentationIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface PresentationSlide {
  n: number;
  title: string;
  bullets: string[];
}

export interface PresentationArtifact {
  id: string;
  topic: string;
  status: "queued" | "processing" | "ready" | "error";
  title: string | null;
  slides: PresentationSlide[] | null;
  error_message: string | null;
  pages: number;
}

interface PresentationPreviewCardProps {
  artifact: PresentationArtifact;
  onDownload: (artifactId: string, format: "pptx" | "pdf") => void;
  onRetry: (artifactId: string) => void;
}

export function PresentationPreviewCard({ artifact, onDownload, onRetry }: PresentationPreviewCardProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);

  if (artifact.status === "error") {
    return (
      <div
        data-testid={`presentation-result-${artifact.id}`}
        className="max-w-[85%] self-start rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
      >
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-foreground">
            <PresentationIcon className="h-3.5 w-3.5" />
          </span>
          <span className="font-semibold text-foreground">演示文稿生成失败</span>
        </div>
        <p data-testid={`presentation-result-error-${artifact.id}`} className="mt-1.5 text-xs text-destructive">
          {artifact.error_message}
        </p>
        <Button
          size="sm"
          variant="outline"
          className="mt-2"
          data-testid={`presentation-result-retry-${artifact.id}`}
          onClick={() => onRetry(artifact.id)}
        >
          重试
        </Button>
      </div>
    );
  }

  const slides = artifact.slides ?? [];
  const total = slides.length || artifact.pages;
  const currentSlide = slides[pageIndex];

  function goPrev() {
    setPageIndex((p) => Math.max(0, p - 1));
  }
  function goNext() {
    setPageIndex((p) => Math.min(slides.length - 1, p + 1));
  }

  return (
    <>
      <div
        data-testid="presentation-preview-card"
        className="max-w-85 self-start overflow-hidden rounded-lg border border-border bg-background text-sm shadow-sm"
      >
        <div className="flex items-center gap-2 border-b border-border bg-card px-3.5 py-3">
          <span className="flex h-6.5 w-6.5 items-center justify-center rounded-md bg-tag-purple text-xs">
            <PresentationIcon className="h-3.5 w-3.5" />
          </span>
          <div className="flex-1">
            <div className="font-semibold text-foreground">{artifact.title ?? artifact.topic}</div>
            <div className="text-11 text-muted-foreground">{total} 页 · 已生成</div>
          </div>
        </div>

        <div className="relative flex aspect-video items-center justify-center border-b border-border bg-muted text-12 text-muted-foreground">
          {currentSlide ? currentSlide.title : "封面预览"}
          <span
            data-testid="pres-page-indicator"
            className="absolute bottom-2 right-2.5 rounded-full border border-border bg-background px-2 py-0.5 text-11"
          >
            {pageIndex + 1} / {total}
          </span>
        </div>

        <div data-testid="pres-thumb-strip" className="flex gap-1.5 overflow-x-auto px-3.5 py-2.5">
          {slides.map((s, i) => (
            <button
              key={s.n}
              type="button"
              data-testid={`pres-thumb-${s.n}`}
              onClick={() => setPageIndex(i)}
              className={`h-7.5 w-13 flex-shrink-0 rounded-sm border ${
                i === pageIndex ? "border-primary outline outline-2 outline-primary/20" : "border-border"
              } bg-muted`}
            />
          ))}
        </div>

        <div className="flex gap-2 border-t border-border px-3.5 py-3">
          <Button
            size="sm"
            data-testid="pres-open-fullscreen"
            onClick={() => setFullscreen(true)}
          >
            全屏预览
          </Button>
          <Button
            size="sm"
            variant="outline"
            data-testid="pres-download"
            onClick={() => onDownload(artifact.id, "pptx")}
          >
            <Download className="h-3.5 w-3.5" />
            下载 PPTX
          </Button>
          <span className="flex-1" />
          <Button
            size="sm"
            variant="outline"
            data-testid="pres-download-pdf"
            onClick={() => onDownload(artifact.id, "pdf")}
          >
            PDF
          </Button>
        </div>
      </div>

      {fullscreen && (
        <div
          data-testid="presentation-fullscreen"
          role="dialog"
          aria-modal="true"
          aria-label="演示文稿全屏预览"
          className="fixed inset-0 z-50 flex flex-col bg-foreground/90"
        >
          <div className="flex items-center gap-2.5 border-b border-border bg-card px-4 py-3">
            <span className="flex-1 font-semibold text-foreground">{artifact.title ?? artifact.topic} — 预览</span>
            <Button size="sm" variant="outline" onClick={() => onDownload(artifact.id, "pptx")}>
              下载
            </Button>
            <Button
              size="sm"
              variant="ghost"
              aria-label="close"
              data-testid="presentation-fullscreen-close"
              onClick={() => setFullscreen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex flex-1 items-center gap-3 bg-muted/40 p-6">
            <button
              type="button"
              data-testid="pres-prev"
              aria-label="上一页"
              disabled={pageIndex === 0}
              onClick={goPrev}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-border bg-background disabled:opacity-30"
            >
              ‹
            </button>
            <div className="flex aspect-video flex-1 flex-col gap-2.5 rounded-md border border-border bg-background p-5 shadow-sm">
              <h3 className="text-xl font-bold text-foreground">{currentSlide?.title ?? artifact.title}</h3>
              <ul className="flex flex-col gap-1">
                {(currentSlide?.bullets ?? []).map((b, i) => (
                  <li key={i} className="ml-4 list-disc text-xs text-foreground/80">
                    {b}
                  </li>
                ))}
              </ul>
            </div>
            <button
              type="button"
              data-testid="pres-next"
              aria-label="下一页"
              disabled={pageIndex >= slides.length - 1}
              onClick={goNext}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-border bg-background disabled:opacity-30"
            >
              ›
            </button>
          </div>

          <div className="py-1 text-center text-11 text-background/80">
            第 {pageIndex + 1} / {total} 页
          </div>
        </div>
      )}
    </>
  );
}
