// p30/F04 工作区分片面隔离测试（真 workerd）：
//   需求提交/推进 + talk append = scoped 面 + agent_id 强绑定（冒充 403）；
//   需求审核 + sprint 面板 upsert = COORD_ADMIN_TOKEN 管理面（scoped/ops 触达不到）；
//   跨仓命名空间：gateway 路由到不同 DO，工作区数据互不可见。
import { SELF } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";

const REPO = "boardx/boardx-dev-template";
const REPO2 = "agentic-harness/agentic-harness-template";
const API = (sub: string, repo = REPO) => `https://gw.test/api/coord/repos/${repo}${sub}`;
const ADMIN = { authorization: "Bearer test-admin-token", "content-type": "application/json" };
const OPS = { authorization: "Bearer test-api-token", "content-type": "application/json" };

// 吸收 vitest-pool-workers singleWorker 跨文件 transform 造成的一次性 DO 失效（同 gateway.test.ts）
beforeAll(async () => {
  for (let i = 0; i < 2; i++) {
    const r = await SELF.fetch(API("/claims"), {
      headers: { authorization: "Bearer test-api-token" },
    }).catch(() => null);
    if (r?.ok) break;
  }
});

async function mintScoped(agentId: string, repo = REPO): Promise<string> {
  const r = await SELF.fetch(API("/tokens/mint", repo), {
    method: "POST", headers: ADMIN,
    body: JSON.stringify({ agent_id: agentId, owner: "usam.shen@gmail.com" }),
  });
  expect(r.status).toBe(201);
  return (await r.json<{ token: string }>()).token;
}

