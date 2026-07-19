// p30-F03 workspace-authz 单测（PR #783 二轮复审新增）：
//
// 核心回归目标——已登录非成员在私有项目上，不能靠 200(WorkspaceNoAccess)/403 vs 404
// 区分「私有项目存在但我不是成员」与「slug 根本不存在」。私有项目 + 该用户在其上
// 完全没有 membership 记录时，必须退化成与未知 slug 完全相同的 { kind: "not_found" }。
// 已有 membership 记录（哪怕 status 非 active）的用户走 forbidden——这类用户本来就
// 合法知道项目存在（申请过/已加入），不构成枚举面。
//
// getSessionUser 走 vi.mock 注入固定身份；directoryGet 走 vi.stubGlobal("fetch", ...)
// 注入固定 projects/engineers/memberships，避免依赖真实 coord-gateway。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const PROJECTS = [
  { project_id: "prj_priv", slug: "priv-proj", name: "Private Project", visibility: "private" as const },
  { project_id: "prj_pub", slug: "pub-proj", name: "Public Project", visibility: "public" as const },
];

const ENGINEERS = [
  { engineer_id: "eng_member", handle: "member-h", github_login: "member-user" },
  { engineer_id: "eng_suspended", handle: "suspended-h", github_login: "suspended-user" },
  { engineer_id: "eng_outsider", handle: "outsider-h", github_login: "outsider-user" },
];

const MEMBERSHIPS = [
  { project_id: "prj_priv", engineer_id: "eng_member", role: "contributor" as const, status: "active" as const },
  { project_id: "prj_priv", engineer_id: "eng_suspended", role: "contributor" as const, status: "suspended" as const },
  // eng_outsider 在 prj_priv 上完全没有 membership 记录（连一行 suspended/pending 都没有）。
];

let currentLogin: string | null = null;

vi.mock("../lib/session", () => ({
  getSessionUser: async () => (currentLogin ? { login: currentLogin, via: "oauth" as const } : null),
}));

function installFetchMock() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = String(url);
      const json = (body: unknown) => ({ ok: true, json: async () => body }) as Response;
      if (u.endsWith("/projects")) return json({ projects: PROJECTS });
      if (u.endsWith("/engineers")) return json({ engineers: ENGINEERS });
      if (u.endsWith("/memberships")) return json({ memberships: MEMBERSHIPS });
      return { ok: false, json: async () => ({}) } as Response;
    }),
  );
}

beforeEach(() => {
  process.env["COORD_GATEWAY_URL"] = "https://coord.example";
  process.env["COORD_API_TOKEN"] = "test-token";
  installFetchMock();
  currentLogin = null;
});

afterEach(() => {
  delete process.env["COORD_GATEWAY_URL"];
  delete process.env["COORD_API_TOKEN"];
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("resolveWorkspaceAccess：私有项目非成员存在性枚举修复", () => {
  it("未知 slug → not_found", async () => {
    const { resolveWorkspaceAccess } = await import("../lib/workspace-authz");
    currentLogin = "member-user";
    const access = await resolveWorkspaceAccess("does-not-exist", new Headers());
    expect(access.kind).toBe("not_found");
  });

  it("已登录、私有项目上完全没有 membership 记录 → not_found，与未知 slug 不可区分（default/allowPublicRead 分支）", async () => {
    const { resolveWorkspaceAccess } = await import("../lib/workspace-authz");
    currentLogin = "outsider-user";
    const known = await resolveWorkspaceAccess("priv-proj", new Headers(), { allowPublicRead: true });
    const unknown = await resolveWorkspaceAccess("does-not-exist", new Headers(), { allowPublicRead: true });
    expect(known).toEqual({ kind: "not_found" });
    expect(unknown).toEqual({ kind: "not_found" });
  });

  it("已登录、私有项目上完全没有 membership 记录 → not_found（minRoles 分支，如治理台）", async () => {
    const { resolveWorkspaceAccess } = await import("../lib/workspace-authz");
    currentLogin = "outsider-user";
    const access = await resolveWorkspaceAccess("priv-proj", new Headers(), { minRoles: ["owner", "maintainer"] });
    expect(access).toEqual({ kind: "not_found" });
  });

  it("engineer 目录里查无此人（从未绑定过 GitHub）→ 视为无 membership 记录，同样 not_found", async () => {
    const { resolveWorkspaceAccess } = await import("../lib/workspace-authz");
    currentLogin = "unknown-engineer-not-in-directory";
    const access = await resolveWorkspaceAccess("priv-proj", new Headers(), { allowPublicRead: true });
    expect(access).toEqual({ kind: "not_found" });
  });

  it("已有 membership 记录但 status 非 active（suspended）→ forbidden，携带真实 project（非枚举面）", async () => {
    const { resolveWorkspaceAccess } = await import("../lib/workspace-authz");
    currentLogin = "suspended-user";
    const access = await resolveWorkspaceAccess("priv-proj", new Headers(), { allowPublicRead: true });
    expect(access.kind).toBe("forbidden");
    if (access.kind === "forbidden") {
      expect(access.project.slug).toBe("priv-proj");
      expect(access.role).toBeNull();
    }
  });

  it("active 成员但角色不够 minRoles → forbidden，携带真实 project 与 role（这类用户本就合法知道项目存在）", async () => {
    const { resolveWorkspaceAccess } = await import("../lib/workspace-authz");
    currentLogin = "member-user";
    const access = await resolveWorkspaceAccess("priv-proj", new Headers(), { minRoles: ["owner", "maintainer"] });
    expect(access.kind).toBe("forbidden");
    if (access.kind === "forbidden") {
      expect(access.project.slug).toBe("priv-proj");
      expect(access.role).toBe("contributor");
    }
  });

  it("公开项目非成员 → 仍是 public-viewer（回归：不受本次修复影响）", async () => {
    const { resolveWorkspaceAccess, PUBLIC_VIEWER_ROLE } = await import("../lib/workspace-authz");
    currentLogin = "outsider-user";
    const access = await resolveWorkspaceAccess("pub-proj", new Headers(), { allowPublicRead: true });
    expect(access).toEqual({ kind: "ok", project: PROJECTS[1], role: PUBLIC_VIEWER_ROLE });
  });

  it("未登录 → unauthenticated（先认证后查项目的顺序不受影响）", async () => {
    const { resolveWorkspaceAccess } = await import("../lib/workspace-authz");
    currentLogin = null;
    const access = await resolveWorkspaceAccess("priv-proj", new Headers(), { allowPublicRead: true });
    expect(access).toEqual({ kind: "unauthenticated" });
  });
});
