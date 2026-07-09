"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface Stats {
  total: number;
  byKind: { note: number; text: number; shape: number; connector: number; embed: number };
  memberCount: number;
  lastCreatedAt: string | null;
}

// 板统计（uc-board-header-014）：header 入口 → 面板展示组件数量分类 + 协作者数 + 最近创建时间。
// 只读：点击时向服务端聚合接口取现状，不改画布。p7:F06 从"客户端拉全量 items 本地数"
// 改为服务端聚合（GET /api/boards/:id/statistics），避免大板场景把整份 items 拉一遍。
export function BoardStatistics({ boardId }: { boardId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      const res = await fetch(`/api/boards/${boardId}/statistics`);
      if (res.ok) setStats(await res.json());
      setLoading(false);
    }
  }

  const total = stats?.total ?? 0;
  const notes = stats?.byKind.note ?? 0;
  const texts = stats?.byKind.text ?? 0;
  const lastCreatedLabel = stats?.lastCreatedAt
    ? new Date(stats.lastCreatedAt).toLocaleString()
    : "暂无组件";

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
          className="absolute right-0 top-full z-[60] mt-2 w-64 rounded-12 border border-border bg-popover p-4 text-popover-foreground shadow-[0_16px_40px_rgba(0,0,0,0.18)]"
        >
          <div className="mb-2 text-13 font-semibold">Board statistics</div>
          {loading ? (
            <div data-testid="board-stats-loading" className="text-11 text-muted-foreground">
              加载中…
            </div>
          ) : (
            <>
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
                <li className="flex items-center justify-between">
                  <span className="text-muted-foreground">形状</span>
                  <span data-testid="stat-shapes" className="font-semibold text-foreground">
                    {stats?.byKind.shape ?? 0}
                  </span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-muted-foreground">连接线</span>
                  <span data-testid="stat-connectors" className="font-semibold text-foreground">
                    {stats?.byKind.connector ?? 0}
                  </span>
                </li>
              </ul>
              <div className="mt-3 flex flex-col gap-1 border-t pt-3 text-13">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">协作者</span>
                  <span data-testid="stat-members" className="font-semibold text-foreground">
                    {stats?.memberCount ?? 0}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">最近创建</span>
                  <span data-testid="stat-last-created" className="text-right text-11 text-foreground">
                    {lastCreatedLabel}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
