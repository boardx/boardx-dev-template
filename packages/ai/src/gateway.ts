// packages/ai/src/gateway.ts — CAP-AI LiteLLM 风格网关（P9 F01 地基）
//
// 统一多供应商模型调用接口：调用方只认 modelId + messages，网关按 modelId 前缀路由到
// 具体 provider（真实 provider 接入见 notes；本 feature 默认注册一个 stub provider，
// 使上层可在无真实供应商额度的情况下跑通端到端流式回复 —— sanctioned in F01 notes）。
//
// Provider 契约：一个异步生成器，逐 token yield 字符串；调用方将其转成 SSE。

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface StreamChatInput {
  modelId: string;
  messages: ChatMessage[];
  settings?: {
    agentId: string;
    toolIds: string[];
  };
}

export type TokenStream = AsyncGenerator<string, void, void>;

export interface ChatProvider {
  /** provider 能处理的 modelId 前缀（如 "stub:"、"claude-"、"gpt-"）。 */
  matches(modelId: string): boolean;
  /** 逐 token 流式生成；失败时抛错误，调用方负责落库失败态。 */
  streamChat(input: StreamChatInput): TokenStream;
}

export const DEFAULT_MODEL_ID = "stub:default";

/** e2e/测试专用触发词：用户消息包含此串时 stub provider 主动抛错，
 *  用于确定性地验证「生成失败展示失败态且不丢用户输入」（F01 验收）。
 *  真实 provider 不识别此串，不影响生产语义。 */
export const FORCE_FAIL_MARKER = "__ava_force_fail__";

/** stub provider：确定性回显 + 简单 Markdown/代码块示例，用于 e2e 与无供应商额度环境。 */
export const stubProvider: ChatProvider = {
  matches(modelId: string) {
    return modelId.startsWith("stub:");
  },
  async *streamChat({ modelId, messages, settings }: StreamChatInput): TokenStream {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const text = (lastUser?.content ?? "").trim();
    if (text.includes(FORCE_FAIL_MARKER)) {
      throw new Error("stub provider: 强制失败（测试触发）");
    }
    const reply = buildStubReply(text, {
      modelId,
      agentId: settings?.agentId ?? "default",
      toolIds: settings?.toolIds ?? [],
    });
    // 按小块切分模拟逐 token 流式（真实 provider 由底层 SDK 决定切分粒度）。
    const chunks = reply.match(/.{1,4}/gs) ?? [reply];
    for (const chunk of chunks) {
      yield chunk;
    }
  },
};

/** 构造 stub 回复：包含纯文本 + Markdown 标题/列表 + 代码块，覆盖渲染断言面。 */
export function buildStubReply(
  userText: string,
  settings: { modelId?: string; agentId?: string; toolIds?: string[] } = {}
): string {
  const quoted = userText.length > 200 ? `${userText.slice(0, 200)}…` : userText;
  const modelId = settings.modelId ?? DEFAULT_MODEL_ID;
  const agentId = settings.agentId ?? "default";
  const tools = settings.toolIds && settings.toolIds.length > 0 ? settings.toolIds.join(", ") : "none";
  return [
    `## 收到`,
    ``,
    `这是 AVA 的 stub 回复（未接入真实模型）。你说：「${quoted}」。`,
    ``,
    `模型：${modelId}`,
    `Agent：${agentId}`,
    `工具：${tools}`,
    ``,
    `- 要点一`,
    `- 要点二`,
    ``,
    "```ts",
    "console.log('hello from AVA stub');",
    "```",
  ].join("\n");
}

export class ChatGateway {
  private providers: ChatProvider[] = [];

  constructor(providers: ChatProvider[] = [stubProvider]) {
    this.providers = providers;
  }

  registerProvider(provider: ChatProvider): void {
    this.providers.unshift(provider);
  }

  resolveProvider(modelId: string): ChatProvider {
    const found = this.providers.find((p) => p.matches(modelId));
    if (!found) throw new Error(`没有匹配 modelId 的 provider: ${modelId}`);
    return found;
  }

  streamChat(input: StreamChatInput): TokenStream {
    return this.resolveProvider(input.modelId).streamChat(input);
  }
}

/** 默认单例网关（进程内共享，注册全部已知 provider）。 */
export const defaultGateway = new ChatGateway([stubProvider]);
