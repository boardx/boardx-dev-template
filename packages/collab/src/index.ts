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

// issue #432：条目级逻辑修订号（内部字段，readItems 不暴露）。
// 语义：_rev 只统计"有意编辑"——upsertItem 的直接写入、以及 syncItemsIntoDoc 对
// **已存在**条目的字段更新（说明 React state 相对 doc 有真实变化）。
// 反之，syncItemsIntoDoc 首次把一个 doc 不认识的 id 镜像进来（可能是过期 poll 快照
// 经 setItems → useEffect 带进来的）**不**记 rev——它只是"临时占位"，权威性不如
// 后续 seedItems 带来的 REST 快照。seedItems 据此裁决：_rev===0（含旧数据缺失
// _rev 的情况，向后兼容按 0 处理）的条目可以被权威快照覆盖；_rev>0 的条目有过
// 有意编辑，跳过不覆盖（保留"不打断在飞编辑"的原语义）。
// 并发场景下 _rev 本身也是 Y.Map 字段，由 Yjs LWW 裁决，无需全局协调。
const REV_KEY = "_rev";

function revOf(im: Y.Map<unknown>): number {
  const raw = im.get(REV_KEY);
  return typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
}

function bumpRev(im: Y.Map<unknown>): void {
  im.set(REV_KEY, revOf(im) + 1);
}

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

/**
 * 用 REST 拉到的权威快照初始化本地 doc。
 *
 * 覆盖裁决（issue #432 的根治点）：
 * - id 不存在 → 新建（原行为）。
 * - id 已存在且 _rev > 0 → 跳过（该条目有过本地/远端的**有意编辑**，REST 快照
 *   可能落后于这些编辑，不能覆盖——保留"不打断在飞编辑"的原语义）。
 * - id 已存在但 _rev === 0（含无 _rev 的旧条目）→ 用快照覆盖差异字段。这类条目
 *   只被 syncItemsIntoDoc 的"新 id 镜像"占位过（典型来源：poll() 在创建与首次
 *   PATCH 之间 GET 到的过期快照），而 seedItems 的调用方拿到的是更新的 REST
 *   权威快照，覆盖才能让正确值收敛，否则过期值永久卡死（#432 的原始病灶就是
 *   这里对已存在 id 无脑 continue）。
 * 覆盖时只写真正不同的字段（幂等，不产生空 update 广播），且不 bump _rev——
 * seed 不是编辑，多次 seed 之间仍按"最新快照胜出"。
 */
export function seedItems(doc: Y.Doc, items: CollabItem[]): void {
  const map = itemsMap(doc);
  doc.transact(() => {
    for (const item of items) {
      const existing = map.get(item.id) as Y.Map<unknown> | undefined;
      if (existing) {
        if (revOf(existing) > 0) continue; // 有过有意编辑，权威快照也不覆盖
        for (const key of FIELD_KEYS) {
          const value = item[key];
          if (value === undefined) continue;
          if (existing.get(key) !== value) existing.set(key, value);
        }
        continue;
      }
      const im = new Y.Map<unknown>();
      for (const key of FIELD_KEYS) {
        if (item[key] !== undefined) im.set(key, item[key]);
      }
      map.set(item.id, im);
    }
  }, LOCAL_ORIGIN);
}

/**
 * 把一个 item 的（部分）字段写入 doc；item 不存在则新建。
 * 这是"有意编辑"通道（拖动/改色/board-canvas 的直写缓解都走这里）：
 * 实际写入任何字段时 bump _rev，此后 seedItems 不会再用 REST 快照覆盖该条目。
 */
export function upsertItem(doc: Y.Doc, id: string, fields: Partial<CollabItemFields>, origin: unknown = LOCAL_ORIGIN): void {
  const map = itemsMap(doc);
  doc.transact(() => {
    let im = map.get(id) as Y.Map<unknown> | undefined;
    if (!im) {
      im = new Y.Map<unknown>();
      map.set(id, im);
    }
    let wrote = false;
    for (const key of FIELD_KEYS) {
      const value = fields[key];
      if (value !== undefined) {
        im.set(key, value);
        wrote = true;
      }
    }
    if (wrote) bumpRev(im);
  }, origin);
}

export function removeItem(doc: Y.Doc, id: string, origin: unknown = LOCAL_ORIGIN): void {
  doc.transact(() => {
    itemsMap(doc).delete(id);
  }, origin);
}

/** 把 doc 当前状态摊平成普通数组，供 React state 渲染。只挑 FIELD_KEYS 白名单字段，内部字段（_rev）不外泄。 */
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
        // doc 里第一次出现这个 id：只是把 React state 镜像进来占位，state 里这份
        // 数据可能来自过期的 poll 快照（issue #432 的入侵路径），所以**不** bump
        // _rev——保持 rev=0，让后续 seedItems 的权威 REST 快照有权覆盖它。
        const created = new Y.Map<unknown>();
        for (const key of FIELD_KEYS) {
          if (item[key] !== undefined) created.set(key, item[key]);
        }
        map.set(item.id, created);
        continue;
      }
      // 已存在条目的字段更新 = React state 相对 doc 有真实变化 = 有意编辑，bump _rev。
      let changed = false;
      for (const key of FIELD_KEYS) {
        const next = item[key] ?? null;
        const current = im.get(key) ?? null;
        if (current !== next) {
          im.set(key, next);
          changed = true;
        }
      }
      if (changed) bumpRev(im);
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
