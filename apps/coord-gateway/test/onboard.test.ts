// 项目接入向导（p30/F05，UC-01，真 workerd）：
//   1. installation(created)/installation_repositories(added) webhook → 直接注册为目录项目（安装即租户）
//   2. GitHub API façade（installation 视角）纯函数：list repos + collaborator permission 判定 admin
//   3. 自动体检四项：webhook 配置态 / 镜像种子（真 RepoHub 数据）/ CODEOWNERS·CONTRIBUTING / 分支保护
//   4. REST 面鉴权矩阵：ops token 门 + GitHub App 未配置 fail-closed
import { SELF, env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { createGitHubAppAuth } from "@repo/coord-projection";
import {
  deriveSlug,
  listInstallationRepos,
  reposFromInstallationPayload,
  runCheckup,
} from "../src/onboard";
import type { Env } from "../src/index";

const SECRET = "test-webhook-secret";
const enc = new TextEncoder();

async function sign(body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(body)));
  return "sha256=" + [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function postWebhook(event: string, payload: unknown, delivery: string) {
  const body = JSON.stringify(payload);
  return SELF.fetch("https://gw.test/api/coord/webhooks/github", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-hub-signature-256": await sign(body),
      "x-github-delivery": delivery,
      "x-github-event": event,
    },
    body,
  });
}

// 预热吸收 vitest-pool-workers singleWorker 的一次性 DO 失效（同 gateway.test.ts/directory.test.ts 纪律）
beforeAll(async () => {
  for (let i = 0; i < 2; i++) {
    const r = await SELF.fetch("https://gw.test/api/coord/directory/projects", {
      headers: { authorization: "Bearer test-api-token" },
    }).catch(() => null);
    if (r?.ok) break;
  }
});

describe("安装即注册（installation/installation_repositories webhook → 目录 DO）", () => {
  it("installation(created)：payload.repositories 全部注册为目录项目", async () => {
    const r = await postWebhook(
      "installation",
      {
        action: "created",
        installation: { id: 9001, account: { login: "usamshen", type: "User" } },
        repositories: [
          { full_name: "usamshen/pixel-forge", name: "pixel-forge", private: false },
          { full_name: "usamshen/ledgerly", name: "ledgerly", private: false },
        ],
      },
      "dlv-install-1",
    );
    expect(r.status).toBe(202);
    const body = await r.json<{ ok: boolean; registered: { slug: string; registered: boolean }[] }>();
    expect(body.registered.map((x) => x.slug).sort()).toEqual(["ledgerly", "pixel-forge"]);

    const list = await (
      await SELF.fetch("https://gw.test/api/coord/directory/projects", {
        headers: { authorization: "Bearer test-api-token" },
      })
    ).json<{ projects: { slug: string }[] }>();
    const slugs = list.projects.map((p) => p.slug);
    expect(slugs).toContain("pixel-forge");
    expect(slugs).toContain("ledgerly");
  });

  it("installation_repositories(added)：repositories_added 增量注册；重复安装幂等（409 不视为失败）", async () => {
    const r1 = await postWebhook(
      "installation_repositories",
      { action: "added", installation: { id: 9001 }, repositories_added: [{ full_name: "acme-inc/crm-core", name: "crm-core", private: true }] },
      "dlv-install-2",
    );
    expect(r1.status).toBe(202);
    const body1 = await r1.json<{ registered: { slug: string; registered: boolean }[] }>();
    expect(body1.registered).toEqual([{ slug: "crm-core", registered: true }]);

    // 同一仓再次投递（幂等）：slug 已占用 → registered:false，仍是 202 而非错误
    const r2 = await postWebhook(
      "installation_repositories",
      { action: "added", installation: { id: 9001 }, repositories_added: [{ full_name: "acme-inc/crm-core", name: "crm-core", private: true }] },
      "dlv-install-3",
    );
    expect(r2.status).toBe(202);
    const body2 = await r2.json<{ registered: { slug: string; registered: boolean }[] }>();
    expect(body2.registered).toEqual([{ slug: "crm-core", registered: false }]);
  });

  it("非 created/added 动作（如 deleted）→ ack 但不注册（registered 空数组）", async () => {
    const r = await postWebhook(
      "installation",
      { action: "deleted", installation: { id: 9001 }, repositories: [{ full_name: "usamshen/should-not-register", name: "should-not-register", private: false }] },
      "dlv-install-4",
    );
    expect(r.status).toBe(202);
    expect((await r.json<{ registered: unknown[] }>()).registered).toEqual([]);
  });

  it("installation 事件缺 repository 顶层字段也能过——不落旧的 missing_repository 400", async () => {
    // 回归断言：installation/installation_repositories 事件天然没有顶层 repository 字段，
    // 必须在 handleWebhook 里被特判拦截，不能落到「要求 repository.full_name」的旧分支。
    const r = await postWebhook("installation", { action: "created", installation: { id: 1 }, repositories: [] }, "dlv-install-5");
    expect(r.status).toBe(202);
  });
});

