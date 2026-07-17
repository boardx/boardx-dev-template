// apps/web/app/api/ava/capabilities/route.ts — AVA 可选 AI 能力（P9 F07）
import { NextResponse } from "next/server";
import {
  AVA_MODEL_OPTIONS,
  AVA_TOOL_OPTIONS,
  DEFAULT_AVA_AGENT_ID,
  DEFAULT_AVA_TOOL_IDS,
  getDefaultAvaModelId,
} from "@repo/ai";
import { getMembership } from "@repo/data";
import { currentTeamId, currentUser } from "@/lib/session";
import { listAvaAgentOptions } from "@/lib/ava-agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function canUseRestrictedModel(role: string | undefined): boolean {
  return role === "owner" || role === "admin";
}

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const teamId = currentTeamId();
  const role = teamId == null ? undefined : await getMembership(teamId, user.id);
  const canUseTeamRestrictedModels = canUseRestrictedModel(role);

  const agents = await listAvaAgentOptions(user.id, teamId);

  return NextResponse.json({
    teamId,
    teamRole: role ?? null,
    deepAgent: {
      enabled: true,
      backendConfigured: Boolean(process.env.NEXT_PUBLIC_API_URL),
    },
    models: AVA_MODEL_OPTIONS.map((model) => ({
      ...model,
      disabled: Boolean(model.teamRestricted && !canUseTeamRestrictedModels),
      disabledReason:
        model.teamRestricted && !canUseTeamRestrictedModels
          ? "Team owners and admins can select this model."
          : "",
    })),
    // p18-F09：内置默认 Agent + 当前用户/团队已订阅的 AI Store Agent（真实订阅数据）。
    agents,
    tools: AVA_TOOL_OPTIONS,
    defaults: {
      modelId: getDefaultAvaModelId(canUseTeamRestrictedModels),
      agentId: DEFAULT_AVA_AGENT_ID,
      toolIds: DEFAULT_AVA_TOOL_IDS,
    },
  });
}
