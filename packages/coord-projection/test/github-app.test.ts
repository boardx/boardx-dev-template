// GitHub App 认证测试（F06）：注入 fetch mock，不打真 GitHub。
// 覆盖：App JWT 结构与 RS256 签名可验证、installation 解析、token 过期缓存。
import { beforeAll, describe, expect, it } from "vitest";
import { createGitHubAppAuth } from "../src/github-app";
import { applyCalls } from "../src/apply";

let privatePem = "";
let publicKey: CryptoKey;

function pemFromPkcs8(der: ArrayBuffer): string {
  const b64 = btoa(String.fromCharCode(...new Uint8Array(der)));
  const lines = b64.match(/.{1,64}/g)!.join("\n");
  return `-----BEGIN PRIVATE KEY-----\n${lines}\n-----END PRIVATE KEY-----\n`;
}

beforeAll(async () => {
  const pair = (await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true, ["sign", "verify"],
  )) as CryptoKeyPair;
  privatePem = pemFromPkcs8((await crypto.subtle.exportKey("pkcs8", pair.privateKey)) as ArrayBuffer);
  publicKey = pair.publicKey;
});

function b64urlDecode(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4)), (c) => c.charCodeAt(0));
}

interface Recorded {
  url: string;
  method: string;
  auth: string | null;
}

function mockGithub(): { fetchImpl: typeof fetch; requests: Recorded[] } {
  const requests: Recorded[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    requests.push({ url, method: init?.method ?? "GET", auth: headers.get("authorization") });
    if (/\/repos\/[^/]+\/[^/]+\/installation$/.test(url))
      return Response.json({ id: 4242 });
    if (/\/app\/installations\/4242\/access_tokens$/.test(url))
      return Response.json(
        { token: `ghs_tok_${requests.length}`, expires_at: new Date(Date.now() + 3600_000).toISOString() },
        { status: 201 },
      );
    return Response.json({ error: "unexpected" }, { status: 500 });
  }) as typeof fetch;
  return { fetchImpl, requests };
}

describe("GitHub App 认证", () => {
  it("App JWT：RS256 签名可用公钥验证，payload 含 iss/iat/exp", async () => {
    const { fetchImpl, requests } = mockGithub();
    const auth = createGitHubAppAuth({ appId: "12345", privateKey: privatePem, fetchImpl });
    await auth.installationToken("boardx", "boardx-dev-template");

    const jwt = requests[0]!.auth!.replace(/^Bearer /, "");
    const [h, p, sig] = jwt.split(".");
    const dec = new TextDecoder();
    const header = JSON.parse(dec.decode(b64urlDecode(h!)));
    const payload = JSON.parse(dec.decode(b64urlDecode(p!)));
    expect(header).toEqual({ alg: "RS256", typ: "JWT" });
    expect(payload.iss).toBe("12345");
    expect(payload.exp - payload.iat).toBe(600); // -60 回拨 + 540 = 10min 窗口
    const ok = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5", publicKey,
      b64urlDecode(sig!).buffer as ArrayBuffer,
      new TextEncoder().encode(`${h}.${p}`),
    );
    expect(ok).toBe(true);
  });

  it("installation token 缓存：同仓二次调用不再打 GitHub；过期后刷新", async () => {
    const { fetchImpl, requests } = mockGithub();
    let clock = Date.now();
    const auth = createGitHubAppAuth({
      appId: "12345", privateKey: privatePem, fetchImpl, now: () => clock,
    });
    const t1 = await auth.installationToken("boardx", "boardx-dev-template");
    expect(requests).toHaveLength(2); // installation 解析 + token
    const t2 = await auth.installationToken("boardx", "boardx-dev-template");
    expect(t2).toBe(t1);
    expect(requests).toHaveLength(2); // 命中缓存，零新请求

    clock += 2 * 3600_000; // 快进 2h：token 过期
    const t3 = await auth.installationToken("boardx", "boardx-dev-template");
    expect(t3).not.toBe(t1);
    expect(requests).toHaveLength(3); // installation id 仍缓存，只补 token 请求
  });

  it("installation 解析失败（App 未安装）→ 抛错不吞", async () => {
    const fetchImpl = (async () => Response.json({ message: "Not Found" }, { status: 404 })) as typeof fetch;
    const auth = createGitHubAppAuth({ appId: "12345", privateKey: privatePem, fetchImpl });
    await expect(auth.installationToken("x", "y")).rejects.toThrow("github_api_404");
  });
});

describe("应用层 applyCalls", () => {
  it("status 与 check-run 打到正确端点；单条失败不中断整批", async () => {
    const seen: Array<{ url: string; body: Record<string, unknown> }> = [];
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      seen.push({ url, body: JSON.parse(String(init?.body)) });
      if (url.includes("/statuses/badbad")) return Response.json({}, { status: 422 });
      return Response.json({}, { status: 201 });
    }) as typeof fetch;
    const r = await applyCalls({
      owner: "boardx", repo: "boardx-dev-template", token: "ghs_x", fetchImpl,
      calls: [
        { kind: "commit_status", sha: "badbad", state: "failure", context: "coord/andon", description: "停线" },
        { kind: "commit_status", sha: "aaa1111", state: "success", context: "coord/andon", description: "解除" },
        { kind: "check_run", head_sha: "aaa1111", name: "coord/lease", conclusion: "success", title: "持有者 wrk-1", summary: "s" },
      ],
    });
    expect(r).toEqual({ applied: 2, failed: 1 });
    expect(seen[1]!.url).toContain("/repos/boardx/boardx-dev-template/statuses/aaa1111");
    expect(seen[2]!.url).toContain("/repos/boardx/boardx-dev-template/check-runs");
    expect(seen[2]!.body).toMatchObject({ name: "coord/lease", head_sha: "aaa1111", conclusion: "success" });
  });
});
