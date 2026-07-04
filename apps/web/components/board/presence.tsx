"use client";
import { useEffect, useRef, useState } from "react";
import { BoardSyncStatus } from "@/components/board/sync-status";
import {
  boardPointToScreen,
  publishFollow,
  readLocalCursor,
  readLocalOperating,
  readLocalViewport,
  subscribeConnectionState,
  subscribeFollowPause,
  viewportContainerRect,
  type CollabConnectionState,
  type ViewportSnapshot,
} from "@/lib/collab-bus";
import { MousePointer2 } from "lucide-react";

// uc-canvas-005 实时协作 · 在线成员 + 同步状态。
// - 每 ~1.5s 向 /api/boards/:id/presence 心跳一次，并拉回当前在线成员名单。
// - 在线成员数量/头像变化 = UC 主流程 2/6（B 进入→A 看到数量变化；离开→移除）。
// - 同步状态由真实心跳/拉取周期驱动：拉取进行中显示「保存中」，完成回「已同步」。
//   （受控喂给 BoardSyncStatus，反映内容是否已被其他协作者看见 —— 业务规则 3。）
//
// uc-collab-001 协作感知 + 视角跟随（AWARENESS + FOLLOW 层）：
// - 心跳 body 附带本地 operating（是否正在操作）+ viewport（当前视口），由 collab-bus 提供。
// - 渲染每位「其他成员」的操作态指示（谁在操作）与「跟随」按钮。
// - 点击跟随某成员后，每次拉取都把该成员最新视口推给 CanvasViewport（publishFollow），
//   本地画布视角随之跟随；顶部显示「正在跟随 X」横幅，可一键停止跟随。

interface Member {
  id: number;
  name: string;
  role: string;
  operating?: boolean;
  viewport?: { x: number; y: number; scale: number };
  cursor?: { x: number; y: number; visible: boolean };
  followingId?: number | null;
  followPaused?: boolean;
}

const POLL_MS = 1500;
const DIRECT_AVATARS = 4;

function initials(name: string): string {
  const t = name.trim();
  if (!t) return "?";
  return t.slice(0, 2).toUpperCase();
}

// 把 presence viewport（x/y/scale）映射为 collab-bus 的 viewport 快照（tx/ty/scale）。
function toSnapshot(v: { x: number; y: number; scale: number }): ViewportSnapshot {
  return { tx: v.x, ty: v.y, scale: v.scale };
}

function normalizeMember(m: Member): Member {
  return {
    ...m,
    id: Number(m.id),
    followingId: m.followingId == null ? m.followingId : Number(m.followingId),
  };
}

