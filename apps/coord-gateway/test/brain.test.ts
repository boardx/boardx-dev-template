// CoordBrain 影子模式集成测试（真 workerd，R1，p30-F10）：
//   ① runShadowTick 读 RepoHub 只读端点 → 纯函数判定 → 写 CoordBrain 自己的
//      shadow_events（本地 INSERT，验证零外部写：本文件全程不 mock/断言任何
//      GitHub API 调用被触发——因为代码里根本没有那样的调用）；
//   ② 边界核心：andon 激活时，同一个全绿 PR 的 merge_ready 决策必须从 true 翻转为 false；
//   ③ 只读面鉴权矩阵（同 REST 协调面口径）：无 token 401 / 跨仓 token 403 / ops 200。
import { SELF, env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { runShadowTick } from "../src/brain";

const REPO = "boardx/coord-brain-shadow-test";
const API = (sub: string) => `https://gw.test/api/coord/repos/${REPO}${sub}`;
const ADMIN = { authorization: "Bearer test-admin-token", "content-type": "application/json" };
const OPS = { authorization: "Bearer test-api-token", "content-type": "application/json" };

interface ShadowDecisionWire {
  rule: string;
  subject_id: string;
  decision: boolean;
  reason: string;
  detail: Record<string, unknown> | null;
}

// 吸收 vitest-pool-workers singleWorker 跨文件 transform 造成的一次性 DO 失效（同其他测试文件）。
// 本文件会触达两个不同仓的 DO（REPO 与 boardx/other-repo），两个都要预热一次，
// 否则第一次真正断言时撞上"changed, invalidating"重试要求而非预期状态码。
async function warm(repo: string): Promise<void> {
  for (let i = 0; i < 2; i++) {
    const r = await SELF.fetch(`https://gw.test/api/coord/repos/${repo}/claims`, {
      headers: { authorization: "Bearer test-api-token" },
    }).catch(() => null);
    if (r?.ok) break;
  }
}

beforeAll(async () => {
  await warm(REPO);
  await warm("boardx/other-repo");
});

async function mirrorPr(number: number, mergeable: string, mergeState: string): Promise<void> {
  const r = await SELF.fetch(API("/mirror/upsert"), {
    method: "POST", headers: ADMIN,
    body: JSON.stringify({
      kind: "pr",
      data: {
        number, state: "open", title: `测试 PR ${number}`, mergeable, merge_state: mergeState,
        head_sha: `sha-${number}`, labels: [], assignees: [], created_at: new Date().toISOString(),
      },
    }),
  });
  expect(r.status).toBe(200);
}

async function mirrorIssue(number: number, labels: string[]): Promise<void> {
  const r = await SELF.fetch(API("/mirror/upsert"), {
    method: "POST", headers: ADMIN,
    body: JSON.stringify({
      kind: "issue",
      data: { number, state: "open", title: `测试 issue ${number}`, labels, assignees: [] },
    }),
  });
  expect(r.status).toBe(200);
}

async function shadowDecisions(headers: Record<string, string>): Promise<Response> {
  return SELF.fetch(API("/shadow-decisions"), { headers });
}

describe("CoordBrain runShadowTick — 只读观察 + 记录，零写 API", () => {
  it("全绿 PR + ready-for-dev issue → 影子决策命中 merge_ready=true 与 dispatch_suggested=true", async () => {
    await mirrorPr(9001, "MERGEABLE", "CLEAN");
    await mirrorIssue(9002, ["status:ready-for-dev", "module:brain-test"]);

    await runShadowTick({
      ...env,
      PROJECTION_REPOS: REPO,
      COORD_BRAIN_AFFINITY: JSON.stringify({ "module:brain-test": "agent-brain-test-1" }),
    });

    const res = await shadowDecisions(OPS);
    expect(res.status).toBe(200);
    const body = await res.json<{ decisions: ShadowDecisionWire[] }>();
    expect(Array.isArray(body.decisions)).toBe(true);

    const merge = body.decisions.find((d) => d.rule === "merge_ready" && d.subject_id === "pr:9001");
    expect(merge?.decision).toBe(true);

    const dispatch = body.decisions.find((d) => d.rule === "dispatch_suggested" && d.subject_id === "issue:9002");
    expect(dispatch?.decision).toBe(true);
    expect(dispatch?.detail?.["suggested_assignee"]).toBe("agent-brain-test-1");

    const freeze = body.decisions.find((d) => d.rule === "andon_freeze");
    expect(freeze?.decision).toBe(false);
  });

  it("边界核心：andon 激活后，同一个全绿 PR 的 merge_ready 决策必须翻转为 false", async () => {
    // 复用上一测试已镜像的全绿 PR 9001，先确认 andon 前 ready，再停线后再判一次
    const raise = await SELF.fetch(`${API("/andon")}`, {
      method: "POST", headers: ADMIN,
      body: JSON.stringify({ action: "raise", scope: "repo", severity: "stop-merge", reason: "边界测试：停线中禁止机械合并判定为真", agent_id: "test-op" }),
    });
    expect(raise.status).toBe(200);

    await runShadowTick({ ...env, PROJECTION_REPOS: REPO, COORD_BRAIN_AFFINITY: "{}" });

    const res = await shadowDecisions(OPS);
    const body = await res.json<{ decisions: ShadowDecisionWire[] }>();
    const merge = body.decisions.find((d) => d.rule === "merge_ready" && d.subject_id === "pr:9001");
    expect(merge?.decision).toBe(false);
    expect(merge?.reason).toBe("andon_active");
    const freeze = body.decisions.find((d) => d.rule === "andon_freeze");
    expect(freeze?.decision).toBe(true);

    // 清线，不影响后续测试文件（fail-open 到人不留残留状态）
    const clear = await SELF.fetch(`${API("/andon")}`, {
      method: "POST", headers: ADMIN,
      body: JSON.stringify({ action: "clear", scope: "repo", reason: "边界测试收尾，恢复正常判定", agent_id: "test-op" }),
    });
    expect(clear.status).toBe(200);
  });
});

describe("GET /shadow-decisions — 只读面鉴权矩阵（同 REST 协调面口径）", () => {
  it("无 token → 401", async () => {
    expect((await shadowDecisions({})).status).toBe(401);
  });

  it("跨仓 scoped token → 403（token_not_valid_for_repo）", async () => {
    const mint = await SELF.fetch(`https://gw.test/api/coord/repos/boardx/other-repo/tokens/mint`, {
      method: "POST", headers: ADMIN,
      body: JSON.stringify({ agent_id: "wrk-other", owner: "usam.shen@gmail.com" }),
    });
    expect(mint.status).toBe(201);
    const { token } = await mint.json<{ token: string }>();
    const res = await shadowDecisions({ authorization: `Bearer ${token}` });
    expect(res.status).toBe(403);
  });

  it("ops 万能钥匙 → 200 且 decisions 是数组", async () => {
    const res = await shadowDecisions(OPS);
    expect(res.status).toBe(200);
    const body = await res.json<{ decisions: unknown }>();
    expect(Array.isArray(body.decisions)).toBe(true);
  });

  it("POST 方法不允许（只读面）", async () => {
    const res = await SELF.fetch(API("/shadow-decisions"), { method: "POST", headers: OPS });
    expect(res.status).toBe(404);
  });
});

describe("GET /shadow-cycle-status — verify-shadow-cycle.sh 消费的事实面", () => {
  it("ops 万能钥匙 → 200，带 event_count/first_at/last_at/span_ms", async () => {
    const res = await SELF.fetch(API("/shadow-cycle-status"), { headers: OPS });
    expect(res.status).toBe(200);
    const body = await res.json<{ event_count: number; first_at: string | null; last_at: string | null; span_ms: number }>();
    expect(typeof body.event_count).toBe("number");
    expect(body.event_count).toBeGreaterThan(0); // 前面测试已写入过决策
    expect(typeof body.span_ms).toBe("number");
  });

  it("无 token → 401", async () => {
    expect((await SELF.fetch(API("/shadow-cycle-status"))).status).toBe(401);
  });
});

describe("GET /api/coord/brain/shadow — 默认仓运维便捷面", () => {
  it("ops 万能钥匙 → 200 且 decisions 是数组（feature_list.json F10 verification 字面路径）", async () => {
    const res = await SELF.fetch("https://gw.test/api/coord/brain/shadow", { headers: OPS });
    expect(res.status).toBe(200);
    const body = await res.json<{ decisions: unknown }>();
    expect(Array.isArray(body.decisions)).toBe(true);
  });

  it("无 token → 401（只读面同样 fail-closed，不因为是默认仓便捷路径而放宽）", async () => {
    const res = await SELF.fetch("https://gw.test/api/coord/brain/shadow");
    expect(res.status).toBe(401);
  });
});
