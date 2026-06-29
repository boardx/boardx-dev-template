import type { ReactNode } from "react";
import { Sidebar } from "@/components/app-shell/sidebar";
import { currentUser, toPublicUser } from "@/lib/session";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await currentUser();
  const pub = user ? toPublicUser(user) : null;

  return (
    <div className="flex h-screen bg-background">
      <Sidebar user={pub} />
      {/* Mobile top bar — shown when sidebar is hidden */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <header className="flex h-14 shrink-0 items-center border-b border-border px-4 md:hidden">
          <span className="text-base font-bold text-foreground tracking-tight">BoardX</span>
          {pub && (
            <span className="ml-auto text-xs text-muted-foreground truncate max-w-xs">
              {pub.displayName}
            </span>
          )}
        </header>
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
