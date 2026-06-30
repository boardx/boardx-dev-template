"use client";
import { useEffect, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface Room {
  id: number | string;
  name: string;
  visibility: string;
  team_id: number | string | null;
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
    <div className="mx-auto max-w-content px-9 pb-14 pt-7">
      {/* 标题 + 操作 */}
      <div className="flex items-center justify-between">
        <h1 className="text-26 font-bold tracking-tight text-foreground">Rooms</h1>
        <Button data-testid="show-create" size="sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "New room"}
        </Button>
      </div>

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
            <Input id="room-name" data-testid="room-name" placeholder="My room" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="visibility">Visibility</Label>
            <Select id="visibility" data-testid="visibility" className="w-40" value={visibility} onChange={(e) => setVisibility(e.target.value)}>
              <option value="private">Private</option>
              <option value="team">Team</option>
            </Select>
          </div>
          {createError && (
            <p role="alert" data-testid="err-create" className="text-13 text-destructive">
              {createError}
            </p>
          )}
          <Button data-testid="create" type="submit" size="sm" className="self-start">
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

      {/* 内容 */}
      <div className="mt-6">
        {loading ? (
          <RoomSkeleton />
        ) : rooms.length === 0 ? (
          <div data-testid="empty" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <NewRoomCard onClick={() => setShowForm(true)} />
          </div>
        ) : (
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
                  <span className="truncate text-13 font-semibold text-foreground">{r.name}</span>
                  <Badge variant="muted">{r.visibility}</Badge>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
