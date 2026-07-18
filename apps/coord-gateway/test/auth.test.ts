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
