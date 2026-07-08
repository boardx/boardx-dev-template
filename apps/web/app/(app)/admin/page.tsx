import { AdminHome } from "./admin-home";

export const dynamic = "force-dynamic";

// uc-admin-005 — Admin Panel 首页（F01：统计摘要 + 模块导航）。
// SysAdmin 门控统一在 layout.tsx 做一次（未登录 → /login；非 SysAdmin → 403 面板），
// 本页只负责渲染，不重复判定。
export default function AdminHomePage() {
  return <AdminHome />;
}
