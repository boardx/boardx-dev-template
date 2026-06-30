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

const NUDGE = 1;
const BIG_NUDGE = 10;

// 画布：渲染 board-keyed items（ADR-0002）+ 选择/多选/键盘操作（P6 F06）。
// 视口（平移/缩放/小地图）复用 CanvasViewport（F05）。marquee 框选 deferred（与拖拽平移冲突，留后续）。
export function BoardCanvas({ boardId, canEdit }: { boardId: string; canEdit: boolean }) {
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const placeN = useRef(0); // 同步自增放置位，避免连点时读到尚未刷新的 items.length 造成重叠
  const clipboard = useRef<Item[]>([]); // 应用内剪贴板（F08）

  const load = useCallback(async () => {
    const res = await fetch(`/api/boards/${boardId}/items`);
    if (res.ok) setItems((await res.json()).items ?? []);
  }, [boardId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addNote() {
    // 纵向堆叠（x 固定靠左、y 间隔 130 > 便签高 100）：不重叠、且都落在视口左侧不被裁剪。
    // 用同步 ref 计数而非 items.length，避免连点时第二次读到尚未 load() 刷新的旧长度→重叠。
    const x = 40;
    const y = 40 + placeN.current++ * 130;
    const res = await fetch(`/api/boards/${boardId}/items`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "note", x, y, text: "便签" }),
    });
    if (res.status === 201) {
      const { item } = await res.json();
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
      setItems((prev) => prev.map((it) => (selected.has(it.id) ? { ...it, x: it.x + dx, y: it.y + dy } : it)));
      await Promise.all(
        targets.map((it) =>
          fetch(`/api/board-items/${it.id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ x: it.x + dx, y: it.y + dy }),
          })
        )
      );
    },
    [canEdit, selected, items]
  );

  const pasteClipboard = useCallback(async () => {
    if (!canEdit || clipboard.current.length === 0) return;
    const created: string[] = [];
    for (const it of clipboard.current) {
      const res = await fetch(`/api/boards/${boardId}/items`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: it.type, x: it.x + 20, y: it.y + 20, text: it.text }),
      });
      if (res.status === 201) created.push((await res.json()).item.id);
    }
    await load();
    setSelected(new Set(created));
  }, [canEdit, boardId, load]);

  const deleteSelected = useCallback(async () => {
    if (!canEdit || selected.size === 0) return;
    const ids = [...selected];
    setItems((prev) => prev.filter((it) => !selected.has(it.id)));
    setSelected(new Set());
    await Promise.all(ids.map((id) => fetch(`/api/board-items/${id}`, { method: "DELETE" })));
  }, [canEdit, selected]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") return setSelected(new Set());
      if ((e.key === "a" || e.key === "A") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        return setSelected(new Set(items.map((it) => it.id)));
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        return void deleteSelected();
      }
      if ((e.key === "c" || e.key === "C") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        clipboard.current = items.filter((it) => selected.has(it.id));
        return;
      }
      if ((e.key === "v" || e.key === "V") && (e.metaKey || e.ctrlKey)) {
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
  }, [items, selected, deleteSelected, moveSelected, pasteClipboard]);

  return (
    <div className="relative flex flex-1 flex-col">
      {/* 工具栏（编辑者可加组件；Board Menu 全量入口在 p7） */}
      {canEdit && (
        <div className="flex items-center gap-2 border-b bg-card px-3 py-1.5">
          <Button data-testid="add-note" size="sm" variant="secondary" onClick={addNote}>
            + 便签
          </Button>
          <span data-testid="selection-count" className="text-xs text-muted-foreground">
            已选 {selected.size}
          </span>
        </div>
      )}

      <CanvasViewport>
        <div
          className="relative h-full w-full"
          data-testid="items-layer"
          onClick={() => setSelected(new Set())}
        >
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
