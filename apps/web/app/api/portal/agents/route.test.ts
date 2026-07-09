import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { currentUser } from "@/lib/session";

// p23/F08 — /api/portal/agents：registry.yaml 按 owner（开发者）分组的 agents 树 + coord 租约标注。
// 关键断言：owner（人类归属）与 parent（agent 派生树）两条关系并存——sub-agent 挂 parent 下，
// 不平铺；开发者只作为分组出现；coord 未配置 → coord_configured:false（诚实降级，不虚构租约）。

const REGISTRY_YAML = `
version: 1
agents:
  - id: coord-main
    kind: coordinator
    owner: usam@ex.com
  - id: coord-architecture
    kind: architecture-coordinator
    owner: usam@ex.com
  - id: coord-architecture.portal-dev-3
    kind: sub-agent
    parent: coord-architecture
    role: portal-dev
    owner: usam@ex.com
  - id: coord-ava
    kind: module-coordinator
    owner: alice@ex.com
    active: false
  - id: wrk-claude-1
    kind: worker
`;

vi.mock("@/lib/session", () => ({ currentUser: vi.fn() }));
vi.mock("node:fs/promises", () => ({ readFile: vi.fn(async () => REGISTRY_YAML) }));

const mockCurrentUser = vi.mocked(currentUser);
const asUser = (email: string) => mockCurrentUser.mockResolvedValue({ id: 1, email } as Awaited<ReturnType<typeof currentUser>>);

describe("GET /api/portal/agents", () => {
  beforeEach(() => {
    asUser("usam@ex.com");
    delete process.env["COORD_SERVICE_URL"];
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("未登录 401", async () => {
    mockCurrentUser.mockResolvedValue(undefined as unknown as Awaited<ReturnType<typeof currentUser>>);
    expect((await GET()).status).toBe(401);
  });

  it("按 owner 分组 + sub-agent 挂 parent 下；未配置 coord → coord_configured:false", async () => {
    const body = await (await GET()).json();
    expect(body.coord_configured).toBe(false);

    // 三个分组：我（usam）在最前、alice 次之、未登记 owner（null）殿后
    expect(body.developers.map((d: { owner: string | null }) => d.owner)).toEqual(["usam@ex.com", "alice@ex.com", null]);

    const me = body.developers[0];
    expect(me.is_me).toBe(true);
    // 顶层只有两个 agent（coord-main / coord-architecture）——sub-agent 不平铺
    expect(me.agents.map((a: { id: string }) => a.id).sort()).toEqual(["coord-architecture", "coord-main"]);
    // 但合计 agent 数含 sub-agent
    expect(me.agent_count).toBe(3);

    // sub-agent 挂在 parent（coord-architecture）之下，带 kind/role/parent
    const arch = me.agents.find((a: { id: string }) => a.id === "coord-architecture");
    expect(arch.sub_agents).toEqual([
      expect.objectContaining({ id: "coord-architecture.portal-dev-3", kind: "sub-agent", role: "portal-dev", parent: "coord-architecture" }),
    ]);

    // active:false 如实透传（不悄悄过滤）
    const alice = body.developers[1];
    expect(alice.is_me).toBe(false);
    expect(alice.agents[0]).toMatchObject({ id: "coord-ava", active: false });

    // 未登记 owner 的 worker 归入 null 组（不丢数据）
    expect(body.developers[2].agents[0].id).toBe("wrk-claude-1");
  });

  it("配置了 coord-service → active_claims 标注为当前租约；无租约的 agent 为 null", async () => {
    process.env["COORD_SERVICE_URL"] = "https://coord.example";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ active_claims: [{ resource_id: "issue:512", agent_id: "coord-architecture.portal-dev-3" }] }),
      }))
    );
    const body = await (await GET()).json();
    expect(body.coord_configured).toBe(true);
    const me = body.developers[0];
    const arch = me.agents.find((a: { id: string }) => a.id === "coord-architecture");
    expect(arch.sub_agents[0].lease).toBe("issue:512");
    expect(arch.lease).toBeNull();
  });

  it("coord-service 不可达 → 仍返回 registry 分组（租约留空），不 5xx 整个响应", async () => {
    process.env["COORD_SERVICE_URL"] = "https://coord.example";
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("boom"); }));
    // 换个观察者避开上一用例的 30s 缓存（缓存键含 viewer + 配置指纹）
    asUser("alice@ex.com");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.coord_configured).toBe(true);
    expect(body.developers.length).toBe(3);
    // alice 观察时她的组排最前
    expect(body.developers[0].owner).toBe("alice@ex.com");
    expect(body.developers[0].is_me).toBe(true);
  });
});
