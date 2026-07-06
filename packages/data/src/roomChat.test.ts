import { describe, it, expect } from "vitest";
import { chatNameOrDefault, DEFAULT_CHAT_NAME, avaReply } from "./roomChat";

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

// uc-rr-010（p20/F11）：ai_instruction 注入路径的桩层断言——只证明注入内容出现在回复里，
// 不是对真实模型「遵循指令」效果的验证（那部分在 p9 真链路阶段）。
describe("avaReply — ai_instruction 注入", () => {
  it("有 ai_instruction 时回复体现注入内容", () => {
    const reply = avaReply("你好", 1, "用简体中文回复，语气正式");
    expect(reply).toContain("用简体中文回复，语气正式");
  });
  it("无 ai_instruction（undefined/null/空串）时不追加注入片段", () => {
    expect(avaReply("你好", 1)).not.toContain("系统提示注入");
    expect(avaReply("你好", 1, null)).not.toContain("系统提示注入");
    expect(avaReply("你好", 1, "   ")).not.toContain("系统提示注入");
  });
});
