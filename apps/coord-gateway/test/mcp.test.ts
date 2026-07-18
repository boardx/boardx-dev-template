// MCP 接入面测试（F07，真 workerd）：握手、tools/list、tools/call 全链路、
// 撞车 409 → isError 工具结果、evidence 合法/非法、鉴权。
// 命名约定：describe 含 "mcp" 关键字，保证 `pnpm --filter coord-gateway test -- --grep mcp` 能选中。
import { SELF } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { TOOLS } from "../src/mcp";

const MCP_URL = "https://gw.test/api/coord/mcp/boardx/boardx-dev-template";
const AUTH = { authorization: "Bearer test-api-token", "content-type": "application/json" };

// 同 gateway.test.ts：吸收跨测试文件的一次性 DO 失效（vitest-pool-workers singleWorker 特性）
beforeAll(async () => {
  for (let i = 0; i < 2; i++) {
    const r = await SELF.fetch("https://gw.test/api/coord/repos/boardx/boardx-dev-template/claims", {
      headers: { authorization: "Bearer test-api-token" },
    }).catch(() => null);
    if (r?.ok) break;
  }
});

let nextId = 1;
async function rpc(method: string, params?: Record<string, unknown>, headers: Record<string, string> = AUTH) {
  const res = await SELF.fetch(MCP_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, ...(params ? { params } : {}) }),
  });
  return res;
}

async function callTool(name: string, args: Record<string, unknown>) {
  const res = await rpc("tools/call", { name, arguments: args });
  expect(res.status).toBe(200);
  const body = await res.json<{ result: { content: Array<{ type: string; text: string }>; isError: boolean } }>();
  return {
    isError: body.result.isError,
    text: body.result.content[0]!.text,
    data: JSON.parse(body.result.content[0]!.text) as Record<string, unknown>,
  };
}

describe("mcp 握手与协议", () => {
  it("initialize 回显 protocolVersion + capabilities.tools + serverInfo", async () => {
    const res = await rpc("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "test-client", version: "0.0.1" },
    });
    expect(res.status).toBe(200);
    const body = await res.json<{ id: number; result: Record<string, unknown> }>();
    expect(body.result["protocolVersion"]).toBe("2025-06-18");
    expect(body.result["capabilities"]).toEqual({ tools: {} });
    expect((body.result["serverInfo"] as Record<string, unknown>)["name"]).toBe("coord-platform");
  });

  it("notifications/initialized → 202 空回", async () => {
    const res = await SELF.fetch(MCP_URL, {
      method: "POST",
      headers: AUTH,
      body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    });
    expect(res.status).toBe(202);
    expect(await res.text()).toBe("");
  });

  it("未知方法 → JSON-RPC error -32601", async () => {
    const res = await rpc("resources/list");
    const body = await res.json<{ error: { code: number } }>();
    expect(body.error.code).toBe(-32601);
  });

  it("无 token 401（MCP 面与 REST 同一鉴权纪律）", async () => {
    const res = await SELF.fetch(MCP_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    expect(res.status).toBe(401);
  });
});

describe("mcp tools/list", () => {
  it("7 个工具齐全且 schema 完整（schema 即接入文档）", async () => {
    const res = await rpc("tools/list");
    const body = await res.json<{ result: { tools: Array<Record<string, unknown>> } }>();
    const names = body.result.tools.map((t) => t["name"]);
    expect(names).toEqual([
      "claim_issue", "heartbeat", "release", "get_realtime_status",
      "get_ready_work", "get_events", "submit_evidence",
    ]);
    expect(body.result.tools).toHaveLength(TOOLS.length);
    for (const t of body.result.tools) {
      expect(typeof t["description"]).toBe("string");
      expect((t["inputSchema"] as Record<string, unknown>)["type"]).toBe("object");
    }
    // 撞车防护相关约束在 schema 里可见
    const release = body.result.tools.find((t) => t["name"] === "release")!;
    expect((release["inputSchema"] as { required: string[] })["required"]).toContain("handoff_note");
  });
});

