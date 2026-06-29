import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

// uc-home-004：Recent 页当前为「开发中」占位（忠于真实产品状态，不臆造最近资源列表）。
export default async function RecentPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <h1 data-testid="recent-title" className="text-3xl font-bold tracking-tight text-foreground">
        Recent Activity
      </h1>
      <p data-testid="under-dev" className="text-sm text-muted-foreground">
        This page is under development.
      </p>
      <p className="text-sm text-muted-foreground">
        可通过左侧导航、Home、Room、Board 或全局搜索继续访问你的工作内容。
      </p>
    </div>
  );
}
