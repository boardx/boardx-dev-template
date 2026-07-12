"use client";
// p20/F01 房间详情壳：面包屑 + 房间名 + 可见性 pill + 成员头像 + Invite + 五 tab 常驻导航（uc-rr-001）
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface RoomInfo {
  id: number | string;
  public_id: string;
  name: string;
  visibility: "private" | "team";
  description?: string | null;
}

interface MemberRow {
  user_id: number | string;
  email: string;
  role: "owner" | "admin" | "member";
}

// p22/F04：Studio 恢复为顶级 tab（对齐原型 roomTabDefs 与人类截图确认的六 tab 结构），
// 不再只依附在某条聊天线程内部才可见。
const TABS = [
  { key: "boards", label: "Boards", segment: "boards" },
  { key: "members", label: "Members", segment: "members" },
  { key: "files", label: "Files", segment: "files" },
  { key: "chat", label: "Chat", segment: "chats" },
  { key: "survey", label: "Survey", segment: "surveys" },
  { key: "studio", label: "Studio", segment: "studio" },
] as const;

function initials(email: string): string {
  return email.slice(0, 2).toUpperCase();
}

export default function RoomShellLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const roomId = params.id;

  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<number | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch(`/api/rooms/${roomId}`);
      if (cancelled) return;
      if (!res.ok) {
        setErrorCode(res.status);
        return;
      }
      const d = await res.json();
      // issue #584：旧数字 URL 落地后规范化到 public_id 形式，路径里除房间 id 段外的
      // 其余部分（当前 tab，如 /members、/boards）原样保留。这个 layout 包住全部房间子
      // 页面，收口在这一处，下游各 tab 内部拼的 `/rooms/${roomId}/...` 链接（都是拿这同一个
      // useParams() 的 roomId 回填）落地后自然跟着变成 public_id 形式，不用逐个改。
      if (d.room?.public_id && d.room.public_id !== roomId) {
        router.replace(pathname.replace(`/rooms/${roomId}`, `/rooms/${d.room.public_id}`));
      }
      setRoom(d.room);
      setIsFavorite(Boolean(d.isFavorite));
      const mres = await fetch(`/api/rooms/${roomId}/members`);
      if (cancelled || !mres.ok) return;
      const md = await mres.json();
      setMembers(md.members ?? []);
      setMyRole(md.myRole ?? null);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  // uc-rr-004：页头星标，乐观切换 + 失败回滚
  async function toggleFavorite() {
    const prev = isFavorite;
    setIsFavorite(!prev);
    try {
      const res = await fetch(`/api/rooms/${roomId}/favorite`, { method: prev ? "DELETE" : "POST" });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      setIsFavorite(prev);
    }
  }

  // 当前 tab：/rooms/[id]/<segment>/... 的第一段
  const activeSegment = pathname.split(`/rooms/${roomId}`)[1]?.split("/")[1] ?? "boards";

  // p22 Studio 全屏：Studio 路由脱离房间壳（不渲染面包屑/房间头部/六 tab），
  // Studio 页自己占满内容区（三栏工作区 + 顶部返回房间）。非成员/加载态仍走下方 errorCode。
  const isStudioFullscreen = activeSegment === "studio";
  if (isStudioFullscreen && !errorCode) {
    return <div data-testid="room-studio-fullscreen" className="h-full min-h-0">{children}</div>;
  }

  if (errorCode) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 p-12 text-center">
        <p role="alert" data-testid="room-shell-error" className="text-sm text-destructive">
          {errorCode === 403
            ? "你不是该房间成员，无法访问"
            : errorCode === 401
              ? "请先登录"
              : errorCode === 404
                ? "房间不存在"
                : "加载失败"}
        </p>
        <Link
          data-testid="room-back-to-list"
          href="/rooms"
          className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
        >
          返回房间列表
        </Link>
      </div>
    );
  }

  const canManage = myRole === "owner" || myRole === "admin";
  const shownMembers = members.slice(0, 4);
  const extra = members.length - shownMembers.length;

  return (
    <div data-testid="room-shell" className="flex min-h-0 flex-1 flex-col">
      <header className="border-b bg-card px-6 pt-4">
        <nav data-testid="room-breadcrumb" className="text-xs text-muted-foreground">
          <Link href="/rooms" className="hover:text-foreground">
            Rooms
          </Link>
          <span className="mx-1">/</span>
          <span>{room?.name ?? "…"}</span>
        </nav>
        <div className="mt-1 flex items-center justify-between gap-4 pb-3">
          <div className="flex items-center gap-3">
            {room && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                data-testid="room-favorite-toggle"
                aria-pressed={isFavorite}
                onClick={() => void toggleFavorite()}
                title={isFavorite ? "取消收藏" : "收藏"}
                className="h-7 w-7 text-lg leading-none text-amber-500"
              >
                {isFavorite ? "★" : "☆"}
              </Button>
            )}
            <h1 data-testid="room-header-name" className="text-xl font-bold tracking-tight text-foreground">
              {room?.name ?? ""}
            </h1>
            {room && (
              <Badge data-testid="room-visibility-pill" variant="muted">
                {room.visibility === "team" ? "🌐 Team" : "🔒 Private"}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div data-testid="room-members-avatars" className="flex -space-x-2">
              {shownMembers.map((m) => (
                <span
                  key={String(m.user_id)}
                  title={m.email}
                  className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-muted text-10 font-semibold text-muted-foreground"
                >
                  {initials(m.email)}
                </span>
              ))}
              {extra > 0 && (
                <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-secondary text-10 font-semibold text-secondary-foreground">
                  +{extra}
                </span>
              )}
            </div>
            {canManage && (
              <Link
                data-testid="room-invite-btn"
                href={`/rooms/${roomId}/members`}
                className={cn(buttonVariants({ size: "sm" }))}
              >
                Invite
              </Link>
            )}
          </div>
        </div>
        {/* uc-rr-010（p20/F11）：房间详情页头展示 description，无则不渲染该行 */}
        {room?.description && (
          <p data-testid="room-header-description" className="mb-3 max-w-2xl truncate text-13 text-muted-foreground">
            {room.description}
          </p>
        )}
        <div className="flex gap-1 rounded-t-xl" role="tablist">
          {TABS.map((t) => {
            const active = activeSegment === t.segment;
            return (
              <Link
                key={t.key}
                href={`/rooms/${roomId}/${t.segment}`}
                data-testid={`room-tab-${t.key}`}
                data-active={active ? "true" : "false"}
                role="tab"
                aria-selected={active}
                className={cn(
                  "rounded-t-lg px-4 py-2 text-sm font-medium transition-colors",
                  active
                    ? "border-b-2 border-primary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
