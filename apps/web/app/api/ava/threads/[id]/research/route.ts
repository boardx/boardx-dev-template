// apps/web/app/api/ava/threads/[id]/research/route.ts — AVA Deep Research stub engine（P9 F06）
//
// POST /api/ava/threads/:id/research
//  1. 校验登录 + 线程属主 + 主题长度。
//  2. 使用 deterministic stub 研究引擎生成澄清问题、计划、时间线、报告。
//  3. 将用户研究主题和最终报告通知落到现有 ava_messages，e2e 不接真实外部 AI。
import { NextResponse } from "next/server";
import {
  getAvaThread,
  insertAvaMessage,
  renameAvaThreadIfDefault,
  titleFromMessage,
  touchAvaThread,
} from "@repo/data";
import { currentUser } from "@/lib/session";

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
  if (!thread || thread.user_id !== user.id) {
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

  return NextResponse.json(
    {
      research,
      messages: {
        user: userMessage,
        assistant: assistantMessage,
      },
    },
    { status: 201 }
  );
}
