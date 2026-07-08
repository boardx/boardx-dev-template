import { redirect } from "next/navigation";
import { requireSysAdmin } from "@/lib/admin";
import { AdminTabs } from "./admin-tabs";

export const dynamic = "force-dynamic";

// 所有 /admin/* 页面共用的门控 + tab 导航壳。SysAdmin 判定统一在这里做一次
// （子页面各自的 401/403 客户端兜底逻辑保留不动，属于纵深防御，不因为这里加了
// 门控就去精简它们——那是另一件事，不在"加 tab"这个改动范围内）。
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
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
          <h1 className="text-17 font-bold text-foreground">Access denied</h1>
          <p className="mt-2 text-13 text-muted-foreground">This admin panel is restricted to system administrators (SysAdmin).</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="border-b border-border">
        <div className="mx-auto max-w-content px-9 py-3">
          <AdminTabs />
        </div>
      </div>
      {children}
    </div>
  );
}
