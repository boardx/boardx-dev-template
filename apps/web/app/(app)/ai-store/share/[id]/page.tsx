import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { redeemAiStoreItemShare } from "@repo/data";

export const dynamic = "force-dynamic";

// uc-ai-store-005 步骤 5：被授权协作者打开管理授权链接 /ai-store/share/:id?shareToken=...
// 未登录 → /login（与站内其它登录门禁一致）；token 无效/分享已关闭 → 落到 Authorized 视图
// 并带上失败提示，不额外暴露项目详情（E3：访问者只看到不可访问提示）。
// token 有效则记录为该项目 grantee，随后跳到 Authorized 视图，卡片会带上「已授权」标识。
export default async function AiStoreSharePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { shareToken?: string };
}) {
  const user = await currentUser();
  if (!user) redirect("/login");

  const itemId = Number(params.id);
  const shareToken = searchParams.shareToken ?? "";

  if (!Number.isFinite(itemId) || !shareToken) {
    redirect("/ai-store?nav=authorized&shareError=invalid");
  }

  const item = await redeemAiStoreItemShare(itemId, shareToken, user!.id);
  if (!item) {
    redirect("/ai-store?nav=authorized&shareError=invalid");
  }

  redirect(`/ai-store?nav=authorized&shared=${itemId}`);
}
