// Cloudflare Access 身份层 — 替代产品面的 @/lib/session（#523 Track A 门禁解耦）。
// develop.boardx.us 整域由 Cloudflare Access（GitHub 登录）保护；请求到达本应用时
// Access 已注入两个头：
//   Cf-Access-Authenticated-User-Email — 登录者邮箱
//   Cf-Access-Jwt-Assertion            — 签名 JWT（RS256，团队证书端点可验签）
// 必须验签而不能只信 email 头：*.pages.dev 直连不经过 Access，攻击者可手工伪造头。
// 验签失败/缺头 → null（调用方按未登录处理）。
import { createRemoteJWKSet, jwtVerify } from "jose";

const TEAM_DOMAIN = process.env["CF_ACCESS_TEAM_DOMAIN"] ?? "https://boardx.cloudflareaccess.com";

export interface AccessUser {
  email: string;
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks(): ReturnType<typeof createRemoteJWKSet> {
  jwks ??= createRemoteJWKSet(new URL(`${TEAM_DOMAIN}/cdn-cgi/access/certs`));
  return jwks;
}

/** 从请求头解析并验证 Access 身份；无 Access 上下文（如 pages.dev 直连）→ null。 */
export async function accessUser(headers: Headers): Promise<AccessUser | null> {
  const assertion = headers.get("cf-access-jwt-assertion");
  if (!assertion) return null;
  try {
    const { payload } = await jwtVerify(assertion, getJwks(), { issuer: TEAM_DOMAIN });
    // AUD 校验需要 Access 应用的 aud tag（当前 API token 无 Access 读权限拿不到）。
    // issuer + 签名已锁定"本团队 Access 签发"；单应用域下足够，拿到 aud 后再收紧。
    const email = typeof payload["email"] === "string" ? payload["email"] : null;
    if (!email) return null;
    return { email };
  } catch {
    return null;
  }
}

/** owner 匹配辅助：registry 的 owner 字段现值为 GitHub login（usamshen），Access 给的是
 *  邮箱（usam.shen@gmail.com）。ADR-011 P1（身份权威迁 D1）落地前的过渡匹配：
 *  精确邮箱相等，或邮箱 local-part 去点后等于 owner（usam.shen → usamshen）。 */
export function ownerMatches(owner: string | null | undefined, email: string): boolean {
  if (!owner) return false;
  if (owner === email) return true;
  const local = email.split("@")[0] ?? "";
  return local.replace(/\./g, "").toLowerCase() === owner.toLowerCase();
}
