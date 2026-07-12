// portal-fetch.ts — 门户数据请求的统一入口（401 = Access 会话过期，不是数据故障）。
// 背景：Cloudflare Access 会话（默认 24h）过期后，已加载的 SPA 里所有 API 开始
// 返回 401，此前各 tab 把它渲染成"数据源不可达"——把认证问题伪装成了上游故障
// （2026-07-11 用户实报）。正确语义：401 → 整页刷新，让 Access 在边缘重新走
// GitHub 登录；sessionStorage 防刷新环（若刷新后仍 401 说明是真问题，不再刷）。
export async function portalFetch(url: string): Promise<Response | null> {
  const res = await fetch(url);
  if (res.status !== 401) {
    if (res.ok) sessionStorage.removeItem("portal-401-reloaded");
    return res;
  }
  if (!sessionStorage.getItem("portal-401-reloaded")) {
    sessionStorage.setItem("portal-401-reloaded", "1");
    window.location.reload();
  }
  return null; // 调用方：null = 正在重新认证，保持当前状态不动
}
