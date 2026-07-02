import { describe, it, expect } from "vitest";
import { titleFromMessage, DEFAULT_AVA_THREAD_TITLE } from "./avaChat";

// 纯函数单测：标题派生逻辑（真实 DB 交互由 harness verify + docker e2e 覆盖）。
describe("titleFromMessage", () => {
  it("短文本原样作为标题（去首尾空白）", () => {
    expect(titleFromMessage("  帮我规划这周的工作  ")).toBe("帮我规划这周的工作");
  });

  it("超过 60 字截断并加省略号", () => {
    const long = "a".repeat(80);
    const title = titleFromMessage(long);
    expect(title.endsWith("…")).toBe(true);
    expect(title.length).toBe(61);
  });

  it("空字符串回退默认标题", () => {
    expect(titleFromMessage("")).toBe(DEFAULT_AVA_THREAD_TITLE);
  });

  it("全空白回退默认标题", () => {
    expect(titleFromMessage("   \n\t  ")).toBe(DEFAULT_AVA_THREAD_TITLE);
  });

  it("内部多余空白折叠为单空格", () => {
    expect(titleFromMessage("hello   world")).toBe("hello world");
  });
});
