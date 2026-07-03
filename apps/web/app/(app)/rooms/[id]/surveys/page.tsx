// p20/F01：Survey tab 占位——房间作用域问卷由 F08（uc-rr-007）交付
export default function RoomSurveysPlaceholderPage() {
  return (
    <div className="mx-auto max-w-2xl p-6">
      <div
        data-testid="room-survey-placeholder"
        className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-16 text-center"
      >
        <p className="text-sm font-medium text-foreground">房间问卷</p>
        <p className="text-sm text-muted-foreground">本房间的问卷入口即将上线（p20/F08）</p>
      </div>
    </div>
  );
}
