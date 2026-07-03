import { redirect } from "next/navigation";

// uc-rr-009 / p20-F10：legacy 单画布页已下线。
// 旧直链不 404，收敛重定向到多 board 列表（/rooms/[id]/boards）。
export default function LegacyRoomBoardRedirect({ params }: { params: { id: string } }) {
  redirect(`/rooms/${params.id}/boards`);
}
