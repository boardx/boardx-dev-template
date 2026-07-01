"use client";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CanvasViewport } from "@/components/board/canvas-viewport";
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

// 画布：渲染 board-keyed items（ADR-0002）+ 选择/键盘（F06）+ 复制粘贴（F08）+ 撤销/重做（F09）。
// 视口（平移/缩放/小地图）复用 CanvasViewport（F05）。marquee 框选 deferred（与拖拽平移冲突，留后续）。
export function BoardCanvas({ boardId, canEdit }: { boardId: string; canEdit: boolean }) {
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null); // F11 文本编辑中的便签
  const [activeTool, setActiveTool] = useState<BoardTool>("select");
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

  const load = useCallback(async () => {
    const res = await fetch(`/api/boards/${boardId}/items`);
    if (res.ok) setItems((await res.json()).items ?? []);
  }, [boardId]);

  useEffect(() => {
    void load();
  }, [load]);

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
    <div className="relative flex flex-1 flex-col">
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
                  className="pointer-events-none absolute -right-1 -top-2 flex items-center gap-0.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground shadow"
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
    </div>
  );
}
