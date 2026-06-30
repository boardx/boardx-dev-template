"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface Item {
  id: string;
  type: string;
  color?: string | null;
}

// 板统计（uc-board-header-014）：header 入口 → 面板展示组件数量与分类。
// 只读：点击时拉取 board items 现状，不改画布。
export function BoardStatistics({ boardId }: { boardId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Item[] | null>(null);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && items === null) {
      setLoading(true);
      const res = await fetch(`/api/boards/${boardId}/items`);
      if (res.ok) setItems((await res.json()).items ?? []);
      setLoading(false);
    } else if (next) {
      // 重新打开时刷新一次
      setLoading(true);
      const res = await fetch(`/api/boards/${boardId}/items`);
      if (res.ok) setItems((await res.json()).items ?? []);
      setLoading(false);
    }
  }

  const total = items?.length ?? 0;
  const texts = items?.filter((it) => it.color === "text").length ?? 0;
  const notes = total - texts;

  return (
    <div className="relative">
      <Button
        data-testid="board-stats-open"
        size="sm"
        variant="ghost"
        aria-expanded={open}
        onClick={toggle}
      >
        统计
      </Button>
      {open && (
        <div
          data-testid="board-stats-panel"
          role="dialog"
          className="absolute right-0 top-full z-50 mt-2 w-56 rounded-12 border border-border bg-popover p-4 text-popover-foreground shadow-[0_16px_40px_rgba(0,0,0,0.18)]"
        >
          <div className="mb-2 text-13 font-semibold">Board statistics</div>
          {loading ? (
            <div data-testid="board-stats-loading" className="text-11 text-muted-foreground">
              加载中…
            </div>
          ) : (
            <ul data-testid="board-stats-list" className="flex flex-col gap-1.5 text-13">
              <li className="flex items-center justify-between">
                <span className="text-muted-foreground">组件总数</span>
                <span data-testid="stat-total" className="font-semibold text-foreground">{total}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-muted-foreground">便签</span>
                <span data-testid="stat-notes" className="font-semibold text-foreground">{notes}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-muted-foreground">文本</span>
                <span data-testid="stat-texts" className="font-semibold text-foreground">{texts}</span>
              </li>
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
