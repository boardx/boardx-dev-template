// apps/web/app/api/boards/[id]/ai-chat/route.ts — Board AI 浮层的真实生成入口（F01 revise）。
//
// 背景：feature-evaluator 复审指出 board-ai-panel.tsx 的 buildAiReply 是纯前端正则模板拼接，
// 没有兑现 user_visible_behavior「能就当前画布内容提问/生成」的核心语义。本路由把 Board AI
// 接到与 AVA 相同的 CAP-AI 网关（packages/ai 的 defaultGateway/stubProvider），
// 并把「当前画布上 items 的真实文字内容」组装进 prompt 上下文一并传给网关，
// 使回复真实依据画布内容生成，而非写死模板。
//
// 范围纪律：不新增持久化对话表、不做多轮历史落库、不做流式 SSE——
// 复用既有 AI 调用能力（网关+stub provider）+ 组装 prompt context，是 reskin 阶段的合理范围。
// 每次请求都是无状态单轮生成（面板侧自行维护本地消息列表），与 F01 notes
// 「Board AI 面板当前无跨会话持久化」的既有边界一致。
import { NextResponse } from "next/server";
import { getBoard, getBoardAccessRole, listBoardItems } from "@repo/data";
import { defaultGateway, DEFAULT_MODEL_ID, FORCE_FAIL_MARKER } from "@repo/ai";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ITEMS_IN_CONTEXT = 40;
const MAX_ITEM_TEXT_LEN = 200;

// 安全修复（code-reviewer 复审 · 中等严重度）：画布 item 文本是用户可写内容，会被原样拼进
// 下面的 `[画布内容: ...]` 标记块再传给网关。stub provider（packages/ai/src/gateway.ts）会对
// 整段用户消息做字符串匹配，命中 FORCE_FAIL_MARKER（"__ava_force_fail__"）就抛错，使本路由
// 500。若不过滤，任何协作者只要在便签里写下这个触发词字符串，就能让该 board 的 AI 浮层对
// 所有人恒定返回 500 —— 是一个由用户内容触发的、可复现的拒绝服务问题。这里在组装上下文之前
// 去掉该触发词的字面出现（大小写不敏感），画布内容本身仍照原样展示给真实场景，只是不再让
// 用户输入能够操纵 gateway 内部的测试触发逻辑。
const FORCE_FAIL_MARKER_RE = new RegExp(FORCE_FAIL_MARKER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");

/** 过滤用户可写文本中可能混入的 stub provider 测试触发词，避免用户内容操纵网关的内部
 *  测试触发逻辑（见上方安全修复说明）。 */
function stripForceFailMarker(text: string): string {
  return text.replace(FORCE_FAIL_MARKER_RE, "");
}

// TODO(接入真实 LLM 前必读)：目前 `[画布内容: ...]` 里拼接的是用户可写的画布文字，直接进入
// 单条 user content 字符串一起发给网关。接入真实 LLM 前需要做 prompt injection 隔离（例如：
// 把画布内容放进独立的 system/tool 消息而非拼在 user 文本里、对分隔符做转义、或用结构化字段
// 替代自由文本拼接），否则画布协作者可以在便签里写入伪造的指令/角色边界字符串来操纵真实模型
// 的行为，而不只是像本次修复的 stub 触发词那样的确定性问题。

/** 把画布 items 的真实文字内容组装成 prompt 上下文片段（供网关 provider 引用）。
 *  空文本 item（如未命名形状）跳过，避免上下文噪音。过滤 stub provider 的测试触发词，
 *  防止用户可写的画布文本意外命中网关内部的强制失败逻辑（见上方安全修复说明）。 */
function buildBoardContext(items: { text: string; type: string }[]): string {
  const withText = items
    .map((it) => it.text?.trim())
    .filter((t): t is string => !!t)
    .map(stripForceFailMarker)
    .slice(0, MAX_ITEMS_IN_CONTEXT)
    .map((t) => (t.length > MAX_ITEM_TEXT_LEN ? `${t.slice(0, MAX_ITEM_TEXT_LEN)}…` : t));
  if (withText.length === 0) return "";
  return withText.map((t, i) => `${i + 1}. ${t}`).join("\n");
}

// POST /api/boards/:id/ai-chat — 就当前画布内容单轮问答（owner/editor/viewer 均可用于提问，
// 与 e2e「无编辑权限时 AI 浮层仍可用于提问」一致；无访问权限 403）。
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const boardId = Number(params.id);
  if (!Number.isFinite(boardId)) {
    return NextResponse.json({ error: "无效的 board id" }, { status: 400 });
  }
  const board = await getBoard(boardId);
  if (!board) return NextResponse.json({ error: "not found" }, { status: 404 });
  const role = await getBoardAccessRole(boardId, user.id);
  if (!role) return NextResponse.json({ error: "无权限" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { question?: unknown };
  const question = String(body.question ?? "").trim();
  if (!question) {
    return NextResponse.json({ error: "问题不能为空" }, { status: 400 });
  }

  const items = await listBoardItems(boardId);
  const boardContext = buildBoardContext(items);
  // 与 AVA 消息路由的既有约定一致（见 ava/threads/[id]/messages/route.ts）：
  // 上下文通过在用户文本末尾拼接标记块传给网关，provider 据此在回复里引用来源，
  // 无内容时该标记不存在，不虚构画布内容。
  const userContent = boardContext ? `${question}\n\n[画布内容: ${boardContext}]` : question;

  try {
    let reply = "";
    for await (const token of defaultGateway.streamChat({
      modelId: DEFAULT_MODEL_ID,
      messages: [{ role: "user", content: userContent }],
      settings: { agentId: "board-ai", toolIds: ["board-context"] },
    })) {
      reply += token;
    }
    return NextResponse.json({ reply, itemCount: items.length }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
