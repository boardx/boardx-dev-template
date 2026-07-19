// GET /api/coord/oauth/logout — 清 session cookie 后 302 到公开层 /explore。
// 只清本应用 OAuth 会话；Cloudflare Access 会话（治理面）不在此处管辖。
import { clearSessionCookieHeader } from "@/lib/session";

export const runtime = "edge";

export function GET(request: Request): Response {
  return new Response(null, {
    status: 302,
    headers: {
      location: new URL("/explore", request.url).toString(),
      "set-cookie": clearSessionCookieHeader(),
    },
  });
}
