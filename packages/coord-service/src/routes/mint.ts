// mint.ts — 自助 token 领取/轮换（ADR-011 P2，人类拍板 2026-07-14：
// "用户申请加入后，需要在 devportal 直接看到自己的 token，而不是人类手工处理"）。
//
// 信任链（三段，每段都有独立门）：
//   1. 审批 = registry.yaml 的身份条目（含 owner=GitHub login）经 PR review 合并——
//      这一步已有人类把关，本端点不重复审批，只兑现审批结果；
//   2. devportal（Access 门禁后）验证登录者身份，并用 registry owner 匹配确认
//      "这个 agent 属于你"，然后以 broker 身份代调本端点；
//   3. 本端点只接受 kind=token-broker 的调用者（broker token 是 devportal 的
//      服务端 secret，不经浏览器）——broker 是唯一入口，泄露面收敛到一个 secret。
//
// 语义：mint = 生成新 token 并覆盖 token_hash（首次领取与轮换同一动作）。旧 token
// 立即失效——这是 owner 对自己 agent 的合法权力（token 丢失/泄露自救），UI 侧要
// 提示"轮换会使旧 token 失效"。明文 token 只在响应里出现一次，服务端只存 hash。
// 全程写 token-mint 事件（含 requested_by），审计链完整。
import { requireAgent, COORDINATOR_KINDS } from "../auth";
import { HttpError } from "../lib/errors";
import { nowIso } from "../lib/time";
import { sha256Hex } from "../lib/crypto";
import { insertEvent } from "../db/queries";
import type { Env } from "../db/types";
import type { Handler } from "../router";

/** POST /agents/:id/mint-token — 仅 token-broker。body: { requested_by: string } */
export const mintAgentToken: Handler = async (request, env: Env, params) => {
  const caller = await requireAgent(request, env);
  if (caller.kind !== "token-broker") {
    throw new HttpError(403, "mint_requires_token_broker");
  }
  const agentId = params["id"] ?? "";
  if (!agentId) throw new HttpError(400, "missing_agent_id");

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const requestedBy = typeof body["requested_by"] === "string" ? body["requested_by"] : null;
  if (!requestedBy) throw new HttpError(400, "missing_field:requested_by");

  const target = await env.DB.prepare("SELECT id, kind, active FROM agents WHERE id = ?")
    .bind(agentId)
    .first<{ id: string; kind: string; active: number }>();
  if (!target || !target.active) throw new HttpError(404, "agent_unknown_or_inactive");
  // broker 自身与**全部**协调层身份（coordinator / module-coordinator /
  // architecture-coordinator，见 auth.ts COORDINATOR_KINDS）不允许经自助通道轮换
  // ——这些是共享基础设施的钥匙且持 andon 停线权，轮换走人类授权的运维流程
  // （OPERATIONS.md §2），不走开发者自助面。安全审查 #629：此处曾只挡
  // "coordinator" 字面量，漏了 module-/architecture-coordinator，构成协调层身份
  // 自助 mint 的提权洞——改用 COORDINATOR_KINDS 全集。
  if (target.kind === "token-broker" || COORDINATOR_KINDS.has(target.kind)) {
    throw new HttpError(403, "identity_not_self_serviceable");
  }

  // Workers 运行时的 CSPRNG；base64url 对齐 seed-agents.ts 的 token 形态
  const raw = new Uint8Array(32);
  crypto.getRandomValues(raw);
  const token = btoa(String.fromCharCode(...raw)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const tokenHash = await sha256Hex(token);
  const at = nowIso();

  await env.DB.prepare("UPDATE agents SET token_hash = ? WHERE id = ?").bind(tokenHash, agentId).run();
  await insertEvent(env.DB, {
    type: "token-mint",
    resourceId: `agent:${agentId}`,
    agentId: caller.id,
    payload: { requested_by: requestedBy },
    at,
  });
  // 明文只出现在这一个响应里；调用方（devportal）直接透传给浏览器，不落任何存储
  return Response.json({ agent_id: agentId, token, minted_at: at }, { status: 201 });
};
