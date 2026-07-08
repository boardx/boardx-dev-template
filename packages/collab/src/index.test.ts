import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  applyEncodedUpdate,
  createBoardDoc,
  decodeUpdate,
  encodeFullState,
  encodeUpdate,
  itemsMap,
  onLocalUpdate,
  readItems,
  reconcileLocalEdits,
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

  // issue #432 精确复现：创建后立即 PATCH 的字段被 poll() 的过期快照卡死。
  // 时序：
  //   1. addShape POST 创建 item（此时还没有 color），紧接着发 PATCH color（未落库）。
  //   2. 后台 poll() 恰好在 PATCH 落库前 GET 到"无 color"的过期快照 → setItems →
  //      useEffect 把它经 syncItemsIntoDoc 镜像进 doc（doc 里第一次出现这个 id）。
  //   3. PATCH 落库后 load() 拿到正确快照（color=circle）→ maybeSeed → seedItems。
  //      修复前 seedItems 对已存在的 id 无脑跳过 → 正确值永远进不了 doc（红）。
  //      修复后 seedItems 发现该条目 _rev=0（只被 stale 镜像创建过，没有任何
  //      本地/远端有意编辑）→ 用权威 REST 快照覆盖（绿）。
  it("issue #432：过期快照经 syncItemsIntoDoc 先入 doc 后，seedItems 的权威快照必须能覆盖它", () => {
    const doc = createBoardDoc();
    // 步骤 2：过期快照（POST 刚建出来、PATCH 还没落库，color 为空）先进 doc。
    const staleSnapshot = [{ id: "shape-1", x: 10, y: 10, w: 40, h: 40, text: "", type: "note", color: null }];
    syncItemsIntoDoc(doc, staleSnapshot);
    expect(readItems(doc).find((i) => i.id === "shape-1")?.color).toBeNull();
    // 步骤 3：PATCH 落库后的权威快照（color=circle 哨兵）再 seed 进来。
    const freshSnapshot = [{ id: "shape-1", x: 10, y: 10, w: 40, h: 40, text: "", type: "note", color: "circle" }];
    seedItems(doc, freshSnapshot);
    // 断言最终值是正确值——修复前这里读到 null（永久卡死），修复后读到 circle。
    expect(readItems(doc).find((i) => i.id === "shape-1")?.color).toBe("circle");
  });

  it("issue #432 边界：有过有意编辑（_rev>0）的条目，seedItems 仍不覆盖", () => {
    const doc = createBoardDoc();
    seedItems(doc, [{ id: "1", x: 0, y: 0, w: 10, h: 10, text: "a", type: "note", color: null }]);
    // 用户真实编辑（upsertItem 有意写入 → _rev 递增）。
    upsertItem(doc, "1", { color: "blue" });
    // 一份不含该编辑的旧快照再 seed：不能把用户的编辑冲掉。
    seedItems(doc, [{ id: "1", x: 0, y: 0, w: 10, h: 10, text: "a", type: "note", color: null }]);
    expect(readItems(doc).find((i) => i.id === "1")?.color).toBe("blue");
  });

  it("issue #432 边界：syncItemsIntoDoc 更新已存在条目的字段算有意编辑，之后 seedItems 不覆盖", () => {
    const doc = createBoardDoc();
    seedItems(doc, [{ id: "1", x: 0, y: 0, w: 10, h: 10, text: "a", type: "note", color: null }]);
    // React state 里用户把 text 改了 → 镜像进 doc（更新已存在条目 = 有意编辑，_rev 递增）。
    syncItemsIntoDoc(doc, [{ id: "1", x: 0, y: 0, w: 10, h: 10, text: "edited", type: "note", color: null }]);
    seedItems(doc, [{ id: "1", x: 0, y: 0, w: 10, h: 10, text: "stale", type: "note", color: null }]);
    expect(readItems(doc).find((i) => i.id === "1")?.text).toBe("edited");
  });

  it("_rev 是内部字段：readItems 不暴露它", () => {
    const doc = createBoardDoc();
    upsertItem(doc, "1", { x: 1, y: 2, w: 3, h: 4, text: "t", type: "note", color: null });
    const item = readItems(doc).find((i) => i.id === "1");
    expect(item).toBeDefined();
    expect(Object.keys(item as object).sort()).toEqual(["color", "h", "id", "text", "type", "w", "x", "y"]);
  });

  it("向后兼容：doc 里没有 _rev 的旧条目按 rev=0 处理（seed 可覆盖，不崩）", () => {
    const doc = createBoardDoc();
    // 手工构造一个"旧版本代码写入的"条目：没有 _rev 字段。
    const map = itemsMap(doc);
    doc.transact(() => {
      const legacy = new Y.Map<unknown>();
      legacy.set("x", 0);
      legacy.set("y", 0);
      legacy.set("w", 10);
      legacy.set("h", 10);
      legacy.set("text", "legacy");
      legacy.set("type", "note");
      map.set("old-1", legacy as Y.Map<unknown>);
    });
    expect(() => seedItems(doc, [{ id: "old-1", x: 5, y: 5, w: 10, h: 10, text: "fresh", type: "note", color: null }])).not.toThrow();
    expect(readItems(doc).find((i) => i.id === "old-1")?.text).toBe("fresh");
  });

  // issue #414 残留根因精确复现：
  //   1. 组件创建走 upsertItem 直写 doc（立即 bump _rev>0）——模拟 board-canvas 里
  //      新建文本/形状/连接线等 widget 时的直写通道。
  //   2. join-sync 完成前，用户连续做了几次样式编辑（font→size→italic→align），
  //      itemsRef.current 已经是最新值，但常规 [items] effect 落 doc 的通道被
  //      joinSyncedRef 门禁挡住，doc 里的 color 字段还停留在步骤 1 的旧值。
  //   3. join-sync 完成，maybeSeed() 依次调 seedItems + reconcileLocalEdits。
  //      修复前只有 seedItems：因为 _rev>0，样式编辑被当成"过期快照"跳过，doc
  //      永久卡在旧 color，随后 mergeRemoteItems 会用这份旧值把 React state 回滚。
  //      修复后 reconcileLocalEdits 用 itemsRef.current（真正的最新本地值）
  //      无条件补写差异字段，doc 收敛到正确值。
  it("issue #414：join-sync 完成前的样式编辑不能被 seedItems 的 _rev 门禁挡在 doc 外", () => {
    const doc = createBoardDoc();
    // 步骤 1：创建 widget，直写 doc，_rev 被顶到 1。
    upsertItem(doc, "widget-1", { x: 0, y: 0, w: 40, h: 40, text: "", type: "text", color: "text" });
    // 步骤 2：join-sync 完成前的本地样式编辑链（font→size→italic→align 叠加在同一个 color 字段上），
    // 只反映在 itemsRef.current 里，doc 完全不知道。
    const itemsRef: import("./index").CollabItem[] = [
      { id: "widget-1", x: 0, y: 0, w: 40, h: 40, text: "", type: "text", color: "text|font=serif|size=18|italic=1|align=right" },
    ];
    // 修复前的行为：seedItems 因为 _rev>0 跳过，doc 停留在创建时的旧 color。
    seedItems(doc, itemsRef);
    expect(readItems(doc).find((i) => i.id === "widget-1")?.color).toBe("text");
    // 修复：reconcileLocalEdits 无条件补写差异字段，doc 收敛到真正的最新本地值。
    reconcileLocalEdits(doc, itemsRef);
    expect(readItems(doc).find((i) => i.id === "widget-1")?.color).toBe(
      "text|font=serif|size=18|italic=1|align=right",
    );
  });

  it("reconcileLocalEdits 不新建条目（新 id 交给 seedItems 负责），也不删除 doc 里存在但 items 未提及的条目", () => {
    const doc = createBoardDoc();
    upsertItem(doc, "1", { x: 0, y: 0, w: 10, h: 10, text: "a", type: "note", color: null });
    reconcileLocalEdits(doc, [{ id: "brand-new", x: 1, y: 1, w: 1, h: 1, text: "", type: "note", color: null }]);
    expect(readItems(doc).find((i) => i.id === "brand-new")).toBeUndefined();
    expect(readItems(doc).find((i) => i.id === "1")).toBeDefined();
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
