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
}

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
  const placeN = useRef(0); // 同步自增放置位，避免连点时读到尚未刷新的 items.length 造成重叠
  const clipboard = useRef<Item[]>([]); // 应用内剪贴板（F08）
  const undoStack = useRef<Op[]>([]); // F09
  const redoStack = useRef<Op[]>([]);

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
        its.map((it) =>
          fetch(`/api/boards/${boardId}/items`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ id: it.id, type: it.type, x: it.x, y: it.y, w: it.w, h: it.h, text: it.text }),
          })
        )
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
      if (res.status === 201) created.push((await res.json()).item);
    }
    if (created.length) recordOp({ kind: "add", items: created });
    await load();
    setSelected(new Set(created.map((c) => c.id)));
  }, [canEdit, boardId, load]);

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
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, selected, deleteSelected, moveSelected, pasteClipboard, undo, redo]);

  return (
    <div className="relative flex flex-1 flex-col">
      {/* 工具栏（编辑者可加组件；Board Menu 全量入口在 p7） */}
      {canEdit && (
        <div className="flex items-center gap-2 border-b bg-card px-3 py-1.5">
          <Button data-testid="add-note" size="sm" variant="secondary" onClick={addNote}>
            + 便签
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

      <CanvasViewport>
        <div className="relative h-full w-full" data-testid="items-layer" onClick={() => setSelected(new Set())}>
          {items.map((it) => (
            <div
              key={it.id}
              data-testid={`item-${it.id}`}
              data-selected={selected.has(it.id) ? "true" : "false"}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                selectItem(it.id, e.shiftKey);
              }}
              style={{ left: it.x, top: it.y, width: it.w, height: it.h }}
              className={
                "absolute flex items-center justify-center rounded-md border bg-amber-100 p-2 text-xs text-amber-900 shadow-sm " +
                (selected.has(it.id) ? "ring-2 ring-primary ring-offset-1" : "")
              }
            >
              {it.text}
            </div>
          ))}
        </div>
      </CanvasViewport>
    </div>
  );
}