function scopedHeaders(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}`, "content-type": "application/json" };
}

describe("workspace scoped 面：需求提交 / talk append 的 agent_id 强绑定", () => {
  it("talk append：scoped token 缺省注入本人身份；自证他人 403；无 token 401", async () => {
    expect((await SELF.fetch(API("/talk"), {
      method: "POST", body: JSON.stringify({ body: "hi" }),
    })).status).toBe(401);

    const token = await mintScoped("wrk-ws-talk");
    const ok = await SELF.fetch(API("/talk"), {
      method: "POST", headers: scopedHeaders(token),
      body: JSON.stringify({ body: "scoped 面发言，身份由 token 注入" }),
    });
    expect(ok.status).toBe(201);
    expect((await ok.json<{ message: { author: string } }>()).message.author).toBe("wrk-ws-talk");

    const impersonate = await SELF.fetch(API("/talk"), {
      method: "POST", headers: scopedHeaders(token),
      body: JSON.stringify({ agent_id: "coord-main", body: "冒充协调者" }),
    });
    expect(impersonate.status).toBe(403);
    expect((await impersonate.json<{ error: string }>()).error).toBe("token_agent_mismatch");
  });

  it("需求提交/推进走 scoped 面并强绑定；GET 列表/单条可读", async () => {
    const token = await mintScoped("wrk-ws-req");
    const created = await SELF.fetch(API("/requirements"), {
      method: "POST", headers: scopedHeaders(token),
      body: JSON.stringify({ title: "gateway 面提交的需求", body: "" }),
    });
    expect(created.status).toBe(201);
    const req = (await created.json<{ requirement: { id: string; submitted_by: string } }>()).requirement;
    expect(req.submitted_by).toBe("wrk-ws-req");

    const adv = await SELF.fetch(API(`/requirements/${req.id}/advance`), {
      method: "POST", headers: scopedHeaders(token), body: "{}",
    });
    expect(adv.status).toBe(200);

    const list = await SELF.fetch(API("/requirements"), { headers: OPS });
    expect(list.status).toBe(200);
    const one = await SELF.fetch(API(`/requirements/${req.id}`), { headers: OPS });
    expect((await one.json<{ requirement: { status: string } }>()).requirement.status).toBe("analyzing");
  });
});

describe("workspace admin 面：审核 + sprint 面板写是 maintainer 特权", () => {
  it("requirements review：scoped/ops 触达不到（401/404），admin 可审", async () => {
    const token = await mintScoped("wrk-ws-rev");
    const { requirement } = await (await SELF.fetch(API("/requirements"), {
      method: "POST", headers: scopedHeaders(token),
      body: JSON.stringify({ title: "待审需求", body: "" }),
    })).json<{ requirement: { id: string } }>();
    // scoped 两跳推进到 in_review
    for (let i = 0; i < 2; i++) {
      const adv = await SELF.fetch(API(`/requirements/${requirement.id}/advance`), {
        method: "POST", headers: scopedHeaders(token), body: "{}",
      });
      expect(adv.status).toBe(200);
    }

    const sub = `/requirements/${requirement.id}/review`;
    // admin 路由先行：非 admin bearer 401（管理面 fail-closed，不落 REST 透传）
    expect((await SELF.fetch(API(sub), { method: "POST", headers: OPS, body: JSON.stringify({ action: "approve" }) })).status).toBe(401);
    expect((await SELF.fetch(API(sub), { method: "POST", headers: scopedHeaders(token), body: JSON.stringify({ action: "approve" }) })).status).toBe(401);
    const ok = await SELF.fetch(API(sub), {
      method: "POST", headers: ADMIN, body: JSON.stringify({ action: "approve", issue: 902 }),
    });
    expect(ok.status).toBe(200);
    expect((await ok.json<{ requirement: { status: string; issue: number } }>()).requirement).toMatchObject({ status: "dispatched", issue: 902 });
  });

  it("sprint-items/upsert：非 admin 401；admin 写入后 scoped/ops 可读", async () => {
    const body = JSON.stringify({ sprint: "p30/01", item_id: "F04", title: "工作区分片", status: "in_progress" });
    expect((await SELF.fetch(API("/sprint-items/upsert"), { method: "POST", headers: OPS, body })).status).toBe(401);
    expect((await SELF.fetch(API("/sprint-items/upsert"), { method: "POST", headers: ADMIN, body })).status).toBe(200);
    const read = await SELF.fetch(API("/sprint-items?sprint=p30%2F01"), { headers: OPS });
    expect(read.status).toBe(200);
    expect((await read.json<{ items: Array<{ item_id: string }> }>()).items.map((i) => i.item_id)).toContain("F04");
  });
});

describe("workspace 跨仓命名空间隔离（gateway 路由层）", () => {
  it("两仓各写一条 talk：交叉读不可见；跨仓 scoped token 403", async () => {
    const tokenA = await mintScoped("wrk-iso-a", REPO);
    const msgA = await (await SELF.fetch(API("/talk", REPO), {
      method: "POST", headers: scopedHeaders(tokenA), body: JSON.stringify({ body: "A 仓讨论" }),
    })).json<{ message: { message_id: string } }>();
    // A 仓的 scoped token 在 B 仓不可用（按仓 scope 由 DO 存储位置保证）
    expect((await SELF.fetch(API("/talk", REPO2), {
      method: "POST", headers: scopedHeaders(tokenA), body: JSON.stringify({ body: "跨仓写入" }),
    })).status).toBe(403);

    const tokenB = await mintScoped("wrk-iso-b", REPO2);
    const msgB = await (await SELF.fetch(API("/talk", REPO2), {
      method: "POST", headers: scopedHeaders(tokenB), body: JSON.stringify({ body: "B 仓讨论" }),
    })).json<{ message: { message_id: string } }>();

    const listB = await (await SELF.fetch(API("/talk", REPO2), { headers: OPS })).json<{ messages: Array<{ message_id: string }> }>();
    expect(listB.messages.map((m) => m.message_id)).toContain(msgB.message.message_id);
    expect(listB.messages.map((m) => m.message_id)).not.toContain(msgA.message.message_id);
    const listA = await (await SELF.fetch(API("/talk", REPO), { headers: OPS }))
      .json<{ messages: Array<{ message_id: string }> }>();
    expect(listA.messages.map((m) => m.message_id)).not.toContain(msgB.message.message_id);
  });
});