export function BoardPresence({ boardId }: { boardId: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [connectionState, setConnectionState] = useState<CollabConnectionState>("connecting");
  const [selfId, setSelfId] = useState<number | null>(null);
  const [followId, setFollowId] = useState<number | null>(null); // 正在跟随的成员 id（null = 未跟随）
  const [followPaused, setFollowPaused] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const alive = useRef(true);
  const followRef = useRef<number | null>(null); // 供 tick 内读取最新跟随目标
  const followPausedRef = useRef(false);
  followRef.current = followId;
  followPausedRef.current = followPaused;

  useEffect(() => {
    alive.current = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      setSyncing(true);
      try {
        // 心跳携带本地协作感知：operating + viewport（供他人看到「谁在操作」/可跟随本地视角）。
        const vp = readLocalViewport();
        const res = await fetch(`/api/boards/${boardId}/presence`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            operating: readLocalOperating(),
            viewport: { x: vp.tx, y: vp.ty, scale: vp.scale },
            cursor: readLocalCursor(),
            followingId: followRef.current,
            followPaused: followPausedRef.current,
          }),
        });
        if (res.ok) {
          const d = (await res.json()) as { members?: Member[]; self?: { id: number } };
          if (alive.current) {
            const list = (d.members ?? []).map(normalizeMember);
            setMembers(list);
            if (d.self) setSelfId(Number(d.self.id));
            // 若正在跟随某成员，把其最新视口推给本地画布（跟随视角实时贴合）。
            const fid = followRef.current;
            if (fid != null) {
              const target = list.find((m) => m.id === fid);
              if (target?.viewport && !followPausedRef.current) {
                publishFollow({ viewport: toSnapshot(target.viewport) });
              } else if (!target || !target.viewport) {
                // 被跟随者离线 → 自动停止跟随。
                followRef.current = null;
                setFollowId(null);
                followPausedRef.current = false;
                setFollowPaused(false);
                publishFollow(null);
              }
            }
          }
        }
      } catch {
        // 网络异常：保留上次名单（UC 异常流程 2：保留本地可恢复信息）
      } finally {
        if (alive.current) setSyncing(false);
        if (alive.current) timer = setTimeout(tick, POLL_MS);
      }
    }
    void tick();

    return () => {
      alive.current = false;
      if (timer) clearTimeout(timer);
      publishFollow(null); // 卸载时解除跟随
    };
  }, [boardId]);

  // uc-collab-001 跟随控制：本地平移/缩放时自动暂停跟随（不能一边跟随一边被
  // 自己的操作打断视角），需要用户显式点「恢复」才继续贴合被跟随者的视口。
  useEffect(() => {
    return subscribeFollowPause(() => {
      if (followRef.current == null) return;
      followPausedRef.current = true;
      setFollowPaused(true);
      publishFollow(null);
    });
  }, []);

  // p8:F05 — 实时通道连接状态（BoardCanvas 的 WS 生命周期驱动），映射进 Header
  // 的同步指示：connecting/syncing 中 → 保存中，disconnected → 连接异常。
  useEffect(() => subscribeConnectionState(setConnectionState), []);

  function startFollow(m: Member) {
    setFollowId(m.id);
    setFollowPaused(false);
    followRef.current = m.id;
    followPausedRef.current = false;
    if (m.viewport) publishFollow({ viewport: toSnapshot(m.viewport) });
  }
  function pauseFollow() {
    setFollowPaused(true);
    followPausedRef.current = true;
    publishFollow(null);
  }
  function resumeFollow() {
    const target = members.find((m) => m.id === followRef.current);
    setFollowPaused(false);
    followPausedRef.current = false;
    if (target?.viewport) publishFollow({ viewport: toSnapshot(target.viewport) });
  }
  function stopFollow() {
    setFollowId(null);
    setFollowPaused(false);
    followRef.current = null;
    followPausedRef.current = false;
    publishFollow(null);
  }

  const followed = members.find((m) => m.id === followId) ?? null;
  const orderedMembers =
    selfId == null
      ? members
      : [...members].sort((a, b) => {
          if (a.id === selfId) return -1;
          if (b.id === selfId) return 1;
          return a.id - b.id;
        });
  const visibleMembers = orderedMembers.slice(0, DIRECT_AVATARS);
  const overflowMembers = orderedMembers.slice(DIRECT_AVATARS);
  const remoteCursors = orderedMembers.filter((m) => m.id !== selfId && m.cursor?.visible);
  const followers = selfId == null ? [] : orderedMembers.filter((m) => m.id !== selfId && m.followingId === selfId);
  const syncState =
    connectionState === "disconnected" ? "offline" : connectionState === "connecting" || syncing ? "saving" : "synced";

  return (
    <div
      data-testid="board-presence"
      data-online-count={members.length}
      data-following-id={followId ?? ""}
      className="relative flex items-center gap-2"
    >
      <span className="sr-only" data-testid="presence-count">
        {members.length}
      </span>
      {/* 在线成员头像组（UC 前端入口 1：在线成员头像）+ uc-collab-001 操作态 + 跟随入口 */}
      <div className="flex items-center gap-1" aria-label={`在线成员 ${members.length} 人`}>
        {visibleMembers.map((m) => {
          const isSelf = selfId != null && m.id === selfId;
          return (
            <span
              key={m.id}
              data-testid="presence-member"
              data-member-id={m.id}
              data-operating={m.operating ? "true" : "false"}
              data-self={isSelf ? "true" : "false"}
              className="relative flex items-center"
            >
              <span
                data-testid="presence-avatar"
                data-member-id={m.id}
                title={`${m.name}（${m.role}）${m.operating ? " · 操作中" : ""}`}
                className={
                  "grid size-6 place-items-center rounded-full border text-10 font-semibold ring-1 ring-card " +
                  (m.operating
                    ? "border-primary bg-primary/20 text-primary"
                    : "border-border bg-primary/10 text-primary")
                }
              >
                {initials(m.name)}
              </span>
              {/* 「谁在操作」指示：该成员正在拖拽/编辑时出现（脉冲小点）。 */}
              {m.operating && (
                <span
                  data-testid={`collab-active-${m.id}`}
                  aria-label={`${m.name} 正在操作`}
                  title={`${m.name} 正在操作`}
                  className="absolute -right-0.5 -top-0.5 size-2 animate-pulse rounded-full bg-emerald-500 ring-1 ring-card"
                />
              )}
              {/* 跟随入口：仅对「其他成员」显示（不能跟随自己）。 */}
              {!isSelf && followId !== m.id && (
                <button
                  type="button"
                  data-testid={`follow-${m.id}`}
                  aria-label={`跟随 ${m.name} 的视角`}
                  title={`跟随 ${m.name}`}
                  onClick={() => startFollow(m)}
                  className="ml-0.5 rounded px-1 text-10 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  跟随
                </button>
              )}
            </span>
          );
        })}
        {overflowMembers.length > 0 && (
          <button
            type="button"
            data-testid="presence-overflow"
            aria-expanded={overflowOpen}
            aria-label={`显示另外 ${overflowMembers.length} 名在线成员`}
            onClick={() => setOverflowOpen((prev) => !prev)}
            className="grid h-6 min-w-6 place-items-center rounded-full border border-border bg-muted px-1.5 text-10 font-semibold text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
          >
            +{overflowMembers.length}
          </button>
        )}
      </div>

      {overflowOpen && overflowMembers.length > 0 && (
        <div
          data-testid="presence-list"
          className="absolute right-12 top-12 z-40 min-w-48 rounded-md border bg-popover p-2 text-popover-foreground shadow-lg"
        >
          {overflowMembers.map((m) => (
            <div
              key={m.id}
              data-testid="presence-list-member"
              data-member-id={m.id}
              className="flex items-center justify-between gap-2 rounded px-2 py-1 text-12"
            >
              <span className="truncate">{m.name}</span>
              <span className="text-10 uppercase text-muted-foreground">{m.role}</span>
            </div>
          ))}
        </div>
      )}

      {remoteCursors.map((m) => {
        // m.cursor 里存的是画布逻辑坐标（发送方广播前已转换，见 board-canvas.tsx
        // 的 screenToBoardPoint）；这里用「我自己」当前的 pan/zoom 转回屏幕坐标再用
        // position:fixed 渲染——否则双方窗口尺寸或缩放不同时位置会对不上（p8:F03）。
        const screen = boardPointToScreen(m.cursor!.x, m.cursor!.y, viewportContainerRect());
        return (
          <div
            key={m.id}
            data-testid={`collab-cursor-${m.id}`}
            data-member-id={m.id}
            style={{ left: screen.x, top: screen.y }}
            className="pointer-events-none fixed z-50 translate-x-1 translate-y-1"
          >
            <MousePointer2 className="h-4 w-4 fill-primary text-primary drop-shadow" />
            <div
              data-testid={`collab-cursor-label-${m.id}`}
              className="mt-0.5 max-w-36 truncate rounded bg-primary px-1.5 py-0.5 text-10 font-medium text-primary-foreground shadow"
            >
              {m.name}
            </div>
          </div>
        );
      })}

      {followers.length > 0 && (
        <div
          data-testid="followed-by-banner"
          data-follower-count={followers.length}
          className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-11 font-medium text-emerald-700"
        >
          {followers.map((m) => m.name).join("、")} 正在跟随你
        </div>
      )}

      {/* 正在跟随横幅：让用户明确知道「自己的视角正在跟随他人」（UC 后置条件 1）。 */}
      {followed && (
        <div
          data-testid="following-banner"
          data-following-id={followed.id}
          data-follow-state={followPaused ? "paused" : "active"}
          className="flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-11 font-medium text-primary"
        >
          <span>
            {followPaused ? "已暂停跟随" : "正在跟随"} {followed.name}
          </span>
          {followPaused ? (
            <button
              type="button"
              data-testid="resume-following"
              aria-label="恢复跟随"
              onClick={resumeFollow}
              className="rounded px-1 text-primary/80 transition-colors hover:bg-primary/20 hover:text-primary"
            >
              恢复
            </button>
          ) : (
            <button
              type="button"
              data-testid="pause-following"
              aria-label="暂停跟随"
              onClick={pauseFollow}
              className="rounded px-1 text-primary/80 transition-colors hover:bg-primary/20 hover:text-primary"
            >
              暂停
            </button>
          )}
          <button
            type="button"
            data-testid="stop-following"
            aria-label="停止跟随"
            onClick={stopFollow}
            className="rounded px-1 text-primary/80 transition-colors hover:bg-primary/20 hover:text-primary"
          >
            退出
          </button>
        </div>
      )}

      {/* 同步状态：真实心跳/拉取周期驱动 */}
      <BoardSyncStatus controlledState={syncState} />
    </div>
  );
}
