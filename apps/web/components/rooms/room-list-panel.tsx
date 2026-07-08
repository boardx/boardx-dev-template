"use client";
// p22/F01：Rooms 主从（master-detail）双栏布局的左栏——房间列表常驻，
// 切换房间时本面板不消失，右侧详情区域随路由替换（见 ../../app/(app)/rooms/layout.tsx）。
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Room {
  id: number | string;
  name: string;
  visibility: string;
  team_id: number | string | null;
  is_member?: boolean;
}

// uc-rr-002：可见性二选一卡片（🔒 Private / 🌐 Team），默认 Private
const VISIBILITY_OPTIONS = [
  { value: "private", icon: "🔒", title: "Private", desc: "Only invited members can find and join" },
  { value: "team", icon: "🌐", title: "Team", desc: "Anyone on the team can discover and join" },
] as const;

const TAG_FILLS = ["bg-tag-green", "bg-tag-blue", "bg-tag-purple", "bg-tag-pink", "bg-tag-yellow"];
function fillFor(id: string | number) {
  const s = String(id);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return TAG_FILLS[h % TAG_FILLS.length];
}

function RoomListSkeleton() {
  return (
    <div data-testid="room-list-loading" className="flex flex-col gap-1 p-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-11 animate-pulse rounded-lg bg-muted" />
      ))}
    </div>
  );
}

export function RoomListPanel() {
  const params = useParams<{ id?: string }>();
  const pathname = usePathname();
  const activeRoomId = params?.id ? String(params.id) : null;

  const [rooms, setRooms] = useState<Room[]>([]);
  const [favIds, setFavIds] = useState<Set<string>>(new Set());
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState("private");
  const [createError, setCreateError] = useState("");

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

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      setFavIds((prev) => {
        const next = new Set(prev);
        if (isFav) next.add(key);
        else next.delete(key);
        return next;
      });
    }
  }

  function toggleFavoritesOnly() {
    const next = !favoritesOnly;
    setFavoritesOnly(next);
    void load(q, next);
  }

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

  // 切换房间时保留当前 tab（若能从路径解析出来），否则默认落 boards。
  const currentSegment = activeRoomId ? pathname.split(`/rooms/${activeRoomId}`)[1]?.split("/")[1] : null;

  return (
    <aside
      data-testid="room-list-panel"
      className="flex h-full w-72 shrink-0 flex-col border-r border-border bg-card"
    >
      <div className="flex items-center justify-between gap-2 px-4 pt-4">
        <h1 className="text-15 font-bold tracking-tight text-foreground">Rooms</h1>
        <Button
          data-testid="room-list-new"
          variant="ghost"
          size="icon"
          aria-label="New room"
          className="h-7 w-7"
          onClick={() => setShowForm((v) => !v)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {showForm && (
        <form
          onSubmit={create}
          data-testid="room-list-create-form"
          className="mx-4 mt-3 flex flex-col gap-2.5 rounded-lg border border-border bg-surface-1 p-3"
        >
          <div className="flex flex-col gap-1">
            <Label htmlFor="room-list-name">Room name</Label>
            <Input
              id="room-list-name"
              data-testid="room-list-name-input"
              placeholder="My room"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Visibility">
            {VISIBILITY_OPTIONS.map((opt) => {
              const selected = visibility === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  data-testid={`room-list-visibility-${opt.value}`}
                  onClick={() => setVisibility(opt.value)}
                  className={cn(
                    "rounded-md border p-1.5 text-left text-xs font-medium",
                    selected
                      ? "border-foreground bg-background ring-1 ring-ring"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {opt.icon} {opt.title}
                </button>
              );
            })}
          </div>
          {createError && (
            <p role="alert" data-testid="room-list-create-err" className="text-xs text-destructive">
              {createError}
            </p>
          )}
          <Button
            data-testid="room-list-create-submit"
            type="submit"
            size="sm"
            disabled={nameTooShort}
            className="self-start"
          >
            Create
          </Button>
        </form>
      )}

      <div className="mt-3 px-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-placeholder" />
          <Input
            data-testid="room-list-search"
            placeholder="Search…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(q)}
            className="h-8 pl-8 text-13"
          />
        </div>
      </div>

      <div className="mt-2 px-4">
        <Button
          variant={favoritesOnly ? "secondary" : "ghost"}
          size="sm"
          data-testid="room-list-favorites-filter"
          aria-pressed={favoritesOnly}
          onClick={toggleFavoritesOnly}
          className="h-7 gap-1 px-2 text-xs"
        >
          <span className="text-amber-500">{favoritesOnly ? "★" : "☆"}</span>
          Favorites
        </Button>
      </div>

      {error && (
        <p role="alert" data-testid="room-list-err" className="px-4 py-2 text-xs text-destructive">
          {error}
        </p>
      )}

      <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <RoomListSkeleton />
        ) : rooms.length === 0 ? (
          <p data-testid="room-list-empty" className="px-4 py-6 text-center text-13 text-muted-foreground">
            {favoritesOnly ? "还没有收藏的房间" : "还没有房间，点击右上角新建"}
          </p>
        ) : (
          <ul data-testid="room-list" className="flex flex-col gap-0.5 px-2 pb-3">
            {rooms.map((r) => {
              const active = activeRoomId === String(r.id);
              const targetSegment = active && currentSegment ? currentSegment : "boards";
              return (
                <li key={String(r.id)}>
                  <Link
                    href={`/rooms/${r.id}/${targetSegment}`}
                    data-testid={`room-list-item-${r.id}`}
                    data-active={active ? "true" : "false"}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-2 py-2 text-13 transition-colors",
                      active ? "bg-muted font-semibold text-foreground" : "text-foreground hover:bg-surface-1",
                    )}
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold text-foreground/30 ${fillFor(r.id)}`}
                    >
                      {r.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{r.name}</span>
                    {favIds.has(String(r.id)) && <span className="shrink-0 text-xs text-amber-500">★</span>}
                    <Badge variant="muted" className="shrink-0 px-1.5 py-0 text-10">
                      {r.visibility === "team" ? "🌐" : "🔒"}
                    </Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