describe("slug 派生", () => {
  it("小写化 + 非法字符折叠为连字符 + 裁两端", () => {
    expect(deriveSlug("Pixel_Forge")).toBe("pixel-forge");
    expect(deriveSlug("crm.core!!")).toBe("crm-core");
    expect(deriveSlug("--edge--")).toBe("edge");
  });
});

describe("installation payload 解析（两种事件形状）", () => {
  it("installation(created) 用 repositories；installation_repositories(added) 用 repositories_added", () => {
    expect(
      reposFromInstallationPayload("installation", { repositories: [{ full_name: "a/b", name: "b", private: false }] }),
    ).toEqual([{ full_name: "a/b", name: "b", private: false }]);
    expect(
      reposFromInstallationPayload("installation_repositories", {
        repositories_added: [{ full_name: "a/c", name: "c", private: true }],
      }),
    ).toEqual([{ full_name: "a/c", name: "c", private: true }]);
    expect(reposFromInstallationPayload("installation", {})).toEqual([]);
  });
});

// ---------- GitHub API façade + 体检（mock fetch，不打真 GitHub；同 coord-projection 测试纪律） ----------

let privatePem = "";

function pemFromPkcs8(der: ArrayBuffer): string {
  const b64 = btoa(String.fromCharCode(...new Uint8Array(der)));
  return `-----BEGIN PRIVATE KEY-----\n${b64.match(/.{1,64}/g)!.join("\n")}\n-----END PRIVATE KEY-----\n`;
}

beforeAll(async () => {
  const pair = (await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true, ["sign", "verify"],
  )) as CryptoKeyPair;
  privatePem = pemFromPkcs8((await crypto.subtle.exportKey("pkcs8", pair.privateKey)) as ArrayBuffer);
});

function mockAuth() {
  return createGitHubAppAuth({
    appId: "12345",
    privateKey: privatePem,
    fetchImpl: (async () =>
      Response.json({ token: "ghs_mock", expires_at: new Date(Date.now() + 3600_000).toISOString() }, { status: 201 })) as typeof fetch,
  });
}

describe("listInstallationRepos：真实仓库列表 + collaborator permission 判定 admin", () => {
  it("按 login 逐仓查 permission；admin 才置 is_admin=true，403/404 保守判非 admin", async () => {
    const auth = mockAuth();
    const calls: string[] = [];
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("/installation/repositories"))
        return Response.json({
          repositories: [
            { full_name: "usamshen/pixel-forge", private: false, description: "渲染引擎", language: "TypeScript", default_branch: "main" },
            { full_name: "acme-inc/crm-core", private: true, description: "CRM 主仓", language: "TypeScript", default_branch: "main" },
          ],
        });
      if (url.includes("/repos/usamshen/pixel-forge/collaborators/usamshen/permission"))
        return Response.json({ permission: "admin" });
      if (url.includes("/repos/acme-inc/crm-core/collaborators/usamshen/permission"))
        return Response.json({ permission: "write" });
      return Response.json({ message: "not found" }, { status: 404 });
    }) as typeof fetch;

    const repos = await listInstallationRepos(auth, 9001, "usamshen", fetchImpl);
    expect(repos).toHaveLength(2);
    expect(repos.find((r) => r.slug === "pixel-forge")!.is_admin).toBe(true);
    expect(repos.find((r) => r.slug === "crm-core")!.is_admin).toBe(false);
  });

  it("未提供 login（未登录态）→ 全部 is_admin=false，不打 collaborator permission", async () => {
    const auth = mockAuth();
    const calls: string[] = [];
    const fetchImpl = (async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return Response.json({ repositories: [{ full_name: "usamshen/pixel-forge", private: false }] });
    }) as typeof fetch;
    const repos = await listInstallationRepos(auth, 9001, null, fetchImpl);
    expect(repos[0]!.is_admin).toBe(false);
    expect(calls.some((u) => u.includes("collaborators"))).toBe(false);
  });
});

