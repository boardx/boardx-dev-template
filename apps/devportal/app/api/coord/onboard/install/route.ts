// GET /api/coord/onboard/install?return_to=/onboard — 发起真实 GitHub App 安装授权
// （p30-F05，UC-01 步骤①）。签发一次性 state（HMAC cookie）后 302 到
// https://github.com/apps/<slug>/installations/new——同构于 lib/oauth.ts 的登录流。
// 要求已登录（/onboard 在 middleware 保护范围内，这里再判一次防止直打 API 绕过页面）。
import { getSessionUser } from "@/lib/session";
import { buildInstallUrl } from "@/lib/onboard";

export const runtime = "edge";

export async function GET(request: Request): Promise<Response> {
  const user = await getSessionUser(request.headers);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const returnTo = url.searchParams.get("return_to") ?? "/onboard";
  const result = await buildInstallUrl(process.env["GITHUB_APP_SLUG"], returnTo);
  if (!result) {
    return Response.json(
      { error: "install_not_configured", detail: "GITHUB_APP_SLUG 或 SESSION_SECRET 未配置" },
      { status: 503 },
    );
  }
  return new Response(null, {
    status: 302,
    headers: { location: result.url, "set-cookie": result.cookieHeader },
  });
}
