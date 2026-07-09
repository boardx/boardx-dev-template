import type { ReactNode } from "react";

// Board 详情页专属布局（P0：真实全屏布局，不是覆盖层）。
// 与 (app) 的 rail layout 相比刻意极简：无 Sidebar、无移动端顶栏——白板要吃满整个视口。
// (app)/layout.tsx 里除 Sidebar 外只有为 Sidebar/FeedbackLauncher 服务的 session 取用，
// board 页自身全部走客户端 fetch，无需在此保留任何 provider 包裹。
export default function BoardLayout({ children }: { children: ReactNode }) {
  return <div className="h-screen overflow-hidden bg-surface-1">{children}</div>;
}
