// packages/canvas/src/index.ts — CAP-CANVAS 命令运行时（CanvasX 核心）
// 纯逻辑 reducer：apply(state, command) → state'。客户端状态、撤销重做、
// 以及后续实时协作（Yjs）都构建在此之上。渲染（Fabric.js/DOM）是可替换适配器。
//
// 数据模型（p6:F14，CRDT-ready）：widget 更新是**字段级 patch**而非整条替换——
// `{kind:"patch", id, patch:{x,y}}` 只改列出的字段，其余字段保持不变。
// 这让未来把存储后端换成 Y.Map（字段级 set/observe）时，上层不需要改命令语义。
// move/edit 保留为 patch 的便捷别名（既有调用方/e2e 不受影响）。

export type ItemType = "note" | "rect";

interface BoardItemCore {
  id: string;
  type: ItemType;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
}

export interface BoardItem extends BoardItemCore {
  /** widget 类型专有字段（形状/连接线/手绘…在 F15+ 各自扩展），字段级可寻址。 */
  [field: string]: unknown;
}

/** 字段级 patch：不允许改 id/type（身份字段），其余字段任意子集。 */
export type ItemPatch = Partial<Omit<BoardItemCore, "id" | "type">> &
  Record<string, unknown> & {
    id?: never;
    type?: never;
  };

export type Command =
  | { kind: "add"; item: BoardItem }
  | { kind: "patch"; id: string; patch: ItemPatch }
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

/** 字段级合并：只覆盖 patch 里列出的字段；id/type 不可被 patch 篡改。 */
function mergePatch(it: BoardItem, patch: ItemPatch): BoardItem {
  const { id: _id, type: _type, ...fields } = patch as Record<string, unknown>;
  return { ...it, ...fields, id: it.id, type: it.type };
}

/** 纯 reducer：对 items 应用一个命令，返回新数组（不可变）。 */
export function applyCommand(items: BoardItem[], cmd: Command): BoardItem[] {
  switch (cmd.kind) {
    case "add":
      return [...items, cmd.item];
    case "patch":
      return items.map((it) => (it.id === cmd.id ? mergePatch(it, cmd.patch) : it));
    case "move":
      return applyCommand(items, { kind: "patch", id: cmd.id, patch: { x: cmd.x, y: cmd.y } });
    case "edit":
      return applyCommand(items, { kind: "patch", id: cmd.id, patch: { text: cmd.text } });
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
