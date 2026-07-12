"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Clock, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

// uc-home-004：最近访问/编辑过的资源（白板）列表，可点击回到内容。
// 复用既有 /api/boards?scope=recent（已按权限过滤，仅返回当前用户可见白板）。
// 覆盖 loading / empty / error 三态（对齐 UC A1 空状态、E1 加载失败重试）。
type RecentBoard = { id: number | string; public_id: string; name: string };

export default function RecentPage() {
  const router = useRouter();
  const [boards, setBoards] = useState<RecentBoard[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const res = await fetch("/api/boards?scope=recent");
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setBoards(Array.isArray(data.boards) ? data.boards : []);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <header className="flex flex-col gap-1">
        <h1
          data-testid="recent-title"
          className="text-3xl font-bold tracking-tight text-foreground"
        >
          Recent Activity
        </h1>
        <p className="text-13 text-muted-foreground">
          最近访问或编辑过的白板，点击即可回到工作内容。
        </p>
      </header>

      {status === "loading" && (
        <div
          data-testid="loading"
          className="flex animate-pulse flex-col gap-2"
          aria-busy="true"
        >
          <div className="h-14 w-full rounded-11 bg-muted" />
          <div className="h-14 w-full rounded-11 bg-muted" />
          <div className="h-14 w-full rounded-11 bg-muted" />
        </div>
      )}

      {status === "error" && (
        <div
          data-testid="recent-error"
          className="flex flex-col items-start gap-3 rounded-12 border border-dashed border-destructive p-6"
        >
          <p className="text-13 text-destructive">最近资源加载失败，请重试。</p>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void load()}
            data-testid="recent-retry"
          >
            <RotateCcw className="mr-1.5 h-4 w-4" />
            重试
          </Button>
        </div>
      )}

      {status === "ready" && boards.length === 0 && (
        <div
          data-testid="recent-empty"
          className="flex flex-col items-start gap-3 rounded-12 border border-dashed border-border p-6"
        >
          <div className="flex items-center gap-2 text-13 text-muted-foreground">
            <Clock className="h-4 w-4 text-placeholder" />
            还没有最近访问的白板。
          </div>
          <p className="text-xs text-muted-foreground">
            可通过左侧导航、Home、Room 或全局搜索继续访问你的工作内容。
          </p>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => router.push("/rooms")}
            data-testid="recent-goto-rooms"
          >
            去房间看看
          </Button>
        </div>
      )}

      {status === "ready" && boards.length > 0 && (
        <ul data-testid="recent-list" className="flex flex-col gap-2">
          {boards.map((b) => (
            <li key={String(b.id)} data-testid={`recent-item-${b.id}`}>
              <a
                href={`/boards/${b.public_id}`}
                className="flex items-center gap-3 rounded-11 border border-border px-4 py-3 transition-all hover:border-border-strong hover:bg-surface-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
                  {b.name.charAt(0).toUpperCase()}
                </div>
                <span className="flex-1 text-13 font-semibold text-foreground">
                  {b.name}
                </span>
                <ArrowRight className="h-4 w-4 text-placeholder" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
