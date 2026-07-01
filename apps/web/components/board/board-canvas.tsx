"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CanvasViewport } from "@/components/board/canvas-viewport";

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

const NUDGE = 1;
const BIG_NUDGE = 10;

// 画布：渲染 board-keyed items（ADR-0002）+ 选择/键盘（F06）+ 复制粘贴（F08）+ 撤销/重做（F09）。
// 视口（平移/缩放/小地图）复用 CanvasViewport（F05）。marquee 框选 deferred（与拖拽平移冲突，留后续）。
export function BoardCanvas({ boardId, canEdit }: { boardId: string; canEdit: boolean }) {
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null); // F11 文本编辑中的便签
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null); // 右键上下文菜单（uc-context-menu-001）
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
    init: Record<string, { x: number; y: number }>;
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
    setItems((prev) =>
      prev.map((it) => {
        const p = d.init[it.id];
        return p ? { ...it, x: p.x + dx, y: p.y + dy } : it;
      }),
    );
  }, []);

  const onDragUp = useCallback(
    async (e: MouseEvent) => {
      window.removeEventListener("mousemove", onDragMove);
      window.removeEventListener("mouseup", onDragUp);
      const d = dragRef.current;
      dragRef.current = null;
      if (!d || !d.moved) return;
      justDraggedRef.current = true;
      const dx = (e.clientX - d.startX) / d.scale;
      const dy = (e.clientY - d.startY) / d.scale;
      const moves: Move[] = d.ids.map((id) => {
        const f = d.init[id] ?? { x: 0, y: 0 };
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
    const init: Record<string, { x: number; y: number }> = {};
    items.forEach((it) => {
      if (ids.includes(it.id)) init[it.id] = { x: it.x, y: it.y };
    });
    dragRef.current = { startX: e.clientX, startY: e.clientY, scale: readScale(), ids, init, moved: false };
    window.addEventListener("mousemove", onDragMove);
    window.addEventListener("mouseup", onDragUp);
  }

  async function addNote() {
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

  // 形状（Shape）组件创建（uc-widgets-004）：以原生 type:"rect" 落库并自动选中。
  async function addShape() {
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
      if (e.key === "Escape") return setSelected(new Set());
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
      {/* 工具栏（编辑者可加组件；Board Menu 全量入口在 p7） */}
      {canEdit && (
        <div className="flex items-center gap-2 border-b bg-card px-3 py-1.5">
          <Button data-testid="add-note" size="sm" variant="secondary" onClick={addNote}>
            + 便签
          </Button>
          <Button data-testid="add-text" size="sm" variant="secondary" onClick={() => void addText()}>
            + 文本
          </Button>
          <Button data-testid="add-shape" size="sm" variant="secondary" onClick={() => void addShape()}>
            + 形状
          </Button>
          <Button data-testid="undo" size="sm" variant="ghost" onClick={() => void undo()}>
            撤销
          </Button>
          <Button data-testid="redo" size="sm" variant="ghost" onClick={() => void redo()}>
            重做
          </Button>
          <span data-testid="selection-count" className="text-xs text-muted-foreground">
            已选 {selected.size}
          </span>
        </div>
      )}

      {/* Widget Menu：选中驱动的悬浮操作（F10）。能力随 widget type 矩阵扩展（F17 样式/F18 锁定…）。
          当前 item 均为便签，动作统一；多选展示交集动作。 */}
      {canEdit && selected.size > 0 && (
        <div
          data-testid="widget-menu"
          className="absolute left-1/2 top-2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-md border bg-card px-2 py-1 shadow-lg"
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
          {items.map((it) => (
            <div
              key={it.id}
              data-testid={`item-${it.id}`}
              data-selected={selected.has(it.id) ? "true" : "false"}
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
              style={{ left: it.x, top: it.y, width: it.w, height: it.h }}
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
            </div>
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
