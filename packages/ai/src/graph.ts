// packages/ai/src/graph.ts — CAP-AI LangGraph 风格编排（P9 F01 地基）
//
// 最小图运行时：节点接收/产出共享 state，按边顺序执行。F01 只需单节点
// （generate：读取历史消息 → 调网关流式生成 → 产出 assistant 消息），
// 多阶段图（澄清/计划/执行/报告）留给 F06 Deep Research 复用本运行时扩展节点。

export interface GraphState {
  threadId: number;
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  modelId: string;
  /** 节点写入的流式 token 回调；由调用方（API 路由）提供，用于转 SSE。 */
  onToken?: (token: string) => void;
}

export type NodeFn = (state: GraphState) => Promise<Partial<GraphState> & { reply?: string }>;

export interface AvaGraphResult {
  reply: string;
}

/** 单节点「聊天壳」图：generate 节点调网关流式生成一条完整回复。
 *  失败（provider 抛错）会向上抛出，调用方负责落库失败态、保留用户输入。 */
export async function runChatGraph(
  state: GraphState,
  generate: NodeFn
): Promise<AvaGraphResult> {
  const result = await generate(state);
  if (typeof result.reply !== "string") {
    throw new Error("generate 节点必须产出 reply");
  }
  return { reply: result.reply };
}

/** 生成节点的默认实现：调用传入网关的 streamChat，逐 token 转发给 onToken，
 *  同时累积成完整回复用于落库。 */
export function makeGenerateNode(
  streamChat: (input: {
    modelId: string;
    messages: GraphState["messages"];
  }) => AsyncGenerator<string, void, void>
): NodeFn {
  return async (state: GraphState) => {
    let full = "";
    for await (const token of streamChat({ modelId: state.modelId, messages: state.messages })) {
      full += token;
      state.onToken?.(token);
    }
    return { reply: full };
  };
}
