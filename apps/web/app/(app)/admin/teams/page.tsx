import { redirect } from "next/navigation";
import { requireSysAdmin } from "@/lib/admin";
import { ComingSoon } from "../coming-soon";

export const dynamic = "force-dynamic";

// 占位目的地：团队管理是 F03（独立 feature，另一 owner），此处只做门控 + 占位。
export default async function AdminTeamsPage() {
  const gate = await requireSysAdmin();
  if (!gate.ok && gate.reason === "unauthenticated") redirect("/login");
  if (!gate.ok) {
    return (
      <div className="mx-auto max-w-content px-9 pb-14 pt-7">
        <div data-testid="admin-forbidden" role="alert" className="rounded-12 border border-border bg-surface-1 p-8 text-center">
          <h1 className="text-17 font-bold text-foreground">无权限访问</h1>
          <p className="mt-2 text-13 text-muted-foreground">该后台仅限系统管理员（SysAdmin）访问。</p>
        </div>
      </div>
    );
  }
  return <ComingSoon title="团队管理" />;
}
