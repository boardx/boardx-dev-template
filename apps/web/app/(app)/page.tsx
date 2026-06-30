import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogoutButton } from "@/components/logout-button";
import { currentUser, toPublicUser } from "@/lib/session";
import { Users, DoorOpen, User } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await currentUser();
  const pub = user ? toPublicUser(user) : null;

  if (!pub) {
    return (
      <div className="flex h-full min-h-[calc(100vh-3.5rem)] items-center justify-center p-8">
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="flex flex-col items-center gap-2">
            <div className="mb-1 flex h-8.5 w-8.5 items-center justify-center rounded-9 bg-primary text-base font-extrabold text-primary-foreground">
              X
            </div>
            <h1 className="text-30 font-bold tracking-tight text-foreground">BoardX</h1>
            <p className="text-sm text-muted-foreground">
              Open Creation Engine for AI-native work and learning.
            </p>
            <Badge variant="success" data-testid="status-badge" className="mx-auto mt-1 w-fit">
              skeleton online
            </Badge>
          </div>
          <div className="flex items-center gap-3" data-testid="guest">
            <a href="/login" className={buttonVariants()}>Sign in</a>
            <a href="/register" className={buttonVariants({ variant: "link" })}>Sign up</a>
          </div>
        </div>
      </div>
    );
  }

  const NAV = [
    { href: "/teams", icon: Users, title: "Teams", desc: "Manage members and permissions", fill: "bg-tag-purple" },
    { href: "/rooms", icon: DoorOpen, title: "Rooms", desc: "Enter collaborative rooms and boards", fill: "bg-tag-blue" },
    { href: "/account", icon: User, title: "Account", desc: "Profile, password and preferences", fill: "bg-tag-green" },
  ];

  return (
    <div className="mx-auto max-w-content px-9 pb-14 pt-10">
      {/* Header */}
      <div className="mb-7 flex flex-col gap-1">
        <h1 className="text-26 font-bold tracking-tight text-foreground">
          Welcome back, {pub.displayName}
        </h1>
        <p className="text-sm text-muted-foreground">{pub.email}</p>
      </div>

      {/* User info card (preserves e2e testids) */}
      <div
        data-testid="user-menu"
        className="mb-7 flex flex-col gap-3 rounded-12 border border-border bg-surface-1 p-5"
      >
        <p data-testid="current-user" className="text-13 text-muted-foreground">
          Signed in as {pub.email}
        </p>
        <div className="flex items-center gap-3">
          <span
            data-testid="menu-avatar"
            className="inline-flex h-9 items-center rounded-full bg-secondary px-3 font-mono text-xs text-secondary-foreground"
          >
            {pub.avatar ?? "(默认头像)"}
          </span>
          <span
            data-testid="menu-displayname"
            className="text-sm font-semibold text-foreground"
          >
            {pub.displayName}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/account"
            data-testid="link-profile"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Profile
          </a>
          <a
            href="/account?section=settings"
            data-testid="link-settings"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            Settings
          </a>
          <LogoutButton />
        </div>
      </div>

      {/* Quick nav cards */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        {NAV.map(({ href, icon: Icon, title, desc, fill }) => (
          <a
            key={href}
            href={href}
            className="group rounded-12 border border-border p-5 transition-all duration-200 hover:border-border-strong hover:shadow-[0_2px_10px_rgba(0,0,0,0.05)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="mb-2.5 flex items-center gap-2.5">
              <div className={`flex h-8.5 w-8.5 items-center justify-center rounded-9 text-foreground ${fill}`}>
                <Icon className="h-4 w-4" />
              </div>
              <CardTitle className="text-sm">{title}</CardTitle>
            </div>
            <p className="text-13 leading-relaxed text-muted-foreground">{desc}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
