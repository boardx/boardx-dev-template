// packages/ai/src/gateway.ts — CAP-AI 模型网关（P9 F01 地基；P18 F01 接入真实 provider）
//
// 这是一个自研的极简前缀路由网关（不是 LiteLLM，也不依赖任何 SDK）：调用方只认
// modelId + messages，网关按 modelId 前缀路由到具体 provider。
// 已注册 provider：
//   - anthropicProvider（anthropic: 前缀，真实 Anthropic Messages API，见 anthropicProvider.ts）
//   - stubProvider（stub: 前缀，确定性回显，供 CI/e2e 在无供应商额度下跑通端到端）
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
  /** P18 F02：停止生成。传入时 provider 应把它接到真实的中断点（如 fetch 的 signal），
   *  使请求被真实取消而非等待完整回显后再丢弃结果。可选：stub provider 忽略它也不影响正确性
   *  （逐块 yield 本身很快，真正需要真实中断的是走网络的 provider）。 */
  signal?: AbortSignal;
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

/** P18 F04：Deep Research 生成请求的系统提示词标记。researchGenerator.ts 把它作为
 *  system 消息的前缀传给网关；stub provider 识别到这个标记时，走研究 JSON 生成分支
 *  （buildStubResearchJson），而不是聊天式回显——两者共用同一个 stub provider 实例，
 *  不需要为研究场景另起一个 provider。放在网关这里（而不是 researchGenerator.ts）
 *  是为了避免 gateway.ts ↔ researchGenerator.ts 的循环 import。 */
export const RESEARCH_JSON_SYSTEM_MARKER = "__ava_research_json_system__";

/** e2e/测试专用触发词：研究主题含此串时研究生成主动抛错（同 FORCE_FAIL_MARKER 的
 *  sanctioned 模式），用于确定性验证"真实生成失败"分支。定义在这里（而不是
 *  researchGenerator.ts）同样是为了避免循环 import——researchGenerator.ts 从这里
 *  重新导出。 */
export const RESEARCH_FORCE_FAIL_MARKER = "__ava_research_generate_fail__";

// p18-F05：stub 报告双模板的判定关键词——含这些词的 topic/audience 走 user-research
// 模板（Summary/Personas/Top pain points/Opportunities），否则走 market 模板
// （Executive summary/Key findings/Recommendation）。与 researchGenerator.ts 的
// inferResearchType 是同一套判定口径（真实 provider 场景），这里是 stub 场景下确定性地
// 覆盖两条模板路径，供 e2e 在 mock-provider 模式下验证两套字段分别正确渲染。
const STUB_USER_RESEARCH_HINTS = [
  "user research",
  "persona",
  "user interview",
  "customer interview",
  "pain point",
  "usability",
  "用户研究",
  "用户访谈",
  "用户画像",
];

/** stub provider 专用：当请求携带 RESEARCH_JSON_SYSTEM_MARKER 时，从用户提示词里的
 *  topic/audience 派生出确定性但随主题变化的 JSON 文本，使 e2e 在 mock-provider 模式下
 *  也能验证"不同主题产出不同内容"。真实 provider（anthropicProvider）不识别这个标记，
 *  按提示词真实生成。 */
