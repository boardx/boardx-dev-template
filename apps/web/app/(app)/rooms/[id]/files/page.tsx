// p20/F01：Files tab 占位——房间级文件库由 F03（uc-rr-003）交付
export default function RoomFilesPlaceholderPage() {
  return (
    <div className="mx-auto max-w-2xl p-6">
      <div
        data-testid="room-files-placeholder"
        className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-16 text-center"
      >
        <p className="text-sm font-medium text-foreground">房间文件库</p>
        <p className="text-sm text-muted-foreground">房间级文件上传与管理即将上线（p20/F03）</p>
      </div>
    </div>
  );
}
