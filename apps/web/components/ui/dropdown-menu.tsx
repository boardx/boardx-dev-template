"use client";
// 轻量 Dropdown 菜单基座（卡片"更多操作"用）。点击 trigger 展开，点外部 / ESC 收起。
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DropdownMenuProps {
  /** 触发元素（如三点按钮）；接收 onClick 由本组件注入 */
  trigger: (props: { open: boolean; onClick: () => void }) => ReactNode;
  children: ReactNode;
  align?: "start" | "end";
  testId?: string;
}

export function DropdownMenu({ trigger, children, align = "end", testId }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      {trigger({ open, onClick: () => setOpen((v) => !v) })}
      {open && (
        <div
          role="menu"
          data-testid={testId}
          onClick={() => setOpen(false)}
          className={cn(
            "absolute top-full z-40 mt-1 min-w-[10rem] rounded-lg border border-border bg-popover p-1 shadow-lg",
            "duration-150 animate-in fade-in-0 zoom-in-95",
            align === "end" ? "right-0" : "left-0"
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

interface ItemProps {
  onSelect: () => void;
  children: ReactNode;
  icon?: ReactNode;
  destructive?: boolean;
  testId?: string;
}

export function DropdownMenuItem({ onSelect, children, icon, destructive, testId }: ItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      data-testid={testId}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-13 transition-colors duration-150",
        destructive
          ? "text-destructive hover:bg-destructive/10"
          : "text-foreground hover:bg-muted"
      )}
    >
      {icon && <span className="flex h-4 w-4 shrink-0 items-center justify-center">{icon}</span>}
      {children}
    </button>
  );
}

export function DropdownMenuSeparator() {
  return <div className="my-1 h-px bg-border" />;
}
