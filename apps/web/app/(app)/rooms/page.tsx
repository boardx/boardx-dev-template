// p22/F01：房间列表已移到左栏常驻面板（components/rooms/room-list-panel.tsx）；
// 未选中任何房间时，右栏展示这个空态。
export default function RoomsIndexPage() {
  return (
    <div
      data-testid="rooms-empty-state"
      className="flex h-full flex-col items-center justify-center gap-1.5 p-12 text-center"
    >
      <p className="text-15 font-medium text-foreground">选择一个房间查看详情</p>
      <p className="text-13 text-muted-foreground">或者从左侧新建一个房间</p>
    </div>
  );
}
