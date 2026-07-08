"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Board {
  id: number | string;
  name: string;
  visibility: string;
}

function BoardSkeleton() {
  return (
    <div data-testid="loading" className="flex flex-col gap-3 animate-pulse">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-14 rounded-lg bg-muted" />
      ))}
    </div>
  );
}

function EmptyState({ onCreate, description }: { onCreate: () => void; description: string | null }) {
  return (
    <div
      data-testid="empty"
      className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border py-12 text-center"
    >
      {/* uc-rr-010（p20/F11）：Boards 空态展示房间 description（无则不渲染该行） */}
      {description && (
        <p data-testid="room-boards-empty-description" className="max-w-md text-sm text-muted-foreground">
          {description}
        </p>
      )}
      <p className="text-sm text-muted-foreground">这个房间还没有白板，创建第一块试试</p>
      <Button size="sm" onClick={onCreate}>
        新建白板
      </Button>
    </div>
  );
}

export default function RoomBoardsPage() {
  const params = useParams<{ id: string }>();
  const roomId = params.id;
  const [boards, setBoards] = useState<Board[]>([]);
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [createError, setCreateError] = useState("");
  const [showForm, setShowForm] = useState(false);
  // uc-rr-010（p20/F11）：Boards 空态展示房间 description
  const [roomDescription, setRoomDescription] = useState<string | null>(null);

  // issue #333 排查发现的真实竞态：初始 load()（React 18 StrictMode 下 effect 双触发，
  // 有两个在途）与用户点击搜索触发的 load(q) 并发时，先发出的未过滤响应可能后返回，
  // 把已过滤的列表覆盖回全量。用请求代数守卫丢弃过期响应（同 board-canvas requestGenRef 手法）。
  const loadGenRef = useRef(0);

  async function load(search = "") {
    const gen = ++loadGenRef.current;
    setLoading(true);
    setError("");
    const res = await fetch(`/api/rooms/${roomId}/boards${search ? `?q=${encodeURIComponent(search)}` : ""}`);
    if (gen !== loadGenRef.current) return; // 已有更新的 load 发出，本响应过期
    if (res.status === 401) {
      setError("请先登录");
      setLoading(false);
      return;
    }
    if (res.status === 403) {
      setError("你不是该房间成员");
      setLoading(false);
      return;
    }
    const d = await res.json();
    if (gen !== loadGenRef.current) return;
    setBoards(d.boards ?? []);
    setFavs(new Set((d.favoriteIds ?? []).map(String)));
    setLoading(false);
  }

  async function toggleFav(id: number | string) {
    const isFav = favs.has(String(id));
    await fetch(`/api/boards/${id}/favorite`, { method: isFav ? "DELETE" : "POST" });
    await load(q);
  }

  async function duplicate(id: number | string) {
    await fetch(`/api/boards/${id}/duplicate`, { method: "POST" });
    await load(q);
  }

  useEffect(() => {
    void load();
    void (async () => {
      const res = await fetch(`/api/rooms/${roomId}`);
      if (!res.ok) return;
      const d = await res.json();
      setRoomDescription(d.room?.description ?? null);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    const res = await fetch(`/api/rooms/${roomId}/boards`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.status === 201) {
      setName("");
      setShowForm(false);
      await load(q);
    } else {
      const d = await res.json().catch(() => ({}));
      setCreateError(d.error ?? "创建失败");
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">房间白板</h1>
        <Button
          data-testid="show-create-board"
          size="sm"
          onClick={() => setShowForm((v) => !v)}
          className="transition-all duration-200 active:scale-[0.98]"
        >
          {showForm ? "取消" : "新建白板"}
        </Button>
      </div>

      {error && (
        <p role="alert" data-testid="err" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {showForm && (
        <form onSubmit={create} className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="board-name">白板名称</Label>
            <Input
              id="board-name"
              data-testid="board-name"
              placeholder="未命名白板"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          {createError && (
            <p role="alert" data-testid="err-create" className="text-sm text-destructive">
              {createError}
            </p>
          )}
          <Button data-testid="create-board" type="submit" size="sm" className="self-start">
            创建
          </Button>
        </form>
      )}

      {/* 搜索栏 */}
      <div className="flex gap-2">
        <Input
          data-testid="search"
          placeholder="搜索白板名称…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load(q)}
        />
        <Button data-testid="search-btn" variant="secondary" onClick={() => load(q)}>
          搜索
        </Button>
      </div>

      {loading ? (
        <BoardSkeleton />
      ) : boards.length === 0 ? (
        q ? (
          <p data-testid="no-match" className="py-12 text-center text-sm text-muted-foreground">
            没有匹配「{q}」的白板
          </p>
        ) : (
          <EmptyState onCreate={() => setShowForm(true)} description={roomDescription} />
        )
      ) : (
        <ul data-testid="board-list" className="flex flex-col gap-2">
          {boards.map((b) => (
            <li
              key={String(b.id)}
              data-testid={`board-${b.id}`}
              className={cn(
                "flex items-center gap-2 rounded-lg border bg-card px-4 py-3",
                "text-card-foreground shadow-sm transition-all duration-200 hover:shadow-md hover:border-border/70"
              )}
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                data-testid={`fav-${b.id}`}
                aria-pressed={favs.has(String(b.id))}
                onClick={() => toggleFav(b.id)}
                className="h-8 w-8 text-lg leading-none text-amber-500"
                title={favs.has(String(b.id)) ? "取消收藏" : "收藏"}
              >
                {favs.has(String(b.id)) ? "★" : "☆"}
              </Button>
              <a href={`/boards/${b.id}`} className="flex flex-1 items-center justify-between">
                <span className="text-sm font-medium text-foreground">{b.name}</span>
                <Badge variant="muted">{b.visibility}</Badge>
              </a>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                data-testid={`dup-${b.id}`}
                onClick={() => duplicate(b.id)}
                title="复制白板"
              >
                复制
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
