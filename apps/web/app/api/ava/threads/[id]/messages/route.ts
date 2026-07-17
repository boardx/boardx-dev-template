// apps/web/app/api/ava/threads/[id]/messages/route.ts — 发消息 + AI 流式回复（P9 F01/F08）
//
// POST /api/ava/threads/:id/messages
//  1. 校验登录 + 线程属主（含 team_id，见下方说明）+ 非空文本或至少一个附件。
//  2. 落库用户消息（立即持久化，即使后续生成失败也不丢）；若带 attachmentIds，把已上传
//     成功的暂存附件（见 attachments/route.ts）关联到这条消息上，随消息一起进聊天历史。
//  3. 用 CAP-AI 网关（packages/ai）流式生成回复，通过 SSE 边生成边推给客户端；附件文件名
//     作为上下文提示词的一部分传给网关，stub provider 据此在回复里提及附件（F08：无需真实
//     多模态理解，引用附件存在/文件名即满足验收）。
//  4. 生成成功：落库完整 assistant 消息（status=complete），首条消息成功后按需重命名线程标题。
//     生成失败：落库一条 status=failed 的 assistant 消息（内容为空提示失败），SSE 发 error 事件。
//
// SSE 事件类型：
//   event: user     — 用户消息已持久化（含 id + attachments），供客户端立即渲染。
//   event: token    — 逐 token 增量文本。
//   event: done     — 生成完成，携带完整 assistant 消息记录。
//   event: error    — 生成失败，携带失败态 assistant 消息记录（用户输入已保留在 event:user）。
import {
  getAvaThread,
  getMembership,
  insertAvaMessage,
  listAvaMessages,
  renameAvaThreadIfDefault,
  retrieveKbFilesForQuery,
  titleFromMessage,
  touchAvaThread,
  attachAvaAttachmentsToMessage,
} from "@repo/data";
import {
  DEFAULT_AVA_AGENT_ID,
  DEFAULT_AVA_TOOL_IDS,
  DEFAULT_MODEL_ID,
  normalizeAvaAiSettings,
} from "@repo/ai";
import { currentTeamId, currentUser } from "@/lib/session";
import { isThreadInCurrentContext } from "@/lib/ava-thread-auth";
import { listAvaAgentOptions } from "@/lib/ava-agents";
import { createAvaReplyStreamResponse } from "./reply-stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return new Response(JSON.stringify({ error: "未登录" }), { status: 401 });

  const threadId = Number(params.id);
  if (!Number.isFinite(threadId)) {
    return new Response(JSON.stringify({ error: "无效的线程 id" }), { status: 400 });
  }

  const thread = await getAvaThread(threadId);
  // 鉴权同时校验 user_id 与 team_id：修复 #153（跨团队用可枚举的线程 id 越权读/写）。
  if (!thread || !isThreadInCurrentContext(thread, user.id, currentTeamId())) {
    return new Response(JSON.stringify({ error: "线程不存在" }), { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    text?: unknown;
    attachmentIds?: unknown;
    modelId?: unknown;
    agentId?: unknown;
    toolIds?: unknown;
    deepAgent?: unknown;
    researchType?: unknown;
  };
  const text = String(body.text ?? "").trim();
  const attachmentIds = Array.isArray(body.attachmentIds)
    ? body.attachmentIds.filter((v): v is string => typeof v === "string")
    : [];
  if (!text && attachmentIds.length === 0) {
    return new Response(JSON.stringify({ errors: { text: "消息不能为空" } }), { status: 400 });
  }
  const teamId = currentTeamId();
  const role = teamId == null ? undefined : await getMembership(teamId, user.id);
  const agentOptions = await listAvaAgentOptions(user.id, teamId);
  const settings = normalizeAvaAiSettings(
    {
      modelId: typeof body.modelId === "string" ? body.modelId : DEFAULT_MODEL_ID,
      agentId: typeof body.agentId === "string" ? body.agentId : DEFAULT_AVA_AGENT_ID,
      toolIds: Array.isArray(body.toolIds)
        ? body.toolIds.filter((id): id is string => typeof id === "string")
        : DEFAULT_AVA_TOOL_IDS,
    },
    role === "owner" || role === "admin",
    // p18-F09：agentId 的合法集合 = 内置默认 + 已订阅的 AI Store Agent（store-<id>），
    // 与 /api/ava/capabilities 下发给 agent-select 的选项同一来源；不在集合内则归一化为默认。
    agentOptions
  );

  const selectedAgent = agentOptions.find((agent) => agent.id === settings.agentId);
  const shouldUseDeepAgent =
    body.deepAgent === true ||
    body.researchType === "deep_agent" ||
    selectedAgent?.deepAgentEnabled === true;

  // boardx-web 旧链路：Deep Agent 不是普通 AVA chat stub，而是走
  // /api/v1/deep-agent/execute，由 boardx-backend DeepAgentController 处理。
  // 这里放在消息落库前，避免普通 stub 和 deep-agent 都各写一份 user 消息。
  if (shouldUseDeepAgent && text) {
    const origin = new URL(req.url).origin;
    const deepAgentRes = await fetch(`${origin}/api/v1/deep-agent/execute`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "text/event-stream",
        "X-Chat-Thread-Id": String(threadId),
        cookie: req.headers.get("cookie") ?? "",
        ...(req.headers.get("authorization")
          ? { authorization: req.headers.get("authorization") as string }
          : {}),
      },
      body: JSON.stringify({
        input: text,
        chatId: String(threadId),
        chatThreadId: String(threadId),
        teamId: teamId == null ? "" : String(teamId),
        userId: String(user.id),
        model: settings.modelId,
        storeId: selectedAgent?.storeId ? String(selectedAgent.storeId) : undefined,
        executionMode: selectedAgent?.storeId ? "tool-auto" : "chat",
        toolScope: selectedAgent?.storeId ? "agent" : "none",
        responseFormat: "markdown",
      }),
      signal: req.signal,
    });

    return new Response(deepAgentRes.body, {
      status: deepAgentRes.status,
      headers: {
        "Content-Type": deepAgentRes.headers.get("Content-Type") || "text/event-stream",
        "Cache-Control": deepAgentRes.headers.get("Cache-Control") || "no-cache, no-transform",
        Connection: deepAgentRes.headers.get("Connection") || "keep-alive",
        "X-Accel-Buffering": "no",
        "X-Ava-Message-Backend": "deep-agent",
        "X-Deep-Agent-Backend": deepAgentRes.headers.get("X-Deep-Agent-Backend") || "",
      },
    });
  }

  // 用户消息先落库：即使下面生成失败，用户输入也不会丢失。
  const userMessage = await insertAvaMessage(threadId, "user", text);
  const attachments = await attachAvaAttachmentsToMessage({
    attachmentIds,
    messageId: userMessage.id,
    threadId,
    ownerUserId: user.id,
  });
  await renameAvaThreadIfDefault(threadId, titleFromMessage(text || attachments[0]?.name || ""));
  await touchAvaThread(threadId);

  const history = await listAvaMessages(threadId);
  // 把本条消息的附件文件名附加到最后一条用户消息内容里，作为 stub provider 的上下文提示——
  // 真实多模态 provider 接入后应改为按 provider 的附件/图片输入协议传递，而非拼进纯文本。
  if (attachments.length > 0) {
    const lastIdx = history.length - 1;
    const namesList = attachments.map((a) => a.name).join("、");
    const last = history[lastIdx];
    if (last) {
      history[lastIdx] = {
        ...last,
        content: `${last.content}\n\n[附件: ${namesList}]`.trim(),
      };
    }
  }

  // RAG 检索（p10-F04）：仅当用户勾选了 file-reader 工具时才检索知识库上下文，
  // 与「用户可选择或自动使用当前上下文中已 ready 的知识库文件」的验收口径一致。
  // retrieveKbFilesForQuery 已做作用域隔离（personal/agent/tool 限 owner；team 限当前
  // 团队上下文成员）+ status='ready' 过滤，这里不重复鉴权、直接信任其返回结果。
  if (settings.toolIds.includes("file-reader") && text) {
    const kbHits = await retrieveKbFilesForQuery({
      ownerUserId: user.id,
      teamId,
      queryText: text,
    });
    if (kbHits.length > 0) {
      const lastIdx = history.length - 1;
      const citeList = kbHits.map((f) => f.name).join("、");
      const last = history[lastIdx];
      if (last) {
        history[lastIdx] = {
          ...last,
          content: `${last.content}\n\n[知识库引用: ${citeList}]`.trim(),
        };
      }
    }
  }

  return createAvaReplyStreamResponse({
    threadId,
    history,
    initialEvent: { event: "user", data: { message: userMessage, attachments } },
    modelId: settings.modelId,
    agentId: settings.agentId,
    toolIds: settings.toolIds,
    status: 201,
    // P18 F02：客户端点击停止/断开连接时 Next.js 会 abort 这个 signal；透传给流式生成，
    // 使真实 provider 的底层 fetch 被真实中断，而非等它自然结束后再丢弃结果。
    signal: req.signal,
  });
}
