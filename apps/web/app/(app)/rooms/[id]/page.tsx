// p20/F01：/rooms/[id] 默认落 Boards tab（uc-rr-001 主流程 1）
import { redirect } from "next/navigation";

export default function RoomIndexPage({ params }: { params: { id: string } }) {
  redirect(`/rooms/${params.id}/boards`);
}
