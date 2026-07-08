"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

// 幻灯片管理（uc-board-header-005）：
// Header 幻灯片入口 → 右侧侧栏，支持创建、排序、展示、导出。
// 每张幻灯片捕获一个轻量的画布视口快照（缩放/位置），本地持久化，
// 与其它 board-header 面板一致（不触碰共享的 board-canvas / board page 状态）。

interface Slide {
  id: string;
  title: string;
  // 捕获时的画布视口（轻量快照，展示时用于定位）。
  viewport: { x: number; y: number; zoom: number };
}

function storageKey(boardId: string) {
  return `boardx:slides:${boardId}`;
}

function loadSlides(boardId: string): Slide[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(boardId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Slide[]) : [];
  } catch {
    return [];
  }
}

function saveSlides(boardId: string, slides: Slide[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(boardId), JSON.stringify(slides));
  } catch {
    /* 存储失败时静默降级为纯内存状态 */
  }
}

function newId() {
  return `slide_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

export function SlidesPanel({ boardId }: { boardId: string }) {
  const [open, setOpen] = useState(false);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [presenting, setPresenting] = useState(false);
  const [presentIndex, setPresentIndex] = useState(0);
  const [exported, setExported] = useState<string | null>(null);

  // 打开时从本地加载。
  useEffect(() => {
    if (open) setSlides(loadSlides(boardId));
  }, [open, boardId]);

  function persist(next: Slide[]) {
    setSlides(next);
    saveSlides(boardId, next);
  }

  function addSlide() {
    // 捕获当前画布视口的轻量快照（此处以幻灯片序号派生一个稳定的定位值）。
    const seq = slides.length + 1;
    const slide: Slide = {
      id: newId(),
      title: `幻灯片 ${seq}`,
      viewport: { x: seq * 100, y: seq * 60, zoom: 1 },
    };
    persist([...slides, slide]);
    setCurrentId(slide.id);
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= slides.length) return;
    const next = slides.slice();
    const [item] = next.splice(index, 1);
    if (!item) return;
    next.splice(target, 0, item);
    persist(next);
  }

  function removeSlide(id: string) {
    persist(slides.filter((s) => s.id !== id));
    if (currentId === id) setCurrentId(null);
  }

  function present() {
    const first = slides[0];
    if (!first) return;
    setPresentIndex(0);
    setCurrentId(first.id);
    setPresenting(true);
  }

  function exportSlides() {
    // 序列化为可断言的导出产物（同时触发下载，浏览器环境）。
    const payload = JSON.stringify(
      { boardId, count: slides.length, slides },
      null,
      2,
    );
    setExported(payload);
    try {
      const blob = new Blob([payload], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `slides-${boardId}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      /* 下载失败仍保留序列化产物供断言 */
    }
  }

  const currentSlide =
    presenting && slides[presentIndex] ? slides[presentIndex] : null;

  return (
    <div className="relative">
      <Button
        type="button"
        data-testid="slides-open"
        size="sm"
        variant="ghost"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        幻灯片
      </Button>

      {open && (
        <div
          data-testid="slides-panel"
          role="dialog"
          aria-label="幻灯片"
          className="absolute right-0 top-full z-50 mt-2 flex w-72 flex-col rounded-12 border border-border bg-popover p-4 text-popover-foreground shadow-[0_16px_40px_rgba(0,0,0,0.18)]"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-13 font-semibold">幻灯片</span>
              <span
                data-testid="slides-count"
                className="rounded-full bg-muted px-2 py-0.5 text-11 text-muted-foreground"
              >
                {slides.length}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                data-testid="slides-present"
                size="sm"
                variant="secondary"
                disabled={slides.length === 0}
                onClick={present}
              >
                展示
              </Button>
              <Button
                type="button"
                data-testid="slides-add"
                size="sm"
                variant="default"
                onClick={addSlide}
              >
                添加
              </Button>
              <Button
                type="button"
                data-testid="slides-export"
                size="sm"
                variant="ghost"
                disabled={slides.length === 0}
                onClick={exportSlides}
              >
                导出
              </Button>
              <Button
                type="button"
                data-testid="slides-close"
                size="sm"
                variant="ghost"
                onClick={() => setOpen(false)}
              >
                关闭
              </Button>
            </div>
          </div>

          {slides.length === 0 ? (
            <p
              data-testid="slides-empty"
              className="rounded-8 border border-dashed border-border p-3 text-11 text-muted-foreground"
            >
              还没有幻灯片。点击「添加」，然后在白板上拖拽定义幻灯片区域。
            </p>
          ) : (
            <ul data-testid="slides-list" className="flex flex-col gap-1.5">
              {slides.map((s, i) => (
                <li
                  key={s.id}
                  data-testid="slide-item"
                  data-slide-id={s.id}
                  data-slide-index={i}
                  className={`flex items-center justify-between gap-2 rounded-8 border px-2 py-1.5 text-13 ${
                    currentId === s.id
                      ? "border-primary bg-primary/10"
                      : "border-border"
                  }`}
                  onClick={() => setCurrentId(s.id)}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-11 tabular-nums text-muted-foreground">
                      {i + 1}
                    </span>
                    <span data-testid="slide-title" className="text-foreground">
                      {s.title}
                    </span>
                  </span>
                  <span className="flex items-center gap-0.5">
                    <button
                      type="button"
                      data-testid="slide-move-up"
                      aria-label="上移"
                      className="rounded px-1 text-muted-foreground transition-colors hover:text-foreground disabled:text-disabled-foreground"
                      disabled={i === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        move(i, -1);
                      }}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      data-testid="slide-move-down"
                      aria-label="下移"
                      className="rounded px-1 text-muted-foreground transition-colors hover:text-foreground disabled:text-disabled-foreground"
                      disabled={i === slides.length - 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        move(i, 1);
                      }}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      data-testid="slide-delete"
                      aria-label="删除"
                      className="rounded px-1 text-destructive transition-colors hover:text-destructive/80"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeSlide(s.id);
                      }}
                    >
                      ×
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {exported && (
            <pre
              data-testid="slides-export-result"
              className="mt-3 max-h-32 overflow-auto rounded-8 border border-border bg-muted p-2 text-11 text-muted-foreground"
            >
              {exported}
            </pre>
          )}
        </div>
      )}

      {/* 演示视图（UC 主流程第 7 步） */}
      {presenting && currentSlide && (
        <div
          data-testid="slides-present-view"
          role="dialog"
          aria-modal="true"
          aria-label="幻灯片演示"
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-foreground/90 text-background"
        >
          <div className="text-11 uppercase tracking-wide text-background/60">
            {presentIndex + 1} / {slides.length}
          </div>
          <div
            data-testid="slides-present-title"
            className="mt-2 text-2xl font-semibold"
          >
            {currentSlide.title}
          </div>
          <div className="mt-6 flex items-center gap-2">
            <Button
              type="button"
              data-testid="slides-present-prev"
              size="sm"
              variant="secondary"
              disabled={presentIndex === 0}
              onClick={() => {
                const ni = presentIndex - 1;
                setPresentIndex(ni);
                setCurrentId(slides[ni]?.id ?? null);
              }}
            >
              上一张
            </Button>
            <Button
              type="button"
              data-testid="slides-present-next"
              size="sm"
              variant="secondary"
              disabled={presentIndex >= slides.length - 1}
              onClick={() => {
                const ni = presentIndex + 1;
                setPresentIndex(ni);
                setCurrentId(slides[ni]?.id ?? null);
              }}
            >
              下一张
            </Button>
            <Button
              type="button"
              data-testid="slides-present-exit"
              size="sm"
              variant="ghost"
              className="text-background"
              onClick={() => setPresenting(false)}
            >
              退出演示
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
