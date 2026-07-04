import { describe, it, expect } from "vitest";
import { applyCommand, applyAll, validateNewItem, type BoardItem } from "./index";

const item = (id: string, x = 0, y = 0): BoardItem => ({ id, type: "note", x, y, w: 160, h: 100, text: "" });

describe("applyCommand（纯 reducer）", () => {
  it("add 追加 item", () => {
    const out = applyCommand([], { kind: "add", item: item("a") });
    expect(out).toHaveLength(1);
    expect(out[0]!.id).toBe("a");
  });
  it("move 更新坐标，不影响其他", () => {
    const out = applyCommand([item("a"), item("b")], { kind: "move", id: "a", x: 50, y: 60 });
    expect(out.find((i) => i.id === "a")).toMatchObject({ x: 50, y: 60 });
    expect(out.find((i) => i.id === "b")).toMatchObject({ x: 0, y: 0 });
  });
  it("edit 更新文字", () => {
    const out = applyCommand([item("a")], { kind: "edit", id: "a", text: "hi" });
    expect(out[0]!.text).toBe("hi");
  });
  it("delete 移除 item", () => {
    const out = applyCommand([item("a"), item("b")], { kind: "delete", id: "a" });
    expect(out.map((i) => i.id)).toEqual(["b"]);
  });
  it("不可变：不改原数组", () => {
    const src = [item("a")];
    applyCommand(src, { kind: "move", id: "a", x: 9, y: 9 });
    expect(src[0]!.x).toBe(0);
  });
});

describe("patch（字段级更新，p6:F14）", () => {
  it("只更新 patch 里列出的字段，其余保持", () => {
    const src = [{ ...item("a", 5, 6), text: "keep" }];
    const out = applyCommand(src, { kind: "patch", id: "a", patch: { x: 50 } });
    expect(out[0]).toMatchObject({ x: 50, y: 6, text: "keep" });
  });
  it("两次不同字段的 patch 互不覆盖", () => {
    let items = [item("a")];
    items = applyCommand(items, { kind: "patch", id: "a", patch: { x: 10 } });
    items = applyCommand(items, { kind: "patch", id: "a", patch: { text: "hi" } });
    expect(items[0]).toMatchObject({ x: 10, text: "hi" });
  });
  it("patch 不能篡改 id/type", () => {
    const out = applyCommand([item("a")], {
      kind: "patch",
      id: "a",
      patch: { id: "hacked", type: "rect", x: 1 },
    });
    expect(out[0]).toMatchObject({ id: "a", type: "note", x: 1 });
  });
  it("支持 widget 专有扩展字段（CRDT-ready）", () => {
    let items = [item("a")];
    items = applyCommand(items, { kind: "patch", id: "a", patch: { color: "yellow" } });
    items = applyCommand(items, { kind: "patch", id: "a", patch: { fontSize: 14 } });
    expect(items[0]).toMatchObject({ color: "yellow", fontSize: 14 });
  });
  it("未知 id 为 no-op", () => {
    const src = [item("a")];
    const out = applyCommand(src, { kind: "patch", id: "nope", patch: { x: 99 } });
    expect(out).toEqual(src);
  });
  it("move/edit 等价于对应字段的 patch（别名语义）", () => {
    const viaMove = applyCommand([item("a")], { kind: "move", id: "a", x: 7, y: 8 });
    const viaPatch = applyCommand([item("a")], { kind: "patch", id: "a", patch: { x: 7, y: 8 } });
    expect(viaMove).toEqual(viaPatch);
  });
});

describe("applyAll", () => {
  it("折叠多个命令", () => {
    const out = applyAll([], [
      { kind: "add", item: item("a") },
      { kind: "move", id: "a", x: 10, y: 20 },
      { kind: "edit", id: "a", text: "x" },
    ]);
    expect(out[0]).toMatchObject({ id: "a", x: 10, y: 20, text: "x" });
  });
});

describe("validateNewItem", () => {
  it("合法", () => {
    expect(validateNewItem({ type: "note", x: 1, y: 2 }).ok).toBe(true);
  });
  it("非法 type / 坐标", () => {
    expect(validateNewItem({ type: "blob", x: 1, y: 2 }).ok).toBe(false);
    expect(validateNewItem({ type: "note", x: "n", y: 2 }).ok).toBe(false);
  });
});
