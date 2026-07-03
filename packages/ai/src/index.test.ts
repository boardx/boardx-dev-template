import { describe, it, expect } from "vitest";
import { ChatGateway, stubProvider, buildStubReply, DEFAULT_MODEL_ID, FORCE_FAIL_MARKER } from "./gateway";
import { runChatGraph, makeGenerateNode } from "./graph";

describe("buildStubReply", () => {
  it("包含用户原文引用", () => {
    expect(buildStubReply("帮我规划这周的工作")).toContain("帮我规划这周的工作");
  });

  it("包含 Markdown 标题与代码块，覆盖渲染断言面", () => {
    const reply = buildStubReply("x");
    expect(reply).toContain("##");
    expect(reply).toContain("```ts");
  });

  it("超长输入被截断", () => {
    const long = "a".repeat(500);
    const reply = buildStubReply(long);
    expect(reply).toContain("…");
  });

  it("携带画布内容标记时，回复中真实引用画布上的具体文字（p17-F01 Board AI）", () => {
    const reply = buildStubReply("总结一下这个画布\n\n[画布内容: 1. 预算方案-Q3-123456]");
    expect(reply).toContain("预算方案-Q3-123456");
    expect(reply).not.toContain("[画布内容:");
  });

  it("无画布内容标记时不虚构画布内容引用", () => {
    const reply = buildStubReply("总结一下这个画布");
    expect(reply).not.toContain("画布内容参考");
  });
});

describe("ChatGateway", () => {
  it("默认注册 stub provider，按 modelId 前缀路由", () => {
    const gw = new ChatGateway([stubProvider]);
    expect(gw.resolveProvider(DEFAULT_MODEL_ID)).toBe(stubProvider);
  });

  it("未匹配的 modelId 抛错", () => {
    const gw = new ChatGateway([stubProvider]);
    expect(() => gw.resolveProvider("unknown:model")).toThrow();
  });

  it("streamChat 逐 token 产出完整回复", async () => {
    const gw = new ChatGateway([stubProvider]);
    const tokens: string[] = [];
    for await (const t of gw.streamChat({ modelId: DEFAULT_MODEL_ID, messages: [{ role: "user", content: "hi" }] })) {
      tokens.push(t);
    }
    expect(tokens.join("")).toContain("hi");
  });

  it("消息含强制失败触发词时 streamChat 抛错（用于确定性验证失败态）", async () => {
    const gw = new ChatGateway([stubProvider]);
    const iter = gw.streamChat({
      modelId: DEFAULT_MODEL_ID,
      messages: [{ role: "user", content: `触发失败 ${FORCE_FAIL_MARKER}` }],
    });
    await expect(iter.next()).rejects.toThrow();
  });
});

describe("runChatGraph", () => {
  it("generate 节点产出 reply 时图返回该 reply", async () => {
    const node = makeGenerateNode(stubProvider.streamChat.bind(stubProvider));
    const result = await runChatGraph(
      { threadId: 1, messages: [{ role: "user", content: "测试" }], modelId: DEFAULT_MODEL_ID },
      node
    );
    expect(result.reply).toContain("测试");
  });

  it("onToken 回调收到逐 token 流", async () => {
    const node = makeGenerateNode(stubProvider.streamChat.bind(stubProvider));
    const seen: string[] = [];
    await runChatGraph(
      {
        threadId: 1,
        messages: [{ role: "user", content: "流式" }],
        modelId: DEFAULT_MODEL_ID,
        onToken: (t) => seen.push(t),
      },
      node
    );
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.join("")).toContain("流式");
  });

  it("generate 节点抛错时向上传播（调用方负责失败态）", async () => {
    const failingNode = async () => {
      throw new Error("provider down");
    };
    await expect(
      runChatGraph({ threadId: 1, messages: [], modelId: DEFAULT_MODEL_ID }, failingNode)
    ).rejects.toThrow("provider down");
  });
});
