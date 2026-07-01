"use client";
import { useEffect, useRef, useState } from "react";
import { BoardSyncStatus } from "@/components/board/sync-status";

// uc-canvas-005 实时协作 · 在线成员 + 同步状态。
// - 每 ~1.5s 向 /api/boards/:id/presence 心跳一次，并拉回当前在线成员名单。
// - 在线成员数量/头像变化 = UC 主流程 2/6（B 进入→A 看到数量变化；离开→移除）。
// - 同步状态由真实心跳/拉取周期驱动：拉取进行中显示「保存中」，完成回「已同步」。
//   （受控喂给 BoardSyncStatus，反映内容是否已被其他协作者看见 —— 业务规则 3。）

interface Member {
  id: number;
  name: string;
  role: string;
}

const POLL_MS = 1500;

function initials(name: string): string {
  const t = name.trim();
  if (!t) return "?";
  return t.slice(0, 2).toUpperCase();
}

export function BoardPresence({ boardId }: { boardId: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [syncing, setSyncing] = useState(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      setSyncing(true);
      try {
        const res = await fetch(`/api/boards/${boardId}/presence`, { method: "POST" });
        if (res.ok) {
          const d = (await res.json()) as { members?: Member[] };
          if (alive.current) setMembers(d.members ?? []);
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
    };
  }, [boardId]);

  return (
    <div
      data-testid="board-presence"
      data-online-count={members.length}
      className="flex items-center gap-2"
    >
      <span className="sr-only" data-testid="presence-count">
        {members.length}
      </span>
      {/* 在线成员头像组（UC 前端入口 1：在线成员头像） */}
      <div className="flex -space-x-2" aria-label={`在线成员 ${members.length} 人`}>
        {members.slice(0, 5).map((m) => (
          <span
            key={m.id}
            data-testid="presence-avatar"
            data-member-id={m.id}
            title={`${m.name}（${m.role}）`}
            className="grid size-6 place-items-center rounded-full border border-border bg-primary/10 text-[10px] font-semibold text-primary ring-1 ring-card"
          >
            {initials(m.name)}
          </span>
        ))}
      </div>
      {/* 同步状态：真实心跳/拉取周期驱动 */}
      <BoardSyncStatus controlledState={syncing ? "saving" : "synced"} />
    </div>
  );
}
