// coord-gateway 测试（真 workerd）：签名校验、fail-closed、REST 鉴权转发、
// 消费者幂等（同 delivery 重放不产生重复镜像事件）。
import { SELF, env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import worker from "../src/index";
import type { QueuedWebhook } from "../src/mapping";

const SECRET = "test-webhook-secret";
const enc = new TextEncoder();

async function sign(body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(body)));
  return "sha256=" + [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function issuePayload(number: number, state = "open"): string {
  return JSON.stringify({
    repository: { full_name: "boardx/boardx-dev-template" },
    issue: {
      number,
      state,
      title: `测试 issue ${number}`,
      labels: [{ name: "status:ready-for-dev" }],
      assignees: [{ login: "wrk-1" }],
    },
  });
}

async function postWebhook(body: string, opts: { sig?: string; delivery?: string; event?: string } = {}) {
  return SELF.fetch("https://gw.test/api/coord/webhooks/github", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-hub-signature-256": opts.sig ?? (await sign(body)),
      "x-github-delivery": opts.delivery ?? "dlv-1",
      "x-github-event": opts.event ?? "issues",
    },
    body,
  });
}

// 直接驱动消费者逻辑（Queues 在测试环境不自动 flush）
async function consume(msg: QueuedWebhook): Promise<{ acked: number; retried: number }> {
  let acked = 0, retried = 0;
  const batch = {
    queue: "coord-webhook-events",
    messages: [{
      id: "m1", timestamp: new Date(), attempts: 1, body: msg,
      ack: () => { acked++; }, retry: () => { retried++; },
    }],
    ackAll: () => {}, retryAll: () => {},
  } as unknown as MessageBatch<QueuedWebhook>;
  await worker.queue(batch, env);
  return { acked, retried };
}

describe("webhook 入口", () => {
  it("healthz 报告配置状态", async () => {
    const r = await SELF.fetch("https://gw.test/api/coord/healthz");
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, webhook_configured: true, api_configured: true });
  });

  it("合法签名 → 202 入队；坏签名/缺头 → 401/400", async () => {
    const body = issuePayload(1);
    expect((await postWebhook(body)).status).toBe(202);
    expect((await postWebhook(body, { sig: "sha256=" + "0".repeat(64) })).status).toBe(401);
    expect((await postWebhook(body, { sig: "nonsense" })).status).toBe(401);
    const noRepo = JSON.stringify({ issue: { number: 1 } });
    expect((await postWebhook(noRepo)).status).toBe(400);
  });
});

describe("消费者幂等（F03 核心断言）", () => {
  it("同 delivery GUID 重放：镜像只更新一次，事件不重复", async () => {
    const msg: QueuedWebhook = {
      delivery_id: "dlv-dup-1",
      event: "issues",
      repo: "boardx/boardx-dev-template",
      payload: JSON.parse(issuePayload(42)),
    };
    expect(await consume(msg)).toEqual({ acked: 1, retried: 0 });
    expect(await consume(msg)).toEqual({ acked: 1, retried: 0 }); // 重放 ack 不 retry

    const token = { headers: { authorization: "Bearer test-api-token" } };
    const events = await (
      await SELF.fetch(
        "https://gw.test/api/coord/repos/boardx/boardx-dev-template/events?limit=500", token,
      )
    ).json<{ events: Array<Record<string, unknown>> }>();
    const updates = events.events.filter(
      (e) => e["type"] === "mirror.updated" && e["resource_id"] === "issue:42",
    );
    expect(updates).toHaveLength(1); // 幂等：两次消费只产生一条 mirror.updated
  });

  it("pull_request 事件映射 mergeable/head_sha/merged 语义", async () => {
    const msg: QueuedWebhook = {
      delivery_id: "dlv-pr-1",
      event: "pull_request",
      repo: "boardx/boardx-dev-template",
      payload: {
        repository: { full_name: "boardx/boardx-dev-template" },
        pull_request: {
          number: 705, state: "open", merged: false, draft: false,
          title: "feat(p29/F04+F05): RepoHub DO",
          head: { sha: "abc1234" }, mergeable: true, mergeable_state: "clean",
          labels: [{ name: "status:in-review" }], assignees: [],
        },
      },
    };
    await consume(msg);
    const pr = await (
      await SELF.fetch("https://gw.test/api/coord/repos/boardx/boardx-dev-template/realtime/prs/705", {
        headers: { authorization: "Bearer test-api-token" },
      })
    ).json<Record<string, unknown>>();
    expect(pr["mergeable"]).toBe("MERGEABLE");
    expect(pr["merge_state"]).toBe("CLEAN");
    expect(pr["head_sha"]).toBe("abc1234");
    expect(typeof pr["mirrored_at"]).toBe("string");
  });
});

describe("REST 网关鉴权", () => {
  it("无 token 401；带 token 全链路 claim 201", async () => {
    const path = "https://gw.test/api/coord/repos/boardx/boardx-dev-template/claims";
    expect((await SELF.fetch(path, { method: "POST", body: "{}" })).status).toBe(401);
    const r = await SELF.fetch(path, {
      method: "POST",
      headers: { authorization: "Bearer test-api-token", "content-type": "application/json" },
      body: JSON.stringify({
        protocol: "coord/0.1", resource_id: "issue:900", resource_type: "issue",
        agent_id: "wrk-gw", ttl_seconds: 3600,
      }),
    });
    expect(r.status).toBe(201);
  });
});
