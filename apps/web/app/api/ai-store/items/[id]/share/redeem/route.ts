// apps/web/app/api/ai-store/items/[id]/share/redeem/route.ts — P11 F05
// 被授权协作者打开管理授权链接：POST ?shareToken=... （或 body.shareToken）。
// 必须已登录（未登录 401，前端引导登录后带着链接回来）；token 必须匹配且分享当前处于
// 开启状态，否则一律 404（E3：分享链接无效或项目已下架，访问者只看到不可访问提示，
// 不暴露项目是否存在，避免用可枚举 id + 猜测状态探测私有项目)。
import { NextResponse } from "next/server";
import { redeemAiStoreItemShare } from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const itemId = Number(params.id);
  if (!Number.isFinite(itemId)) return NextResponse.json({ error: "无效的项目 id" }, { status: 400 });

  const url = new URL(req.url);
  let shareToken = url.searchParams.get("shareToken") ?? "";
  if (!shareToken) {
    try {
      const body = (await req.json()) as { shareToken?: string };
      shareToken = body.shareToken ?? "";
    } catch {
      shareToken = "";
    }
  }
  if (!shareToken) return NextResponse.json({ error: "缺少授权链接 token" }, { status: 400 });

  const item = await redeemAiStoreItemShare(itemId, shareToken, user.id);
  if (!item) return NextResponse.json({ error: "分享链接无效或已关闭" }, { status: 404 });

  return NextResponse.json({ item });
}
