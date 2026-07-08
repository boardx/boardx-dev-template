import { describe, it, expect } from "vitest";
import {
  applyCommand,
  applyAll,
  validateNewItem,
  isSafeLinkUrl,
  isLinkSentinel,
  linkUrlFromSentinel,
  isColorSafe,
  type BoardItem,
  type ItemPatch,
} from "./index";

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
      patch: { id: "hacked", type: "rect", x: 1 } as unknown as ItemPatch,
    });
    expect(out[0]).toMatchObject({ id: "a", type: "note", x: 1 });
  });
  it("patch:{x: undefined} 是显式字段写入，不会被当成缺省字段忽略", () => {
    const out = applyCommand([item("a", 12, 34)], {
      kind: "patch",
      id: "a",
      patch: { x: undefined },
    });
    expect(Object.prototype.hasOwnProperty.call(out[0], "x")).toBe(true);
    expect(out[0]!.x).toBeUndefined();
    expect(out[0]!.y).toBe(34);
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

// p7:F12 stored XSS 防护：链接 URL 协议白名单（默认拒绝）。
describe("isSafeLinkUrl（协议白名单）", () => {
  it("http/https 通过", () => {
    expect(isSafeLinkUrl("http://example.com")).toBe(true);
    expect(isSafeLinkUrl("https://example.com/x?a=1|b=2&c=x=y")).toBe(true);
    expect(isSafeLinkUrl("HTTPS://EXAMPLE.COM")).toBe(true); // 协议大小写归一化
  });
  it("javascript/data/vbscript 被拒（stored XSS 载荷）", () => {
    expect(isSafeLinkUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeLinkUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isSafeLinkUrl("vbscript:msgbox(1)")).toBe(false);
    expect(isSafeLinkUrl("file:///etc/passwd")).toBe(false);
  });
  it("大小写/前导空白变体被 WHATWG 归一化后仍被白名单拦下", () => {
    expect(isSafeLinkUrl("JaVaScRiPt:alert(1)")).toBe(false);
    expect(isSafeLinkUrl("  javascript:alert(1)")).toBe(false);
    expect(isSafeLinkUrl("\tjavascript:alert(1)")).toBe(false);
    expect(isSafeLinkUrl("java\nscript:alert(1)")).toBe(false); // 内嵌换行变体
  });
  it("相对路径/畸形串/空串被拒（解析失败即拒绝）", () => {
    expect(isSafeLinkUrl("/relative/path")).toBe(false);
    expect(isSafeLinkUrl("example.com")).toBe(false); // 无 scheme
    expect(isSafeLinkUrl("not a url")).toBe(false);
    expect(isSafeLinkUrl("")).toBe(false);
  });
});

describe("链接哨兵解析 + isColorSafe（服务端守门）", () => {
  const enc = (u: string) => `link|url=${encodeURIComponent(u)}`;
  it("isLinkSentinel 仅认判别头 link", () => {
    expect(isLinkSentinel("link|url=x")).toBe(true);
    expect(isLinkSentinel("amber")).toBe(false);
    expect(isLinkSentinel("amber|z=3")).toBe(false);
    expect(isLinkSentinel(null)).toBe(false);
    expect(isLinkSentinel(undefined)).toBe(false);
  });
  it("linkUrlFromSentinel 编码往返无损（含 |/= 的 URL）", () => {
    const u = "https://example.com/x?a=1|b=2&c=x=y";
    expect(linkUrlFromSentinel(enc(u))).toBe(u);
    expect(linkUrlFromSentinel("amber")).toBeNull();
  });
  it("isColorSafe 对非链接 color 一律放行（不影响既有哨兵）", () => {
    for (const c of [null, undefined, "amber", "amber:bold", "text|font=serif", "connector|from=a|to=b", "amber|z=5", "amber|locked=1"]) {
      expect(isColorSafe(c)).toBe(true);
    }
  });
  it("isColorSafe 放行 https 链接哨兵", () => {
    expect(isColorSafe(enc("https://example.com"))).toBe(true);
  });
  it("isColorSafe 拒绝 javascript/data 链接哨兵（含大小写变体）", () => {
    expect(isColorSafe(enc("javascript:alert(1)"))).toBe(false);
    expect(isColorSafe(enc("JaVaScRiPt:alert(1)"))).toBe(false);
    expect(isColorSafe(enc("data:text/html,<script>alert(1)</script>"))).toBe(false);
  });
  it("isColorSafe 拒绝缺 url 段/编码损坏的链接哨兵", () => {
    expect(isColorSafe("link")).toBe(false);
    expect(isColorSafe("link|foo=bar")).toBe(false);
    expect(isColorSafe("link|url=%E0%A4%A")).toBe(false); // 畸形百分号编码 → decode 抛错
  });
});
