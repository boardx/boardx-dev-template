import { Badge } from "@/components/ui/badge";
import { LogoutButton } from "@/components/logout-button";
import { currentUser, toPublicUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await currentUser();
  const pub = user ? toPublicUser(user) : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-start justify-center gap-4 p-8">
      <h1 className="text-4xl font-bold tracking-tight">BoardX</h1>
      <p className="text-neutral-600">Open Creation Engine for AI-native work and learning.</p>
      <Badge variant="success" data-testid="status-badge">skeleton online</Badge>

      {pub ? (
        <div className="flex flex-col gap-2" data-testid="user-menu">
          <p data-testid="current-user">已登录：{pub.email}</p>
          <div className="flex items-center gap-2">
            <span data-testid="menu-avatar" className="rounded-full bg-neutral-200 px-2 py-1 font-mono text-xs">
              {pub.avatar ?? "(默认头像)"}
            </span>
            <span data-testid="menu-displayname" className="text-sm font-medium">{pub.displayName}</span>
          </div>
          <div className="flex items-center gap-3">
            <a href="/account" data-testid="link-profile" className="text-sm text-blue-600">Profile</a>
            <a href="/account?section=settings" data-testid="link-settings" className="text-sm text-blue-600">Settings</a>
            <a href="/teams" className="text-sm text-blue-600">团队</a>
            <a href="/rooms" className="text-sm text-blue-600">房间</a>
            <LogoutButton />
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3" data-testid="guest">
          <a href="/login" className="rounded bg-neutral-900 px-4 py-2 text-sm text-white">登录</a>
          <a href="/register" className="text-sm text-blue-600">注册</a>
        </div>
      )}
    </main>
  );
}
