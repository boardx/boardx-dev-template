"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Search, LayoutGrid, List, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type View = "grid" | "list";

interface Room {
  id: number | string;
  name: string;
  visibility: string;
  team_id: number | string | null;
  is_member?: boolean;
}

function FavoriteToggle({
  active,
  onToggle,
  testId,
  className,
}: {
  active: boolean;
  onToggle: () => void;
  testId: string;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      data-testid={testId}
      aria-pressed={active}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      className={cn("h-7 w-7 text-base leading-none text-amber-500", className)}
      title={active ? "取消收藏" : "收藏"}
    >
      {active ? "★" : "☆"}
    </Button>
  );
}

// uc-rr-002：可见性二选一卡片（🔒 Private / 🌐 Team），默认 Private
const VISIBILITY_OPTIONS = [
  { value: "private", icon: "🔒", title: "Private", desc: "Only invited members can find and join" },
  { value: "team", icon: "🌐", title: "Team", desc: "Anyone on the team can discover and join" },
] as const;

/** 列表徽章：与创建时的可见性选择一致（🔒 private / 🌐 team）。 */
function VisibilityBadge({ room }: { room: Room }) {
  const team = room.visibility === "team";
  return (
    <Badge variant="muted" data-testid={`room-visibility-badge-${room.id}`} className="shrink-0">
      {team ? "🌐 team" : "🔒 private"}
    </Badge>
  );
}

const TAG_FILLS = ["bg-tag-green", "bg-tag-blue", "bg-tag-purple", "bg-tag-pink", "bg-tag-yellow"];
function fillFor(id: string | number) {
  const s = String(id);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return TAG_FILLS[h % TAG_FILLS.length];
}

function NewRoomCard({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="outline"
      onClick={onClick}
      className="h-[9.375rem] w-full flex-col gap-1.5 rounded-12 border-dashed border-border-strong font-medium text-muted-foreground hover:border-foreground hover:bg-transparent hover:text-foreground"
    >
      <Plus className="h-6 w-6" strokeWidth={1.5} />
      <span className="text-xs">New room</span>
    </Button>
  );
}

function ViewToggle({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  const opts: { v: View; icon: typeof LayoutGrid; label: string }[] = [
    { v: "grid", icon: LayoutGrid, label: "网格视图" },
    { v: "list", icon: List, label: "列表视图" },
  ];
  return (
    <div className="flex gap-0.5 rounded-lg border border-border p-0.5">
      {opts.map(({ v, icon: Icon, label }) => (
        <Button
          key={v}
          variant="ghost"
          size="icon"
          aria-label={label}
          aria-pressed={view === v}
          data-testid={`view-${v}`}
          onClick={() => onChange(v)}
          className={cn(
            "h-7 w-7 rounded-md",
            view === v ? "bg-muted text-foreground" : "text-placeholder hover:text-foreground",
          )}
        >
          <Icon className="h-4 w-4" />
        </Button>
      ))}
    </div>
  );
}

function NewRoomRow({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      className="h-auto w-full justify-start gap-3 rounded-none border-b border-muted px-4 py-3 font-normal text-muted-foreground hover:bg-surface-1 hover:text-foreground"
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-dashed border-border-strong">
        <Plus className="h-3.5 w-3.5" />
      </span>
      <span className="text-13 font-medium">New room</span>
    </Button>
  );
}

function RoomSkeleton() {
  return (
    <div data-testid="loading" className="grid animate-pulse grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-[9.375rem] rounded-12 bg-muted" />
      ))}
    </div>
  );
}

