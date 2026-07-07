import { redirect } from "next/navigation";
import { requireSysAdmin } from "@/lib/admin";
import { CoordinationDashboard } from "./coordination-dashboard";

export const dynamic = "force-dynamic";

// coordination dashboard — server-side SysAdmin gate, same pattern as admin/page.tsx
// (the actual precedent in this codebase for a real server-side gate; admin/users
// and admin/teams are client-only and rely solely on their API routes' 401/403 —
// this page follows the stricter home-page pattern instead, matching what the
// agent-lifecycle-management-proposal.md actually described).
export default async function CoordinationPage() {
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
          <p className="mt-2 text-13 text-muted-foreground">
            This admin panel is restricted to system administrators (SysAdmin).
          </p>
        </div>
      </div>
    );
  }

  return <CoordinationDashboard />;
}
