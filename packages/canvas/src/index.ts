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

// ── p7:F12 链接组件 URL 安全校验（stored XSS 防护）─────────────────────────────
// 链接组件把目标 URL 存进 color 哨兵 `link|url=<encodeURIComponent(URL)>`。若不校验协议，
// 攻击者可经无鉴别的 PATCH 写入 `javascript:`/`data:`/`vbscript:` URL，其它用户点击「打开
// 链接」时会在**其会话**里执行脚本（stored XSS）。防御以**协议白名单**为准（默认拒绝）——
// 不用 blacklist：黑名单会漏掉大小写/空白前缀变体（`  JaVaScRiPt:`）与未来新增的危险协议，
// 而 WHATWG URL 解析器会把这些变体归一化后再由白名单统一拦下。
const SAFE_LINK_PROTOCOLS = new Set(["http:", "https:"]);

/** 仅 http/https 视为安全链接；解析失败或其它协议一律拒绝（默认拒绝）。 */
export function isSafeLinkUrl(raw: string): boolean {
  try {
    return SAFE_LINK_PROTOCOLS.has(new URL(raw).protocol);
  } catch {
    return false;
  }
}

// 链接哨兵编码：`link|url=<encodeURIComponent(URL)>`。判别头固定为 "link"，与 board-canvas.tsx
// 的 LINK_MARK 一致（此处独立定义，避免 packages/canvas 反向依赖 apps/web）。
const LINK_SENTINEL_HEAD = "link";

/** 该 color 值是否为链接哨兵（判别头 === "link"）。 */
export function isLinkSentinel(color: string | null | undefined): boolean {
  if (typeof color !== "string") return false;
  return color.split("|")[0] === LINK_SENTINEL_HEAD;
}

/** 从链接哨兵里取出并 decode 目标 URL；非链接哨兵或解码失败返回 null。 */
export function linkUrlFromSentinel(color: string | null | undefined): string | null {
  if (!isLinkSentinel(color)) return null;
  for (const seg of (color as string).split("|").slice(1)) {
    const eq = seg.indexOf("=");
    if (eq === -1) continue;
    if (seg.slice(0, eq) === "url") {
      try {
        return decodeURIComponent(seg.slice(eq + 1));
      } catch {
        return null; // 编码损坏
      }
    }
  }
  return null;
}

/**
 * 校验一个待落库的 color 值是否安全（服务端 PATCH/写入路径的守门）。
 * 只对**链接哨兵**做协议白名单校验；其它任何 color 值（便签色/文本/形状/连接线/锁定/z 等
 * 哨兵）一律放行，绝不影响既有 sentinel 写入路径。
 */
export function isColorSafe(color: string | null | undefined): boolean {
  if (!isLinkSentinel(color)) return true; // 非链接哨兵：不干预
  const url = linkUrlFromSentinel(color);
  if (url == null) return false; // link 哨兵但取不出 URL（缺 url 段/编码损坏）→ 拒绝
  return isSafeLinkUrl(url);
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
