import { redirect } from "next/navigation";
import { requireSysAdmin } from "@/lib/admin";
import { AdminHome } from "./admin-home";

export const dynamic = "force-dynamic";

// uc-admin-005 — Admin Panel 首页（F01：身份门控 + 统计摘要 + 模块导航）。
// 服务端做 SysAdmin 门控：未登录 → /login；已登录但非 SysAdmin → 403 面板（不重定向，
// 避免把"无权限"和"未登录"混淆成同一种跳转，且方便 e2e 断言可见的 403 文案）。
export default async function AdminHomePage() {
  const gate = await requireSysAdmin();

  if (!gate.ok && gate.reason === "unauthenticated") {
    redirect("/login");
  }

  if (!gate.ok) {
    return (
      <div className="mx-auto max-w-content px-9 pb-14 pt-7">
        <div
          data-testid="admin-forbidden"
          role="alert"
          className="rounded-12 border border-border bg-surface-1 p-8 text-center"
        >
          <h1 className="text-17 font-bold text-foreground">无权限访问</h1>
          <p className="mt-2 text-13 text-muted-foreground">该后台仅限系统管理员（SysAdmin）访问。</p>
        </div>
      </div>
    );
  }

  return <AdminHome />;
}
