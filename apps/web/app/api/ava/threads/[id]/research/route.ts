// apps/web/app/api/ava/threads/[id]/research/route.ts — AVA Deep Research 真实生成（P18 F04）
//
// POST /api/ava/threads/:id/research
//  1. 校验登录 + 线程属主 + 主题长度。
//  2. p18-F04：不再用硬编码的 buildResearch() 静态文案——改为调用 CAP-AI 网关
//     （packages/ai 的 generateResearch，走 F01 的同一条真实/stub provider 路径）
//     针对用户提交的 topic/audience 真实生成澄清问题/计划/报告，不同主题产出不同内容。
//  3. 将用户研究主题和最终报告通知落到现有 ava_messages，e2e 用 stub: 模型确定性验证。
//  4. p18-F03：同时把该研究持久化到 ava_research_sessions；p18-F04 起初始状态为
//     'draft'（只有澄清问题待确认，timeline 全 queued——执行还没开始，避免"还没确认
//     计划就已经在跑"的假象）。
//
// GET /api/ava/threads/:id/research — 返回该线程最近一次研究会话（线程重新打开时
// 用它把 research-card 恢复到中断前的阶段与内容；没有研究过则 { session: null }）。
import { NextResponse } from "next/server";
import {
  getAvaThread,
  getLatestAvaResearchSession,
  insertAvaMessage,
  createAvaResearchSession,
  renameAvaThreadIfDefault,
  titleFromMessage,
  touchAvaThread,
} from "@repo/data";
import { defaultGateway, generateResearch, DEFAULT_MODEL_ID, normalizeAvaAiSettings } from "@repo/ai";
import { currentTeamId, currentUser } from "@/lib/session";
import { isThreadInCurrentContext } from "@/lib/ava-thread-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_TOPIC_LENGTH = 8;
const NO_CREDITS_MARKER = "__ava_research_no_credits__";
const FAIL_MARKER = "__ava_research_fail__";
const DEFAULT_RESEARCH_AUDIENCE = "Product and go-to-market team";

interface ResearchBody {
  topic?: unknown;
  audience?: unknown;
  modelId?: unknown;
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const threadId = Number(params.id);
  if (!Number.isFinite(threadId)) {
    return NextResponse.json({ error: "无效的线程 id" }, { status: 400 });
  }

  const thread = await getAvaThread(threadId);
  if (!thread || !isThreadInCurrentContext(thread, user.id, currentTeamId())) {
    return NextResponse.json({ error: "线程不存在" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as ResearchBody;
  const topic = String(body.topic ?? "").trim().replace(/\s+/g, " ");
  const audience = String(body.audience ?? "").trim() || DEFAULT_RESEARCH_AUDIENCE;

  if (topic.length < MIN_TOPIC_LENGTH) {
    return NextResponse.json(
      { error: "研究主题太短，请补充目标、对象或决策背景。" },
      { status: 400 }
    );
  }
  if (topic.includes(NO_CREDITS_MARKER)) {
    return NextResponse.json(
      { error: "Credit 额度不足，请充值或缩小研究范围后重试。" },
      { status: 402 }
    );
  }
  if (topic.includes(FAIL_MARKER)) {
    return NextResponse.json(
      { error: "研究任务启动失败，请稍后重试；当前主题已保留。" },
      { status: 503 }
    );
  }

  // modelId 复用聊天消息同一套设置归一化（未登录/非法值降级为默认 stub 模型），
  // 使研究生成与当前聊天设置里选中的模型一致（真实 provider 或 stub）。
  const teamId = currentTeamId();
  const settings = normalizeAvaAiSettings(
    { modelId: typeof body.modelId === "string" ? body.modelId : DEFAULT_MODEL_ID },
    true
  );

  let research;
  try {
    research = await generateResearch({
      topic,
      audience,
      modelId: settings.modelId,
      gateway: defaultGateway,
    });
  } catch (err) {
    // 真实生成失败（provider 报错 / 模型输出无法解析为预期结构）：服务端记录原始错误，
    // 给用户一个可重试的通用提示，不把内部错误细节透传到客户端。
    console.error("[ava/research] 研究内容生成失败:", err);
    return NextResponse.json(
      { error: "研究内容生成失败，请稍后重试；当前主题已保留。" },
      { status: 503 }
    );
  }

  const userMessage = await insertAvaMessage(threadId, "user", `[Deep Research] ${topic}`);
  await renameAvaThreadIfDefault(threadId, titleFromMessage(topic));
  const assistantMessage = await insertAvaMessage(
    threadId,
    "assistant",
    `Deep Research report ready: ${research.report.title}\n\n${research.report.conclusion}`
  );
  await touchAvaThread(threadId);

  // p18-F04：两步确认的第一步——刚生成时只展示澄清问题待确认，timeline 全部 queued
  // （执行尚未开始）。用户显式确认澄清问题后（PATCH status=clarified）计划才变为可
  // 确认，确认计划后（PATCH status=running）才真正推进 timeline。
  const draftTimeline = research.timeline;
  const session = await createAvaResearchSession({
    threadId,
    topic,
    audience,
    status: "draft",
    researchPayload: research,
    timeline: draftTimeline,
    assistantMessageId: assistantMessage.id,
  });

  return NextResponse.json(
    {
      research,
      session,
      messages: {
        user: userMessage,
        assistant: assistantMessage,
      },
    },
    { status: 201 }
  );
}

/** 恢复该线程最近一次研究会话（线程重新打开/刷新页面后，用于把 research-card
 *  恢复到中断前的正确阶段与内容）。没有研究过则返回 { session: null }。 */
/** research_payload 落库时是 unknown（jsonb），恢复给前端渲染前做一次轻量 shape 校验——
 *  前端 ResearchWorkspace 直接解构 `run.research.plan.phases`/`report.sections` 等字段，
 *  一行脏数据就会让整个页面抛未处理异常。校验不过时降级为 null（前端已有 hasPlan=false
 *  的正常展示分支），而不是把可能畸形的数据原样透传出去。 */
function isValidResearchPayload(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (!Array.isArray(v.clarifyingQuestions)) return false;
  if (!Array.isArray(v.timeline)) return false;
  const plan = v.plan as Record<string, unknown> | undefined;
  if (!plan || typeof plan.audience !== "string" || !Array.isArray(plan.phases)) return false;
  const report = v.report as Record<string, unknown> | undefined;
  if (!report || typeof report.title !== "string" || typeof report.conclusion !== "string") return false;
  if (!Array.isArray(report.sections)) return false;
  return true;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const threadId = Number(params.id);
  if (!Number.isFinite(threadId)) {
    return NextResponse.json({ error: "无效的线程 id" }, { status: 400 });
  }

  const thread = await getAvaThread(threadId);
  if (!thread || !isThreadInCurrentContext(thread, user.id, currentTeamId())) {
    return NextResponse.json({ error: "线程不存在" }, { status: 404 });
  }

  const session = await getLatestAvaResearchSession(threadId);
  if (session && !isValidResearchPayload(session.research_payload)) {
    console.error(
      `[ava/research] session ${session.id} 的 research_payload 未通过 shape 校验，已降级为 null`
    );
    return NextResponse.json({ session: { ...session, research_payload: null } });
  }
  return NextResponse.json({ session: session ?? null });
}
