"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Board {
  id: number | string;
  name: string;
  visibility: string;
}

export default function RecentBoardsPage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  // uc-ai-store-003：从 AI Store 模板「Use」入口跳转过来时（?template=<id>），
  // boards 目前还没有「按模板建板」的后端管线（见 F03 范围说明），先给出明确提示，
  // 避免用户误以为已经按模板建好了板（静默落到普通列表会误导）。
  const [templateNotice, setTemplateNotice] = useState(false);

  async function load(search = "") {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/boards?scope=recent${search ? `&q=${encodeURIComponent(search)}` : ""}`);
    if (res.status === 401) {
      setError("请先登录");
      setLoading(false);
      return;
    }
    setBoards((await res.json()).boards ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("template")) {
      setTemplateNotice(true);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">最近白板</h1>

      {templateNotice && (
        <div
          data-testid="template-use-notice"
          role="status"
          className="rounded-lg border border-border bg-surface-1 px-4 py-3 text-sm text-foreground"
        >
          按模板建板功能开发中，暂未上线——已为你打开最近白板列表。
        </div>
      )}

      {error && (
        <p role="alert" data-testid="err" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Input
          data-testid="search"
          placeholder="搜索最近白板…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load(q)}
        />
        <Button data-testid="search-btn" variant="secondary" onClick={() => load(q)}>
          搜索
        </Button>
      </div>

      {loading ? (
        <div data-testid="loading" className="flex flex-col gap-3 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-muted" />
          ))}
        </div>
      ) : boards.length === 0 ? (
        <p data-testid="empty" className="py-12 text-center text-sm text-muted-foreground">
          还没有最近访问的白板
        </p>
      ) : (
        <ul data-testid="recent-list" className="flex flex-col gap-2">
          {boards.map((b) => (
            <li key={String(b.id)} data-testid={`board-${b.id}`}>
              <a
                href={`/boards/${b.id}`}
                className={cn(
                  "flex items-center justify-between rounded-lg border bg-card px-4 py-3",
                  "text-card-foreground shadow-sm",
                  "transition-all duration-200 hover:shadow-md hover:border-border/70 cursor-pointer"
                )}
              >
                <span className="text-sm font-medium text-foreground">{b.name}</span>
                <Badge variant="muted">{b.visibility}</Badge>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
