// coord-gateway：webhook ingest（签名校验 → Queues 削峰 → DO 幂等消费）
// + REST 网关（bearer 鉴权 → 转发 RepoHub DO）。F08 落地后 bearer 换按仓 scoped token。
import { RepoHub } from "@repo/coord-repohub";
import { verifyWebhookSignature } from "./signature";
import { toIngestBody, type QueuedWebhook } from "./mapping";

export { RepoHub };

export interface Env {
  REPOHUB: DurableObjectNamespace;
  WEBHOOK_QUEUE: Queue<QueuedWebhook>;
  GITHUB_WEBHOOK_SECRET?: string;
  COORD_API_TOKEN?: string;
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

async function handleRest(req: Request, env: Env, url: URL): Promise<Response> {
  if (!env.COORD_API_TOKEN) return json(503, { error: "api_token_not_configured" });
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${env.COORD_API_TOKEN}`) return json(401, { error: "unauthorized" });
  const m = url.pathname.match(/^\/api\/coord\/repos\/([^/]+)\/([^/]+)(\/.*)$/);
  if (!m) return json(404, { error: "not_found" });
  return repoStub(env, `${m[1]}/${m[2]}`).fetch(
    new Request(new URL(m[3]! + url.search, url.origin), req),
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
    if (req.method === "POST" && url.pathname === "/api/coord/webhooks/github")
      return handleWebhook(req, env);
    if (url.pathname.startsWith("/api/coord/repos/")) return handleRest(req, env, url);
    return json(404, { error: "not_found" });
  },

  // Queues 消费者：逐条转发对应仓库的 DO 幂等入口。DO 侧按 delivery GUID 去重，
  // 因此 Queues 的 at-least-once 重投递不会产生重复镜像事件。
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
