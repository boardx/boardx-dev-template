"use client";
// 居中弹窗基座（issue #469）。项目无 Radix 依赖，沿用手写浮层惯例
// （board More 面板 / shortcuts-help / RoomDangerZoneSection 弹窗），把共性收拢：
// 遮罩点击关闭、Esc 关闭、焦点圈定（Tab 循环）、打开时聚焦、关闭时还原焦点、
// 尊重 prefers-reduced-motion（动画类用 motion-safe: 前缀）。
// 用法：{open && <Dialog …>} 或恒挂 <Dialog open={open}>（内部对 !open 渲染 null）。
import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Dialog({
  open,
  onClose,
  title,
  description,
  testId,
  closeTestId,
  className,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  /** 弹窗标题：渲染在头部行，同时作为 aria-label。 */
  title: string;
  /** 可选副标题：渲染在标题下方。 */
  description?: string;
  /** 落在弹窗面板（role=dialog）上的 data-testid。 */
  testId?: string;
  /** 右上角关闭按钮的 data-testid。 */
  closeTestId?: string;
  /** 附加到面板的样式（如自定义 max-w）。 */
  className?: string;
  children: ReactNode;
  /** 可选底部操作区（如取消/确认按钮），右对齐渲染在内容下方。 */
  footer?: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    // React 会消费 autoFocus 而不保证保留 autofocus 属性；data 属性用于稳定声明首焦点。
    const panel = panelRef.current;
    const auto = panel?.querySelector<HTMLElement>("[data-dialog-autofocus], [autofocus]");
    (auto ?? panel)?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      // 焦点圈定：Tab 在面板内循环。
      if (e.key === "Tab" && panel) {
        const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
          (el) => el.offsetParent !== null
        );
        const first = items[0];
        const last = items[items.length - 1];
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      restoreFocusRef.current?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-surface-dark-2/40 p-6 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        data-testid={testId}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "flex w-full max-w-md flex-col gap-4 rounded-16 border border-border bg-card p-6 shadow-lg",
          "focus-visible:outline-none",
          className
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="text-15 font-semibold text-foreground">{title}</h2>
            {description && <p className="text-13 text-muted-foreground">{description}</p>}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="关闭"
            data-testid={closeTestId}
            className="h-7 w-7"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        {children}
        {footer && <div className="mt-1 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
