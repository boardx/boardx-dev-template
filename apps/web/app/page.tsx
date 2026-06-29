import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { LogoutButton } from "@/components/logout-button";
import { currentUser, toPublicUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await currentUser();
  const pub = user ? toPublicUser(user) : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-start justify-center gap-5 p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">BoardX</h1>
        <p className="text-muted-foreground">Open Creation Engine for AI-native work and learning.</p>
        <Badge variant="success" data-testid="status-badge" className="mt-1 w-fit">skeleton online</Badge>
      </div>

      {pub ? (
        <div className="flex w-full max-w-md flex-col gap-3 rounded-lg border bg-card p-5 text-card-foreground shadow-sm" data-testid="user-menu">
          <p data-testid="current-user" className="text-sm text-muted-foreground">已登录：{pub.email}</p>
          <div className="flex items-center gap-3">
            <span data-testid="menu-avatar"
              className="inline-flex h-9 items-center rounded-full bg-secondary px-3 font-mono text-xs text-secondary-foreground">
              {pub.avatar ?? "(默认头像)"}
            </span>
            <span data-testid="menu-displayname" className="text-sm font-semibold text-foreground">{pub.displayName}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a href="/account" data-testid="link-profile" className={buttonVariants({ variant: "outline", size: "sm" })}>Profile</a>
            <a href="/account?section=settings" data-testid="link-settings" className={buttonVariants({ variant: "ghost", size: "sm" })}>Settings</a>
            <a href="/teams" className={buttonVariants({ variant: "ghost", size: "sm" })}>团队</a>
            <a href="/rooms" className={buttonVariants({ variant: "ghost", size: "sm" })}>房间</a>
            <LogoutButton />
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3" data-testid="guest">
          <a href="/login" className={buttonVariants()}>登录</a>
          <a href="/register" className={buttonVariants({ variant: "link" })}>注册</a>
        </div>
      )}
    </main>
  );
}