describe("mcp tools/call 全链路", () => {
  it("claim_issue 认领成功；第二个 agent 同资源 → isError 且文本含持有者（撞车 409）", async () => {
    const first = await callTool("claim_issue", {
      resource_id: "issue:800", resource_type: "issue", agent_id: "wrk-mcp-1", ttl_seconds: 3600,
    });
    expect(first.isError).toBe(false);
    expect(first.data["status"]).toBe("in_progress");
    const leaseId = first.data["lease_id"] as string;

    const second = await callTool("claim_issue", {
      resource_id: "issue:800", resource_type: "issue", agent_id: "wrk-mcp-2",
    });
    expect(second.isError).toBe(true);
    expect(second.text).toContain("wrk-mcp-1"); // 冲突详情里能看到当前持有者
    expect(second.data["status"]).toBe(409);
    expect((second.data["holder"] as Record<string, unknown>)["agent_id"]).toBe("wrk-mcp-1");

    // heartbeat 续期走通
    const hb = await callTool("heartbeat", { lease_id: leaseId, agent_id: "wrk-mcp-1" });
    expect(hb.isError).toBe(false);

    // release 缺 note → 422 → isError（DO 4xx 映射为工具级错误而非 JSON-RPC error）
    const noNote = await callTool("release", { lease_id: leaseId, agent_id: "wrk-mcp-1", handoff_note: "" });
    expect(noNote.isError).toBe(true);
    expect(noNote.data["status"]).toBe(422);

    const ok = await callTool("release", {
      lease_id: leaseId, agent_id: "wrk-mcp-1",
      handoff_note: "issue:800 MCP 测试租约，验证完毕正常释放。",
    });
    expect(ok.isError).toBe(false);
  });

  it("get_realtime_status 汇总 issues+prs+active_claims；get_ready_work 排除已认领", async () => {
    // 造两个 ready issue，认领其中一个
    const upsert = (n: number) =>
      SELF.fetch("https://gw.test/api/coord/repos/boardx/boardx-dev-template/mirror/upsert", {
        method: "POST",
        // F08 返工：/mirror/upsert 是管理写端点（COORD_ADMIN_TOKEN），普通 token 401
        headers: { authorization: "Bearer test-admin-token", "content-type": "application/json" },
        body: JSON.stringify({
          kind: "issue",
          data: { number: n, state: "open", title: `ready issue ${n}`, labels: ["status:ready-for-dev"], assignees: [] },
        }),
      });
    expect((await upsert(810)).status).toBe(200);
    expect((await upsert(811)).status).toBe(200);
    const claimed = await callTool("claim_issue", {
      resource_id: "issue:810", resource_type: "issue", agent_id: "wrk-mcp-3",
    });
    expect(claimed.isError).toBe(false);

    const status = await callTool("get_realtime_status", {});
    expect(status.isError).toBe(false);
    expect(Array.isArray(status.data["issues"])).toBe(true);
    expect(Array.isArray(status.data["prs"])).toBe(true);
    expect(
      (status.data["active_claims"] as Array<Record<string, unknown>>).some((l) => l["resource_id"] === "issue:810"),
    ).toBe(true);

    const ready = await callTool("get_ready_work", {});
    const numbers = (ready.data["ready"] as Array<Record<string, unknown>>).map((i) => i["number"]);
    expect(numbers).toContain(811);
    expect(numbers).not.toContain(810); // 已有活跃租约的排除
  });

  it("get_events 支持 since 续传", async () => {
    const all = await callTool("get_events", { limit: 500 });
    const events = all.data["events"] as Array<Record<string, unknown>>;
    expect(events.length).toBeGreaterThan(0);
    const last = events.at(-1)!["event_id"] as string;
    const tail = await callTool("get_events", { since: last });
    expect((tail.data["events"] as unknown[]).length).toBe(0);
  });

  it("submit_evidence 合法 → 事件落盘；非法（exit_code 非 0）→ isError 422", async () => {
    const manifest = {
      manifest_id: "evm_mcp_test_01",
      resource_id: "feature:p29/F07",
      agent_id: "wrk-mcp-1",
      head_sha: "abc1234",
      attestations: [{
        command: "pnpm --filter coord-gateway test",
        exit_code: 0,
        output_digest: "sha256:deadbeef",
        output_excerpt: "Tests 12 passed (12)",
        log_url: "phases/phase-p29-coord-platform/evidence/F07.verify.log",
      }],
      attested_at: "2026-07-18T04:00:00Z",
    };
    const ok = await callTool("submit_evidence", manifest);
    expect(ok.isError).toBe(false);
    expect(ok.data["manifest_id"]).toBe("evm_mcp_test_01");

    const bad = await callTool("submit_evidence", {
      ...manifest,
      manifest_id: "evm_mcp_test_02",
      attestations: [{ ...manifest.attestations[0]!, exit_code: 1 }],
    });
    expect(bad.isError).toBe(true);
    expect(bad.data["status"]).toBe(422);

    // 事件流可见 evidence.submitted
    const events = await callTool("get_events", { limit: 500 });
    expect(
      (events.data["events"] as Array<Record<string, unknown>>).some((e) => e["type"] === "evidence.submitted"),
    ).toBe(true);
  });

  it("未知工具 → JSON-RPC -32602", async () => {
    const res = await rpc("tools/call", { name: "rm_rf_slash", arguments: {} });
    const body = await res.json<{ error: { code: number } }>();
    expect(body.error.code).toBe(-32602);
  });
});
