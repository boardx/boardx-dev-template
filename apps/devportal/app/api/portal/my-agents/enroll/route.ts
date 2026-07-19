// POST /api/portal/my-agents/enroll — enroll 向导「起名 + 领 token」的真实落点
// （p30/F07，UC-06）。信任链同 my-tokens/route.ts：登录者身份来自 session
// （GitHub login），devportal 服务端代表其调用 coord-gateway 的目录写面 +
// RepoHub mint 面，明文 token 只经这一跳、只出现这一次。
//
// 命名空间查重是 Directory 的 UNIQUE(owner_engineer_id, name) 索引说了算
// （409 agent_name_taken）——不做「先 GET 再判断」的竞态查重，前端的即时校验
// 只是 UX 提示，这里是真正的判定权威，见 err-ns-dup 映射。
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { AGENT_NAME_RE, ENROLL_RUNTIMES, type EnrollRuntime } from "@/lib/agent-runtimes";
import { gatewayEnv, mintRepoToken, upsertEngineer } from "@/lib/agents-gateway";

export const runtime = "edge";
export const dynamic = "force-dynamic";

function isEnrollRuntime(v: unknown): v is EnrollRuntime {
  return typeof v === "string" && (ENROLL_RUNTIMES as readonly string[]).includes(v);
}

export async function POST(req: Request) {
  const user = await getSessionUser(req.headers);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const gw = gatewayEnv();
  if (!gw) return NextResponse.json({ error: "gateway_not_configured" }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as { name?: unknown; runtime?: unknown };
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const runtime: EnrollRuntime = isEnrollRuntime(body.runtime) ? body.runtime : "自研";
  if (!AGENT_NAME_RE.test(name)) {
    return NextResponse.json({ error: "invalid_name" }, { status: 422 });
  }

  await upsertEngineer(gw, user.login, user.name);

  const adminHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${gw.adminToken}` };
  const agentRes = await fetch(`${gw.base}/api/coord/directory/agents`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({ owner: user.login, name, capabilities: [runtime] }),
    signal: AbortSignal.timeout(8_000),
  });
  if (agentRes.status === 409) {
    return NextResponse.json({ error: "err-ns-dup" }, { status: 409 });
  }
  if (!agentRes.ok) {
    return NextResponse.json({ error: "enroll_failed", upstream_status: agentRes.status }, { status: 502 });
  }
  const { agent } = (await agentRes.json()) as { agent: { agent_id: string; identifier: string } };

  const minted = await mintRepoToken(gw, agent.agent_id, user.login);
  if ("error" in minted) {
    // agent 身份已登记但 token 没发出来：不是「假成功」，如实报错，前端可提示重试
    // mint（登记是幂等的——同名会 409，但重新走 enroll 会命中同一条 agent 记录）。
    return NextResponse.json(
      { error: "mint_failed", upstream_status: minted.upstreamStatus, agent_id: agent.agent_id, identifier: agent.identifier },
      { status: 502 },
    );
  }

  return NextResponse.json(
    { agentId: agent.agent_id, identifier: agent.identifier, runtime, token: minted.token, repo: gw.repo },
    { headers: { "Cache-Control": "no-store" } },
  );
}
