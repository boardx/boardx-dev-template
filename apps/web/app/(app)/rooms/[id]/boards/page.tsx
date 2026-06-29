"use client";
import { useEffect, useState } from "react";
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

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div
      data-testid="empty"
      className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border py-12 text-center"
    >
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
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [createError, setCreateError] = useState("");
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/rooms/${roomId}/boards`);
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
    setBoards((await res.json()).boards ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
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
      await load();
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

      {loading ? (
        <BoardSkeleton />
      ) : boards.length === 0 ? (
        <EmptyState onCreate={() => setShowForm(true)} />
      ) : (
        <ul data-testid="board-list" className="flex flex-col gap-2">
          {boards.map((b) => (
            <li
              key={String(b.id)}
              data-testid={`board-${b.id}`}
              className={cn(
                "flex items-center justify-between rounded-lg border bg-card px-4 py-3",
                "text-card-foreground shadow-sm",
                "transition-all duration-200 hover:shadow-md hover:border-border/70 cursor-pointer"
              )}
            >
              <span className="text-sm font-medium text-foreground">{b.name}</span>
              <Badge variant="muted">{b.visibility}</Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
