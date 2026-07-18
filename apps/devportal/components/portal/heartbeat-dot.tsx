// p23/F04 心跳语义状态点：<5min 新鲜（绿）/ <30min 渐旧（黄）/ 其余陈旧（红）。
// 阈值复用 coord-dashboard 约定；具体时间放 title 悬停（界面契约：状态点不写字，时间在悬停）。
export function HeartbeatDot({ minutes }: { minutes: number }) {
  if (minutes < 5) {
    return <span aria-label="心跳新鲜" title={`最后心跳 ${formatMinutes(minutes)}前（<5 分钟 新鲜）`} className="inline-block h-2 w-2 shrink-0 rounded-full bg-success" />;
  }
  if (minutes < 30) {
    return <span aria-label="心跳渐旧" title={`最后心跳 ${formatMinutes(minutes)}前（<30 分钟 渐旧）`} className="inline-block h-2 w-2 shrink-0 rounded-full bg-accent-amber" />;
  }
  return <span aria-label="心跳陈旧" title={`最后心跳 ${formatMinutes(minutes)}前（≥30 分钟 陈旧）`} className="inline-block h-2 w-2 shrink-0 rounded-full bg-destructive" />;
}

export function formatMinutes(minutes: number): string {
  if (minutes < 1) return "不到 1 分钟";
  if (minutes < 60) return `${Math.round(minutes)} 分钟`;
  return `${Math.round((minutes / 60) * 10) / 10} 小时`;
}
