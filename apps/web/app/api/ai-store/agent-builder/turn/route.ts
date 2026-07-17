import { NextResponse } from "next/server";
import { getMembership } from "@repo/data";
import { currentTeamId, currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function titleFromIdea(input: string): string {
  const words = input
    .replace(/\b(create|build|make|an?|the|for|agent|assistant|teams?)\b/gi, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3);
  return `${words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ") || "Custom"} Agent`;
}

export async function POST(req: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const teamId = currentTeamId();
    if (teamId == null || !(await getMembership(teamId, user.id))) {
      return NextResponse.json({ error: "当前团队不可用" }, { status: 403 });
    }
    const body = (await req.json().catch(() => ({}))) as { latestUserInput?: unknown };
    const idea = String(body.latestUserInput ?? "").trim();
    if (!idea) return NextResponse.json({ errors: { latestUserInput: "请描述需要创建的 Agent" } }, { status: 400 });
    const name = titleFromIdea(idea);
    return NextResponse.json({
      draft: {
        type: "agent",
        scope: "personal",
        teamId,
        name,
        description: `An editable Agent draft for: ${idea}`,
        config: {
          model: "stub:default",
          instructions: `You are ${name}. Help the current Team accomplish this goal: ${idea}. Ask for missing context, work step by step, and return concrete, reviewable results.`,
        },
        suggestedQuestions: [
          "What outcome should this Agent optimize for?",
          "Which inputs and constraints should it expect?",
          "What format should the final result use?",
        ],
      },
    });
  } catch (err) {
    console.error("[ai-store/agent-builder/turn] failed", err);
    return NextResponse.json({ error: "Agent Builder 暂时不可用，请重试" }, { status: 500 });
  }
}
