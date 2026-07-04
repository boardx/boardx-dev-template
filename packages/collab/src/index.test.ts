import { describe, expect, it } from "vitest";
import {
  applyEncodedUpdate,
  createBoardDoc,
  decodeUpdate,
  encodeFullState,
  encodeUpdate,
  onLocalUpdate,
  readItems,
  removeItem,
  seedItems,
  syncItemsIntoDoc,
  upsertItem,
} from "./index";

// 模拟两个客户端：本地 update 广播给对方（跳过真实 WS），验证最终收敛一致。
function link(a: ReturnType<typeof createBoardDoc>, b: ReturnType<typeof createBoardDoc>) {
  const offA = onLocalUpdate(a, (update) => applyEncodedUpdate(b, encodeUpdate(update)));
  const offB = onLocalUpdate(b, (update) => applyEncodedUpdate(a, encodeUpdate(update)));
  return () => {
    offA();
    offB();
  };
}

// 模拟"B 加入房间时从已在线的 A 拿一份完整状态"——这是让两端后续增量 update 能
// 正确合并的前提：如果双方各自独立 seedItems 出同一个 item，会得到互不相识的
// Y.Map 实例，后续字段级增量会因为找不到共同祖先而静默丢失（真实发生过，见下方
// 用例的历史教训）。
function joinFrom(existing: ReturnType<typeof createBoardDoc>, joining: ReturnType<typeof createBoardDoc>) {
  applyEncodedUpdate(joining, encodeFullState(existing));
}

describe("@repo/collab board doc", () => {
  it("seedItems 建立初始状态，不覆盖已存在的 key", () => {
    const doc = createBoardDoc();
    seedItems(doc, [{ id: "1", x: 0, y: 0, w: 10, h: 10, text: "a", type: "note", color: null }]);
    upsertItem(doc, "1", { text: "edited-locally" });
    // 重新 seed 同一个 id：不应该把本地已经改过的字段覆盖回去。
    seedItems(doc, [{ id: "1", x: 0, y: 0, w: 10, h: 10, text: "from-server", type: "note", color: null }]);
    expect(readItems(doc).find((i) => i.id === "1")?.text).toBe("edited-locally");
  });

  it("两个 doc 通过 update 广播收敛到同一状态（不同 item 并发新增）", () => {
    const a = createBoardDoc();
    const b = createBoardDoc();
    const unlink = link(a, b);
    upsertItem(a, "1", { x: 0, y: 0, w: 10, h: 10, text: "from-a", type: "note", color: null });
    upsertItem(b, "2", { x: 5, y: 5, w: 10, h: 10, text: "from-b", type: "note", color: null });
    unlink();
    const itemsA = readItems(a).sort((x, y) => x.id.localeCompare(y.id));
    const itemsB = readItems(b).sort((x, y) => x.id.localeCompare(y.id));
    expect(itemsA).toEqual(itemsB);
    expect(itemsA.map((i) => i.id)).toEqual(["1", "2"]);
  });

  it("同一 item 的不同字段被两端并发修改时按字段合并，而不是整条互相覆盖", () => {
    const a = createBoardDoc();
    const b = createBoardDoc();
    seedItems(a, [{ id: "1", x: 0, y: 0, w: 10, h: 10, text: "hello", type: "note", color: null }]);
    joinFrom(a, b); // B 通过"加入同步"获得跟 A 同源的 item 结构，而不是自己独立 seed 一份
    const unlink = link(a, b);
    upsertItem(a, "1", { x: 99 }); // A 只改位置
    upsertItem(b, "1", { color: "blue" }); // B 只改颜色（跟 A 的字段不相交）
    unlink();
    const itemA = readItems(a).find((i) => i.id === "1");
    const itemB = readItems(b).find((i) => i.id === "1");
    expect(itemA).toEqual(itemB);
    expect(itemA?.x).toBe(99);
    expect(itemA?.color).toBe("blue");
  });

  it("removeItem 广播后对方也会删除该条目", () => {
    const a = createBoardDoc();
    const b = createBoardDoc();
    seedItems(a, [{ id: "1", x: 0, y: 0, w: 10, h: 10, text: "hi", type: "note", color: null }]);
    joinFrom(a, b);
    const unlink = link(a, b);
    removeItem(a, "1");
    unlink();
    expect(readItems(b)).toEqual([]);
  });

  it("syncItemsIntoDoc 是幂等的：值不变时不产生新的 update（不会造成广播反馈环）", () => {
    const doc = createBoardDoc();
    seedItems(doc, [{ id: "1", x: 0, y: 0, w: 10, h: 10, text: "hi", type: "note", color: null }]);
    let updates = 0;
    const off = onLocalUpdate(doc, () => {
      updates += 1;
    });
    syncItemsIntoDoc(doc, readItems(doc)); // 用 doc 自己当前的状态回写自己：应该是空 diff
    off();
    expect(updates).toBe(0);
  });

  it("encode/decode update 往返一致", () => {
    const doc = createBoardDoc();
    let captured: Uint8Array | null = null;
    const off = onLocalUpdate(doc, (u) => {
      captured = u;
    });
    upsertItem(doc, "1", { x: 1, y: 2, w: 3, h: 4, text: "t", type: "note", color: null });
    off();
    expect(captured).not.toBeNull();
    const roundtrip = decodeUpdate(encodeUpdate(captured as unknown as Uint8Array));
    expect(roundtrip).toEqual(captured);
  });
});
