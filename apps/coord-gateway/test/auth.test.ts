// F08 auth 测试（真 workerd）：按仓 scoped token 全生命周期——
// admin mint → 本仓 REST/MCP 200 → 伪造他仓路径 403 → revoke → 401；
// COORD_API_TOKEN 万能钥匙仍可用；管理面特权隔离；缺配置 fail-closed。
import { SELF } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";

const REPO = "boardx/boardx-dev-template";
const OTHER = "boardx/other-repo";
const API = (repo: string, sub: string) => `https://gw.test/api/coord/repos/${repo}${sub}`;
const ADMIN = { authorization: "Bearer test-admin-token", "content-type": "application/json" };

// 吸收 vitest-pool-workers singleWorker 跨文件 transform 造成的一次性 DO 失效（同 gateway.test.ts）
beforeAll(async () => {
  for (let i = 0; i < 2; i++) {
    const r = await SELF.fetch(API(REPO, "/claims"), {
      headers: { authorization: "Bearer test-api-token" },
    }).catch(() => null);
    if (r?.ok) break;
  }
});

async function mint(agentId: string): Promise<{ token: string; token_hash_prefix: string }> {
  const r = await SELF.fetch(API(REPO, "/tokens/mint"), {
    method: "POST",
    headers: ADMIN,
    body: JSON.stringify({ agent_id: agentId, owner: "usam.shen@gmail.com" }),
  });
  expect(r.status).toBe(201);
  return r.json();
}