function buildStubResearchJson(userPrompt: string): string {
  const topicMatch = userPrompt.match(/Research topic:\s*(.+)/);
  const audienceMatch = userPrompt.match(/Target audience:\s*(.+)/);
  const topic = (topicMatch?.[1] ?? "the given topic").trim();
  const audience = (audienceMatch?.[1] ?? "the target audience").trim();

  const slug = topic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  const keyword = slug[0] ?? "topic";
  const secondKeyword = slug[1] ?? keyword;

  // 只看 topic，不看 audience：前端 composer 目前对所有研究请求都发送同一句固定的
  // audience 文案（含 "user research" 四个字，见 apps/web/app/(app)/ava/page.tsx 的
  // RESEARCH_AUDIENCE 常量），把 audience 也纳入判定会导致所有请求都被误判成
  // user-research，market 模板永远测不到——与 researchGenerator.ts 的 inferResearchType
  // 同一个坑、同一个修法。
  const haystack = topic.toLowerCase();
  const researchType = STUB_USER_RESEARCH_HINTS.some((hint) => haystack.includes(hint))
    ? "user-research"
    : "market";

  const sections =
    researchType === "market"
      ? [
          {
            heading: "Key findings",
            bullets: [
              `Stakeholders in ${audience} need a clearer reason tied to ${keyword} than broad claims.`,
              `Research should compare current workaround cost against ${secondKeyword} gains.`,
              "The next interview round should prioritize high-frequency, high-signal participants.",
            ],
          },
          {
            heading: "Recommended next steps",
            bullets: [
              `Confirm the primary audience for ${keyword} with five targeted interviews.`,
              `Prototype one ${secondKeyword}-specific message and measure comprehension.`,
              "Track follow-up objections in the same AVA thread.",
            ],
          },
        ]
      : [
          {
            heading: "Interview themes",
            bullets: [
              `Participants in ${audience} describe ${keyword} as a recurring friction point.`,
              `Workarounds around ${secondKeyword} reveal unmet needs worth prototyping.`,
              "Recruit high-frequency users for the next round of interviews.",
            ],
          },
          {
            heading: "Opportunity areas",
            bullets: [
              `Simplify the ${keyword} workflow to remove the most-cited pain point.`,
              `Explore a lightweight ${secondKeyword} feature to close the gap.`,
              "Validate opportunities with a follow-up usability test.",
            ],
          },
        ];

  const report =
    researchType === "market"
      ? {
          researchType,
          title: `Deep Research Report: ${topic}`,
          conclusion: `For "${topic}", the strongest opportunity is to narrow the ${keyword} segment, validate the top workflow pain around ${secondKeyword}, and test one focused positioning angle before expanding scope.`,
          sections,
          keyFindings: [
            `Stakeholders in ${audience} need a clearer reason tied to ${keyword} than broad claims.`,
            `Current workaround cost around ${secondKeyword} outweighs perceived switching effort.`,
            "High-frequency, high-signal participants should anchor the next validation round.",
          ],
          recommendation: `Prioritize the ${keyword} segment, validate the ${secondKeyword} pain point with five targeted interviews, and ship one focused positioning test before expanding scope.`,
        }
      : {
          researchType,
          title: `Deep Research Report: ${topic}`,
          conclusion: `Users in ${audience} consistently struggle with ${keyword}; the clearest opportunity is to address the ${secondKeyword} workaround before expanding scope.`,
          sections,
          personas: [
            `${audience} member evaluating ${keyword} day-to-day`,
            `Power user who has already built a ${secondKeyword} workaround`,
            `New user encountering ${keyword} for the first time`,
          ],
          topPainPoints: [
            `${keyword} requires too many manual steps for ${audience}.`,
            `Workarounds around ${secondKeyword} are fragile and error-prone.`,
            "Onboarding does not explain the intended workflow clearly.",
          ],
          opportunities: [
            `Simplify the ${keyword} workflow to remove the most-cited pain point.`,
            `Ship a guided ${secondKeyword} flow to replace the fragile workaround.`,
            "Add contextual onboarding at the point of first friction.",
          ],
        };

  return JSON.stringify({
    clarifyingQuestions: [
      `What decision should the research on "${topic}" support?`,
      `Within ${audience}, which segment matters most for "${keyword}"?`,
      `Are there constraints or regions to exclude when studying ${secondKeyword}?`,
    ],
    plan: {
      audience,
      phases: [
        {
          name: "Frame the research",
          tasks: [`Define the decision behind ${keyword}`, "List assumptions", "Set evidence bar"],
        },
        {
          name: "Collect signals",
          tasks: [
            `Review language around ${secondKeyword}`,
            "Map competitor positioning",
            "Extract usage patterns",
          ],
        },
        {
          name: "Synthesize report",
          tasks: ["Rank insights", "Draft recommendations", "Package follow-up questions"],
        },
      ],
    },
    report,
  });
}

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

    const systemMessage = messages.find((m) => m.role === "system");
    if (systemMessage?.content.includes(RESEARCH_JSON_SYSTEM_MARKER)) {
      if (text.includes(RESEARCH_FORCE_FAIL_MARKER)) {
        throw new Error("stub provider: 研究生成强制失败（测试触发）");
      }
      const json = buildStubResearchJson(text);
      const chunks = json.match(/.{1,32}/gs) ?? [json];
      for (const chunk of chunks) {
        yield chunk;
      }
      return;
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

// 消息路由（apps/web .../messages/route.ts）在用户文本末尾拼接 `[附件: a.png、b.pdf]`
// 作为附件上下文提示（P9 F08：stub provider 无需真实多模态理解，引用附件存在/文件名即可）。
const ATTACHMENT_MARKER_RE = /\n\n\[附件: (.+)\]$/;

// 消息路由在用户文本末尾拼接 `[知识库引用: a.pdf、b.md]`（p10-F04：RAG 检索命中的、
// 用户有权访问且已 ready 的知识库文件名）。stub provider 据此在回复中标注引用来源，
// 无命中时该标记不存在，回复也不会虚构引用——与 F04 验收口径「无相关内容时不虚构来源」一致。
const KB_CITATION_MARKER_RE = /\n\n\[知识库引用: (.+)\]$/;

// board-ai-chat 路由（p17-F01）在用户问题末尾拼接 `[画布内容: 1. xxx\n2. yyy]`
// （当前画布上各 item 的真实文字内容，见 apps/web/app/api/boards/[id]/ai-chat/route.ts）。
// stub provider 据此在回复中真实引用画布上的具体文字，而非只报数量——
// 用于验证 Board AI 的回复确实基于画布内容生成，不是写死模板。支持多行内容（dotall）。
const BOARD_CONTEXT_MARKER_RE = /\n\n\[画布内容: ([\s\S]+)\]$/;

/** 构造 stub 回复：包含纯文本 + Markdown 标题/列表 + 代码块，覆盖渲染断言面。
 *  若用户文本携带附件上下文标记，回复里显式提及附件文件名，供 F08 验证 AI 感知到附件。
 *  若携带知识库引用标记，回复里显式列出引用来源，供 F04 验证 RAG 检索结果被使用且可追溯。
 *  若携带画布内容标记，回复里显式引用画布上的具体文字，供 p17-F01 验证 Board AI 真实基于
 *  画布内容生成（而非仅报组件数量）。
 *  settings 携带当前生效的模型/Agent/工具，供 F07 验证发送前设置在回复中确实生效。 */
export function buildStubReply(
  userText: string,
  settings: { modelId?: string; agentId?: string; toolIds?: string[] } = {}
): string {
  const boardMatch = userText.match(BOARD_CONTEXT_MARKER_RE);
  const afterBoard = boardMatch ? userText.replace(BOARD_CONTEXT_MARKER_RE, "") : userText;
  const kbMatch = afterBoard.match(KB_CITATION_MARKER_RE);
  const afterKb = kbMatch ? afterBoard.replace(KB_CITATION_MARKER_RE, "") : afterBoard;
  const attachmentMatch = afterKb.match(ATTACHMENT_MARKER_RE);
  const bodyText = attachmentMatch ? afterKb.replace(ATTACHMENT_MARKER_RE, "") : afterKb;
  const quoted = bodyText.length > 200 ? `${bodyText.slice(0, 200)}…` : bodyText;
  const attachmentLine = attachmentMatch
    ? `\n\n我看到你附上了 ${attachmentMatch[1]}，已一并考虑。`
    : "";
  const kbLine = kbMatch ? `\n\n**引用来源**：${kbMatch[1]}` : "";
  const boardLine = boardMatch
    ? `\n\n**画布内容参考**：\n${boardMatch[1]}\n\n以上是我在当前画布上看到的内容，已结合它来回答你的问题。`
    : "";
  const modelId = settings.modelId ?? DEFAULT_MODEL_ID;
  const agentId = settings.agentId ?? "default";
  const tools = settings.toolIds && settings.toolIds.length > 0 ? settings.toolIds.join(", ") : "none";
  return [
    `## 收到`,
    ``,
    `这是 AVA 的 stub 回复（未接入真实模型）。你说：「${quoted}」。${attachmentLine}${kbLine}${boardLine}`,
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

import { anthropicProvider } from "./anthropicProvider";

/** 默认单例网关（进程内共享，注册全部已知 provider）。
 *  anthropic: → 真实 Anthropic API；stub: → 确定性 stub。前缀不重叠，顺序无关。 */
export const defaultGateway = new ChatGateway([anthropicProvider, stubProvider]);
