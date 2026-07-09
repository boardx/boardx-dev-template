"use client";
// p22/F01：Rooms 应用的主从（master-detail）双栏壳——左栏房间列表常驻，
// 右栏渲染当前路由（/rooms 空态 或 /rooms/[id]/... 详情），切换房间不再整页跳转。
//
// p22 Studio 全屏：Studio 是沉浸式全屏工作区（对齐原型里 Studio/Chat 为独立全屏路由的设计），
// 在 /rooms/[id]/studio 路由下不渲染左侧房间列表，让 Studio 三栏占满整个内容区
// （仅保留最左 app 导航）。其余路由维持双栏。
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { RoomListPanel } from "@/components/rooms/room-list-panel";

export default function RoomsSectionLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const fullscreen = /^\/rooms\/[^/]+\/studio(\/|$)/.test(pathname);

  if (fullscreen) {
    return <div className="h-full min-h-0">{children}</div>;
  }

  return (
    <div data-testid="rooms-two-pane" className="flex h-full min-h-0">
      <RoomListPanel />
      <div className="min-h-0 min-w-0 flex-1 overflow-auto">{children}</div>
    </div>
  );
}
