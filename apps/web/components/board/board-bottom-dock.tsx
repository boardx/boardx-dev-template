"use client";
// uc-board-ai-001 — FigJam 风格底部悬浮工具 dock（F01）。
// 对齐 docs/design/boardx-prototype-v1.bundle.html 的 Board 屏「FigJam bottom toolbar」：
// 居中悬浮胶囊、工具 + 分隔线 + 末尾黑底 "Ask AI" 触发按钮。
// 补充（非取代）现有顶部单行工具条 board-menu：后者是权威的编辑操作入口（含 disabled 态的
// 手绘/连接线等），本 dock 是与 prototype 视觉对齐的悬浮层，工具点击复用同一套
// chooseTool/activeTool 状态，两者保持一致，不产生第二套真值。
import type { ReactNode } from "react";
import {
  Cable,
  Code2,
  Hand,
  Image as ImageIcon,
  Kanban,
  MousePointer2,
  Shapes,
  Sparkles,
  StickyNote,
  Table2,
  Type,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type DockToolKey =
  | "select"
  | "pan"
  | "sticky"
  | "text"
  | "shape"
  | "connector"
  | "table"
  | "kanban"
  | "code"
  | "image";

interface DockTool {
  key: DockToolKey;
  name: string;
  icon: ReactNode;
  disabled?: boolean;
}

const DOCK_TOOLS: DockTool[] = [
  { key: "select", name: "选择", icon: <MousePointer2 className="h-4 w-4" /> },
  { key: "pan", name: "平移", icon: <Hand className="h-4 w-4" /> },
  { key: "sticky", name: "便利贴", icon: <StickyNote className="h-4 w-4" /> },
  { key: "text", name: "文本", icon: <Type className="h-4 w-4" /> },
  { key: "shape", name: "形状", icon: <Shapes className="h-4 w-4" /> },
  { key: "connector", name: "连接线", icon: <Cable className="h-4 w-4" />, disabled: true },
  { key: "table", name: "表格", icon: <Table2 className="h-4 w-4" />, disabled: true },
  { key: "kanban", name: "看板", icon: <Kanban className="h-4 w-4" />, disabled: true },
  { key: "code", name: "代码", icon: <Code2 className="h-4 w-4" />, disabled: true },
  { key: "image", name: "图片", icon: <ImageIcon className="h-4 w-4" />, disabled: true },
];

export function BoardBottomDock({
  activeTool,
  onSelectTool,
  aiOpen,
  onToggleAi,
}: {
  activeTool: string;
  onSelectTool: (tool: DockToolKey) => void;
  aiOpen: boolean;
  onToggleAi: () => void;
}) {
  return (
    <div
      data-testid="board-bottom-dock"
      aria-label="Board 工具 dock"
      className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-2xl border border-border bg-card/90 p-1.5 shadow-lg backdrop-blur-md"
    >
      {DOCK_TOOLS.map((tool) => (
        <button
          key={tool.key}
          type="button"
          data-testid={`dock-tool-${tool.key}`}
          title={tool.disabled ? `${tool.name}（暂不可用）` : tool.name}
          aria-label={tool.name}
          aria-pressed={activeTool === tool.key}
          disabled={tool.disabled}
          onClick={() => onSelectTool(tool.key)}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg transition-colors duration-200",
            "hover:bg-accent hover:text-accent-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:text-disabled-foreground disabled:hover:bg-transparent",
            activeTool === tool.key ? "bg-secondary text-secondary-foreground" : "text-muted-foreground"
          )}
        >
          {tool.icon}
        </button>
      ))}

      <div className="mx-1 h-6 w-px bg-border" />

      {/* Ask AI 触发按钮：对齐 prototype 黑底圆角胶囊 "AI"，唤起 board-ai-panel */}
      <button
        type="button"
        data-testid="dock-tool-ask-ai"
        title="Ask AI"
        aria-label="唤起 Board AI"
        aria-pressed={aiOpen}
        onClick={onToggleAi}
        className={cn(
          "flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground",
          "transition-all duration-200 hover:bg-primary/90 hover:scale-[1.02] active:scale-95",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        )}
      >
        <Sparkles className="h-3.5 w-3.5" />
        Ask AI
      </button>
    </div>
  );
}