describe("scoped token auth（F08）", () => {
  it("mint（admin 特权）→ 明文只返回一次，形如 coordtk_<64hex>", async () => {
    const minted = await mint("wrk-auth-1");
    expect(minted.token).toMatch(/^coordtk_[0-9a-f]{64}$/);
    expect(minted.token_hash_prefix).toMatch(/^[0-9a-f]{8}$/);
    // 列表接口拿不回明文，也拿不到完整 hash
    const list = await (
      await SELF.fetch(API(REPO, "/tokens"), { headers: ADMIN })
    ).json<{ tokens: Array<Record<string, unknown>> }>();
    const row = list.tokens.find((t) => t["agent_id"] === "wrk-auth-1");
    expect(row).toBeDefined();
    expect(JSON.stringify(row)).not.toContain(minted.token);
    expect(row!["token_hash_prefix"]).toBe(minted.token_hash_prefix);
  });

  it("scoped token：本仓 REST 200 → 伪造他仓路径 403 → revoke → 401（吊销即时生效）", async () => {
    const { token, token_hash_prefix } = await mint("wrk-auth-2");
    const bearer = { authorization: `Bearer ${token}` };

    // 本仓 API 放行
    const ok = await SELF.fetch(API(REPO, "/claims"), { headers: bearer });
    expect(ok.status).toBe(200);

    // 伪造他仓路径：token 在他仓 DO 无记录 → 403（按仓 scope 天然成立）
    const cross = await SELF.fetch(API(OTHER, "/claims"), { headers: bearer });
    expect(cross.status).toBe(403);
    expect((await cross.json<Record<string, unknown>>())["error"]).toBe("token_not_valid_for_repo");

    // revoke（admin 特权，按 hash 前缀）→ 随后请求 401，无缓存窗口
    const rv = await SELF.fetch(API(REPO, "/tokens/revoke"), {
      method: "POST", headers: ADMIN,
      body: JSON.stringify({ token_hash_prefix }),
    });
    expect(rv.status).toBe(200);
    const after = await SELF.fetch(API(REPO, "/claims"), { headers: bearer });
    expect(after.status).toBe(401);
    expect((await after.json<Record<string, unknown>>())["error"]).toBe("token_revoked");
  });

  it("scoped token 可调 MCP 面；跨仓 MCP 同样 403", async () => {
    const { token } = await mint("wrk-auth-mcp");
    const rpc = {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    };
    const ok = await SELF.fetch(`https://gw.test/api/coord/mcp/boardx/boardx-dev-template`, rpc);
    expect(ok.status).toBe(200);
    const cross = await SELF.fetch(`https://gw.test/api/coord/mcp/boardx/other-repo`, rpc);
    expect(cross.status).toBe(403);
  });

  it("COORD_API_TOKEN 万能钥匙仍可用（REST 与跨仓均放行）", async () => {
    const ops = { headers: { authorization: "Bearer test-api-token" } };
    expect((await SELF.fetch(API(REPO, "/claims"), ops)).status).toBe(200);
    expect((await SELF.fetch(API(OTHER, "/claims"), ops)).status).toBe(200);
  });

  it("伪造/随机 token 403；无 token 401", async () => {
    const fake = `coordtk_${"ab".repeat(32)}`;
    const r = await SELF.fetch(API(REPO, "/claims"), {
      headers: { authorization: `Bearer ${fake}` },
    });
    expect(r.status).toBe(403);
    expect((await SELF.fetch(API(REPO, "/claims"))).status).toBe(401);
  });

  it("token 管理面特权隔离：无 token/普通 API token 401；scoped token 也不可自我管理", async () => {
    const { token } = await mint("wrk-auth-priv");
    const body = JSON.stringify({ agent_id: "evil", owner: "evil" });
    const attempts: Array<Record<string, string>> = [
      { "content-type": "application/json" },
      { authorization: "Bearer test-api-token", "content-type": "application/json" },
      { authorization: `Bearer ${token}`, "content-type": "application/json" },
    ];
    for (const headers of attempts) {
      const r = await SELF.fetch(API(REPO, "/tokens/mint"), { method: "POST", headers, body });
      expect(r.status).toBe(401);
      // GET /tokens（枚举）同样是 admin 面
      const l = await SELF.fetch(API(REPO, "/tokens"), { headers });
      expect(l.status).toBe(401);
    }
  });

  it("缺 COORD_ADMIN_TOKEN 配置 → mint 503 fail-closed；缺 COORD_API_TOKEN → REST 503", async () => {
    const { env } = await import("cloudflare:test");
    const worker = (await import("../src/index")).default;
    const mintReq = new Request(API(REPO, "/tokens/mint"), {
      method: "POST", headers: ADMIN,
      body: JSON.stringify({ agent_id: "x", owner: "y" }),
    });
    expect((await worker.fetch(mintReq, { ...env, COORD_ADMIN_TOKEN: undefined })).status).toBe(503);
    const restReq = new Request(API(REPO, "/claims"), {
      headers: { authorization: "Bearer whatever" },
    });
    expect((await worker.fetch(restReq, { ...env, COORD_API_TOKEN: undefined })).status).toBe(503);
  });

  it("agent_id 强绑定（REST，#721）：冒充他人 403；一致放行；缺省注入 token 身份", async () => {
    const { token } = await mint("wrk-bind-1");
    const bearer = { authorization: `Bearer ${token}`, "content-type": "application/json" };
    const claim = (agent?: string, resource = "issue:8801") =>
      SELF.fetch(API(REPO, "/claims"), {
        method: "POST", headers: bearer,
        body: JSON.stringify({
          protocol: "coord/0.1", resource_id: resource, resource_type: "issue",
          ...(agent !== undefined ? { agent_id: agent } : {}), ttl_seconds: 3600,
        }),
      });

    // 冒充他人 agent_id → 403，DO 完全不被触达
    const forged = await claim("someone-else");
    expect(forged.status).toBe(403);
    expect((await forged.json<Record<string, unknown>>())["error"]).toBe("token_agent_mismatch");

    // 与 token 在册身份一致 → 放行 201
    expect((await claim("wrk-bind-1")).status).toBe(201);

    // 缺省 agent_id → 注入 token 身份（heartbeat/release 同一通道，验证注入结果）
    const injected = await claim(undefined, "issue:8802");
    expect(injected.status).toBe(201);
    const lease = await injected.json<Record<string, unknown>>();
    expect(lease["agent_id"]).toBe("wrk-bind-1");

    // 冒充释放他人租约同样 403（release 走同一强绑定）
    const rel = await SELF.fetch(API(REPO, `/claims/${lease["lease_id"]}/release`), {
      method: "POST", headers: bearer,
      body: JSON.stringify({ protocol: "coord/0.1", agent_id: "someone-else", handoff_note: "12345678901" }),
    });
    expect(rel.status).toBe(403);
    expect((await rel.json<Record<string, unknown>>())["error"]).toBe("token_agent_mismatch");
  });

  it("agent_id 强绑定（MCP 面，#721）：工具参数冒充 403；缺省注入", async () => {
    const { token } = await mint("wrk-bind-mcp");
    const call = (args: Record<string, unknown>) =>
      SELF.fetch(`https://gw.test/api/coord/mcp/boardx/boardx-dev-template`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", id: 1, method: "tools/call",
          params: { name: "claim_issue", arguments: { resource_id: "issue:8803", resource_type: "issue", ...args } },
        }),
      });
    const forged = await call({ agent_id: "someone-else" });
    expect(forged.status).toBe(403);
    expect((await forged.json<Record<string, unknown>>())["error"]).toBe("token_agent_mismatch");

    const injected = await call({}); // 缺省 → 注入 token 身份
    expect(injected.status).toBe(200);
    const rpc = await injected.json<{ result: { content: Array<{ text: string }>; isError: boolean } }>();
    expect(rpc.result.isError).toBe(false);
    expect((JSON.parse(rpc.result.content[0]!.text) as Record<string, unknown>)["agent_id"]).toBe("wrk-bind-mcp");
  });

  it("ops 万能钥匙不受强绑定（运维语义维持自证 agent_id）", async () => {
    const r = await SELF.fetch(API(REPO, "/claims"), {
      method: "POST",
      headers: { authorization: "Bearer test-api-token", "content-type": "application/json" },
      body: JSON.stringify({
        protocol: "coord/0.1", resource_id: "issue:8804", resource_type: "issue",
        agent_id: "any-ops-identity", ttl_seconds: 3600,
      }),
    });
    expect(r.status).toBe(201);
  });

  it("REST 可达面 allowlist：内部/管理写端点对普通 token 一律 404", async () => {
    const { token } = await mint("wrk-allow-1");
    for (const auth of [`Bearer ${token}`, "Bearer test-api-token"]) {
      const headers = { authorization: auth, "content-type": "application/json" };
      // /mirror/upsert 挂 admin 面：普通 token（scoped/API）401，不进 DO
      const mirror = await SELF.fetch(API(REPO, "/mirror/upsert"), {
        method: "POST", headers,
        body: JSON.stringify({ kind: "issue", data: { number: 9999, state: "open", title: "x" } }),
      });
      expect(mirror.status).toBe(401);
      expect((await SELF.fetch(API(REPO, "/webhook/ingest"), { method: "POST", headers, body: "{}" })).status).toBe(404);
      expect((await SELF.fetch(API(REPO, "/projector/cursor"), { headers })).status).toBe(404);
      // 允许面之外的方法也拒（andon 只放 GET）
      expect((await SELF.fetch(API(REPO, "/andon"), { method: "POST", headers, body: "{}" })).status).toBe(401); // admin 路由把守
      expect((await SELF.fetch(API(REPO, "/events"), { method: "POST", headers, body: "{}" })).status).toBe(404);
    }
  });

  it("/mirror/upsert 挂 admin 面：COORD_ADMIN_TOKEN 可用（backfill 脚本通道）", async () => {
    const r = await SELF.fetch(API(REPO, "/mirror/upsert"), {
      method: "POST", headers: ADMIN,
      body: JSON.stringify({ kind: "issue", data: { number: 9001, state: "open", title: "backfill" } }),
    });
    expect(r.status).toBe(200);
  });

  it("REST 透传不得触达 DO token 接口（/tokens/verify 直连 404，防绕过管理面）", async () => {
    const r = await SELF.fetch(API(REPO, "/tokens/verify"), {
      method: "POST",
      headers: { authorization: "Bearer test-api-token", "content-type": "application/json" },
      body: JSON.stringify({ token_hash: "0".repeat(64) }),
    });
    expect(r.status).toBe(404);
    expect((await r.json<Record<string, unknown>>())["error"]).toBe("not_found");
  });
});
