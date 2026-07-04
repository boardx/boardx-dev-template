"use client";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CanvasViewport } from "@/components/board/canvas-viewport";
import { BoardBottomDock, type DockToolKey } from "@/components/board/board-bottom-dock";
import { BoardAiOverlay } from "@/components/board/board-ai-panel";
import {
  publishConnectionState,
  publishCursor,
  screenToBoardPoint,
  setOperating,
  viewportContainerRect,
} from "@/lib/collab-bus";
import {
  applyEncodedUpdate,
  createBoardDoc,
  encodeFullState,
  encodeUpdate,
  onLocalUpdate,
  onRemoteItemsChange,
  readItems as readCollabItems,
  seedItems,
  syncItemsIntoDoc,
} from "@repo/collab";
import {
  Cable,
  Hand,
  Image,
  LayoutTemplate,
  MousePointer2,
  PenLine,
  Redo2,
  RefreshCw,
  Shapes,
  StickyNote,
  Type,
  Undo2,
} from "lucide-react";

interface Item {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  type: string;
  color?: string | null;
}

// 便签外观色 token → 样式（F11）。对齐 BoardX Prototype 柔彩便签（#fff7cc/#dbe8f7/#d8efe6/#fde2dd）。
// null/未知 → 默认 amber(=tag-yellow)。色 key 为持久化数据，勿改（见 widget-sticky e2e）。
const COLORS: Record<string, string> = {
  amber: "bg-tag-yellow border-border-strong text-foreground",
  blue: "bg-tag-blue border-border-strong text-foreground",
  green: "bg-tag-green border-border-strong text-foreground",
  pink: "bg-tag-pink border-border-strong text-foreground",
};
const COLOR_TOKENS = Object.keys(COLORS);
// color 字段可为复合 "<base>:bold"（uc-widget-menu-002 字重）；base 决定色/文本判别，:bold 决定字重。
const baseColor = (c?: string | null) => (c ?? "amber").split(":")[0] || "amber";
const isBold = (it: { color?: string | null }) => (it.color ?? "").endsWith(":bold");
const colorClass = (c?: string | null) => COLORS[baseColor(c)] ?? COLORS.amber;

// 文本（Text）组件（uc-board-menu-003）。
// 约束（范围纪律）：当前 @repo/canvas 的 validateNewItem 只放行 type ∈ {note,rect}，
// 服务端校验/路由不可改。故文本组件在「线上」仍以 type:"note" 持久化，
// 用 color 哨兵值 "text" 作为判别位（color 字段经 POST/PATCH/GET 全程原样透传，
// 刷新后仍在）。客户端据此把它渲染为「透明无边框文本块」，与便签区分。
const TEXT_MARK = "text";
const DEFAULT_TEXT = "文本";
const isText = (it: { color?: string | null }) => baseColor(it.color) === TEXT_MARK;
// 形状（Shape）组件（uc-widgets-004）：服务端原生放行 type:"rect"，按 type 判别，无需 color 哨兵。
const isShape = (it: { type: string }) => it.type === "rect";

// 可刷新组件（uc-widget-menu-009 刷新组件）：模拟「内容会重新加载」的嵌入/资源类组件
// （如图片、文件、外链预览）。线上仍以 type:"note" 持久化 + color:"embed" 哨兵判别。
// 普通便签/文本/形状为「不可刷新」（内容即静态文字），Widget Menu 中刷新入口不显示，
// 仅在对象不支持时展示禁用的「刷新暂不可用」，满足 UC：类型不支持则隐藏/置灰刷新入口。
const EMBED_MARK = "embed";
const DEFAULT_EMBED = "嵌入内容";
const isReloadable = (it: { color?: string | null }) => baseColor(it.color) === EMBED_MARK;

