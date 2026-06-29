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
        <div className="flex flex-col gap-2">
          <p data-testid="current-user">已登录：{pub.email}（{pub.firstName} {pub.lastName}）</p>
          <div className="flex items-center gap-3">
            <a href="/account" className="text-sm text-blue-600">账号中心</a>
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
