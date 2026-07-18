// F09 实时流路由：devportal/agent 的 WebSocket 接入面。逻辑独立成文件，
// index.ts 只保留路由匹配（与并行改动的冲突面最小化）。
//
// 两条鉴权路径（events.md §订阅 + F09 目标架构）：
//   1) agent：Authorization: Bearer <COORD_API_TOKEN>，同现有 REST；
//   2) 浏览器：先 POST /stream-ticket（bearer，由 devportal 服务端代理持有）换
//      60s 一次性 ticket，再 ?ticket= 连 WS——浏览器 WebSocket 无法带
//      Authorization header，这是 ticket 存在的唯一原因。
//      长期 token 绝不下发浏览器；ticket 的存储与一次性消费都在 RepoHub DO 内。
import type { Env } from "./index";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function handleStreamRoute(
  req: Request,
  env: Env,
  repo: string,
  leaf: "stream" | "stream-ticket",
  url: URL,
): Promise<Response> {
  // 缺配置 fail-closed（同 handleRest 纪律）
  if (!env.COORD_API_TOKEN) return json(503, { error: "api_token_not_configured" });
  const stub = env.REPOHUB.get(env.REPOHUB.idFromName(repo));
  const bearerOk = req.headers.get("authorization") === `Bearer ${env.COORD_API_TOKEN}`;

  if (leaf === "stream-ticket") {
    if (req.method !== "POST") return json(405, { error: "method_not_allowed" });
    if (!bearerOk) return json(401, { error: "unauthorized" });
    return stub.fetch("https://repohub/stream/ticket", { method: "POST" });
  }

  // WS 升级转发：bearer 已验 → 打标转发；否则必须带 ticket（由 DO 一次性校验）
  if (req.headers.get("upgrade")?.toLowerCase() !== "websocket")
    return json(426, { error: "upgrade_required" });
  if (!bearerOk && !url.searchParams.has("ticket")) return json(401, { error: "unauthorized" });
  const target = new URL("https://repohub/stream");
  target.search = url.search; // 透传 since / ticket
  const headers = new Headers(req.headers);
  headers.delete("authorization");
  headers.delete("x-coord-stream-auth"); // 外部伪造无效：只有 gateway 验过 bearer 才打标
  if (bearerOk) headers.set("x-coord-stream-auth", "bearer");
  return stub.fetch(new Request(target, { method: "GET", headers }));
}