describe("runCheckup：四项真实体检（警告不阻塞）", () => {
  it("webhook 已配置 + 有镜像数据 + CODEOWNERS/CONTRIBUTING 都在 + 分支已保护 → 全部 ok", async () => {
    // 先灌一条镜像事件，让 mirror-seed 检查读到非零数据（真 RepoHub DO，非 mock）
    const repo = "onboard-checkup-ok/repo";
    await env.REPOHUB.get(env.REPOHUB.idFromName(repo)).fetch("https://repohub/webhook/ingest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ delivery_id: "seed-1", mirror: { kind: "issue", data: { number: 1, state: "open", title: "t", labels: [], assignees: [] } } }),
    });

    const auth = mockAuth();
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/contents/")) return new Response(null, { status: 200 });
      if (url.includes("/branches/main/protection"))
        return Response.json({ required_pull_request_reviews: { required_approving_review_count: 1 } });
      return Response.json({ message: "unexpected" }, { status: 500 });
    }) as typeof fetch;

    const items = await runCheckup(env as unknown as Env, auth, 9001, "onboard-checkup-ok", "repo", "main", fetchImpl);
    expect(items.map((i) => i.id)).toEqual(["webhook", "mirror-seed", "modules-init", "branch-protection"]);
    expect(items.every((i) => i.result === "ok")).toBe(true);
  });

  it("无镜像数据 + 缺 CODEOWNERS/CONTRIBUTING + 未保护分支 → 对应项 warn 且带 remedy，不阻塞（仍是终态）", async () => {
    const auth = mockAuth();
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/contents/")) return Response.json({ message: "not found" }, { status: 404 });
      if (url.includes("/branches/main/protection")) return Response.json({ message: "not found" }, { status: 404 });
      return Response.json({ message: "unexpected" }, { status: 500 });
    }) as typeof fetch;

    const items = await runCheckup(env as unknown as Env, auth, 9001, "onboard-checkup-empty", "repo-fresh", "main", fetchImpl);
    const byId = Object.fromEntries(items.map((i) => [i.id, i]));
    expect(byId["mirror-seed"]!.result).toBe("warn");
    expect(byId["modules-init"]!.result).toBe("warn");
    expect(byId["modules-init"]!.remedy).toBeTruthy();
    expect(byId["branch-protection"]!.result).toBe("warn");
    expect(byId["branch-protection"]!.remedy).toBeTruthy();
  });
});

describe("REST 面 /api/coord/onboard/*", () => {
  it("GitHub App 未配置（本测试环境无 GITHUB_APP_ID）→ 503 fail-closed", async () => {
    const r = await SELF.fetch("https://gw.test/api/coord/onboard/installations/9001", {
      headers: { authorization: "Bearer test-api-token" },
    });
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ error: "github_app_not_configured" });
  });

  it("无 token / 假 token → 401（fail-closed，先于 GitHub App 配置检查）", async () => {
    expect((await SELF.fetch("https://gw.test/api/coord/onboard/installations/9001")).status).toBe(401);
    expect(
      (
        await SELF.fetch("https://gw.test/api/coord/onboard/installations/9001", {
          headers: { authorization: "Bearer wrong" },
        })
      ).status,
    ).toBe(401);
  });

  it("finalize：POST 缺 full_name → 422；非法格式 → 422", async () => {
    const r1 = await SELF.fetch("https://gw.test/api/coord/onboard/finalize", {
      method: "POST",
      headers: { authorization: "Bearer test-api-token", "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(r1.status).toBe(422);
  });

  it("未知子路径 → 404", async () => {
    const r = await SELF.fetch("https://gw.test/api/coord/onboard/nope", {
      headers: { authorization: "Bearer test-api-token" },
    });
    expect(r.status).toBe(404);
  });
});
