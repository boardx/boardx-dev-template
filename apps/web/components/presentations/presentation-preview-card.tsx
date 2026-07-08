"use client";
// 演示预览卡片（P12 F02 + F03）：出现在聊天中的生成结果——翻页缩略图 + 全屏预览翻页 +
// 下载 PPTX/PDF；全屏预览内含「优化本页」输入 + 「方案修订（整体）」面板（P12 F03）。
// data-testid 对齐 phases/requirements/mockups/presentation-preview.html，供
// e2e/presentations-001-generate-presentation.spec.ts / presentations-002-revise-presentation.spec.ts。
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

export interface PresentationRevisionSummaryItem {
  label: string;
}

export interface PresentationRevision {
  id: string;
  kind: "plan" | "page";
  page_n: number | null;
  status: "queued" | "processing" | "ready" | "error";
  summary: PresentationRevisionSummaryItem[] | null;
  error_message: string | null;
}

interface PresentationPreviewCardProps {
  artifact: PresentationArtifact;
  onDownload: (artifactId: string, format: "pptx" | "pdf") => void;
  onRetry: (artifactId: string) => void;
  /** P12 F03：该制品下最新的修订/优化请求（供处理态/失败展示；不传则不渲染修订相关 UI）。 */
  revisions?: PresentationRevision[];
  onRevisePlan?: (artifactId: string, instructions: string) => void;
  onOptimizePage?: (artifactId: string, pageN: number, instructions: string) => void;
}

export function PresentationPreviewCard({
  artifact,
  onDownload,
  onRetry,
  revisions = [],
  onRevisePlan,
  onOptimizePage,
}: PresentationPreviewCardProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [revisePanelOpen, setRevisePanelOpen] = useState(false);
  const [reviseInput, setReviseInput] = useState("");
  const [optimizeInput, setOptimizeInput] = useState("");

  const planRevisions = revisions.filter((r) => r.kind === "plan");
  const pageRevisions = revisions.filter((r) => r.kind === "page");
  const latestPlanRevision = planRevisions[planRevisions.length - 1];
  const planPending = latestPlanRevision?.status === "queued" || latestPlanRevision?.status === "processing";
  const latestPlanReady = [...planRevisions].reverse().find((r) => r.status === "ready");
  const latestPlanError = latestPlanRevision?.status === "error" ? latestPlanRevision : undefined;

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

  // 当前页的最新优化请求（供「优化本页」按钮处理态/失败展示）。
  const currentPageRevisions = currentSlide
    ? pageRevisions.filter((r) => r.page_n === currentSlide.n)
    : [];
  const latestPageRevision = currentPageRevisions[currentPageRevisions.length - 1];
  const pagePending = latestPageRevision?.status === "queued" || latestPageRevision?.status === "processing";
  const pageError = latestPageRevision?.status === "error" ? latestPageRevision : undefined;

  function submitOptimize() {
    const text = optimizeInput.trim();
    if (!text || !currentSlide || !onOptimizePage) return;
    onOptimizePage(artifact.id, currentSlide.n, text);
    setOptimizeInput("");
  }

  function submitRevise() {
    const text = reviseInput.trim();
    if (!text || !onRevisePlan) return;
    onRevisePlan(artifact.id, text);
    setReviseInput("");
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
          {onRevisePlan && (
            <Button
              size="sm"
              variant="outline"
              data-testid="pres-revise-open"
              onClick={() => {
                setFullscreen(true);
                setRevisePanelOpen(true);
              }}
            >
              方案修订
            </Button>
          )}
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
            {onRevisePlan && (
              <Button
                size="sm"
                variant="outline"
                data-testid="pres-revise-toggle"
                onClick={() => setRevisePanelOpen((v) => !v)}
              >
                方案修订
              </Button>
            )}
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

          <div className="flex flex-1 gap-4 overflow-hidden p-6">
            <div className="flex flex-1 flex-col gap-3">
              <div className="flex flex-1 items-center gap-3 bg-muted/40 p-6">
                <button
                  type="button"
                  data-testid="pres-prev"
                  aria-label="上一页"
                  disabled={pageIndex === 0}
                  onClick={goPrev}
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-border bg-background disabled:text-disabled-foreground disabled:border-border/60"
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
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-border bg-background disabled:text-disabled-foreground disabled:border-border/60"
                >
                  ›
                </button>
              </div>

              <div className="py-1 text-center text-11 text-background/80">
                第 {pageIndex + 1} / {total} 页
              </div>

              {onOptimizePage && (
                <div className="flex flex-col gap-1.5 border-t border-border/40 bg-card/95 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <input
                      data-testid="pres-optimize-input"
                      value={optimizeInput}
                      onChange={(e) => setOptimizeInput(e.target.value)}
                      placeholder="优化本页：例如「加一张架构图并精简文字」"
                      disabled={pagePending}
                      className="h-8.5 flex-1 rounded-md border border-border bg-background px-3 text-12 text-foreground placeholder:text-placeholder"
                    />
                    <Button
                      size="sm"
                      data-testid="pres-optimize-submit"
                      disabled={!optimizeInput.trim() || pagePending}
                      onClick={submitOptimize}
                    >
                      {pagePending ? "优化中…" : "优化本页"}
                    </Button>
                  </div>
                  {pagePending && (
                    <p data-testid="pres-optimize-pending" role="status" aria-busy="true" className="text-11 text-background/70">
                      正在优化本页…
                    </p>
                  )}
                  {pageError && (
                    <p data-testid="pres-optimize-error" role="alert" className="text-11 text-destructive">
                      {pageError.error_message}
                    </p>
                  )}
                </div>
              )}
            </div>

            {revisePanelOpen && onRevisePlan && (
              <div
                data-testid="presentation-revise-panel"
                className="flex w-80 flex-shrink-0 flex-col gap-2.5 rounded-lg border border-border bg-background p-4"
              >
                <h4 className="text-13 font-semibold text-foreground">方案修订（整体）</h4>

                {latestPlanReady?.summary && latestPlanReady.summary.length > 0 && (
                  <div data-testid="pres-revise-summary" className="flex flex-col gap-1.5">
                    {latestPlanReady.summary.map((item, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-11"
                      >
                        <span className="flex h-4.5 w-4.5 flex-shrink-0 items-center justify-center rounded-full bg-primary text-9 text-primary-foreground">
                          {i + 1}
                        </span>
                        {item.label}
                      </div>
                    ))}
                  </div>
                )}

                <textarea
                  data-testid="pres-revise-input"
                  value={reviseInput}
                  onChange={(e) => setReviseInput(e.target.value)}
                  placeholder="描述修改要求，得到更新后的方案…"
                  rows={3}
                  disabled={planPending}
                  className="w-full resize-y rounded-md border border-border bg-background px-2.5 py-2 text-12 text-foreground placeholder:text-placeholder"
                />

                {planPending && (
                  <p data-testid="pres-revise-pending" role="status" aria-busy="true" className="text-11 text-muted-foreground">
                    正在修订方案…
                  </p>
                )}
                {latestPlanError && (
                  <p data-testid="pres-revise-error" role="alert" className="text-11 text-destructive">
                    {latestPlanError.error_message}
                  </p>
                )}

                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => setRevisePanelOpen(false)}>
                    取消
                  </Button>
                  <Button
                    size="sm"
                    data-testid="pres-revise-submit"
                    disabled={!reviseInput.trim() || planPending}
                    onClick={submitRevise}
                  >
                    提交修订
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
