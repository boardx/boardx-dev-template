// PlatformDirectory DO 测试：真 workerd（vitest-pool-workers，isolatedStorage:false——
// 测试各用独立 slug/handle 自行隔离）。覆盖 p30/F01 验收契约：
// 状态机合法/非法迁移、@handle 唯一性、ULID 不可变、owner 必填、D6 点号命名、
// 三答完整性（哪个项目的/属于哪个人类/parent 是谁）、写路径全量审计事件。
import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const BASE = "https://directory.test";

type Obj = Record<string, unknown>;

async function post(path: string, body: unknown): Promise<Response> {
  return SELF.fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function get(path: string): Promise<Response> {
  return SELF.fetch(`${BASE}${path}`);
}

async function j(r: Response): Promise<Obj> {
  return r.json<Obj>();
}

/** 便捷 setup：注册工程师 + 项目，返回 handle/slug（各测试独立命名自隔离）。 */
async function seed(tag: string): Promise<{ handle: string; slug: string; engineerId: string; projectId: string }> {
  const handle = `eng-${tag}`;
  const slug = `proj-${tag}`;
  const e = await j(await post("/directory/engineers", { handle, github_login: `gh-${tag}` }));
  const p = await j(await post("/directory/projects", { slug, name: `Project ${tag}` }));
  return {
    handle, slug,
    engineerId: (e["engineer"] as Obj)["engineer_id"] as string,
    projectId: (p["project"] as Obj)["project_id"] as string,
  };
}

describe("Project 注册", () => {
  it("注册 201（ULID 主键 + 默认值），slug 全局唯一冲突 409", async () => {
    const r = await post("/directory/projects", { slug: "proj-a1", name: "A1", modules: ["room", "board"] });
    expect(r.status).toBe(201);
    const p = (await j(r))["project"] as Obj;
    expect(p["project_id"]).toMatch(/^prj_[0-9A-Z]{26}$/);
    expect(p["visibility"]).toBe("private");
    expect(p["modules"]).toEqual(["room", "board"]);
    expect((p["gate_policy"] as Obj)["agent_admission"]).toBe("auto"); // D2 默认自动准入

    const dup = await post("/directory/projects", { slug: "proj-a1" });
    expect(dup.status).toBe(409);
    expect((await j(dup))["error"]).toBe("slug_taken");
  });

  it("非法输入 422：坏 slug / 坏 visibility / modules 非数组", async () => {
    expect((await post("/directory/projects", { slug: "Bad Slug!" })).status).toBe(422);
    expect((await post("/directory/projects", {})).status).toBe(422);
    expect((await post("/directory/projects", { slug: "proj-a2", visibility: "secret" })).status).toBe(422);
    expect((await post("/directory/projects", { slug: "proj-a2", modules: "room" })).status).toBe(422);
  });

  it("GET /directory/projects 返回数组", async () => {
    await post("/directory/projects", { slug: "proj-a3" });
    const body = await j(await get("/directory/projects"));
    expect(Array.isArray(body["projects"])).toBe(true);
    expect((body["projects"] as Obj[]).some((p) => p["slug"] === "proj-a3")).toBe(true);
  });
});

describe("Engineer：@handle 全局唯一 + upsert", () => {
  it("首次 201，同 handle 同身份再 POST = 更新 200，engineer_id（ULID）不变", async () => {
    const a = await post("/directory/engineers", { handle: "@eng-b1", github_login: "gh-b1" });
    expect(a.status).toBe(201);
    const first = (await j(a))["engineer"] as Obj;
    expect(first["engineer_id"]).toMatch(/^eng_[0-9A-Z]{26}$/);
    expect(first["handle"]).toBe("eng-b1"); // @ 前缀归一

    const b = await post("/directory/engineers", { handle: "eng-b1", display_name: "B1 本尊" });
    expect(b.status).toBe(200);
    const second = (await j(b))["engineer"] as Obj;
    expect(second["engineer_id"]).toBe(first["engineer_id"]); // ULID 不可变
    expect(second["display_name"]).toBe("B1 本尊");
  });

  it("@handle 被他人（不同 github_login）抢注 → 409 handle_taken", async () => {
    await post("/directory/engineers", { handle: "eng-b2", github_login: "gh-b2" });
    const r = await post("/directory/engineers", { handle: "eng-b2", github_login: "gh-b2-evil" });
    expect(r.status).toBe(409);
    expect((await j(r))["error"]).toBe("handle_taken");
  });

  it("非法 handle 422", async () => {
    expect((await post("/directory/engineers", { handle: "Bad Handle" })).status).toBe(422);
    expect((await post("/directory/engineers", {})).status).toBe(422);
  });
});

describe("Membership 状态机（pending→active→suspended）", () => {
  it("申请 201 pending → approve → suspend → reinstate 全链合法", async () => {
    const s = await seed("c1");
    const r = await post("/directory/memberships", { project: s.slug, engineer: `@${s.handle}`, role: "maintainer" });
    expect(r.status).toBe(201);
    const m = (await j(r))["membership"] as Obj;
    expect(m["membership_id"]).toMatch(/^mem_[0-9A-Z]{26}$/);
    expect(m["status"]).toBe("pending");
    const id = m["membership_id"] as string;

    const ap = await post(`/directory/memberships/${id}/transition`, { action: "approve" });
    expect(ap.status).toBe(200);
    expect(((await j(ap))["membership"] as Obj)["status"]).toBe("active");

    const su = await post(`/directory/memberships/${id}/transition`, { action: "suspend" });
    expect(((await j(su))["membership"] as Obj)["status"]).toBe("suspended");

    const re = await post(`/directory/memberships/${id}/transition`, { action: "reinstate" });
    expect(((await j(re))["membership"] as Obj)["status"]).toBe("active");
  });

  it("非法迁移全部 409：pending→suspend、重复 approve、active→reinstate", async () => {
    const s = await seed("c2");
    const m = (await j(await post("/directory/memberships", { project: s.slug, engineer: s.handle, role: "contributor" })))["membership"] as Obj;
    const id = m["membership_id"] as string;

    const bad1 = await post(`/directory/memberships/${id}/transition`, { action: "suspend" });
    expect(bad1.status).toBe(409);
    expect((await j(bad1))["error"]).toBe("invalid_transition:pending->suspended");

    await post(`/directory/memberships/${id}/transition`, { action: "approve" });
    const bad2 = await post(`/directory/memberships/${id}/transition`, { action: "approve" });
    expect(bad2.status).toBe(409);
    const bad3 = await post(`/directory/memberships/${id}/transition`, { action: "reinstate" });
    expect(bad3.status).toBe(409);
  });

  it("未知 action 422 / 未知 membership 404 / 坏 role 422 / 未知引用 404 / 重复成员 409", async () => {
    const s = await seed("c3");
    const m = (await j(await post("/directory/memberships", { project: s.slug, engineer: s.handle, role: "owner" })))["membership"] as Obj;
    const id = m["membership_id"] as string;
    expect((await post(`/directory/memberships/${id}/transition`, { action: "yolo" })).status).toBe(422);
    expect((await post(`/directory/memberships/mem_00000000000000000000000000/transition`, { action: "approve" })).status).toBe(404);
    expect((await post("/directory/memberships", { project: s.slug, engineer: s.handle, role: "root" })).status).toBe(422);
    expect((await post("/directory/memberships", { project: "no-such", engineer: s.handle, role: "owner" })).status).toBe(404);
    expect((await post("/directory/memberships", { project: s.slug, engineer: "@no-such", role: "owner" })).status).toBe(404);
    const dup = await post("/directory/memberships", { project: s.slug, engineer: s.handle, role: "contributor" });
    expect(dup.status).toBe(409);
    expect((await j(dup))["error"]).toBe("membership_exists");
  });
});

describe("Membership rejected 终态 + SLA（p30/F06）", () => {
  it("reject：pending→rejected 终态；rejected 后 approve/reject/suspend 全部 409", async () => {
    const s = await seed("h1");
    const m = (await j(await post("/directory/memberships", {
      project: s.slug, engineer: s.handle, role: "contributor", modules: ["collab"], intro: "8 年前端",
    })))["membership"] as Obj;
    expect(m["modules"]).toEqual(["collab"]);
    expect(m["intro"]).toBe("8 年前端");
    const id = m["membership_id"] as string;

    const rj = await post(`/directory/memberships/${id}/transition`, { action: "reject" });
    expect(rj.status).toBe(200);
    expect(((await j(rj))["membership"] as Obj)["status"]).toBe("rejected");

    for (const action of ["approve", "reject", "suspend", "reinstate"]) {
      const bad = await post(`/directory/memberships/${id}/transition`, { action });
      expect(bad.status, action).toBe(409);
    }
  });

  it("onboarding_issue_url 落库并在读面回显（GitHub 双写关联，N5）", async () => {
    const s = await seed("h2");
    const m = (await j(await post("/directory/memberships", {
      project: s.slug, engineer: s.handle, role: "owner", onboarding_issue_url: "https://github.com/boardx/boardx-dev-template/issues/9999",
    })))["membership"] as Obj;
    expect(m["onboarding_issue_url"]).toBe("https://github.com/boardx/boardx-dev-template/issues/9999");

    const list = (await j(await get("/directory/memberships")))["memberships"] as Obj[];
    const row = list.find((x) => x["membership_id"] === m["membership_id"])!;
    expect(row["onboarding_issue_url"]).toBe("https://github.com/boardx/boardx-dev-template/issues/9999");
  });

  it("GET /directory/memberships/:id/sla：pending 返回倒计时，非 pending 返回 sla:null，未知 404", async () => {
    const s = await seed("h3");
    const m = (await j(await post("/directory/memberships", { project: s.slug, engineer: s.handle, role: "contributor" })))["membership"] as Obj;
    const id = m["membership_id"] as string;

    const pending = await j(await get(`/directory/memberships/${id}/sla`));
    expect(pending["status"]).toBe("pending");
    const sla = pending["sla"] as Obj;
    expect(sla["timedOut"]).toBe(false);
    expect(sla["urgent"]).toBe(false);
    expect(typeof sla["hoursLeft"]).toBe("number");
    expect(sla["hoursLeft"] as number).toBeGreaterThan(23); // 项目默认未设 sla → 24h 兜底，刚申请剩余接近 24h
    expect(typeof sla["deadline"]).toBe("string");

    await post(`/directory/memberships/${id}/transition`, { action: "approve" });
    const active = await j(await get(`/directory/memberships/${id}/sla`));
    expect(active["status"]).toBe("active");
    expect(active["sla"]).toBeNull();

    expect((await get(`/directory/memberships/mem_00000000000000000000000000/sla`)).status).toBe(404);
  });

  it("列表读面附带 sla：pending 行非空、active 行为 null（项目自定义 promiseH 生效）", async () => {
    const slug = "proj-h4";
    const handle = "eng-h4";
    await post("/directory/engineers", { handle, github_login: "gh-h4" });
    await post("/directory/projects", { slug, sla: { promiseH: 4 } }); // 4h 承诺 → 立即 urgent
    const m = (await j(await post("/directory/memberships", { project: slug, engineer: handle, role: "contributor" })))["membership"] as Obj;

    const list = (await j(await get("/directory/memberships")))["memberships"] as Obj[];
    const row = list.find((x) => x["membership_id"] === m["membership_id"])!;
    const sla = row["sla"] as Obj;
    expect(sla["urgent"]).toBe(true); // 4h 承诺，刚申请即 ≤4h
    expect(sla["timedOut"]).toBe(false);
  });
});

describe("Agent：owner 必填 + D6 命名空间", () => {
  it("缺 owner 422、未知 owner 404、enroll 201（ULID 主键，心跳空）", async () => {
    const s = await seed("d1");
    expect((await post("/directory/agents", { name: "worker" })).status).toBe(422);
    expect((await j(await post("/directory/agents", { name: "worker" })))["error"]).toBe("owner_required");
    expect((await post("/directory/agents", { owner: "@ghost-d1", name: "worker" })).status).toBe(404);

    const r = await post("/directory/agents", { owner: `@${s.handle}`, name: "worker", capabilities: ["typescript"] });
    expect(r.status).toBe(201);
    const a = (await j(r))["agent"] as Obj;
    expect(a["agent_id"]).toMatch(/^agt_[0-9A-Z]{26}$/);
    expect(a["identifier"]).toBe(`@${s.handle}/worker`);
    expect(a["last_heartbeat_at"]).toBeNull(); // enroll 后等首个心跳点亮
  });

  it("owner 命名空间唯一：同 owner 同名 409，不同 owner 同名可共存", async () => {
    const s1 = await seed("d2");
    const s2 = await seed("d2b");
    expect((await post("/directory/agents", { owner: s1.handle, name: "twin" })).status).toBe(201);
    expect((await post("/directory/agents", { owner: s1.handle, name: "twin" })).status).toBe(409);
    expect((await post("/directory/agents", { owner: s2.handle, name: "twin" })).status).toBe(201);
  });

  it("sub-agent 点号命名沿 parent 追溯：合法延伸 201；顶级带点 422；错误前缀 422；跨 owner parent 422", async () => {
    const s = await seed("d3");
    const other = await seed("d3b");
    const parent = (await j(await post("/directory/agents", { owner: s.handle, name: "coord" })))["agent"] as Obj;
    const pid = parent["agent_id"] as string;

    expect((await post("/directory/agents", { owner: s.handle, name: "coord.sub" })).status).toBe(422); // 缺 parent
    expect((await post("/directory/agents", { owner: s.handle, name: "rogue.sub", parent_agent_id: pid })).status).toBe(422); // 不沿 parent 名
    expect((await post("/directory/agents", { owner: other.handle, name: "coord.sub", parent_agent_id: pid })).status).toBe(422); // 跨 owner
    expect((await post("/directory/agents", { owner: s.handle, name: "worker", parent_agent_id: "agt_00000000000000000000000000" })).status).toBe(404);

    const sub = await post("/directory/agents", { owner: s.handle, name: "coord.sub", parent_agent_id: pid });
    expect(sub.status).toBe(201);
    const subAgent = (await j(sub))["agent"] as Obj;
    expect((subAgent["parent"] as Obj)["agent_id"]).toBe(pid);

    // sub 的 sub：coord.sub.deep
    const deep = await post("/directory/agents", {
      owner: s.handle, name: "coord.sub.deep", parent_agent_id: subAgent["agent_id"],
    });
    expect(deep.status).toBe(201);
  });

  it("心跳更新时间戳（重复心跳单调推进）", async () => {
    const s = await seed("d4");
    const a = (await j(await post("/directory/agents", { owner: s.handle, name: "hb" })))["agent"] as Obj;
    const id = a["agent_id"] as string;
    const h1 = await post(`/directory/agents/${id}/heartbeat`, {});
    expect(h1.status).toBe(200);
    const t1 = ((await j(h1))["agent"] as Obj)["last_heartbeat_at"] as string;
    expect(t1).toBeTruthy();
    const h2 = await post(`/directory/agents/${id}/heartbeat`, {});
    const t2 = ((await j(h2))["agent"] as Obj)["last_heartbeat_at"] as string;
    expect(Date.parse(t2)).toBeGreaterThanOrEqual(Date.parse(t1));
    expect((await post(`/directory/agents/agt_00000000000000000000000000/heartbeat`, {})).status).toBe(404);
  });

  it("ULID 不可变：改名后 agent_id 不变，旧 ULID 引用仍可解析（D6 不断链）", async () => {
    const s = await seed("d5");
    const a = (await j(await post("/directory/agents", { owner: s.handle, name: "old-name" })))["agent"] as Obj;
    const id = a["agent_id"] as string;

    const rn = await post(`/directory/agents/${id}/rename`, { name: "new-name" });
    expect(rn.status).toBe(200);
    const renamed = (await j(rn))["agent"] as Obj;
    expect(renamed["agent_id"]).toBe(id); // 主键不可变
    expect(renamed["name"]).toBe("new-name");

    const byOldUlid = await get(`/directory/agents/${id}`); // 旧 ULID 照常解析
    expect(byOldUlid.status).toBe(200);
    expect(((await j(byOldUlid))["agent"] as Obj)["name"]).toBe("new-name");

    // 改名冲突 409；sub-agent 改名仍须沿 parent 名
    await post("/directory/agents", { owner: s.handle, name: "taken" });
    expect((await post(`/directory/agents/${id}/rename`, { name: "taken" })).status).toBe(409);
    const sub = (await j(await post("/directory/agents", { owner: s.handle, name: "new-name.kid", parent_agent_id: id })))["agent"] as Obj;
    expect((await post(`/directory/agents/${sub["agent_id"]}/rename`, { name: "loose-kid" })).status).toBe(422);
    expect((await post(`/directory/agents/${sub["agent_id"]}/rename`, { name: "new-name.kid2" })).status).toBe(200);
  });
});

describe("Agent 生命周期（p30/F07：暂停/恢复/退役）", () => {
  it("默认 active；pause→paused→resume→active；未知 action 422；未知 agent 404", async () => {
    const s = await seed("lc1");
    const a = (await j(await post("/directory/agents", { owner: s.handle, name: "lc-worker" })))["agent"] as Obj;
    const id = a["agent_id"] as string;
    expect(a["lifecycle"]).toBe("active");

    const p1 = await post(`/directory/agents/${id}/lifecycle`, { action: "pause" });
    expect(p1.status).toBe(200);
    expect(((await j(p1))["agent"] as Obj)["lifecycle"]).toBe("paused");

    const r1 = await post(`/directory/agents/${id}/lifecycle`, { action: "resume" });
    expect(r1.status).toBe(200);
    expect(((await j(r1))["agent"] as Obj)["lifecycle"]).toBe("active");

    expect((await post(`/directory/agents/${id}/lifecycle`, { action: "nope" })).status).toBe(422);
    expect((await post(`/directory/agents/agt_00000000000000000000000000/lifecycle`, { action: "pause" })).status).toBe(404);
  });

  it("retire 是终态：active→retired 200；再次 pause/retire 均 409（非法迁移）", async () => {
    const s = await seed("lc2");
    const a = (await j(await post("/directory/agents", { owner: s.handle, name: "lc-retiree" })))["agent"] as Obj;
    const id = a["agent_id"] as string;

    const rt = await post(`/directory/agents/${id}/lifecycle`, { action: "retire" });
    expect(rt.status).toBe(200);
    expect(((await j(rt))["agent"] as Obj)["lifecycle"]).toBe("retired");

    expect((await post(`/directory/agents/${id}/lifecycle`, { action: "pause" })).status).toBe(409);
    const rt2 = await post(`/directory/agents/${id}/lifecycle`, { action: "retire" });
    expect(rt2.status).toBe(409);
    expect((await j(rt2))["error"]).toBe("invalid_transition:retired->retired");
  });

  it("paused agent 也能 retire（paused→retired 合法）", async () => {
    const s = await seed("lc3");
    const a = (await j(await post("/directory/agents", { owner: s.handle, name: "lc-pause-retire" })))["agent"] as Obj;
    const id = a["agent_id"] as string;
    await post(`/directory/agents/${id}/lifecycle`, { action: "pause" });
    const rt = await post(`/directory/agents/${id}/lifecycle`, { action: "retire" });
    expect(rt.status).toBe(200);
    expect(((await j(rt))["agent"] as Obj)["lifecycle"]).toBe("retired");
  });
});

describe("Enrollment：agent×项目 + token 引用", () => {
  it("登记 201 → 重复 409 → 吊销 → 重复吊销 409 → 重登记复活（ULID 不变）", async () => {
    const s = await seed("e1");
    const a = (await j(await post("/directory/agents", { owner: s.handle, name: "enrollee" })))["agent"] as Obj;
    const agentId = a["agent_id"] as string;

    const r = await post("/directory/enrollments", { agent_id: agentId, project: s.slug, token_ref: "abcd1234" });
    expect(r.status).toBe(201);
    const en = (await j(r))["enrollment"] as Obj;
    expect(en["enrollment_id"]).toMatch(/^enr_[0-9A-Z]{26}$/);
    expect(en["status"]).toBe("active");
    const enId = en["enrollment_id"] as string;

    expect((await post("/directory/enrollments", { agent_id: agentId, project: s.slug })).status).toBe(409);

    const rv = await post(`/directory/enrollments/${enId}/revoke`, {});
    expect(rv.status).toBe(200);
    expect(((await j(rv))["enrollment"] as Obj)["status"]).toBe("revoked");
    const rv2 = await post(`/directory/enrollments/${enId}/revoke`, {});
    expect(rv2.status).toBe(409); // 非法迁移被拒
    expect((await j(rv2))["error"]).toBe("invalid_transition:revoked->revoked");

    const back = await post("/directory/enrollments", { agent_id: agentId, project: s.slug, token_ref: "ffff0000" });
    expect(back.status).toBe(200);
    expect(((await j(back))["enrollment"] as Obj)["enrollment_id"]).toBe(enId); // ULID 不变
  });

  it("未知 agent / 未知项目 404，缺字段 422", async () => {
    const s = await seed("e2");
    expect((await post("/directory/enrollments", { agent_id: "agt_00000000000000000000000000", project: s.slug })).status).toBe(404);
    const a = (await j(await post("/directory/agents", { owner: s.handle, name: "x" })))["agent"] as Obj;
    expect((await post("/directory/enrollments", { agent_id: a["agent_id"], project: "no-such" })).status).toBe(404);
    expect((await post("/directory/enrollments", {})).status).toBe(422);
  });

  // #770 跟进 2/3：token_ref 格式校验——只接受 hash 前缀形态，拒绝明文/完整 token/过长字符串
  it("token_ref 格式校验：合法 hash 前缀通过，完整 token / 过长 / 非法字符被拒 422", async () => {
    const s = await seed("e3");
    const a = (await j(await post("/directory/agents", { owner: s.handle, name: "tokened" })))["agent"] as Obj;
    const agentId = a["agent_id"] as string;

    // 合法：6~16 位小写十六进制 hash 前缀
    const ok = await post("/directory/enrollments", { agent_id: agentId, project: s.slug, token_ref: "a1b2c3" });
    expect(ok.status).toBe(201);
    expect(((await j(ok))["enrollment"] as Obj)["token_ref"]).toBe("a1b2c3");

    // 非法：完整 GitHub PAT 形态（含下划线、超长）
    const s2 = await seed("e3b");
    const a2 = (await j(await post("/directory/agents", { owner: s2.handle, name: "tokened2" })))["agent"] as Obj;
    const fullToken = await post("/directory/enrollments", {
      agent_id: a2["agent_id"], project: s2.slug,
      token_ref: "ghp_1234567890abcdefghijklmnopqrstuvwxyz01",
    });
    expect(fullToken.status).toBe(422);
    expect((await j(fullToken))["error"]).toBe("invalid_token_ref");

    // 非法：过长的纯 hex（超过 16 位上限，即便字符集合法也拒）
    const tooLong = await post("/directory/enrollments", {
      agent_id: a2["agent_id"], project: s2.slug,
      token_ref: "0123456789abcdef0123456789abcdef",
    });
    expect(tooLong.status).toBe(422);
    expect((await j(tooLong))["error"]).toBe("invalid_token_ref");

    // 非法：太短 / 含大写 / 含非 hex 字符
    expect((await post("/directory/enrollments", { agent_id: a2["agent_id"], project: s2.slug, token_ref: "ab" })).status).toBe(422);
    expect((await post("/directory/enrollments", { agent_id: a2["agent_id"], project: s2.slug, token_ref: "ABCDEF12" })).status).toBe(422);
    expect((await post("/directory/enrollments", { agent_id: a2["agent_id"], project: s2.slug, token_ref: "not-hex!" })).status).toBe(422);

    // 未提供 token_ref 仍合法（可空 = 未发 token）
    const noToken = await post("/directory/enrollments", { agent_id: a2["agent_id"], project: s2.slug });
    expect(noToken.status).toBe(201);
    expect(((await j(noToken))["enrollment"] as Obj)["token_ref"]).toBeNull();
  });
});

describe("三答完整性（§1 设计推论）", () => {
  it("agents 列表任意行都能回答：哪个项目的？属于哪个人类？parent 是谁？", async () => {
    const s = await seed("f1");
    const parent = (await j(await post("/directory/agents", { owner: s.handle, name: "lead" })))["agent"] as Obj;
    const sub = (await j(await post("/directory/agents", {
      owner: s.handle, name: "lead.helper", parent_agent_id: parent["agent_id"],
    })))["agent"] as Obj;
    await post("/directory/enrollments", { agent_id: sub["agent_id"], project: s.slug });

    const rows = (await j(await get("/directory/agents")))["agents"] as Obj[];
    const row = rows.find((x) => x["agent_id"] === sub["agent_id"])!;
    expect((row["owner"] as Obj)["handle"]).toBe(s.handle); // 属于哪个人类
    expect((row["parent"] as Obj)["agent_id"]).toBe(parent["agent_id"]); // parent 是谁
    expect(row["projects"]).toEqual([s.slug]); // 哪个项目的
    expect(row["identifier"]).toBe(`@${s.handle}/lead.helper`);

    // 顶级 agent：parent 显式 null，owner 仍必答
    const lead = rows.find((x) => x["agent_id"] === parent["agent_id"])!;
    expect(lead["parent"]).toBeNull();
    expect((lead["owner"] as Obj)["handle"]).toBe(s.handle);
  });
});

describe("审计事件（append-only，coord/0.1.2 directory.*）", () => {
  it("每条写路径都 emit：project/engineer/membership/agent/enrollment 全覆盖", async () => {
    const s = await seed("g1");
    const m = (await j(await post("/directory/memberships", { project: s.slug, engineer: s.handle, role: "owner", actor: "coord-main" })))["membership"] as Obj;
    await post(`/directory/memberships/${m["membership_id"]}/transition`, { action: "approve" });
    const a = (await j(await post("/directory/agents", { owner: s.handle, name: "audited" })))["agent"] as Obj;
    await post(`/directory/agents/${a["agent_id"]}/heartbeat`, {});
    await post(`/directory/agents/${a["agent_id"]}/rename`, { name: "audited2" });
    const en = (await j(await post("/directory/enrollments", { agent_id: a["agent_id"], project: s.slug })))["enrollment"] as Obj;
    await post(`/directory/enrollments/${en["enrollment_id"]}/revoke`, {});

    const events = (await j(await get("/directory/events?limit=500")))["events"] as Obj[];
    const types = new Set(events.map((e) => e["type"]));
    for (const t of [
      "directory.project.registered",
      "directory.engineer.upserted",
      "directory.membership.requested",
      "directory.membership.transitioned",
      "directory.agent.enrolled",
      "directory.agent.heartbeat",
      "directory.agent.updated",
      "directory.enrollment.created",
      "directory.enrollment.revoked",
    ]) expect(types.has(t), t).toBe(true);

    // 信封语义：protocol tag + evt_ULID 严格递增 + actor 归因
    const ids = events.map((e) => e["event_id"] as string);
    expect([...ids].sort().join()).toBe(ids.join());
    expect(events.every((e) => e["protocol"] === "coord/0.1")).toBe(true);
    const req = events.find((e) => e["type"] === "directory.membership.requested" && (e["payload"] as Obj)["membership_id"] === m["membership_id"])!;
    expect(req["agent_id"]).toBe("coord-main"); // 自报 actor 归因
  });
});

describe("入口纪律", () => {
  it("未知路径 404、坏 JSON 400、非 /directory 前缀 404", async () => {
    expect((await get("/directory/nope")).status).toBe(404);
    expect((await get("/other")).status).toBe(404);
    const bad = await SELF.fetch(`${BASE}/directory/projects`, {
      method: "POST", headers: { "content-type": "application/json" }, body: "{oops",
    });
    expect(bad.status).toBe(400);
  });
});

// #770 跟进 3/3：独立测试 host 的写路径 fail-closed 断言。SELF.fetch 走本包
// wrangler.toml（已设 COORD_DIRECTORY_TEST_HOST="1"），上面所有写路径测试都已经
// 隐式证明「带标志位时正常放行」；这里直接调 default export 的 fetch，手工构造
// 缺标志位/标志位错误的 env，验证 fail-closed 生效——不触达 DO（没给真实 DIRECTORY
// binding 也能通过，因为应在到达 stub.fetch 之前就被拦截）。
describe("独立测试 host fail-closed（#770 跟进 3/3）", () => {
  it("缺少 COORD_DIRECTORY_TEST_HOST 标志时，写路径一律 403，不转发给 DO", async () => {
    const worker = await import("../src/index");
    const req = new Request(`${BASE}/directory/projects`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: "should-not-write-1" }),
    });
    // 故意不传 DIRECTORY binding：若代码在拦截前就往下走，会因为 env.DIRECTORY
    // 未定义而抛异常（而非返回预期的 403），测试也能借此发现「拦截被绕过」。
    const res = await worker.default.fetch(req, {} as never);
    expect(res.status).toBe(403);
    expect((await res.json<Obj>())["error"]).toBe("test_host_writes_disabled");
  });

  it("标志位值不是 \"1\"（如 \"true\"/\"0\"/空字符串）同样 fail-closed", async () => {
    const worker = await import("../src/index");
    for (const flag of ["true", "0", "", "TRUE"]) {
      const req = new Request(`${BASE}/directory/projects`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug: `should-not-write-${flag || "empty"}` }),
      });
      const res = await worker.default.fetch(req, { COORD_DIRECTORY_TEST_HOST: flag } as never);
      expect(res.status).toBe(403);
    }
  });

  it("GET 读路径不受标志位影响（无标志位仍会尝试转发给 DO，只是写路径被拦）", async () => {
    const worker = await import("../src/index");
    const req = new Request(`${BASE}/directory/projects`, { method: "GET" });
    // 没给真实 DIRECTORY binding，读路径会继续往下走到 env.DIRECTORY.get(...)
    // 而抛异常——用异常（而非 403）证明 GET 没有被写路径的 fail-closed 逻辑拦截。
    await expect(worker.default.fetch(req, {} as never)).rejects.toThrow();
  });

  it("带上正确标志位则放行写路径（与 SELF 环境一致，转发给真实 DO）", async () => {
    const res = await post("/directory/projects", { slug: "flagged-write-ok" });
    expect(res.status).toBe(201);
  });
});
