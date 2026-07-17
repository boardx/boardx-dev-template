import { describe, it, expect } from "vitest";
import { chatNameOrDefault, DEFAULT_CHAT_NAME, buildRoomChatMessages } from "./roomChat";

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

// uc-rr-010（p20/F11）：ai_instruction 注入路径的断言——只证明注入内容作为 system 消息
// 出现在喂给网关的消息数组里，不是对真实模型「遵循指令」效果的验证（那部分是 provider 层的事）。
// p18 room-ava F05：改用真实网关后，这条注入路径由 buildRoomChatMessages（纯函数）验证，
// 不再靠拼接固定占位字符串（avaReply 已移除）。
describe("buildRoomChatMessages — ai_instruction 注入 + 历史拼接", () => {
  it("有 ai_instruction 时最前面插入一条 system 消息，内容体现注入指令", () => {
    const messages = buildRoomChatMessages([], "你好", 1, "用简体中文回复，语气正式");
    expect(messages[0]).toMatchObject({ role: "system" });
    expect(messages[0]!.content).toContain("用简体中文回复，语气正式");
    expect(messages[messages.length - 1]).toMatchObject({ role: "user", content: "你好" });
  });

  it("无 ai_instruction（undefined/null/空串）时不插入 system 消息", () => {
    expect(buildRoomChatMessages([], "你好", 1).every((m) => m.role !== "system")).toBe(true);
    expect(buildRoomChatMessages([], "你好", 1, null).every((m) => m.role !== "system")).toBe(true);
    expect(buildRoomChatMessages([], "你好", 1, "   ").every((m) => m.role !== "system")).toBe(true);
  });

  it("历史消息按顺序拼在 system 之后、当前用户消息之前", () => {
    const history = [
      { role: "user" as const, content: "第一条" },
      { role: "assistant" as const, content: "第一条回复" },
    ];
    const messages = buildRoomChatMessages(history, "第二条", 1, "指令X");
    expect(messages).toHaveLength(4);
    expect(messages[0]).toMatchObject({ role: "system" });
    expect(messages[1]).toMatchObject({ role: "user", content: "第一条" });
    expect(messages[2]).toMatchObject({ role: "assistant", content: "第一条回复" });
    expect(messages[3]).toMatchObject({ role: "user", content: "第二条" });
  });
});
