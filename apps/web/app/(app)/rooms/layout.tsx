// p22/F01：Rooms 应用的主从（master-detail）双栏壳——左栏房间列表常驻，
// 右栏渲染当前路由（/rooms 空态 或 /rooms/[id]/... 详情），切换房间不再整页跳转。
import type { ReactNode } from "react";
import { RoomListPanel } from "@/components/rooms/room-list-panel";

export default function RoomsSectionLayout({ children }: { children: ReactNode }) {
  return (
    <div data-testid="rooms-two-pane" className="flex h-full min-h-0">
      <RoomListPanel />
      <div className="min-h-0 min-w-0 flex-1 overflow-auto">{children}</div>
    </div>
  );
}
