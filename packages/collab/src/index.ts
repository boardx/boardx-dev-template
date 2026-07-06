// @repo/collab — p8:F02 Board item 实时同步的 CRDT 层（Yjs）。
//
// 设计边界（读 phases/phase-p8-collaboration/feature_list.json 的 F02 之前先读这里）：
// - 每个 item 是 Y.Map 里的一条记录（key=item id），value 又是一个嵌套 Y.Map（字段级）。
//   两个人同时改同一个 item 的不同字段（如一个人拖动、另一个人改色）会正确合并；
//   同一字段被并发修改仍是 Yjs 内置的 LWW（最后写入胜出，由 Yjs 的逻辑时钟裁决），
//   不是真正的字符级 OT——这符合 issue notes 里"字段级 patch"的粒度要求，不是
//   逐字符协同编辑（那需要 Y.Text，超出本 feature 范围）。
// - 这一层只负责"多个已连接客户端之间的实时合并"，不是持久化层。冷启动/新用户
//   加载仍然走现有 REST（GET /api/boards/:id/items），把结果 seedItems 进来即可；
//   这里不实现 Yjs 标准的 sync protocol（客户端间交换 state vector 补历史）,
//   因为 REST 已经是权威落库来源，语义上等价且实现成本低得多。
import * as Y from "yjs";

export interface CollabItemFields {
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  type: string;
  color?: string | null;
}

export type CollabItem = { id: string } & CollabItemFields;

const FIELD_KEYS: (keyof CollabItemFields)[] = ["x", "y", "w", "h", "text", "type", "color"];

// transact 时传入的 origin：区分"这次变更是本地发起的（需要广播出去）"还是
// "这次变更是应用一个远端传来的 update（不能再广播回去，否则死循环）"。
export const LOCAL_ORIGIN = Symbol("collab:local");
export const REMOTE_ORIGIN = Symbol("collab:remote");

export function createBoardDoc(): Y.Doc {
  return new Y.Doc();
}

export function itemsMap(doc: Y.Doc): Y.Map<Y.Map<unknown>> {
  return doc.getMap("items");
}

/** 用 REST 拉到的权威快照初始化本地 doc；已存在的 key 不覆盖（避免打断已经在飞的本地编辑）。 */
export function seedItems(doc: Y.Doc, items: CollabItem[]): void {
  const map = itemsMap(doc);
  doc.transact(() => {
    for (const item of items) {
      if (map.has(item.id)) continue;
      const im = new Y.Map<unknown>();
      for (const key of FIELD_KEYS) {
        if (item[key] !== undefined) im.set(key, item[key]);
      }
      map.set(item.id, im);
    }
  }, LOCAL_ORIGIN);
}

/** 把一个 item 的（部分）字段写入 doc；item 不存在则新建。 */
export function upsertItem(doc: Y.Doc, id: string, fields: Partial<CollabItemFields>, origin: unknown = LOCAL_ORIGIN): void {
  const map = itemsMap(doc);
  doc.transact(() => {
    let im = map.get(id) as Y.Map<unknown> | undefined;
    if (!im) {
      im = new Y.Map<unknown>();
      map.set(id, im);
    }
    for (const key of FIELD_KEYS) {
      const value = fields[key];
      if (value !== undefined) im.set(key, value);
    }
  }, origin);
}

export function removeItem(doc: Y.Doc, id: string, origin: unknown = LOCAL_ORIGIN): void {
  doc.transact(() => {
    itemsMap(doc).delete(id);
  }, origin);
}

/** 把 doc 当前状态摊平成普通数组，供 React state 渲染。 */
export function readItems(doc: Y.Doc): CollabItem[] {
  const out: CollabItem[] = [];
  itemsMap(doc).forEach((im, id) => {
    const fields = (im as Y.Map<unknown>).toJSON() as Partial<CollabItemFields>;
    out.push({
      id,
      x: Number(fields.x ?? 0),
      y: Number(fields.y ?? 0),
      w: Number(fields.w ?? 0),
      h: Number(fields.h ?? 0),
      text: String(fields.text ?? ""),
      type: String(fields.type ?? "note"),
      color: (fields.color as string | null | undefined) ?? null,
    });
  });
  return out;
}

/**
 * 把当前 React items 状态里跟 doc 不一致的字段写回 doc（新增/更新/删除）。
 * 只写"真的变了"的字段——这是幂等的：如果这次 items 变化本身就是刚从远端 apply
 * 过来的（doc 已经是最新值），diff 出来是空的，不会再广播回去，不会有反馈环。
 */
export function syncItemsIntoDoc(doc: Y.Doc, items: CollabItem[]): void {
  const map = itemsMap(doc);
  const seen = new Set(items.map((it) => it.id));
  doc.transact(() => {
    for (const item of items) {
      const im = map.get(item.id) as Y.Map<unknown> | undefined;
      if (!im) {
        upsertItem(doc, item.id, item, LOCAL_ORIGIN);
        continue;
      }
      for (const key of FIELD_KEYS) {
        const next = item[key] ?? null;
        const current = im.get(key) ?? null;
        if (current !== next) im.set(key, next);
      }
    }
    for (const key of Array.from(map.keys())) {
      if (!seen.has(key)) map.delete(key);
    }
  }, LOCAL_ORIGIN);
}

/** 浏览器与 Node 都能用的 base64 编解码（不依赖 Buffer，Yjs update 是 Uint8Array）。 */
export function encodeUpdate(update: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < update.length; i += 1) binary += String.fromCharCode(update[i] as number);
  return btoa(binary);
}

export function decodeUpdate(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function applyEncodedUpdate(doc: Y.Doc, base64: string): void {
  Y.applyUpdate(doc, decodeUpdate(base64), REMOTE_ORIGIN);
}

/**
 * 编码 doc 的完整当前状态（不是增量 update）。用于"新客户端加入房间"时问在线的
 * 其它客户端要一份完整状态——这一步不能省：如果每个客户端各自独立从 REST 种子
 * 出同一个 item 的 Y.Map 实例，它们在 Yjs 眼里是两个从未同源的结构，后续增量
 * update 互相之间会因为找不到共同祖先而静默丢失（这是本文件早期版本的真实 bug，
 * 由 index.test.ts 的收敛测试抓出来的）。正确流程：新客户端先广播 sync 请求，
 * 收到已有客户端的完整状态并 applyEncodedUpdate 合并进来，之后才 seedItems
 * 补上"还没被任何在线客户端带进来"的、纯来自 REST 的新增项。
 */
export function encodeFullState(doc: Y.Doc): string {
  return encodeUpdate(Y.encodeStateAsUpdate(doc));
}

/** 订阅"本地发起的"变更，用于把 update 广播给其它客户端；返回取消订阅函数。 */
export function onLocalUpdate(doc: Y.Doc, cb: (update: Uint8Array) => void): () => void {
  const handler = (update: Uint8Array, origin: unknown) => {
    if (origin === LOCAL_ORIGIN) cb(update);
  };
  doc.on("update", handler);
  return () => doc.off("update", handler);
}

/** 订阅"远端 apply 之后"的 items 结构变化，用于把结果合并回 React state；返回取消订阅函数。 */
export function onRemoteItemsChange(doc: Y.Doc, cb: (items: CollabItem[]) => void): () => void {
  const handler = (_events: unknown, transaction: Y.Transaction) => {
    if (transaction.origin === REMOTE_ORIGIN) cb(readItems(doc));
  };
  itemsMap(doc).observeDeep(handler);
  return () => itemsMap(doc).unobserveDeep(handler);
}
