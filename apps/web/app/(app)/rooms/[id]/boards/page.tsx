"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronRight,
  Copy,
  ImageOff,
  ImagePlus,
  LayoutGrid,
  List,
  MoreHorizontal,
  Move,
  Pencil,
  Plus,
  Presentation,
  Tag,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { TagInput } from "@/components/board-list/tag-input";
import { EditTagsDialog } from "@/components/board-list/edit-tags-dialog";
import { cn } from "@/lib/utils";

interface Board {
  id: number | string;
  name: string;
  visibility: string;
  updated_at?: string;
  cover?: string | null;
  tags?: string[];
}

interface RoomOption {
  id: number | string;
  name: string;
}

// 卡片缩略图底色（board 目前没有真实缩略图/封面，按 id 稳定散列到柔和色板——
// 对齐 prototype 的 b.fill 色块 + 居中图标；oldcode BoardGrid 用的是封面图，
// 等封面能力上线后这里换成真实缩略图）。
const THUMB_TONES = ["bg-amber-50", "bg-sky-50", "bg-emerald-50", "bg-rose-50", "bg-violet-50"];
function thumbTone(id: number | string) {
  const n = String(id)
    .split("")
    .reduce((a, c) => a + c.charCodeAt(0), 0);
  return THUMB_TONES[n % THUMB_TONES.length];
}

function formatUpdated(updatedAt?: string) {
  if (!updatedAt) return "";
  const d = new Date(updatedAt);
  if (Number.isNaN(d.getTime())) return "";
  return `更新于 ${d.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" })}`;
}

