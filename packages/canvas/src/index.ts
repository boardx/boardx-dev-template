// packages/canvas/src/index.ts — CAP-CANVAS 命令运行时（CanvasX 核心）
// 纯逻辑 reducer：apply(state, command) → state'。客户端状态、撤销重做、
// 以及后续实时协作（Yjs）都构建在此之上。渲染（Fabric.js/DOM）是可替换适配器。

export type ItemType = "note" | "rect";

export interface BoardItem {
  id: string;
  type: ItemType;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
}

export type Command =
  | { kind: "add"; item: BoardItem }
  | { kind: "move"; id: string; x: number; y: number }
  | { kind: "edit"; id: string; text: string }
  | { kind: "delete"; id: string };

export const DEFAULT_SIZE: Record<ItemType, { w: number; h: number }> = {
  note: { w: 160, h: 100 },
  rect: { w: 120, h: 80 },
};

export function isItemType(s: string): s is ItemType {
  return s === "note" || s === "rect";
}

/** 纯 reducer：对 items 应用一个命令，返回新数组（不可变）。 */
export function applyCommand(items: BoardItem[], cmd: Command): BoardItem[] {
  switch (cmd.kind) {
    case "add":
      return [...items, cmd.item];
    case "move":
      return items.map((it) => (it.id === cmd.id ? { ...it, x: cmd.x, y: cmd.y } : it));
    case "edit":
      return items.map((it) => (it.id === cmd.id ? { ...it, text: cmd.text } : it));
    case "delete":
      return items.filter((it) => it.id !== cmd.id);
    default: {
      const _exhaustive: never = cmd;
      return items;
      void _exhaustive;
    }
  }
}

/** 应用一串命令（折叠）。 */
export function applyAll(items: BoardItem[], cmds: Command[]): BoardItem[] {
  return cmds.reduce(applyCommand, items);
}

/** 校验新增 item 的输入（坐标有限、type 合法）。 */
export function validateNewItem(input: {
  type?: unknown;
  x?: unknown;
  y?: unknown;
  text?: unknown;
}): { ok: true } | { ok: false; error: string } {
  if (typeof input.type !== "string" || !isItemType(input.type)) return { ok: false, error: "type 非法" };
  if (!Number.isFinite(Number(input.x)) || !Number.isFinite(Number(input.y)))
    return { ok: false, error: "坐标非法" };
  return { ok: true };
}
