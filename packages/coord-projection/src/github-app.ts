// GitHub App 认证（F06）：RS256 App JWT（WebCrypto，workerd 无 Node crypto 依赖）
// → 按仓解析 installation → installation token（带过期缓存）。
// fetch 可注入——测试用 mock，不打真 GitHub。

export interface GitHubAppAuthOptions {
  appId: string;
  privateKey: string; // PKCS#8 PEM（GitHub 下载的 PKCS#1 需先转换，见 e2e 脚本注释）
  fetchImpl?: typeof fetch;
  apiBase?: string;
  now?: () => number; // 注入时钟：过期缓存可测试
}

export interface GitHubAppInstallation {
  id: number;
  account: { login: string; type: string } | null;
  permissions: Record<string, string>;
}

export interface GitHubAppAuth {
  installationToken(owner: string, repo: string): Promise<string>;
  // p30/F05：按 installation id 直接换 token（安装流场景——回调只带 installation_id，
  // 尚无 owner/repo 上下文；与 installationToken 共用同一 JWT/缓存机制）。
  installationTokenById(installationId: number): Promise<string>;
  // 安装回执（installation # + 账户 + 权限清单）：JWT 鉴权读，非 installation token。
  getInstallation(installationId: number): Promise<GitHubAppInstallation>;
}

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlJson(obj: unknown): string {
  return b64url(enc.encode(JSON.stringify(obj)));
}

async function importPkcs8(pem: string): Promise<CryptoKey> {
  const body = pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8", der.buffer as ArrayBuffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false, ["sign"],
  );
}

// App JWT：iat 回拨 60s 抗时钟漂移，exp 上限 10min（GitHub 规定）内取 9min
async function appJwt(appId: string, key: CryptoKey, nowMs: number): Promise<string> {
  const nowSec = Math.floor(nowMs / 1000);
  const unsigned =
    `${b64urlJson({ alg: "RS256", typ: "JWT" })}.` +
    `${b64urlJson({ iat: nowSec - 60, exp: nowSec + 540, iss: appId })}`;
  const sig = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(unsigned)),
  );
  return `${unsigned}.${b64url(sig)}`;
}

interface CachedToken {
  token: string;
  expiresAtMs: number;
}

const EXPIRY_MARGIN_MS = 5 * 60 * 1000; // 到期前 5min 视为过期，避免用到边缘 token

export function createGitHubAppAuth(opts: GitHubAppAuthOptions): GitHubAppAuth {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const apiBase = opts.apiBase ?? "https://api.github.com";
  const now = opts.now ?? Date.now;
  let keyPromise: Promise<CryptoKey> | null = null;
  const installationIds = new Map<string, number>();
  const tokens = new Map<string, CachedToken>();

  async function freshJwt(): Promise<string> {
    keyPromise ??= importPkcs8(opts.privateKey);
    return appJwt(opts.appId, await keyPromise, now());
  }

  async function tokenForInstallationId(cacheKey: string, instId: number): Promise<string> {
    const cached = tokens.get(cacheKey);
    if (cached && cached.expiresAtMs - EXPIRY_MARGIN_MS > now()) return cached.token;
    const jwt = await freshJwt();
    const tok = await ghJson(
      `${apiBase}/app/installations/${instId}/access_tokens`, { method: "POST" }, jwt,
    );
    if (typeof tok["token"] !== "string") throw new Error("github_token_missing");
    const expiresAtMs =
      typeof tok["expires_at"] === "string" ? Date.parse(tok["expires_at"]) : now() + 55 * 60 * 1000;
    tokens.set(cacheKey, { token: tok["token"], expiresAtMs });
    return tok["token"];
  }

  async function ghJson(url: string, init: RequestInit, jwt: string): Promise<Record<string, unknown>> {
    const res = await fetchImpl(url, {
      ...init,
      headers: {
        authorization: `Bearer ${jwt}`,
        accept: "application/vnd.github+json",
        "user-agent": "coord-projection",
        ...(init.headers ?? {}),
      },
    });
    if (!res.ok) throw new Error(`github_api_${res.status}: ${init.method ?? "GET"} ${url}`);
    return (await res.json()) as Record<string, unknown>;
  }

  return {
    async installationToken(owner: string, repo: string): Promise<string> {
      const cacheKey = `${owner}/${repo}`;
      const cached = tokens.get(cacheKey);
      if (cached && cached.expiresAtMs - EXPIRY_MARGIN_MS > now()) return cached.token;

      const jwt = await freshJwt();
      let instId = installationIds.get(cacheKey);
      if (instId === undefined) {
        const inst = await ghJson(`${apiBase}/repos/${owner}/${repo}/installation`, {}, jwt);
        if (typeof inst["id"] !== "number") throw new Error("github_installation_missing_id");
        instId = inst["id"];
        installationIds.set(cacheKey, instId);
      }
      return tokenForInstallationId(cacheKey, instId);
    },

    // p30/F05：安装流回调只带 installation_id（无 owner/repo）——直接换 token。
    async installationTokenById(installationId: number): Promise<string> {
      return tokenForInstallationId(`inst:${installationId}`, installationId);
    },

    // 安装回执：installation # + 账户 + 权限清单（JWT 鉴权读，非 installation token）。
    async getInstallation(installationId: number): Promise<GitHubAppInstallation> {
      const jwt = await freshJwt();
      const inst = await ghJson(`${apiBase}/app/installations/${installationId}`, {}, jwt);
      const account = inst["account"] as Record<string, unknown> | undefined;
      const permissions = inst["permissions"] as Record<string, string> | undefined;
      return {
        id: installationId,
        account:
          account && typeof account["login"] === "string"
            ? { login: account["login"] as string, type: typeof account["type"] === "string" ? (account["type"] as string) : "User" }
            : null,
        permissions: permissions ?? {},
      };
    },
  };
}