function BoardSkeleton() {
  return (
    <div data-testid="loading" className="grid animate-pulse gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-36 rounded-xl bg-muted" />
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
  const router = useRouter();
  const roomId = params.id;
  const [boards, setBoards] = useState<Board[]>([]);
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [createTags, setCreateTags] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [createError, setCreateError] = useState("");
  const [showForm, setShowForm] = useState(false);
  // 视图切换（prototype room boards：▦ grid / ☰ list，默认 grid），偏好记在 localStorage。
  const [view, setView] = useState<"grid" | "list">("grid");
  // uc-rr-010（p20/F11）：Boards 空态展示房间 description
  const [roomDescription, setRoomDescription] = useState<string | null>(null);
  // 多标签客户端过滤（不改服务端调用）
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
  // 卡片"更多操作"各 Dialog 的目标
  const [renameTarget, setRenameTarget] = useState<Board | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [tagsTarget, setTagsTarget] = useState<Board | null>(null);
  const [moveTarget, setMoveTarget] = useState<Board | null>(null);
  const [moveRoomId, setMoveRoomId] = useState("");
  const [moveRooms, setMoveRooms] = useState<RoomOption[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Board | null>(null);

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
    if (typeof window !== "undefined" && window.localStorage.getItem("room_boards_view") === "list") {
      setView("list");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  function switchView(v: "grid" | "list") {
    setView(v);
    if (typeof window !== "undefined") window.localStorage.setItem("room_boards_view", v);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    const res = await fetch(`/api/rooms/${roomId}/boards`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, tags: createTags }),
    });
    if (res.status === 201) {
      setName("");
      setCreateTags([]);
      setShowForm(false);
      await load(q);
    } else {
      const d = await res.json().catch(() => ({}));
      setCreateError(d.error ?? "创建失败");
    }
  }

  // ─── 卡片"更多操作"动作 ────────────────────────────────────────────────
  function openRename(b: Board) {
    setRenameTarget(b);
    setRenameValue(b.name);
  }

  async function submitRename() {
    if (!renameTarget) return;
    await fetch(`/api/boards/${renameTarget.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: renameValue }),
    });
    setRenameTarget(null);
    await load(q);
  }

  async function saveTags(tags: string[]) {
    if (!tagsTarget) return;
    await fetch(`/api/boards/${tagsTarget.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tags }),
    });
    setTagsTarget(null);
    await load(q);
  }

  // 上传封面：单个受控 file input，记录目标 boardId。
  const coverInputRef = useRef<HTMLInputElement>(null);
  const coverTargetRef = useRef<number | string | null>(null);

  function triggerCoverUpload(id: number | string) {
    coverTargetRef.current = id;
    coverInputRef.current?.click();
  }

  async function onCoverFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const id = coverTargetRef.current;
    e.target.value = ""; // 允许再次选同一文件
    if (!file || id == null) return;
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/boards/${id}/cover`, { method: "POST", body: fd });
    if (res.ok) {
      await load(q);
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.errors?.file ?? d.error ?? "封面上传失败");
    }
  }

  async function removeCover(b: Board) {
    await fetch(`/api/boards/${b.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cover: null }),
    });
    await load(q);
  }

  async function openMove(b: Board) {
    setMoveTarget(b);
    setMoveRoomId("");
    const res = await fetch(`/api/rooms`);
    if (!res.ok) return;
    const d = await res.json();
    const rooms: RoomOption[] = (d.rooms ?? []).filter((r: RoomOption) => String(r.id) !== String(roomId));
    setMoveRooms(rooms);
  }

  async function submitMove() {
    if (!moveTarget || !moveRoomId) return;
    await fetch(`/api/boards/${moveTarget.id}/move`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ targetRoomId: Number(moveRoomId) }),
    });
    setMoveTarget(null);
    await load(q);
  }

  async function submitDelete() {
    if (!deleteTarget) return;
    await fetch(`/api/boards/${deleteTarget.id}`, { method: "DELETE" });
    setDeleteTarget(null);
    await load(q);
  }

  // 未过滤全集算出的标签集合（保持稳定，不随过滤变化）
  const allTags = [...new Set(boards.flatMap((b) => b.tags ?? []))].sort();
  const displayBoards = activeTags.size
    ? boards.filter((b) => (b.tags ?? []).some((t) => activeTags.has(t)))
    : boards;

  function toggleTagFilter(t: string) {
    setActiveTags((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  const favStar = (b: Board, extra?: string) => (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      data-testid={`fav-${b.id}`}
      aria-pressed={favs.has(String(b.id))}
      onClick={(e) => {
        e.stopPropagation();
        void toggleFav(b.id);
      }}
      className={cn(
        "h-8 w-8 text-lg leading-none",
        favs.has(String(b.id)) ? "text-amber-500" : "text-muted-foreground/50 hover:text-amber-500",
        extra
      )}
      title={favs.has(String(b.id)) ? "取消收藏" : "收藏"}
    >
      {favs.has(String(b.id)) ? "★" : "☆"}
    </Button>
  );

  const dupButton = (b: Board, extra?: string) => (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      data-testid={`dup-${b.id}`}
      onClick={(e) => {
        e.stopPropagation();
        void duplicate(b.id);
      }}
      className={extra}
      title="复制白板"
    >
      复制
    </Button>
  );

  // 卡片"更多操作"下拉菜单（grid / list 共用）
  const moreMenu = (b: Board, extra?: string) => (
    <div className={extra} onClick={(e) => e.stopPropagation()}>
      <DropdownMenu
        testId={`board-card-menu-panel-${b.id}`}
        trigger={({ onClick }) => (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            data-testid={`board-card-menu-${b.id}`}
            title="更多操作"
            className="h-7 w-7 bg-card/90 shadow-sm backdrop-blur-sm"
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        )}
      >
        <DropdownMenuItem
          testId={`board-menu-rename-${b.id}`}
          icon={<Pencil className="h-4 w-4" />}
          onSelect={() => openRename(b)}
        >
          重命名
        </DropdownMenuItem>
        <DropdownMenuItem
          testId={`board-menu-tags-${b.id}`}
          icon={<Tag className="h-4 w-4" />}
          onSelect={() => setTagsTarget(b)}
        >
          编辑标签
        </DropdownMenuItem>
        {b.cover ? (
          <DropdownMenuItem
            testId={`board-menu-cover-${b.id}`}
            icon={<ImageOff className="h-4 w-4" />}
            onSelect={() => void removeCover(b)}
          >
            移除封面
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            testId={`board-menu-upload-cover-${b.id}`}
            icon={<ImagePlus className="h-4 w-4" />}
            onSelect={() => triggerCoverUpload(b.id)}
          >
            上传封面
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          testId={`board-menu-duplicate-${b.id}`}
          icon={<Copy className="h-4 w-4" />}
          onSelect={() => void duplicate(b.id)}
        >
          复制
        </DropdownMenuItem>
        <DropdownMenuItem
          testId={`board-menu-move-${b.id}`}
          icon={<Move className="h-4 w-4" />}
          onSelect={() => void openMove(b)}
        >
          移动到房间
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          testId={`board-menu-delete-${b.id}`}
          icon={<Trash2 className="h-4 w-4" />}
          destructive
          onSelect={() => setDeleteTarget(b)}
        >
          删除
        </DropdownMenuItem>
      </DropdownMenu>
    </div>
  );

  const tagChips = (b: Board, extra?: string) => {
    const ts = (b.tags ?? []).slice(0, 3);
    if (!ts.length) return null;
    return (
      <div className={cn("flex flex-wrap gap-1", extra)}>
        {ts.map((t) => (
          <span
            key={t}
            data-testid={`board-card-tag-${b.id}-${t}`}
            className="rounded-full bg-muted px-2 py-0.5 text-10 text-muted-foreground"
          >
            {t}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      {/* 上传封面：隐藏 file input，独立于下拉菜单（菜单项 onSelect 里 ref.click() 触发） */}
      <Input
        ref={coverInputRef}
        type="file"
        accept="image/*"
        aria-label="上传封面图片"
        className="hidden"
        data-testid="board-cover-file-input"
        onChange={onCoverFileChange}
      />
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">房间白板</h1>
        <div className="flex items-center gap-2">
          {/* 视图切换（prototype：▦/☰，active 反色） */}
          <div className="flex gap-0.5 rounded-lg border border-border p-0.5" role="group" aria-label="视图切换">
            <Button
              type="button"
              data-testid="boards-view-grid"
              variant="ghost"
              size="icon"
              aria-pressed={view === "grid"}
              onClick={() => switchView("grid")}
              className={cn(
                "h-7 w-8 rounded-md",
                view === "grid" && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
              )}
              title="卡片视图"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              data-testid="boards-view-list"
              variant="ghost"
              size="icon"
              aria-pressed={view === "list"}
              onClick={() => switchView("list")}
              className={cn(
                "h-7 w-8 rounded-md",
                view === "list" && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
              )}
              title="列表视图"
            >
              <List className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Button
            data-testid="show-create-board"
            size="sm"
            onClick={() => setShowForm(true)}
            className="transition-all duration-200 active:scale-[0.98]"
          >
            新建白板
          </Button>
        </div>
      </div>

      {error && (
        <p role="alert" data-testid="err" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {/* issue #469（用户反馈）：创建白板从页面内联表单改为居中 Dialog 弹窗。 */}
      <Dialog
        open={showForm}
        onClose={() => setShowForm(false)}
        title="新建白板"
        testId="board-create-modal"
        closeTestId="board-create-close"
      >
        <form onSubmit={create} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="board-name">白板名称</Label>
            <Input
              id="board-name"
              data-testid="board-name"
              placeholder="未命名白板"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>标签</Label>
            <TagInput
              value={createTags}
              onChange={setCreateTags}
              inputTestId="board-create-tag-input"
              chipTestIdPrefix="board-create-tag"
            />
          </div>
          {createError && (
            <p role="alert" data-testid="err-create" className="text-sm text-destructive">
              {createError}
            </p>
          )}
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              data-testid="board-create-cancel"
              onClick={() => setShowForm(false)}
            >
              取消
            </Button>
            <Button data-testid="create-board" type="submit" size="sm">
              创建
            </Button>
          </div>
        </form>
      </Dialog>

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

      {/* 多标签过滤条（客户端过滤） */}
      {allTags.length > 0 && (
        <div data-testid="board-tag-filter" className="flex flex-wrap items-center gap-1.5">
          {allTags.map((t) => {
            const on = activeTags.has(t);
            return (
              <Button
                key={t}
                type="button"
                variant="ghost"
                size="sm"
                data-testid={`board-tag-filter-${t}`}
                aria-pressed={on}
                onClick={() => toggleTagFilter(t)}
                className={cn(
                  "h-7 rounded-full px-3 text-xs font-medium",
                  on
                    ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                    : "border border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {t}
              </Button>
            );
          })}
          {activeTags.size > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              data-testid="board-filter-clear"
              onClick={() => setActiveTags(new Set())}
              className="h-7 px-2 text-xs"
            >
              清除
            </Button>
          )}
        </div>
      )}

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
      ) : view === "grid" ? (
        /* 卡片视图（prototype room boards grid + oldcode BoardGrid 的 hover 动效/悬浮操作） */
        <div data-testid="board-list" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <Button
            type="button"
            variant="ghost"
            data-testid="new-board-card"
            onClick={() => setShowForm(true)}
            className={cn(
              "flex h-auto min-h-36 flex-col items-center justify-center gap-1.5 whitespace-normal rounded-xl",
              "border border-dashed border-border text-muted-foreground",
              "hover:border-primary hover:bg-transparent hover:text-foreground"
            )}
          >
            <Plus className="h-6 w-6" strokeWidth={1.5} />
            <span className="text-xs font-medium">新建白板</span>
          </Button>

          {displayBoards.map((b) => (
            <div
              key={String(b.id)}
              data-testid={`board-${b.id}`}
              role="link"
              tabIndex={0}
              onClick={() => router.push(`/boards/${b.id}`)}
              onKeyDown={(e) => e.key === "Enter" && router.push(`/boards/${b.id}`)}
              className={cn(
                "group relative cursor-pointer rounded-xl border bg-card text-card-foreground",
                "shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-border/70 hover:shadow-md",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
            >
              {/* 缩略图：有封面显示真实封面图，否则回退色块（自身裁圆角，卡片根不再 overflow-hidden 以免裁掉菜单浮层） */}
              {b.cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt=""
                  src={`/api/boards/${b.id}/cover?v=${encodeURIComponent(b.updated_at ?? "")}`}
                  className="h-24 w-full rounded-t-xl object-cover"
                  data-testid={`board-cover-img-${b.id}`}
                />
              ) : (
                <div className={cn("flex h-24 items-center justify-center rounded-t-xl", thumbTone(b.id))}>
                  <Presentation className="h-6 w-6 text-muted-foreground/50" />
                </div>
              )}
              {/* 悬浮操作：更多操作菜单（group-hover 显现） */}
              {moreMenu(
                b,
                "absolute right-2 top-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
              )}
              {/* 收藏（常显，e2e 直接可点） */}
              <div className="absolute left-1.5 top-1.5">{favStar(b, "h-7 w-7 bg-card/70 backdrop-blur-sm")}</div>

              <div className="flex flex-col gap-1 p-3">
                <a
                  href={`/boards/${b.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="truncate text-sm font-semibold text-foreground"
                >
                  {b.name}
                </a>
                {tagChips(b)}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-11 text-muted-foreground">{formatUpdated(b.updated_at)}</span>
                  <Badge variant="muted">{b.visibility}</Badge>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* 列表视图（prototype room boards list：圆角容器 + 分隔行 + ›） */
        <div data-testid="board-list" className="divide-y divide-border overflow-hidden rounded-xl border">
          <Button
            type="button"
            variant="ghost"
            data-testid="new-board-row"
            onClick={() => setShowForm(true)}
            className={cn(
              "flex h-auto w-full items-center justify-start gap-3 rounded-none px-4 py-3 text-muted-foreground",
              "hover:bg-muted/50 hover:text-foreground"
            )}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-md border border-dashed border-border">
              <Plus className="h-3.5 w-3.5" />
            </span>
            <span className="text-sm font-medium">新建白板</span>
          </Button>

          {displayBoards.map((b) => (
            <div
              key={String(b.id)}
              data-testid={`board-${b.id}`}
              role="link"
              tabIndex={0}
              onClick={() => router.push(`/boards/${b.id}`)}
              onKeyDown={(e) => e.key === "Enter" && router.push(`/boards/${b.id}`)}
              className={cn(
                "flex cursor-pointer items-center gap-3 bg-card px-4 py-3 transition-colors duration-200 hover:bg-muted/50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
            >
              {favStar(b)}
              {b.cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt=""
                  src={`/api/boards/${b.id}/cover?v=${encodeURIComponent(b.updated_at ?? "")}`}
                  className="h-7 w-9 flex-none rounded-md object-cover"
                  data-testid={`board-cover-img-${b.id}`}
                />
              ) : (
                <span className={cn("flex h-7 w-9 flex-none items-center justify-center rounded-md", thumbTone(b.id))}>
                  <Presentation className="h-3.5 w-3.5 text-muted-foreground/60" />
                </span>
              )}
              <a
                href={`/boards/${b.id}`}
                onClick={(e) => e.stopPropagation()}
                className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground"
              >
                {b.name}
              </a>
              {tagChips(b)}
              <span className="text-xs text-muted-foreground">{formatUpdated(b.updated_at)}</span>
              <Badge variant="muted">{b.visibility}</Badge>
              {moreMenu(b)}
              <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
            </div>
          ))}
        </div>
      )}

      {/* 重命名 Dialog */}
      <Dialog
        open={renameTarget !== null}
        onClose={() => setRenameTarget(null)}
        title="重命名白板"
        testId="board-rename-dialog"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setRenameTarget(null)}>
              取消
            </Button>
            <Button size="sm" data-testid="board-rename-save" onClick={() => void submitRename()}>
              保存
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="board-rename-input">白板名称</Label>
          <Input
            id="board-rename-input"
            data-testid="board-rename-input"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
          />
        </div>
      </Dialog>

      {/* 编辑标签 Dialog */}
      <EditTagsDialog
        open={tagsTarget !== null}
        boardName={tagsTarget?.name ?? ""}
        initialTags={tagsTarget?.tags ?? []}
        onClose={() => setTagsTarget(null)}
        onSave={(tags) => void saveTags(tags)}
      />

      {/* 移动到房间 Dialog */}
      <Dialog
        open={moveTarget !== null}
        onClose={() => setMoveTarget(null)}
        title="移动到房间"
        description={moveTarget?.name}
        testId="board-move-dialog"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setMoveTarget(null)}>
              取消
            </Button>
            <Button
              size="sm"
              data-testid="board-move-confirm"
              disabled={!moveRoomId}
              onClick={() => void submitMove()}
            >
              移动
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="board-move-select">目标房间</Label>
          <Select
            id="board-move-select"
            data-testid="board-move-select"
            value={moveRoomId}
            onChange={(e) => setMoveRoomId(e.target.value)}
          >
            <option value="">选择房间…</option>
            {moveRooms.map((r) => (
              <option key={String(r.id)} value={String(r.id)}>
                {r.name}
              </option>
            ))}
          </Select>
        </div>
      </Dialog>

      {/* 删除确认 Dialog */}
      <Dialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="删除白板"
        description={deleteTarget ? `将删除「${deleteTarget.name}」，此操作不可撤销。` : undefined}
        testId="board-delete-dialog"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setDeleteTarget(null)}>
              取消
            </Button>
            <Button variant="destructive" size="sm" data-testid="board-delete-confirm" onClick={() => void submitDelete()}>
              删除
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">删除后无法恢复，确认继续？</p>
      </Dialog>
    </div>
  );
}
