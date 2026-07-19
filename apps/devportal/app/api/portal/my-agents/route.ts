// GET /api/portal/my-agents — /me/agents 车队管理台的真实数据源（p30/F07）。
// ⚠️ 与既有 /api/portal/agents（p23/F08 registry 分组树，perf-tab 消费）是两个
// 不同的数据面，故意不复用同一路径：那个读 .harness/agents/registry.yaml，
// 这个读 coord-gateway 的平台目录 DO（真实 enroll 出来的 agent 身份）。
//
// 交叉出「token 健康态」：Directory 只存身份，RepoHub 的 /tokens 才是 token
// 是否被吊销的权威（F08）——两者按 agent_id 关联（enroll 时 mint 用的就是
// Directory 发的 agt_ULID 作 agent_id，见 my-agents/enroll/route.ts）。
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { gatewayEnv, heartbeatBucket, listMyDirectoryAgents, listRepoTokens } from "@/lib/agents-gateway";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getSessionUser(req.headers);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const gw = gatewayEnv();
  // handle 来自 session（与 gateway 是否接通无关）：即便 gateway 未配置，向导仍应
  // 能开（点了会撞 enroll 端点的 503 gateway_not_configured，是诚实降级而非卡死 UI）。
  if (!gw) return NextResponse.json({ configured: false, handle: user.login, fleet: [] });

  const [agents, tokens] = await Promise.all([listMyDirectoryAgents(gw), listRepoTokens(gw)]);
  if (!agents) return NextResponse.json({ configured: true, error: "directory_unreachable" }, { status: 502 });

  const mine = agents.filter((a) => a.owner?.handle === user.login);
  const fleet = mine.map((a) => {
    const myTokens = tokens.filter((t) => t.agent_id === a.agent_id);
    const active = myTokens.filter((t) => !t.revoked_at);
    const tokenStatus: "健康" | "已吊销" | "未发放" =
      myTokens.length === 0 ? "未发放" : active.length > 0 ? "健康" : "已吊销";
    const hb = heartbeatBucket(a.last_heartbeat_at);
    return {
      id: a.identifier,
      agentId: a.agent_id,
      runtime: a.capabilities[0] ?? "自研",
      heartbeat: hb.heartbeat,
      heartbeatMin: hb.minutes,
      lifecycle: a.lifecycle ?? "active",
      projectSlug: a.projects[0] ?? null,
      tokenStatus,
      lastHeartbeatAt: a.last_heartbeat_at,
    };
  });

  return NextResponse.json(
    { configured: true, handle: user.login, fleet },
    { headers: { "Cache-Control": "no-store" } },
  );
}
