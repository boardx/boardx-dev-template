// last-stop.ts — D4「记住上次停留」（p30/F08，platform-redesign.md D4 第二条行为）。
//
// D4 两条行为：① 登录默认落点 /me（p30/F02 已实现：lib/oauth.ts sanitizeReturnTo
// 的硬编码 fallback）；② 记住上次停留，返回时优先——本文件补齐这一条。
//
// 设计：中间件在每次已认证访问 /p/:slug/* 时，把规范化的 `/p/<slug>` 写入一枚
// cookie（不含子路径，见 F02 已知偏差：workspace focus mode 记的是"哪个项目"，
// 不是"哪个子页"）。登录路由（github/login）在没有显式 return_to 时，用它代替
// 硬编码的 /me fallback——只影响"无具体目标的通用登录"路径，不影响
// middleware 已经在做的"显式 return_to 优先"（例如从 /p/xxx 被重定向登录）。
//
// 只读会话层不受影响（不碰 lib/session.ts 的签发/验签逻辑）。
export const LAST_STOP_COOKIE = "devportal_last_stop";
const MAX_AGE_SECONDS = 30 * 24 * 3600; // 30d，比 session 7d 长一些，允许跨会话记忆

const PROJECT_PATH = /^\/p\/([a-z0-9][a-z0-9-]*)(?:\/|$)/i;

/** 从路径提取规范化的项目工作区前缀 `/p/<slug>`；非工作区路径 → null。 */
export function projectStopFromPath(pathname: string): string | null {
  const m = PROJECT_PATH.exec(pathname);
  if (!m) return null;
  return `/p/${m[1]!.toLowerCase()}`;
}

export function lastStopCookieHeader(path: string): string {
  return `${LAST_STOP_COOKIE}=${encodeURIComponent(path)}; Path=/; Max-Age=${MAX_AGE_SECONDS}; HttpOnly; Secure; SameSite=Lax`;
}

function cookieValue(headers: Headers, name: string): string | null {
  const raw = headers.get("cookie");
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return null;
}

/** 读取并校验上次停留 cookie；格式不符（被篡改/污染）→ null，绝不半信。 */
export function readLastStop(headers: Headers): string | null {
  const raw = cookieValue(headers, LAST_STOP_COOKIE);
  if (!raw) return null;
  return projectStopFromPath(raw);
}