interface Move {
  id: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

// 可逆操作（F09 撤销/重做命令栈）。add 与 delete 互为逆；move 记录 from/to。
type Op =
  | { kind: "add"; items: Item[] }
  | { kind: "delete"; items: Item[] }
  | { kind: "move"; moves: Move[] };

type BoardTool = "select" | "pan" | "sticky" | "draw" | "text" | "connector" | "shape" | "assets" | "templates";

const NUDGE = 1;
const BIG_NUDGE = 10;

// 对齐参考线（uc-canvas-007）：拖动组件时，若其边缘/中心线与其它组件的边缘/中心线
// 足够接近（画布坐标系阈值 SNAP_TOLERANCE），则吸附到该对齐位置并显示参考线。
const SNAP_TOLERANCE = 6;

interface Guide {
  orientation: "v" | "h"; // v=竖直参考线（沿 x 对齐）；h=水平参考线（沿 y 对齐）
  pos: number; // 参考线在画布坐标系中的 x（v）或 y（h）
}

// 组件在某一轴上的三条对齐锚点（前/中/后 = 左中右 或 上中下）。
function anchors(start: number, size: number): number[] {
  return [start, start + size / 2, start + size];
}

// 计算拖动结果的吸附增量 + 需显示的参考线。
// dragged: 拖动后（未吸附）的目标 item；others: 其余静止 item。
// 返回沿 x/y 的吸附增量（把 dragged 拉到对齐位置）与参考线集合。
function computeSnap(
  dragged: { x: number; y: number; w: number; h: number },
  others: { x: number; y: number; w: number; h: number }[],
): { snapDX: number; snapDY: number; guides: Guide[] } {
  const guides: Guide[] = [];
  let snapDX = 0;
  let snapDY = 0;
  let bestX = SNAP_TOLERANCE + 1;
  let bestY = SNAP_TOLERANCE + 1;

  const dragXA = anchors(dragged.x, dragged.w);
  const dragYA = anchors(dragged.y, dragged.h);

  for (const o of others) {
    const oxA = anchors(o.x, o.w);
    const oyA = anchors(o.y, o.h);
    for (const dx of dragXA) {
      for (const ox of oxA) {
        const diff = Math.abs(dx - ox);
        if (diff <= SNAP_TOLERANCE && diff < bestX) {
          bestX = diff;
          snapDX = ox - dx;
        }
      }
    }
    for (const dy of dragYA) {
      for (const oy of oyA) {
        const diff = Math.abs(dy - oy);
        if (diff <= SNAP_TOLERANCE && diff < bestY) {
          bestY = diff;
          snapDY = oy - dy;
        }
      }
    }
  }

  const snap = { snapDX: bestX <= SNAP_TOLERANCE ? snapDX : 0, snapDY: bestY <= SNAP_TOLERANCE ? snapDY : 0 };

  // 吸附确定后，收集所有与吸附后位置精确重合的对齐线用于绘制参考线。
  if (bestX <= SNAP_TOLERANCE) {
    const snappedX = anchors(dragged.x + snap.snapDX, dragged.w);
    const seen = new Set<number>();
    for (const o of others) {
      for (const ox of anchors(o.x, o.w)) {
        if (snappedX.some((a) => Math.abs(a - ox) < 0.5) && !seen.has(ox)) {
          seen.add(ox);
          guides.push({ orientation: "v", pos: ox });
        }
      }
    }
  }
  if (bestY <= SNAP_TOLERANCE) {
    const snappedY = anchors(dragged.y + snap.snapDY, dragged.h);
    const seen = new Set<number>();
    for (const o of others) {
      for (const oy of anchors(o.y, o.h)) {
        if (snappedY.some((a) => Math.abs(a - oy) < 0.5) && !seen.has(oy)) {
          seen.add(oy);
          guides.push({ orientation: "h", pos: oy });
        }
      }
    }
  }

  return { ...snap, guides };
}

function BoardMenuButton({
  testId,
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  testId: string;
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      data-testid={testId}
      size="sm"
      variant={active ? "secondary" : "ghost"}
      title={disabled ? `${label}（暂不可用）` : label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`transition-colors duration-200 ${
        active ? "bg-muted text-foreground ring-1 ring-border-strong" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
      <span className="text-xs">{label}</span>
    </Button>
  );
}

// p8:F02 — 把 Yjs doc 的最新状态合并回本地 items，但正在本地编辑/拖拽的那一条
// 保留本地版本，不被远端覆盖（避免打断用户正在做的操作；等编辑/拖拽结束后，
// 下一次远端事件或 editingId 清空时的兜底 reconcile 会把merge 的那部分带回来，
// 不会永久丢失——这是相对于纯"全量快照广播"方案的关键修复点）。
function mergeRemoteItems(
  prev: Item[],
  latest: Item[],
  editingId: string | null,
  dragIds: readonly string[],
): Item[] {
  const held = new Set(dragIds);
  if (editingId) held.add(editingId);
  const prevById = new Map(prev.map((it) => [it.id, it]));
  const merged = latest.map((it) => (held.has(it.id) ? prevById.get(it.id) ?? it : it));
  for (const it of prev) {
    if (held.has(it.id) && !merged.some((m) => m.id === it.id)) merged.push(it);
  }
  return merged;
}

// 画布：渲染 board-keyed items（ADR-0002）+ 选择/键盘（F06）+ 复制粘贴（F08）+ 撤销/重做（F09）。
// 视口（平移/缩放/小地图）复用 CanvasViewport（F05）。marquee 框选 deferred（与拖拽平移冲突，留后续）。
export function BoardCanvas({ boardId, canEdit }: { boardId: string; canEdit: boolean }) {
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null); // F11 文本编辑中的便签
  const [activeTool, setActiveTool] = useState<BoardTool>("select");
  const [aiOpen, setAiOpen] = useState(false); // F01: Board AI 浮层/board chat 面板开关，dock 与浮层共享同一真值
  const [openPanel, setOpenPanel] = useState<"assets" | "templates" | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null); // 右键上下文菜单（uc-context-menu-001）
  const [guides, setGuides] = useState<Guide[]>([]); // 拖动时的对齐参考线（uc-canvas-007）
  // uc-widget-menu-009 刷新组件：可刷新组件的重载信号（重载次数 + 最近重载时间戳），
  // 是纯客户端的「内容已重新加载」可见反馈，随每次刷新自增。
  const [reload, setReload] = useState<Record<string, { count: number; at: number }>>({});
  const [refreshing, setRefreshing] = useState<Set<string>>(new Set()); // 刷新处理中（旋转/加载态）
  const placeN = useRef(0); // 同步自增放置位，避免连点时读到尚未刷新的 items.length 造成重叠
  const clipboard = useRef<Item[]>([]); // 应用内剪贴板（F08）
  const undoStack = useRef<Op[]>([]); // F09
  const redoStack = useRef<Op[]>([]);
  // 鼠标拖拽移动便签（指针驱动；记录可逆 move 命令）。
  const dragRef = useRef<{
    startX: number;
    startY: number;
    scale: number;
    ids: string[];
    init: Record<string, { x: number; y: number; w: number; h: number }>;
    others: { x: number; y: number; w: number; h: number }[]; // 未参与拖动的组件（吸附参照）
    snapDX: number; // 最近一次 onDragMove 计算出的吸附增量（release 时应用）
    snapDY: number;
    moved: boolean;
  } | null>(null);
  const justDraggedRef = useRef(false); // 拖拽刚结束 → 抑制随后的 click 选择翻转
  const cursorIdleTimer = useRef<ReturnType<typeof setTimeout> | null>(null); // p8:F03 光标闲置自动隐藏

  // ── p8:F02 Yjs 实时同步 ──────────────────────────────────────────────────
  // docRef 是本 board 的 CRDT 状态；WS 只是把 doc 的二进制 update 转发给其它
  // 在线客户端（走 F01 的 collab-gateway，纯 relay，不解释内容）。REST 仍是
  // 冷启动/持久化的权威来源，doc 只负责"已连接客户端之间"的即时合并。
  const docRef = useRef(createBoardDoc());
  const wsRef = useRef<WebSocket | null>(null);
  const clientIdRef = useRef(crypto.randomUUID());
  const editingIdRef = useRef<string | null>(null);
  const itemsRef = useRef<Item[]>([]);
  const itemsLoadedRef = useRef(false);
  // 是否已经完成"加入房间"的初次同步判定（收到 peer 的完整状态，或等待超时判定
  // 自己是第一个在线的人）。在这之前不能把本地 items 写进 doc——否则会替已存在的
  // item 独立造一份结构上互不相识的 Y.Map，后续增量 update 就合并不回去了。
  const joinSyncedRef = useRef(false);

  const maybeSeed = useCallback(() => {
    if (!joinSyncedRef.current || !itemsLoadedRef.current) return;
    seedItems(docRef.current, itemsRef.current);
    // seedItems 只补"任何在线客户端都还不知道"的新条目；已存在的条目里，doc
    // 内可能有比这次 REST 快照更新的字段（比如刚加入时另一人正在编辑），
    // 用 doc 当前真实状态回填一次 React state，而不是反过来拿 REST 覆盖 doc。
    setItems((prev) => mergeRemoteItems(prev, readCollabItems(docRef.current), editingIdRef.current, dragRef.current?.ids ?? []));
  }, []);

  const load = useCallback(async () => {
    const res = await fetch(`/api/boards/${boardId}/items`);
    if (res.ok) {
      const next = ((await res.json()).items ?? []) as Item[];
      itemsRef.current = next;
      itemsLoadedRef.current = true;
      setItems(next);
      maybeSeed();
    }
  }, [boardId, maybeSeed]);

  useEffect(() => {
    void load();
  }, [load]);

  // p8:F03 — 光标 presence：走既有 collab-bus 的 viewport/awareness 心跳通道（HTTP
  // presence 轮询），不是 F01/F02 的 WS+Yjs 传输——光标不需要 CRDT 合并语义，
  // 复用现成的 1.5s presence 心跳足够。闲置 2.5s 自动隐藏，避免残留光标误导。
  const clearLocalCursor = useCallback(() => {
    if (cursorIdleTimer.current) {
      clearTimeout(cursorIdleTimer.current);
      cursorIdleTimer.current = null;
    }
    publishCursor(null);
  }, []);

  const publishLocalCursor = useCallback((e: React.MouseEvent) => {
    // 广播画布逻辑坐标，不是发送方屏幕像素——接收端按各自的 pan/zoom 转回屏幕坐标
    // 渲染，否则窗口尺寸/缩放不同时光标会跟真实指向对不上（p8:F03 修复点）。
    const board = screenToBoardPoint(e.clientX, e.clientY, viewportContainerRect());
    publishCursor({ x: board.x, y: board.y, visible: true });
    if (cursorIdleTimer.current) clearTimeout(cursorIdleTimer.current);
    cursorIdleTimer.current = setTimeout(() => {
      cursorIdleTimer.current = null;
      publishCursor(null);
    }, 2500);
  }, []);

  useEffect(() => clearLocalCursor, [clearLocalCursor]);

  // 打开到 F01 网关的 WS 连接：先广播 sync-request 问"房间里有没有已经在线的人"，
  // 有则 apply 对方的完整状态（保证跟对方是同一批 Y.Map 结构实例，见 packages/collab
  // 的 encodeFullState 注释）；800ms 内没人应答就当自己是第一个，直接从 REST seed。
  //
  // p8:F05 重连策略：close/error 会指数退避重试（1s→2s→4s...封顶 30s，连上一次
  // 就把退避计数器复位），而不是旧版那种固定 1.5s 无限重试——网关真的挂掉时
  // 别把它打得更惨。另外，浏览器原生 WebSocket 拿不到握手失败的真实 HTTP 状态码
  // （401 也只是笼统的 error/close，无法区分"鉴权过期"和"网络抖动"），所以每次
  // 重连前先探一下 `/api/auth/session`——没登录就直接停止自动重连（重试一个必然
  // 会被拒绝的连接没有意义，用户需要重新登录）；探测本身失败（网络问题）则当作
  // 暂时性抖动，照常走退避重试。
  useEffect(() => {
    let cancelled = false;
    let ws: WebSocket | null = null;
    let syncTimer: ReturnType<typeof setTimeout> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let backoffMs = 1000;
    const MAX_BACKOFF_MS = 30_000;

    function scheduleRetry() {
      if (cancelled) return;
      const wait = backoffMs;
      backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
      retryTimer = setTimeout(() => void connect(), wait);
    }

    async function connect() {
      if (cancelled) return;
      joinSyncedRef.current = false;
      publishConnectionState("connecting");

      try {
        const authRes = await fetch("/api/auth/session");
        if (authRes.ok) {
          const body = (await authRes.json()) as { user?: unknown };
          if (!body?.user) {
            publishConnectionState("disconnected"); // 会话已失效：不再自动重连
            return;
          }
        }
      } catch {
        // 探测请求本身失败（网络问题），当作暂时性抖动，继续走下面的重试路径。
      }
      if (cancelled) return;

      const configRes = await fetch("/api/collab/config").catch(() => null);
      if (!configRes?.ok) {
        if (!cancelled) scheduleRetry();
        return;
      }
      const { wsUrl } = (await configRes.json()) as { wsUrl: string };
      if (cancelled) return;
      ws = new WebSocket(`${wsUrl}?boardId=${encodeURIComponent(boardId)}`);
      wsRef.current = ws;
      // 仅非生产环境暴露调试句柄（e2e 用它模拟断线）；生产环境不应该让任意脚本
      // 能读到/关闭这个内部连接。
      if (process.env.NODE_ENV !== "production") {
        (window as Window & { __boardCollabWs?: WebSocket | null }).__boardCollabWs = ws;
      }

      ws.addEventListener("open", () => {
        if (cancelled || !ws) return;
        backoffMs = 1000; // 连上了，退避计数器复位
        publishConnectionState("connected");
        ws.send(JSON.stringify({ type: "y-sync-request", boardId, from: clientIdRef.current }));
        syncTimer = setTimeout(() => {
          if (cancelled || joinSyncedRef.current) return;
          joinSyncedRef.current = true; // 没人应答：自己是第一个在线的，直接种子化
          maybeSeed();
        }, 800);
      });

      ws.addEventListener("message", (event) => {
        if (cancelled) return;
        // F01 网关把"转发自其它客户端"的消息包一层自己的信封：
        // { type: "message", boardId, data: "<发送方原始文本>", fromClientId, via }。
        // 网关自己直接发的消息（如刚连上时的 {type:"connected"}）不走这层信封。
        // 这里先剥掉信封，取出 data 里才是我们自己的业务消息（y-sync-request/
        // y-sync-response/y-update），再解析一次——只解析一层会把 outer.type
        // （恒为 "message"）当成业务类型，永远匹配不上，是本文件早期版本的真实 bug
        // （被同文件里原有的 REST 轮询兜底完全掩盖，playwright 测试一度"意外通过"）。
        let outer: { type?: string; data?: string } | null = null;
        try {
          outer = JSON.parse(event.data);
        } catch {
          return;
        }
        if (outer?.type !== "message" || typeof outer.data !== "string") return;
        let msg: { type?: string; from?: string; update?: string } | null = null;
        try {
          msg = JSON.parse(outer.data);
        } catch {
          return;
        }
        if (msg?.type === "y-sync-request" && msg.from !== clientIdRef.current) {
          ws?.send(
            JSON.stringify({ type: "y-sync-response", boardId, update: encodeFullState(docRef.current) }),
          );
          return;
        }
        if (msg?.type === "y-sync-response" && msg.update) {
          applyEncodedUpdate(docRef.current, msg.update);
          if (!joinSyncedRef.current) {
            joinSyncedRef.current = true;
            if (syncTimer) clearTimeout(syncTimer);
            maybeSeed();
          }
          return;
        }
        if (msg?.type === "y-update" && msg.update) {
          applyEncodedUpdate(docRef.current, msg.update);
        }
      });

      ws.addEventListener("close", () => {
        if (wsRef.current === ws) wsRef.current = null;
        if (
          process.env.NODE_ENV !== "production" &&
          (window as Window & { __boardCollabWs?: WebSocket | null }).__boardCollabWs === ws
        ) {
          (window as Window & { __boardCollabWs?: WebSocket | null }).__boardCollabWs = null;
        }
        if (!cancelled) {
          publishConnectionState("disconnected");
          scheduleRetry();
        }
      });
      ws.addEventListener("error", () => {
        ws?.close();
      });
    }

    void connect();

    const offLocal = onLocalUpdate(docRef.current, (update) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "y-update", boardId, update: encodeUpdate(update) }));
      }
    });
    const offRemote = onRemoteItemsChange(docRef.current, (latest) => {
      setItems((prev) => mergeRemoteItems(prev, latest, editingIdRef.current, dragRef.current?.ids ?? []));
    });

    return () => {
      cancelled = true;
      if (syncTimer) clearTimeout(syncTimer);
      if (retryTimer) clearTimeout(retryTimer);
      offLocal();
      offRemote();
      ws?.close();
      wsRef.current = null;
      publishConnectionState("disconnected");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId]);

  // 本地 items 变化（不管是用户操作、旧的 REST 轮询合并、还是上面 maybeSeed 的
  // reconcile）都镜像进 doc，这样才能广播给其它人。syncItemsIntoDoc 对没有真的
  // 变化的字段是幂等的，所以"这次变化本来就是从 doc 读回来的"不会又广播回去。
  useEffect(() => {
    if (!joinSyncedRef.current) return;
    syncItemsIntoDoc(docRef.current, items);
  }, [items]);

  useEffect(() => {
    editingIdRef.current = editingId;
    // 编辑刚结束：把编辑期间被"保留本地版本"挡住的远端变更（如果有）拉回来，
    // 不必等下一次远端事件才生效——这是相对旧方案"编辑中收到的变更永久丢失"的修复点。
    if (editingId == null && joinSyncedRef.current) {
      setItems((prev) => mergeRemoteItems(prev, readCollabItems(docRef.current), null, dragRef.current?.ids ?? []));
    }
  }, [editingId]);

  // uc-collab-001：文本编辑进行中也算「正在操作」，供他人看到「谁在操作」（editingId 存在 = 编辑中）。
  useEffect(() => {
    setOperating(editingId != null);
  }, [editingId]);

  // ── 实时协作同步（uc-canvas-005）────────────────────────────────────────
  // 轮询服务端 item 列表，让其它在线用户的新增/移动/删除在本地画布上出现，
  // 达成「在线用户看到一致的 Board 内容」（UC 后置条件 1）。
  // 只在本地无进行中编辑/拖拽时才合并服务端快照，避免打断本地操作。
  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    async function poll() {
      if (!stop && !editingId && !dragRef.current) {
        try {
          const res = await fetch(`/api/boards/${boardId}/items`);
          if (res.ok && !stop && !editingId && !dragRef.current) {
            const next = ((await res.json()).items ?? []) as Item[];
            setItems((prev) =>
              JSON.stringify(prev) === JSON.stringify(next) ? prev : next
            );
          }
        } catch {
          // 网络异常忽略；下个周期重试（UC 异常流程 2）
        }
      }
      if (!stop) timer = setTimeout(poll, 1500);
    }
    timer = setTimeout(poll, 1500);
    return () => {
      stop = true;
      if (timer) clearTimeout(timer);
    };
  }, [boardId, editingId]);

  // ── 落库原子操作（撤销/重做与正常操作共用）──────────────────────────────
  const apiDelete = useCallback(
    (ids: string[]) => Promise.all(ids.map((id) => fetch(`/api/board-items/${id}`, { method: "DELETE" }))),
    []
  );
  const apiRestore = useCallback(
    (its: Item[]) =>
      Promise.all(
        its.map(async (it) => {
          await fetch(`/api/boards/${boardId}/items`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ id: it.id, type: it.type, x: it.x, y: it.y, w: it.w, h: it.h, text: it.text }),
          });
          // 路由 restore 分支不读 color；用 PATCH 补回外观色（含文本哨兵），保证撤销删除后仍是原样。
          if (it.color != null) {
            await fetch(`/api/board-items/${it.id}`, {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ color: it.color }),
            });
          }
        })
      ),
    [boardId]
  );
  const apiMove = useCallback(
    (moves: Move[], useFrom: boolean) =>
      Promise.all(
        moves.map((m) =>
          fetch(`/api/board-items/${m.id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(useFrom ? { x: m.fromX, y: m.fromY } : { x: m.toX, y: m.toY }),
          })
        )
      ),
    []
  );

  function recordOp(op: Op) {
    undoStack.current.push(op);
    redoStack.current = [];
  }

  // ── 鼠标拖拽移动便签（F06 增强：指针驱动 + 视口缩放感知 + 可逆）──────────────
  // 读取画布表面的缩放（item 坐标系在缩放后的 surface 内，故屏幕位移需 ÷scale）。
  function readScale(): number {
    const surf = document.querySelector('[data-testid="canvas-surface"]') as HTMLElement | null;
    if (!surf) return 1;
    const t = getComputedStyle(surf).transform;
    const m = t && t !== "none" ? t.match(/matrix\(([^)]+)\)/) : null;
    const first = m?.[1]?.split(",")[0];
    const a = first ? parseFloat(first) : 1;
    return a || 1;
  }

  const onDragMove = useCallback((e: MouseEvent) => {
    const d = dragRef.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 3) d.moved = true;
    if (!d.moved) return;
    const dx = (e.clientX - d.startX) / d.scale;
    const dy = (e.clientY - d.startY) / d.scale;

    // 以拖动集合的第一个 item 作为吸附参照，计算对齐吸附增量与参考线。
    const leadId = d.ids[0];
    const lead = leadId ? d.init[leadId] : undefined;
    let snapDX = 0;
    let snapDY = 0;
    let nextGuides: Guide[] = [];
    if (lead) {
      const { snapDX: sdx, snapDY: sdy, guides: g } = computeSnap(
        { x: lead.x + dx, y: lead.y + dy, w: lead.w, h: lead.h },
        d.others,
      );
      snapDX = sdx;
      snapDY = sdy;
      nextGuides = g;
    }
    d.snapDX = snapDX;
    d.snapDY = snapDY;
    setGuides(nextGuides);

    setItems((prev) =>
      prev.map((it) => {
        const p = d.init[it.id];
        return p ? { ...it, x: p.x + dx + snapDX, y: p.y + dy + snapDY } : it;
      }),
    );
  }, []);

  const onDragUp = useCallback(
    async (e: MouseEvent) => {
      window.removeEventListener("mousemove", onDragMove);
      window.removeEventListener("mouseup", onDragUp);
      const d = dragRef.current;
      dragRef.current = null;
      setOperating(false); // uc-collab-001：拖拽结束 → 清除操作态
      setGuides([]); // 释放后隐藏参考线
      if (!d || !d.moved) return;
      justDraggedRef.current = true;
      // 若拖动结束时触发吸附，最终位置 = 释放位置 + 吸附增量；否则停在释放位置。
      const dx = (e.clientX - d.startX) / d.scale + d.snapDX;
      const dy = (e.clientY - d.startY) / d.scale + d.snapDY;
      const moves: Move[] = d.ids.map((id) => {
        const f = d.init[id] ?? { x: 0, y: 0, w: 0, h: 0 };
        return { id, fromX: f.x, fromY: f.y, toX: f.x + dx, toY: f.y + dy };
      });
      setSelected(new Set(d.ids));
      undoStack.current.push({ kind: "move", moves });
      redoStack.current = [];
      await apiMove(moves, false);
    },
    [apiMove, onDragMove],
  );

  function startNoteDrag(e: React.MouseEvent, item: Item) {
    e.stopPropagation(); // 阻止视口平移在便签上启动
    if (!canEdit || editingId === item.id) return;
    const ids = selected.has(item.id) ? items.filter((it) => selected.has(it.id)).map((it) => it.id) : [item.id];
    // 拖动集合置于 ids 首位（吸附以拖动的目标 item 为参照）。
    const orderedIds = [item.id, ...ids.filter((id) => id !== item.id)];
    const init: Record<string, { x: number; y: number; w: number; h: number }> = {};
    const others: { x: number; y: number; w: number; h: number }[] = [];
    items.forEach((it) => {
      if (orderedIds.includes(it.id)) init[it.id] = { x: it.x, y: it.y, w: it.w, h: it.h };
      else others.push({ x: it.x, y: it.y, w: it.w, h: it.h });
    });
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      scale: readScale(),
      ids: orderedIds,
      init,
      others,
      snapDX: 0,
      snapDY: 0,
      moved: false,
    };
    setOperating(true); // uc-collab-001：开始拖拽 → 标记为「正在操作」，供他人看到「谁在操作」
    window.addEventListener("mousemove", onDragMove);
    window.addEventListener("mouseup", onDragUp);
  }

  async function addNote() {
    setActiveTool("sticky");
    setOpenPanel(null);
    const x = 40;
    const y = 40 + placeN.current++ * 130;
    const res = await fetch(`/api/boards/${boardId}/items`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "note", x, y, text: "便签" }),
    });
    if (res.status === 201) {
      const { item } = await res.json();
      recordOp({ kind: "add", items: [item] });
      await load();
      setSelected(new Set([item.id]));
    }
  }

  // 文本（Text）组件创建（uc-board-menu-003）：在画布放置默认文本块并自动选中。
  // 线上以 type:"note" 持久化 + color:"text" 哨兵；创建后立即 PATCH 写入 color 标记，
  // 使刷新/重载后仍判别为文本（见上方 TEXT_MARK 注释）。
  async function addText() {
    setActiveTool("text");
    setOpenPanel(null);
    const x = 220;
    const y = 40 + placeN.current++ * 130;
    // 服务端 validateNewItem 仅放行 note/rect（不可改）；以 note 落库，再用 color 哨兵标记为文本。
    const res = await fetch(`/api/boards/${boardId}/items`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "note", x, y, text: DEFAULT_TEXT }),
    });
    if (res.status !== 201) return;
    const { item } = (await res.json()) as { item: Item };
    // 持久化文本标记（color 哨兵），刷新后仍可判别为文本块。
    await fetch(`/api/board-items/${item.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ color: TEXT_MARK }),
    });
    const textItem: Item = { ...item, color: TEXT_MARK };
    recordOp({ kind: "add", items: [textItem] });
    await load();
    setSelected(new Set([item.id]));
  }

  async function addShape() {
    setActiveTool("shape");
    setOpenPanel(null);
    const x = 400;
    const y = 40 + placeN.current++ * 130;
    const res = await fetch(`/api/boards/${boardId}/items`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "rect", x, y, text: "" }),
    });
    if (res.status !== 201) return;
    const { item } = (await res.json()) as { item: Item };
    recordOp({ kind: "add", items: [item] });
    await load();
    setSelected(new Set([item.id]));
  }

  // 嵌入/资源组件创建（uc-widget-menu-009）：可刷新组件。线上以 type:"note" 落库 +
  // color:"embed" 哨兵，创建后立即 PATCH 写入标记，刷新/重载后仍判别为可刷新组件。
  async function addEmbed() {
    setActiveTool("assets");
    setOpenPanel(null);
    const x = 580;
    const y = 40 + placeN.current++ * 130;
    const res = await fetch(`/api/boards/${boardId}/items`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "note", x, y, text: DEFAULT_EMBED }),
    });
    if (res.status !== 201) return;
    const { item } = (await res.json()) as { item: Item };
    await fetch(`/api/board-items/${item.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ color: EMBED_MARK }),
    });
    const embedItem: Item = { ...item, color: EMBED_MARK };
    recordOp({ kind: "add", items: [embedItem] });
    await load();
    setSelected(new Set([item.id]));
  }

  // uc-widget-menu-009：刷新选中的可刷新组件。仅对 color:"embed" 的组件生效；
  // 主流程 = 显示处理中 → 重新获取该组件内容（重走 GET /items）→ 内容/状态更新并保持选中。
  // 可见反馈：重载计数自增 + 时间戳更新（data-testid=widget-reloaded-<id>）。
  const refreshSelected = useCallback(async () => {
    if (!canEdit) return;
    const targets = items.filter((it) => selected.has(it.id) && isReloadable(it));
    if (targets.length === 0) return; // 不支持刷新的对象不执行（入口本就不显示）
    const ids = targets.map((t) => t.id);
    setRefreshing((prev) => new Set([...prev, ...ids])); // 处理中/旋转状态
    // 重新获取该组件内容：原组件保持在画布中（load 覆盖同 id）。
    await load();
    setReload((prev) => {
      const next = { ...prev };
      const now = Date.now();
      for (const id of ids) next[id] = { count: (prev[id]?.count ?? 0) + 1, at: now };
      return next;
    });
    setRefreshing((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
    setSelected(new Set(ids)); // 刷新后保持选中
  }, [canEdit, items, selected, load]);

  function chooseTool(tool: BoardTool) {
    setActiveTool(tool);
    if (tool === "assets" || tool === "templates") setOpenPanel(tool);
    else setOpenPanel(null);
    if (tool === "select") setSelected(new Set());
  }

  // 底部悬浮 dock（F01，对齐 prototype FigJam 工具栏）复用同一套 activeTool 真值与
  // add* 动作，不引入第二套工具状态；disabled 的新工具（table/kanban/code/image）
  // 点击不做任何事（按钮本身已 disabled，这里仅作类型收窄防御）。
  function chooseDockTool(tool: DockToolKey) {
    if (tool === "sticky") {
      void addNote();
      return;
    }
    if (tool === "text") {
      void addText();
      return;
    }
    if (tool === "shape") {
      void addShape();
      return;
    }
    if (tool === "select" || tool === "pan") {
      chooseTool(tool);
    }
  }

  function selectItem(id: string, additive: boolean) {
    setSelected((prev) => {
      const next = new Set(additive ? prev : []);
      if (additive && prev.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const moveSelected = useCallback(
    async (dx: number, dy: number) => {
      if (!canEdit || selected.size === 0) return;
      const targets = items.filter((it) => selected.has(it.id));
      const moves: Move[] = targets.map((it) => ({ id: it.id, fromX: it.x, fromY: it.y, toX: it.x + dx, toY: it.y + dy }));
      setItems((prev) => prev.map((it) => (selected.has(it.id) ? { ...it, x: it.x + dx, y: it.y + dy } : it)));
      recordOp({ kind: "move", moves });
      await apiMove(moves, false);
    },
    [canEdit, selected, items, apiMove]
  );

  const pasteClipboard = useCallback(async () => {
    if (!canEdit || clipboard.current.length === 0) return;
    const created: Item[] = [];
    for (const it of clipboard.current) {
      const res = await fetch(`/api/boards/${boardId}/items`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: it.type, x: it.x + 20, y: it.y + 20, text: it.text }),
      });
      if (res.status !== 201) continue;
      const copy = (await res.json()).item as Item;
      // 保留外观色（含文本组件的 color:"text" 哨兵），使复制出的文本仍是文本块。
      if (it.color != null) {
        await fetch(`/api/board-items/${copy.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ color: it.color }),
        });
        copy.color = it.color;
      }
      created.push(copy);
    }
    if (created.length) recordOp({ kind: "add", items: created });
    await load();
    setSelected(new Set(created.map((c) => c.id)));
  }, [canEdit, boardId, load]);

  function duplicateSelected() {
    clipboard.current = items.filter((it) => selected.has(it.id));
    void pasteClipboard();
  }

  // F11：保存便签文字（双击编辑 → 失焦/回车）
  async function saveText(id: string, text: string) {
    setEditingId(null);
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, text } : it)));
    await fetch(`/api/board-items/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
  }

  // 落库一批 color 变更（共用于 setColor / toggleBold）。
  async function applyColors(updates: { id: string; color: string }[]) {
    const map = new Map(updates.map((u) => [u.id, u.color]));
    setItems((prev) => prev.map((it) => (map.has(it.id) ? { ...it, color: map.get(it.id)! } : it)));
    await Promise.all(
      updates.map((u) =>
        fetch(`/api/board-items/${u.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ color: u.color }),
        })
      )
    );
  }

  // F11：改选中便签颜色（保留字重 :bold 修饰）
  async function setColor(base: string) {
    const updates = items
      .filter((it) => selected.has(it.id))
      .map((it) => ({ id: it.id, color: base + (isBold(it) ? ":bold" : "") }));
    await applyColors(updates);
  }

  // uc-widget-menu-002：切换选中组件字重（bold/normal），编码为 color 的 :bold 后缀。
  async function toggleBold() {
    const targets = items.filter((it) => selected.has(it.id));
    if (targets.length === 0) return;
    const allBold = targets.every(isBold); // 全粗 → 取消；否则 → 全部加粗
    const updates = targets.map((it) => {
      const b = baseColor(it.color);
      return { id: it.id, color: allBold ? b : `${b}:bold` };
    });
    await applyColors(updates);
  }

  // uc-context-menu-003：调整图层顺序（z-order）。items 数组顺序即 DOM 绘制顺序，
  // 越靠后越在上层（同 z-index、position:absolute → 后绘制覆盖先绘制）。
  // 通过重排 items 数组实现「置顶/上移/下移/置底」，并保留选中态。
  // z-order 为纯客户端视图关注点（后端 item 无 order 字段），重排数组即改变遮挡关系。
  const arrange = useCallback(
    (mode: "front" | "forward" | "backward" | "back") => {
      if (!canEdit || selected.size === 0) return;
      setItems((prev) => {
        if (!prev.some((it) => selected.has(it.id))) return prev;
        const sel = prev.filter((it) => selected.has(it.id));
        const rest = prev.filter((it) => !selected.has(it.id));
        if (mode === "front") return [...rest, ...sel];
        if (mode === "back") return [...sel, ...rest];
        const next = [...prev];
        if (mode === "forward") {
          // 整体上移一层：从右往左，把每个选中项与其右侧最近的未选中项交换，
          // 保留选中项彼此相对次序。
          for (let i = next.length - 2; i >= 0; i--) {
            if (selected.has(next[i]!.id) && !selected.has(next[i + 1]!.id)) {
              [next[i], next[i + 1]] = [next[i + 1]!, next[i]!];
            }
          }
        } else {
          // 整体下移一层：从左往右，把每个选中项与其左侧最近的未选中项交换。
          for (let i = 1; i < next.length; i++) {
            if (selected.has(next[i]!.id) && !selected.has(next[i - 1]!.id)) {
              [next[i], next[i - 1]] = [next[i - 1]!, next[i]!];
            }
          }
        }
        return next;
      });
    },
    [canEdit, selected]
  );

  const deleteSelected = useCallback(async () => {
    if (!canEdit || selected.size === 0) return;
    const removed = items.filter((it) => selected.has(it.id));
    setItems((prev) => prev.filter((it) => !selected.has(it.id)));
    setSelected(new Set());
    recordOp({ kind: "delete", items: removed });
    await apiDelete(removed.map((it) => it.id));
  }, [canEdit, selected, items, apiDelete]);

  const undo = useCallback(async () => {
    if (!canEdit) return;
    const op = undoStack.current.pop();
    if (!op) return;
    if (op.kind === "add") await apiDelete(op.items.map((i) => i.id));
    else if (op.kind === "delete") await apiRestore(op.items);
    else await apiMove(op.moves, true);
    redoStack.current.push(op);
    setSelected(new Set());
    await load();
  }, [canEdit, apiDelete, apiRestore, apiMove, load]);

  const redo = useCallback(async () => {
    if (!canEdit) return;
    const op = redoStack.current.pop();
    if (!op) return;
    if (op.kind === "add") await apiRestore(op.items);
    else if (op.kind === "delete") await apiDelete(op.items.map((i) => i.id));
    else await apiMove(op.moves, false);
    undoStack.current.push(op);
    setSelected(new Set());
    await load();
  }, [canEdit, apiDelete, apiRestore, apiMove, load]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      if (e.key === "Escape") {
        setOpenPanel(null);
        setActiveTool("select");
        return setSelected(new Set());
      }
      const mod = e.metaKey || e.ctrlKey;
      if (mod && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        return void (e.shiftKey ? redo() : undo());
      }
      if (mod && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        return void redo();
      }
      if (mod && (e.key === "a" || e.key === "A")) {
        e.preventDefault();
        return setSelected(new Set(items.map((it) => it.id)));
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        return void deleteSelected();
      }
      if (mod && (e.key === "c" || e.key === "C")) {
        e.preventDefault();
        clipboard.current = items.filter((it) => selected.has(it.id));
        return;
      }
      if (mod && (e.key === "v" || e.key === "V")) {
        e.preventDefault();
        return void pasteClipboard();
      }
      const step = e.shiftKey ? BIG_NUDGE : NUDGE;
      if (e.key === "ArrowLeft") return void moveSelected(-step, 0);
      if (e.key === "ArrowRight") return void moveSelected(step, 0);
      if (e.key === "ArrowUp") return void moveSelected(0, -step);
      if (e.key === "ArrowDown") return void moveSelected(0, step);
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [items, selected, deleteSelected, moveSelected, pasteClipboard, undo, redo]);

  return (
    <div className="relative flex flex-1 flex-col" onMouseMove={publishLocalCursor} onMouseLeave={clearLocalCursor}>
      {/* Board Menu：编辑者可见的工具入口；不可用能力保留禁用状态，避免误导为已实现。 */}
      {canEdit && (
        <div className="relative border-b bg-card px-3 py-1.5">
          <div data-testid="board-menu" aria-label="Board Menu" className="flex items-center gap-1.5">
            <BoardMenuButton
              testId="board-tool-select"
              label="选择"
              active={activeTool === "select"}
              onClick={() => chooseTool("select")}
            >
              <MousePointer2 className="h-4 w-4" />
            </BoardMenuButton>
            <BoardMenuButton
              testId="board-tool-pan"
              label="平移"
              active={activeTool === "pan"}
              onClick={() => chooseTool("pan")}
            >
              <Hand className="h-4 w-4" />
            </BoardMenuButton>
            <BoardMenuButton testId="add-note" label="便利贴" active={activeTool === "sticky"} onClick={() => void addNote()}>
              <StickyNote className="h-4 w-4" />
            </BoardMenuButton>
            <BoardMenuButton testId="board-tool-draw" label="手绘" active={false} disabled>
              <PenLine className="h-4 w-4" />
            </BoardMenuButton>
            <BoardMenuButton testId="add-text" label="文本" active={activeTool === "text"} onClick={() => void addText()}>
              <Type className="h-4 w-4" />
            </BoardMenuButton>
            <BoardMenuButton testId="board-tool-connector" label="连接线" active={false} disabled>
              <Cable className="h-4 w-4" />
            </BoardMenuButton>
            <BoardMenuButton testId="board-tool-shape" label="形状" active={activeTool === "shape"} onClick={() => void addShape()}>
              <Shapes className="h-4 w-4" />
            </BoardMenuButton>
            <BoardMenuButton
              testId="board-tool-assets"
              label="资源"
              active={activeTool === "assets"}
              onClick={() => chooseTool("assets")}
            >
              <Image className="h-4 w-4" />
            </BoardMenuButton>
            {/* 嵌入/资源组件（可刷新）：uc-widget-menu-009 的刷新入口只对这类组件出现 */}
            <BoardMenuButton testId="add-embed" label="嵌入" active={false} onClick={() => void addEmbed()}>
              <RefreshCw className="h-4 w-4" />
            </BoardMenuButton>
            <BoardMenuButton
              testId="board-tool-templates"
              label="模板"
              active={activeTool === "templates"}
              onClick={() => chooseTool("templates")}
            >
              <LayoutTemplate className="h-4 w-4" />
            </BoardMenuButton>

            <div className="mx-1 h-5 w-px bg-border" />
            <Button data-testid="undo" size="icon" variant="ghost" title="撤销" aria-label="撤销" onClick={() => void undo()}>
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button data-testid="redo" size="icon" variant="ghost" title="重做" aria-label="重做" onClick={() => void redo()}>
              <Redo2 className="h-4 w-4" />
            </Button>
            <span data-testid="selection-count" className="ml-1 text-xs text-muted-foreground">
              已选 {selected.size}
            </span>
          </div>

          {openPanel === "assets" && (
            <div
              data-testid="board-assets-panel"
              className="absolute left-3 top-12 z-20 w-72 rounded-lg border bg-popover p-3 shadow-lg"
            >
              <input
                data-testid="board-assets-search"
                aria-label="搜索资源"
                placeholder="搜索图片或图标"
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <div className="mt-2 flex gap-1.5">
                <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium">图片</span>
                <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium">图标</span>
              </div>
            </div>
          )}

          {openPanel === "templates" && (
            <div
              data-testid="board-templates-panel"
              className="absolute left-3 top-12 z-20 w-72 rounded-lg border bg-popover p-3 shadow-lg"
            >
              <div className="text-xs font-semibold text-muted-foreground">模板</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button type="button" className="rounded-md border bg-background p-2 text-left text-xs">
                  Brainstorm
                </button>
                <button type="button" className="rounded-md border bg-background p-2 text-left text-xs">
                  Kanban
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Widget Menu：选中驱动的悬浮操作（F10）。能力随 widget type 矩阵扩展（F17 样式/F18 锁定…）。
          当前 item 均为便签，动作统一；多选展示交集动作。 */}
      {canEdit && selected.size > 0 && (
        <div
          data-testid="widget-menu"
          className="absolute left-1/2 top-14 z-20 flex -translate-x-1/2 items-center gap-1 rounded-md border bg-card px-2 py-1 shadow-lg"
        >
          <span className="px-1 text-xs text-muted-foreground">{selected.size} 项</span>
          {/* 颜色色板（F11）：仅对便签生效；选中项全为文本时隐藏（文本为透明块，不套柔彩色） */}
          {!items.filter((it) => selected.has(it.id)).every(isText) &&
            COLOR_TOKENS.map((c) => (
            <button
              key={c}
              type="button"
              data-testid={`wm-color-${c}`}
              aria-label={`颜色 ${c}`}
              onClick={() => void setColor(c)}
              className={"h-5 w-5 rounded-full border " + colorClass(c)}
            />
          ))}
          <Button
            data-testid="wm-bold"
            size="sm"
            variant="ghost"
            aria-label="字重加粗"
            aria-pressed={items.filter((it) => selected.has(it.id)).every(isBold)}
            className="font-bold"
            onClick={() => void toggleBold()}
          >
            B
          </Button>
          {/* 刷新组件（uc-widget-menu-009）：仅当选中项全部为可刷新（embed）组件时显示刷新入口；
              否则（含不可刷新对象）显示禁用的「刷新暂不可用」，体现类型不支持则动作不可用。 */}
          {(() => {
            const sel = items.filter((it) => selected.has(it.id));
            const allReloadable = sel.length > 0 && sel.every(isReloadable);
            const busy = sel.some((it) => refreshing.has(it.id));
            return allReloadable ? (
              <Button
                data-testid="wm-refresh"
                size="sm"
                variant="ghost"
                aria-label="刷新组件"
                aria-busy={busy}
                disabled={busy}
                onClick={() => void refreshSelected()}
              >
                <RefreshCw className={"mr-1 h-3.5 w-3.5 " + (busy ? "animate-spin" : "")} />
                {busy ? "刷新中" : "刷新"}
              </Button>
            ) : (
              <Button
                data-testid="wm-refresh-unavailable"
                size="sm"
                variant="ghost"
                disabled
                title="当前组件类型不支持刷新"
              >
                刷新暂不可用
              </Button>
            );
          })()}
          <Button data-testid="wm-duplicate" size="sm" variant="ghost" onClick={duplicateSelected}>
            复制
          </Button>
          <Button data-testid="wm-delete" size="sm" variant="ghost" className="text-destructive" onClick={() => void deleteSelected()}>
            删除
          </Button>
          <Button data-testid="wm-resize-unavailable" size="sm" variant="ghost" disabled title="当前组件暂不支持拖拽控制点缩放">
            缩放暂不可用
          </Button>
          <Button data-testid="wm-lock-unavailable" size="sm" variant="ghost" disabled title="锁定能力将在后续组件权限矩阵接入">
            锁定暂不可用
          </Button>
        </div>
      )}

      <CanvasViewport>
        <div
          className="relative h-full w-full"
          data-testid="items-layer"
          onClick={() => {
            setSelected(new Set());
            setCtxMenu(null);
          }}
          onContextMenu={(e) => {
            if (!canEdit) return;
            e.preventDefault();
            setCtxMenu({ x: e.clientX, y: e.clientY });
          }}
        >
          {items.map((it, z) => (
            <div
              key={it.id}
              data-testid={`item-${it.id}`}
              data-selected={selected.has(it.id) ? "true" : "false"}
              data-z={z}
              data-reloadable={isReloadable(it) ? "true" : "false"}
              data-reload-count={reload[it.id]?.count ?? 0}
              data-refreshed-at={reload[it.id]?.at ?? ""}
              onMouseDown={(e) => startNoteDrag(e, it)}
              onClick={(e) => {
                e.stopPropagation();
                if (justDraggedRef.current) {
                  justDraggedRef.current = false;
                  return;
                }
                selectItem(it.id, e.shiftKey);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (canEdit) setEditingId(it.id);
              }}
              onContextMenu={(e) => {
                if (!canEdit) return;
                e.preventDefault();
                e.stopPropagation();
                if (!selected.has(it.id)) selectItem(it.id, false);
                setCtxMenu({ x: e.clientX, y: e.clientY });
              }}
              style={{ left: it.x, top: it.y, width: it.w, height: it.h, zIndex: z }}
              className={
                "absolute flex p-2 text-xs " +
                // 文本：透明无边框文本块；形状：粗边框矩形；便签：柔彩 + 边框 + 圆角 + 阴影
                (isText(it)
                  ? "items-start justify-start border-0 bg-transparent text-foreground shadow-none "
                  : isShape(it)
                  ? "items-center justify-center rounded-7 border-2 border-border-strong bg-surface-1 text-foreground shadow-sm "
                  : "items-center justify-center rounded-7 border shadow-sm " + colorClass(it.color) + " ") +
                (isBold(it) ? "font-bold " : "") +
                (canEdit && editingId !== it.id ? "cursor-grab active:cursor-grabbing " : "") +
                (selected.has(it.id) ? "ring-2 ring-primary ring-offset-1" : "")
              }
            >
              {editingId === it.id ? (
                <textarea
                  data-testid={`item-edit-${it.id}`}
                  autoFocus
                  defaultValue={it.text}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={(e) => void saveText(it.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      (e.target as HTMLTextAreaElement).blur();
                    }
                  }}
                  className={
                    "h-full w-full resize-none rounded bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-primary " +
                    (isText(it) ? "text-left" : "text-center")
                  }
                />
              ) : (
                it.text
              )}
              {/* uc-widget-menu-009：可刷新组件的重载可见反馈（重载次数徽标）。刷新中显示旋转态。 */}
              {isReloadable(it) && (
                <span
                  data-testid={`widget-reloaded-${it.id}`}
                  data-reload-count={reload[it.id]?.count ?? 0}
                  className="pointer-events-none absolute -right-1 -top-2 flex items-center gap-0.5 rounded-full bg-primary px-1.5 py-0.5 text-10 font-medium text-primary-foreground shadow"
                >
                  <RefreshCw className={"h-2.5 w-2.5 " + (refreshing.has(it.id) ? "animate-spin" : "")} />
                  {reload[it.id]?.count ?? 0}
                </span>
              )}
            </div>
          ))}

          {/* 对齐参考线（uc-canvas-007）：拖动触发吸附时显示，与 item 同处画布坐标系。 */}
          {guides.map((g, i) => (
            <div
              key={`${g.orientation}-${g.pos}-${i}`}
              data-testid="alignment-guide"
              data-orientation={g.orientation}
              aria-hidden
              className="pointer-events-none absolute z-10 bg-primary"
              style={
                g.orientation === "v"
                  ? { left: g.pos, top: -4000, height: 8000, width: 1 }
                  : { top: g.pos, left: -4000, width: 8000, height: 1 }
              }
            />
          ))}
        </div>
      </CanvasViewport>

      {/* 右键上下文菜单（uc-context-menu-001）：复用复制/粘贴/副本/删除 */}
      {canEdit && ctxMenu && (
        <div
          data-testid="context-menu"
          role="menu"
          style={{ position: "fixed", left: ctxMenu.x, top: ctxMenu.y }}
          className="z-30 w-36 rounded-md border bg-popover p-1 text-popover-foreground shadow-lg"
        >
          {selected.size > 0 && (
            <>
              <button
                type="button"
                data-testid="ctx-copy"
                className="flex w-full items-center rounded px-2 py-1.5 text-left text-13 transition-colors hover:bg-muted"
                onClick={() => {
                  clipboard.current = items.filter((it) => selected.has(it.id));
                  setCtxMenu(null);
                }}
              >
                复制
              </button>
              <button
                type="button"
                data-testid="ctx-duplicate"
                className="flex w-full items-center rounded px-2 py-1.5 text-left text-13 transition-colors hover:bg-muted"
                onClick={() => {
                  duplicateSelected();
                  setCtxMenu(null);
                }}
              >
                创建副本
              </button>
              {/* uc-context-menu-003：调整图层顺序（z-order）。重排后关闭菜单、保留选中态。 */}
              <div className="my-1 h-px bg-border" />
              <button
                type="button"
                data-testid="ctx-bring-front"
                className="flex w-full items-center rounded px-2 py-1.5 text-left text-13 transition-colors hover:bg-muted"
                onClick={() => {
                  arrange("front");
                  setCtxMenu(null);
                }}
              >
                置于顶层
              </button>
              <button
                type="button"
                data-testid="ctx-bring-forward"
                className="flex w-full items-center rounded px-2 py-1.5 text-left text-13 transition-colors hover:bg-muted"
                onClick={() => {
                  arrange("forward");
                  setCtxMenu(null);
                }}
              >
                上移一层
              </button>
              <button
                type="button"
                data-testid="ctx-send-backward"
                className="flex w-full items-center rounded px-2 py-1.5 text-left text-13 transition-colors hover:bg-muted"
                onClick={() => {
                  arrange("backward");
                  setCtxMenu(null);
                }}
              >
                下移一层
              </button>
              <button
                type="button"
                data-testid="ctx-send-back"
                className="flex w-full items-center rounded px-2 py-1.5 text-left text-13 transition-colors hover:bg-muted"
                onClick={() => {
                  arrange("back");
                  setCtxMenu(null);
                }}
              >
                置于底层
              </button>
              <div className="my-1 h-px bg-border" />
              <button
                type="button"
                data-testid="ctx-delete"
                className="flex w-full items-center rounded px-2 py-1.5 text-left text-13 text-destructive transition-colors hover:bg-muted"
                onClick={() => {
                  void deleteSelected();
                  setCtxMenu(null);
                }}
              >
                删除
              </button>
            </>
          )}
          <button
            type="button"
            data-testid="ctx-paste"
            className="flex w-full items-center rounded px-2 py-1.5 text-left text-13 transition-colors hover:bg-muted disabled:opacity-40"
            disabled={clipboard.current.length === 0}
            onClick={() => {
              void pasteClipboard();
              setCtxMenu(null);
            }}
          >
            粘贴
          </button>
          <button
            type="button"
            data-testid="ctx-lock-unavailable"
            className="flex w-full items-center rounded px-2 py-1.5 text-left text-13 text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
            disabled
            title="锁定能力将在后续组件权限矩阵接入"
          >
            锁定暂不可用
          </button>
        </div>
      )}

      {/* F01（uc-board-ai-001）：底部悬浮工具 dock + AI 浮层/board chat 面板，对齐
          docs/design/boardx-prototype-v1.bundle.html 的 Board 屏。仅编辑者可见操作类 dock；
          AI 浮层对所有可查看者可用（就画布内容提问不要求编辑权限）。 */}
      {canEdit && (
        <BoardBottomDock
          activeTool={activeTool}
          onSelectTool={chooseDockTool}
          aiOpen={aiOpen}
          onToggleAi={() => setAiOpen((prev) => !prev)}
        />
      )}
      <BoardAiOverlay boardId={boardId} itemCount={items.length} open={aiOpen} onOpenChange={setAiOpen} />
    </div>
  );
}
