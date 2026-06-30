"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Room {
  id: number | string;
  name: string;
  visibility: string;
  team_id: number | string | null;
}

function RoomSkeleton() {
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
      <p className="text-sm text-muted-foreground">还没有房间，创建第一个试试</p>
      <Button size="sm" onClick={onCreate}>
        新建房间
      </Button>
    </div>
  );
}

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState("private");
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [createError, setCreateError] = useState("");
  const [showForm, setShowForm] = useState(false);

  async function load(search = "") {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/rooms${search ? `?q=${encodeURIComponent(search)}` : ""}`);
    if (res.status === 401) {
      setError("请先登录");
      setLoading(false);
      return;
    }
    setRooms((await res.json()).rooms ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    const res = await fetch("/api/rooms", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, visibility }),
    });
    if (res.status === 201) {
      setName("");
      setShowForm(false);
      await load(q);
    } else {
      const d = await res.json().catch(() => ({}));
      setCreateError(d.errors?.name ?? d.error ?? "创建失败");
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      {/* 页面标题 + 操作区 */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">我的房间</h1>
        <Button
          data-testid="show-create"
          size="sm"
          onClick={() => setShowForm((v) => !v)}
          className="transition-all duration-200 active:scale-[0.98]"
        >
          {showForm ? "取消" : "新建房间"}
        </Button>
      </div>

      {/* 错误（认证/加载失败）*/}
      {error && (
        <p role="alert" data-testid="err" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {/* 创建表单（折叠）*/}
      {showForm && (
        <form
          onSubmit={create}
          className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="room-name">房间名称</Label>
            <Input
              id="room-name"
              data-testid="room-name"
              placeholder="我的房间"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="visibility">可见性</Label>
            <Select
              id="visibility"
              data-testid="visibility"
              className="w-40"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
            >
              <option value="private">私有</option>
              <option value="team">团队可见</option>
            </Select>
          </div>
          {createError && (
            <p role="alert" data-testid="err-create" className="text-sm text-destructive">
              {createError}
            </p>
          )}
          <Button data-testid="create" type="submit" size="sm" className="self-start">
            创建
          </Button>
        </form>
      )}

      {/* 搜索栏 */}
      <div className="flex gap-2">
        <Input
          data-testid="search"
          placeholder="搜索房间名称…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load(q)}
        />
        <Button
          data-testid="search-btn"
          variant="secondary"
          onClick={() => load(q)}
          className="transition-colors duration-200"
        >
          搜索
        </Button>
      </div>

      {/* 内容区：loading / empty / list */}
      {loading ? (
        <RoomSkeleton />
      ) : rooms.length === 0 ? (
        <EmptyState onCreate={() => setShowForm(true)} />
      ) : (
        <ul data-testid="room-list" className="flex flex-col gap-2">
          {rooms.map((r) => (
            <li
              key={String(r.id)}
              data-testid={`room-${r.id}`}
              className={cn(
                "flex items-center justify-between rounded-lg border bg-card px-4 py-3",
                "text-card-foreground shadow-sm",
                "transition-all duration-200 hover:shadow-md hover:border-border/70 cursor-pointer"
              )}
            >
              <span className="text-sm font-medium text-foreground">{r.name}</span>
              <Badge variant="muted">{r.visibility}</Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