export default function RoomsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [favIds, setFavIds] = useState<Set<string>>(new Set());
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState("private");
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [createError, setCreateError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [view, setView] = useState<View>("grid");
  // p20/F06：删除房间后跳回列表带 ?deleted=<房间名>，展示一次性 toast 并清掉 query。
  const [deletedToast, setDeletedToast] = useState("");

  useEffect(() => {
    const v = typeof window !== "undefined" ? window.localStorage.getItem("rooms-view") : null;
    if (v === "grid" || v === "list") setView(v);
  }, []);

  useEffect(() => {
    const deleted = searchParams.get("deleted");
    if (deleted) {
      setDeletedToast(deleted);
      router.replace("/rooms");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function changeView(v: View) {
    setView(v);
    if (typeof window !== "undefined") window.localStorage.setItem("rooms-view", v);
  }

  async function load(search = "", favOnly = favoritesOnly) {
    setLoading(true);
    setError("");
    const sp = new URLSearchParams();
    if (search) sp.set("q", search);
    if (favOnly) sp.set("favorite", "1");
    const qs = sp.toString();
    const res = await fetch(`/api/rooms${qs ? `?${qs}` : ""}`);
    if (res.status === 401) {
      setError("请先登录");
      setLoading(false);
      return;
    }
    const d = await res.json();
    setRooms(d.rooms ?? []);
    setFavIds(new Set((d.favoriteIds ?? []).map(String)));
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  // uc-rr-004：星标即时切换（乐观更新 + 网络失败回滚 toast）
  async function toggleFav(id: Room["id"]) {
    const key = String(id);
    const isFav = favIds.has(key);
    setFavIds((prev) => {
      const next = new Set(prev);
      if (isFav) next.delete(key);
      else next.add(key);
      return next;
    });
    try {
      const res = await fetch(`/api/rooms/${id}/favorite`, { method: isFav ? "DELETE" : "POST" });
      if (!res.ok) throw new Error(String(res.status));
      if (favoritesOnly) await load(q, true);
    } catch {
      // 回滚
      setFavIds((prev) => {
        const next = new Set(prev);
        if (isFav) next.add(key);
        else next.delete(key);
        return next;
      });
      setError("收藏操作失败，请重试");
    }
  }

  function toggleFavoritesOnly() {
    const next = !favoritesOnly;
    setFavoritesOnly(next);
    void load(q, next);
  }

  // uc-rr-002 E1：房间名 ≥3 字符才可提交
  const nameTooShort = name.trim().length < 3;

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (nameTooShort) return;
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

  // uc-rr-002：team 可见房间的同团队成员自助加入（加入即成为 member）
  async function join(id: Room["id"]) {
    const res = await fetch(`/api/rooms/${id}/join`, { method: "POST" });
    if (res.ok) await load(q);
  }

  return (
    <div className="mx-auto max-w-content px-9 pb-14 pt-7">
      {/* 标题 + 操作 */}
      <div className="flex items-center justify-between">
        <h1 className="text-26 font-bold tracking-tight text-foreground">Rooms</h1>
        <Button data-testid="show-create" size="sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "New room"}
        </Button>
      </div>

      {/* p20/F06：房间删除成功 toast（一次性，来自 ?deleted= 跳转） */}
      {deletedToast && (
        <div
          data-testid="room-deleted-toast"
          className="mt-4 flex items-center justify-between gap-3 rounded-10 border border-border bg-surface-1 px-3.5 py-3 text-13 text-foreground"
        >
          <span>
            <span className="font-semibold">{deletedToast}</span> has been permanently deleted.
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="关闭提示"
            className="h-6 w-6"
            onClick={() => setDeletedToast("")}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {error && (
        <p role="alert" data-testid="err" className="mt-4 text-13 text-destructive">
          {error}
        </p>
      )}

      {/* 创建表单（折叠） */}
      {showForm && (
        <form onSubmit={create} className="mt-5 flex flex-col gap-3 rounded-12 border border-border bg-surface-1 p-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="room-name">Room name</Label>
            <Input
              id="room-name"
              data-testid="room-name"
              placeholder="My room"
              value={name}
              aria-invalid={name.length > 0 && nameTooShort}
              onChange={(e) => setName(e.target.value)}
            />
            {name.length > 0 && nameTooShort && (
              <p role="alert" data-testid="room-name-hint" className="text-xs text-destructive">
                Room name must be at least 3 characters
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Visibility</Label>
            <div role="radiogroup" aria-label="Visibility" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {VISIBILITY_OPTIONS.map((opt) => {
                const selected = visibility === opt.value;
                return (
                  <Button
                    key={opt.value}
                    type="button"
                    variant="outline"
                    role="radio"
                    aria-checked={selected}
                    data-testid={`room-create-visibility-${opt.value}`}
                    onClick={() => setVisibility(opt.value)}
                    className={cn(
                      "h-auto flex-col items-start gap-1 rounded-12 p-3 text-left font-normal",
                      selected
                        ? "border-foreground bg-background ring-1 ring-ring"
                        : "border-border text-muted-foreground hover:border-border-strong",
                    )}
                  >
                    <span className="text-13 font-semibold text-foreground">
                      {opt.icon} {opt.title}
                    </span>
                    <span className="whitespace-normal text-xs text-muted-foreground">{opt.desc}</span>
                  </Button>
                );
              })}
            </div>
          </div>
          {createError && (
            <p role="alert" data-testid="err-create" className="text-13 text-destructive">
              {createError}
            </p>
          )}
          <Button data-testid="create" type="submit" size="sm" disabled={nameTooShort} className="self-start">
            Create
          </Button>
        </form>
      )}

      {/* 搜索 */}
      <div className="mt-5 flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-placeholder" />
          <Input
            data-testid="search"
            placeholder="Search rooms…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(q)}
            className="pl-9"
          />
        </div>
        <Button data-testid="search-btn" variant="secondary" onClick={() => load(q)}>
          Search
        </Button>
      </div>

      {/* Favorites 筛选 + 视图切换 */}
      <div className="mt-6 flex items-center justify-end gap-2">
        <Button
          variant={favoritesOnly ? "secondary" : "ghost"}
          size="sm"
          data-testid="room-favorites-filter"
          aria-pressed={favoritesOnly}
          onClick={toggleFavoritesOnly}
          className="gap-1.5 text-13"
        >
          <span className="text-amber-500">{favoritesOnly ? "★" : "☆"}</span>
          Favorites
        </Button>
        <ViewToggle view={view} onChange={changeView} />
      </div>

      {/* 内容 */}
      <div className="mt-4">
        {loading ? (
          <RoomSkeleton />
        ) : rooms.length === 0 ? (
          favoritesOnly ? (
            <p data-testid="empty-favorites" className="py-12 text-center text-13 text-muted-foreground">
              还没有收藏的房间
            </p>
          ) : (
            <div data-testid="empty" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <NewRoomCard onClick={() => setShowForm(true)} />
            </div>
          )
        ) : view === "grid" ? (
          <div data-testid="room-list" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <NewRoomCard onClick={() => setShowForm(true)} />
            {rooms.map((r) => (
              <a
                key={String(r.id)}
                href={`/rooms/${r.id}/boards`}
                data-testid={`room-${r.id}`}
                className="block overflow-hidden rounded-12 border border-border transition-all hover:border-border-strong hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className={`flex h-[6.5rem] items-center justify-center text-22 font-bold text-foreground/30 ${fillFor(r.id)}`}>
                  {r.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                  <span className="flex min-w-0 items-center gap-1">
                    <FavoriteToggle
                      active={favIds.has(String(r.id))}
                      onToggle={() => toggleFav(r.id)}
                      testId={`room-favorite-toggle-${r.id}`}
                    />
                    <span className="truncate text-13 font-semibold text-foreground">{r.name}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <VisibilityBadge room={r} />
                    {r.is_member === false && (
                      <Button
                        size="sm"
                        variant="secondary"
                        data-testid={`room-join-${r.id}`}
                        className="h-6 px-2 text-xs"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          void join(r.id);
                        }}
                      >
                        Join
                      </Button>
                    )}
                  </span>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div data-testid="room-list" className="overflow-hidden rounded-12 border border-border">
            <NewRoomRow onClick={() => setShowForm(true)} />
            {rooms.map((r) => (
              <a
                key={String(r.id)}
                href={`/rooms/${r.id}/boards`}
                data-testid={`room-${r.id}`}
                className="flex items-center gap-3 border-b border-muted px-4 py-3 transition-colors last:border-b-0 hover:bg-surface-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <span className={`flex h-7 w-9 shrink-0 items-center justify-center rounded-md text-13 font-bold text-foreground/30 ${fillFor(r.id)}`}>
                  {r.name.charAt(0).toUpperCase()}
                </span>
                <FavoriteToggle
                  active={favIds.has(String(r.id))}
                  onToggle={() => toggleFav(r.id)}
                  testId={`room-favorite-toggle-${r.id}`}
                />
                <span className="flex-1 truncate text-13 font-semibold text-foreground">{r.name}</span>
                <VisibilityBadge room={r} />
                {r.is_member === false && (
                  <Button
                    size="sm"
                    variant="secondary"
                    data-testid={`room-join-${r.id}`}
                    className="h-6 px-2 text-xs"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void join(r.id);
                    }}
                  >
                    Join
                  </Button>
                )}
                <ChevronRight className="h-4 w-4 shrink-0 text-border-strong" />
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
