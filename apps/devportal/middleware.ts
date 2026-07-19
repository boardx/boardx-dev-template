// 路由分层中间件（p30-F02，D3 阶段 2 灰度）——本文件是「谁需要登录」的唯一事实源。
//
//   公开层   /explore /projects/:slug /u/:handle /a/:handle/:agent
//            —— 不在 matcher 内，零鉴权零身份读取（tests/public-layer-static.test.ts
//            以静态断言防回退：公开层组件禁 import lib/access.ts、禁读 cookie/headers）。
//   工作区   /p/:slug/* 与个人层 /me* —— 要求会话（OAuth session cookie 优先，
//            Access JWT 兼容回退，灰度期双栈）；无会话 → 302 到 OAuth 登录，
//            保留 return_to（白名单化后进 HMAC state，防 open redirect）。
//   接入向导 /onboard —— p30-F05 起同样要求会话：admin 权限判定需要发起人的真实
//            GitHub 身份（collaborator permission 查询），批次 3 原型「无身份读取」
//            的假设随接真失效（原型页头部注释保留仅作历史记录，不再是约束）。
//   治理面   /portal /platform 及 /api/portal/*（Access JWT 逐路由验签，#523/#543）
//            —— 本中间件不触碰；Access 收缩到治理面由人类在 CF dashboard 操作
//            （阶段 2 的「删」侧不在代码内，原子灰度：本 PR 只加不删）。
//
// #588 不回退：API 的 401 仍由 lib/portal-fetch.ts 触发整页重认证；此处仅管页面导航。
import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/session";

export const config = {
  // 工作区 + 个人层 + 接入向导。公开层与治理面绝不进入本 matcher（改动须同步顶部注释与静态断言）。
  matcher: ["/me", "/me/:path*", "/p/:path*", "/onboard"],
};

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const user = await getSessionUser(request.headers);
  if (user) return NextResponse.next();
  const returnTo = request.nextUrl.pathname + request.nextUrl.search;
  const login = new URL("/api/coord/oauth/github/login", request.url);
  login.searchParams.set("return_to", returnTo);
  // 302（非 Next 默认 307）：feature_list F02 验收断言 /me 未登录 → 301|302|401。
  return NextResponse.redirect(login, 302);
}
