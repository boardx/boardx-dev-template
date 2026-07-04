// apps/web/lib/presence.ts — uc-canvas-005 实时协作在线成员表（进程内内存）。
// presence 是短暂状态：谁此刻打开着这块 Board。用内存 Map 而非 DB，避免 migration；
// 单 dev/prod server 场景足够。心跳过期后自动从在线名单剔除（对应 UC 主流程 6：离开→移除）。

// uc-collab-001 协作感知：视口快照（跟随用）。
export interface PresenceViewport {
  x: number;
  y: number;
  scale: number;
}

// p8:F03 协作光标：坐标使用浏览器 viewport clientX/clientY，
// Header presence 渲染为 fixed overlay，可跨画布/视口同步显示。
export interface PresenceCursor {
  x: number;
  y: number;
  visible: boolean;
}

export interface PresenceMember {
  id: number;
  name: string;
  role: string;
  // uc-collab-001 协作感知（可选、附加字段，向后兼容旧心跳）：
  // operating = 该成员此刻是否正在操作（拖拽/编辑）；viewport = 其当前视口（供他人「跟随视角」）。
  operating?: boolean;
  viewport?: PresenceViewport;
  cursor?: PresenceCursor;
  followingId?: number | null;
  followPaused?: boolean;
}

interface Entry extends PresenceMember {
  lastSeen: number;
}

// 心跳存活窗口：客户端每 ~1.5s 心跳一次，5s 内没心跳即视为离开。
const TTL_MS = 5_000;

// 用 globalThis 兜住 dev 模式下模块热重载导致的多实例，保证 presence 表跨请求单例。
const g = globalThis as unknown as { __boardPresence__?: Map<number, Map<number, Entry>> };
const boards: Map<number, Map<number, Entry>> = (g.__boardPresence__ ??= new Map());

function pruned(boardId: number): Map<number, Entry> {
  const now = Date.now();
  const table = boards.get(boardId) ?? new Map<number, Entry>();
  for (const [uid, e] of table) {
    if (now - e.lastSeen > TTL_MS) table.delete(uid);
  }
  if (table.size === 0) boards.delete(boardId);
  else boards.set(boardId, table);
  return table;
}

/** 登记/刷新一名在线成员的心跳。 */
export function heartbeat(boardId: number, member: PresenceMember): void {
  const table = pruned(boardId);
  table.set(member.id, { ...member, lastSeen: Date.now() });
  boards.set(boardId, table);
}

/** 当前在线成员（已剔除过期心跳），按加入顺序稳定排序。 */
export function listOnline(boardId: number): PresenceMember[] {
  const table = pruned(boardId);
  return [...table.values()]
    .sort((a, b) => a.id - b.id)
    .map(({ id, name, role, operating, viewport, cursor, followingId, followPaused }) => ({
      id,
      name,
      role,
      operating,
      viewport,
      cursor,
      followingId,
      followPaused,
    }));
}

/** 测试辅助：清空某 Board 的在线表。 */
export function clearPresence(boardId: number): void {
  boards.delete(boardId);
}
