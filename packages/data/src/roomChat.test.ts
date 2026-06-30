import { describe, it, expect } from "vitest";
import { chatNameOrDefault, DEFAULT_CHAT_NAME } from "./roomChat";

describe("chatNameOrDefault", () => {
  it("非空名去空白返回", () => {
    expect(chatNameOrDefault("  Plan  ")).toBe("Plan");
  });
  it("空/空白/null 回退默认", () => {
    expect(chatNameOrDefault("")).toBe(DEFAULT_CHAT_NAME);
    expect(chatNameOrDefault("   ")).toBe(DEFAULT_CHAT_NAME);
    expect(chatNameOrDefault(null)).toBe(DEFAULT_CHAT_NAME);
    expect(chatNameOrDefault(undefined)).toBe(DEFAULT_CHAT_NAME);
  });
});
