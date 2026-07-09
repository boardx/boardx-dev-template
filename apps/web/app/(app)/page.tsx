import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { LogoutButton } from "@/components/logout-button";
import { HomeWorkbench } from "@/components/home/home-workbench";
import { currentUser, toPublicUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await currentUser();
  const pub = user ? toPublicUser(user) : null;

  if (!pub) {
    return (
      <div className="flex h-full min-h-[calc(100vh-3.5rem)] items-center justify-center p-8">
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="flex flex-col items-center gap-2">
            <img src="/logo-icon.png" alt="BoardX Logo" className="mb-1 h-8.5 w-8.5 object-contain" />
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

  return (
    <div>
      {/* 精简身份条：sidebar 账号菜单已是主入口，这里保留可见的最小形态，
          避免和 Quick chat 等工作台内容抢视觉焦点，同时不破坏既有 e2e 对这些 testid 的断言。 */}
      <div
        data-testid="user-menu"
        className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-border px-9 py-2.5 text-13"
      >
        <span data-testid="menu-avatar" className="font-mono text-xs text-muted-foreground">
          {pub.avatar ?? "(默认头像)"}
        </span>
        <span data-testid="menu-displayname" className="font-semibold text-foreground">
          {pub.displayName}
        </span>
        <p data-testid="current-user" className="text-muted-foreground">
          Signed in as {pub.email}
        </p>
        <div className="ml-auto flex items-center gap-2">
          <a href="/account" data-testid="link-profile" className={buttonVariants({ variant: "outline", size: "sm" })}>
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

      <HomeWorkbench />
    </div>
  );
}
