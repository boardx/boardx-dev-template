// coord-gateway：webhook ingest（签名校验 → Queues 削峰 → DO 幂等消费）
// + REST 网关（bearer 鉴权 → 转发 RepoHub DO）。F08：按仓 scoped token 优先，
// COORD_API_TOKEN 保留为 ops 万能钥匙；mint/revoke 走 COORD_ADMIN_TOKEN 管理面（auth.ts）。
import { RepoHub } from "@repo/coord-repohub";
import { PlatformDirectory } from "@repo/coord-directory";
import { describeCycle } from "./cycle";
import { handleDirectory } from "./directory";
import { verifyWebhookSignature } from "./signature";
import { toIngestBody, type QueuedWebhook } from "./mapping";
import { runProjectionTick } from "./projection";
import { handleMcp } from "./mcp";
import {
  authorizeRepoAccess,
  bindScopedAgentRequest,
  bindScopedInboxQuery,
  isAdminBearer,
  isAllowedRestSubpath,
  requireAdmin,
} from "./auth";
import { handleStreamRoute } from "./stream";

export { RepoHub, PlatformDirectory };

export interface Env {
  REPOHUB: DurableObjectNamespace;
  // 平台目录单例 DO（p30/F01）：Project/Membership/Enrollment 领域模型
  DIRECTORY: DurableObjectNamespace;
  WEBHOOK_QUEUE: Queue<QueuedWebhook>;
  GITHUB_WEBHOOK_SECRET?: string;
  COORD_API_TOKEN?: string;
  // andon 是 maintainer 特权：独立 secret，普通 API token 不可发（F06）
  COORD_ADMIN_TOKEN?: string;
  // 反向投影（F06）：GitHub App 凭据 + 投影目标仓（逗号分隔）
  GITHUB_APP_ID?: string;
  GITHUB_APP_PRIVATE_KEY?: string;
  PROJECTION_REPOS?: string;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function repoStub(env: Env, repo: string): DurableObjectStub {
  return env.REPOHUB.get(env.REPOHUB.idFromName(repo));
}

async function handleWebhook(req: Request, env: Env): Promise<Response> {
  // 缺配置 fail-closed（503 而非放行）——纪律：静默 fail-open 是被 ADR-017 处决的缺陷
  if (!env.GITHUB_WEBHOOK_SECRET) return json(503, { error: "webhook_secret_not_configured" });
  const body = await req.text();
  const ok = await verifyWebhookSignature(
    env.GITHUB_WEBHOOK_SECRET, body, req.headers.get("x-hub-signature-256"),
  );
  if (!ok) return json(401, { error: "invalid_signature" });

  const deliveryId = req.headers.get("x-github-delivery");
  const event = req.headers.get("x-github-event");
  if (!deliveryId || !event) return json(400, { error: "missing_webhook_headers" });

  const payload = JSON.parse(body) as Record<string, unknown>;
  const repoFull = ((payload["repository"] ?? {}) as Record<string, unknown>)["full_name"];
  if (typeof repoFull !== "string") return json(400, { error: "missing_repository" });

  await env.WEBHOOK_QUEUE.send({ delivery_id: deliveryId, event, repo: repoFull, payload });
  return json(202, { ok: true, queued: true });
}

// 管理路由（F06 andon / F08 tokens）：独立 COORD_ADMIN_TOKEN 把守——maintainer 特权，
// 普通 COORD_API_TOKEN 不可发。鉴权细节在 auth.ts（requireAdmin，fail-closed）。
async function handleAdmin(req: Request, env: Env, repo: string, subpath: string): Promise<Response> {
  const denied = requireAdmin(req, env);
  if (denied) return denied;
  return repoStub(env, repo).fetch(new Request(`https://repohub${subpath}`, req));
}

async function handleRest(req: Request, env: Env, url: URL): Promise<Response> {
  const m = url.pathname.match(/^\/api\/coord\/repos\/([^/]+)\/([^/]+)(\/.*)$/);
  if (!m) return json(404, { error: "not_found" });
  // 可达面 allowlist（F08 返工）：普通 token（scoped/API）只触达协调端点；
  // /mirror/upsert（admin 面，上面已路由）、/webhook/ingest、/projector/*、/tokens*
  // 等内部/管理写端点一律 404。内部消费者（Queues/投影 cron）走 DO stub 不经此处。
  if (!isAllowedRestSubpath(req.method, m[3]!)) return json(404, { error: "not_found" });
  const access = await authorizeRepoAccess(req, env, `${m[1]}/${m[2]}`);
  if (!access.granted) return access.response;
  // agent_id 强绑定（#721）：scoped token 不得在 body 里自证他人身份
  const bound = await bindScopedAgentRequest(req, access.principal);
  if (bound instanceof Response) return bound;
  // 收件箱可见性（F10-pre）：scoped token 的 GET /tasks 强制 assignee=<本人>
  let search = url.search;
  if (req.method === "GET" && m[3] === "/tasks") {
    const inbox = bindScopedInboxQuery(url.searchParams, access.principal);
    if (inbox instanceof Response) return inbox;
    search = `?${inbox.toString()}`;
  }
  return repoStub(env, `${m[1]}/${m[2]}`).fetch(
    new Request(new URL(m[3]! + search, url.origin), bound),
  );
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/api/coord/healthz")
      return json(200, {
        ok: true,
        webhook_configured: Boolean(env.GITHUB_WEBHOOK_SECRET),
        api_configured: Boolean(env.COORD_API_TOKEN),
      });
    // 权威时钟（ADR-014，迁自 coord-service GET /time，语义零变更）：公开只读、
    // 不接受入参、不写库——任何 runtime（CC/Codex/裸脚本/CI）都能读，无需 token。
    if (req.method === "GET" && url.pathname === "/api/coord/time") {
      const now = new Date();
      return json(200, { now: now.toISOString(), epoch_ms: now.getTime(), cycle: describeCycle(now) });
    }
    if (req.method === "POST" && url.pathname === "/api/coord/webhooks/github")
      return handleWebhook(req, env);
    const andon = url.pathname.match(/^\/api\/coord\/repos\/([^/]+)\/([^/]+)(\/andon)$/);
    if (req.method === "POST" && andon)
      return handleAdmin(req, env, `${andon[1]}/${andon[2]}`, andon[3]!);
    // token 管理面（F08）：mint/revoke/list 是 maintainer 特权（COORD_ADMIN_TOKEN）
    const tok = url.pathname.match(/^\/api\/coord\/repos\/([^/]+)\/([^/]+)(\/tokens(?:\/(?:mint|revoke))?)$/);
    if (tok && ((req.method === "POST" && tok[3] !== "/tokens") || (req.method === "GET" && tok[3] === "/tokens")))
      return handleAdmin(req, env, `${tok[1]}/${tok[2]}`, tok[3]!);
    // 镜像回填（F04 backfill-mirror.sh）是管理写端点（F08 返工挂 admin 面）：
    // 常规镜像增量走 webhook→Queues→DO stub，不经此路由
    const mir = url.pathname.match(/^\/api\/coord\/repos\/([^/]+)\/([^/]+)(\/mirror\/upsert)$/);
    if (req.method === "POST" && mir)
      return handleAdmin(req, env, `${mir[1]}/${mir[2]}`, mir[3]!);
    // tasks 派工面（F10-pre）：POST /tasks（派工）、/tasks/:id/recall（撤回）、
    // /tasks/import（割接导入）是 COORD_ADMIN_TOKEN 管理特权（原 coord-service
    // COORDINATOR_KINDS 判定的迁移落点）；GET /tasks 带 admin bearer（devportal
    // broker，assignee=* 列全队，#706）直通管理面，其余落下方 REST scoped 面。
    const tasks = url.pathname.match(/^\/api\/coord\/repos\/([^/]+)\/([^/]+)(\/tasks(?:\/import|\/\d+\/recall)?)$/);
    if (tasks) {
      if (req.method === "POST")
        return handleAdmin(req, env, `${tasks[1]}/${tasks[2]}`, tasks[3]!);
      if (req.method === "GET" && tasks[3] === "/tasks" && isAdminBearer(req, env))
        return handleAdmin(req, env, `${tasks[1]}/${tasks[2]}`, `/tasks${url.search}`);
    }
    // WS 实时流 + 一次性 ticket（F09）：逻辑全在 src/stream.ts，这里只做路由
    const stream = url.pathname.match(/^\/api\/coord\/repos\/([^/]+)\/([^/]+)\/(stream|stream-ticket)$/);
    if (stream)
      return handleStreamRoute(req, env, `${stream[1]}/${stream[2]}`, stream[3] as "stream" | "stream-ticket", url);
    if (url.pathname.startsWith("/api/coord/repos/")) return handleRest(req, env, url);
    // 平台目录面（p30/F01）：逻辑全在 src/directory.ts，这里只做路由
    if (url.pathname.startsWith("/api/coord/directory/")) return handleDirectory(req, env, url);
    // MCP 接入面（F07）：逻辑全在 src/mcp.ts，这里只做路由（降低与并行改动的冲突面）
    const mcp = url.pathname.match(/^\/api\/coord\/mcp\/([^/]+)\/([^/]+)$/);
    if (mcp) return handleMcp(req, env, mcp[1]!, mcp[2]!);
    return json(404, { error: "not_found" });
  },

  // 反向投影 cron（F06）：每 tick 逐仓 事件→引擎→GitHub→游标。编排在 projection.ts。
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runProjectionTick(env));
  },

  // Queues 消费者：逐条转发对应仓库的 DO 幂等入口。DO 侧按 delivery GUID 去重，
  // 因此 Queues 的 at-least-once 重投递不会产生重复镜像事件。
  // 毒消息（持续非 ok/非 422）重试 max_retries 次后进 coord-webhook-dlq（#712，
  // wrangler.toml dead_letter_queue）。DLQ 处置约定：人工重放，暂无自动消费者。
  async queue(batch: MessageBatch<QueuedWebhook>, env: Env): Promise<void> {
    for (const msg of batch.messages) {
      const res = await repoStub(env, msg.body.repo).fetch("https://repohub/webhook/ingest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(toIngestBody(msg.body)),
      });
      if (res.ok || res.status === 422) msg.ack(); // 422=坏消息，重试也不会好，ack 丢弃
      else msg.retry();
    }
  },
};
