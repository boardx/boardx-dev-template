import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { StoreBrowser } from "./store-browser";

export const dynamic = "force-dynamic";

// uc-ai-store-001-browse-items：浏览 Agent/工具/模板。
// 服务端做登录守卫（未登录 → /login），登录后渲染交互式浏览客户端组件。
export default async function AiStorePage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  return <StoreBrowser />;
}
