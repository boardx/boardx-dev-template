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
          <div className="flex flex-col gap-2">
            <h1 className="text-4xl font-bold tracking-tight text-foreground">BoardX</h1>
            <p className="text-muted-foreground">Open Creation Engine for AI-native work and learning.</p>
            <Badge variant="success" data-testid="status-badge" className="mx-auto mt-1 w-fit">
              skeleton online
            </Badge>
          </div>
          <div className="flex items-center gap-3" data-testid="guest">
            <a href="/login" className={buttonVariants()}>登录</a>
            <a href="/register" className={buttonVariants({ variant: "link" })}>注册</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-8">
      {/* Header */}
      <div className="flex flex-col gap-1 mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            欢迎回来，{pub.displayName}
          </h1>
          <Badge variant="success" data-testid="status-badge" className="hidden sm:flex">
            skeleton online
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm">{pub.email}</p>
      </div>

      {/* User info card (preserves e2e testids) */}
      <div
        data-testid="user-menu"
        className="mb-8 flex flex-col gap-3 rounded-lg border bg-card p-5 text-card-foreground shadow-sm"
      >
        <p data-testid="current-user" className="text-sm text-muted-foreground">
          已登录：{pub.email}
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <a
          href="/teams"
          className="group rounded-lg border bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:border-border/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-accent-foreground transition-colors duration-200 group-hover:bg-primary group-hover:text-primary-foreground">
              <Users className="h-5 w-5" />
            </div>
            <CardTitle className="text-base">团队</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">管理你的团队成员与权限</p>
        </a>

        <a
          href="/rooms"
          className="group rounded-lg border bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:border-border/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-accent-foreground transition-colors duration-200 group-hover:bg-primary group-hover:text-primary-foreground">
              <DoorOpen className="h-5 w-5" />
            </div>
            <CardTitle className="text-base">房间</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">进入协作房间与画板</p>
        </a>

        <a
          href="/account"
          className="group rounded-lg border bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:border-border/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-accent-foreground transition-colors duration-200 group-hover:bg-primary group-hover:text-primary-foreground">
              <User className="h-5 w-5" />
            </div>
            <CardTitle className="text-base">账号</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">个人信息、密码与偏好设置</p>
        </a>
      </div>
    </div>
  );
}
