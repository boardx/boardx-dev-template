// apps/web/app/api/ava/threads/[id]/research/route.ts — AVA Deep Research stub engine（P9 F06）
//
// POST /api/ava/threads/:id/research
//  1. 校验登录 + 线程属主 + 主题长度。
//  2. 使用 deterministic stub 研究引擎生成澄清问题、计划、时间线、报告。
//  3. 将用户研究主题和最终报告通知落到现有 ava_messages，e2e 不接真实外部 AI。
//  4. p18-F03：同时把该研究持久化到 ava_research_sessions（draft 阶段的 timeline：
//     首个阶段 running、其余 queued），供 GET 恢复、PATCH 推进阶段。
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
  type AvaResearchTimelineItem,
} from "@repo/data";
import { currentTeamId, currentUser } from "@/lib/session";
import { isThreadInCurrentContext } from "@/lib/ava-thread-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_TOPIC_LENGTH = 8;
const NO_CREDITS_MARKER = "__ava_research_no_credits__";
const FAIL_MARKER = "__ava_research_fail__";

interface ResearchBody {
  topic?: unknown;
  audience?: unknown;
}

function buildResearch(topic: string, audience: string) {
  const normalizedAudience = audience.trim() || "Product and go-to-market team";
  return {
    clarifyingQuestions: [
      "What decision should this research support?",
      "Which audience segment matters most for this pass?",
      "Are there regions, competitors, or constraints that must be excluded?",
    ],
    plan: {
      audience: normalizedAudience,
      phases: [
        {
          name: "Frame the research",
          tasks: ["Define target decision", "List assumptions", "Set evidence bar"],
        },
        {
          name: "Collect signals",
          tasks: ["Review customer language", "Map competitor positioning", "Extract usage patterns"],
        },
        {
          name: "Synthesize report",
          tasks: ["Rank insights", "Draft recommendations", "Package follow-up questions"],
        },
      ],
    },
    timeline: [
      { phase: "Clarification", task: "Scope topic and audience", status: "complete" },
      { phase: "Planning", task: "Create phased research plan", status: "complete" },
      { phase: "Execution", task: "Run stub research engine", status: "complete" },
      { phase: "Report", task: "Prepare structured findings", status: "complete" },
    ],
    report: {
      title: `Deep Research Report: ${topic}`,
      conclusion:
        "The strongest opportunity is to narrow the user segment, validate the top workflow pain, and test one focused positioning angle before expanding scope.",
      sections: [
        {
          heading: "Key findings",
          bullets: [
            "Users need a clearer reason to switch than broad productivity claims.",
            "Research should compare current workaround cost against expected collaboration gains.",
            "The next interview round should prioritize high-frequency teams with active shared boards.",
          ],
        },
        {
          heading: "Recommended next steps",
          bullets: [
            "Confirm the primary audience with five targeted interviews.",
            "Prototype one workflow-specific message and measure comprehension.",
            "Track follow-up objections in the same AVA thread.",
          ],
        },
      ],
    },
  };
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
  const audience = String(body.audience ?? "").trim();

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

  const research = buildResearch(topic, audience);
  const userMessage = await insertAvaMessage(threadId, "user", `[Deep Research] ${topic}`);
  await renameAvaThreadIfDefault(threadId, titleFromMessage(topic));
  const assistantMessage = await insertAvaMessage(
    threadId,
    "assistant",
    `Deep Research report ready: ${research.report.title}\n\n${research.report.conclusion}`
  );
  await touchAvaThread(threadId);

  // p18-F03：draft 阶段的实时 timeline——首个阶段 running，其余 queued（与前端
  // startResearch() 里原本纯 client 端构造的初始 timeline 同一形状，现在权威落库）。
  const draftTimeline: AvaResearchTimelineItem[] = research.timeline.map((item, index) => ({
    ...item,
    status: index === 0 ? "running" : "queued",
  }));
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
