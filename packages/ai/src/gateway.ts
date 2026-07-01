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
  async *streamChat({ messages }: StreamChatInput): TokenStream {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const text = (lastUser?.content ?? "").trim();
    if (text.includes(FORCE_FAIL_MARKER)) {
      throw new Error("stub provider: 强制失败（测试触发）");
    }
    const reply = buildStubReply(text);
    // 按小块切分模拟逐 token 流式（真实 provider 由底层 SDK 决定切分粒度）。
    const chunks = reply.match(/.{1,4}/gs) ?? [reply];
    for (const chunk of chunks) {
      yield chunk;
    }
  },
};

// 消息路由（apps/web .../messages/route.ts）在用户文本末尾拼接 `[附件: a.png、b.pdf]`
// 作为附件上下文提示（P9 F08：stub provider 无需真实多模态理解，引用附件存在/文件名即可）。
const ATTACHMENT_MARKER_RE = /\n\n\[附件: (.+)\]$/;

/** 构造 stub 回复：包含纯文本 + Markdown 标题/列表 + 代码块，覆盖渲染断言面。
 *  若用户文本携带附件上下文标记，回复里显式提及附件文件名，供 F08 验证 AI 感知到附件。 */
export function buildStubReply(userText: string): string {
  const attachmentMatch = userText.match(ATTACHMENT_MARKER_RE);
  const bodyText = attachmentMatch ? userText.replace(ATTACHMENT_MARKER_RE, "") : userText;
  const quoted = bodyText.length > 200 ? `${bodyText.slice(0, 200)}…` : bodyText;
  const attachmentLine = attachmentMatch
    ? `\n\n我看到你附上了 ${attachmentMatch[1]}，已一并考虑。`
    : "";
  return [
    `## 收到`,
    ``,
    `这是 AVA 的 stub 回复（未接入真实模型）。你说：「${quoted}」。${attachmentLine}`,
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
