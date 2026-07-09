"use client";
// Board 底部悬浮工具 dock — 对齐 UI Prototype V1 的 Board 屏（board-shell reskin，issue #468）。
// 顶部 Board Menu 工具条已删除，本 dock 是唯一的画布工具入口（仅编辑者可见，viewer 不渲染，
// 门控在 board-canvas.tsx 的 canEdit && <BoardBottomDock/>）。
// 分组：select hand | sticky text shape connector draw eraser | table kanban code image embed link | AI。
// e2e testid 保活策略：sticky/text/embed/link 沿用 canonical 的 add-* 名，select/pan/shape/
// connector/draw/eraser 沿用 board-tool-* 名（21+ 个 spec 把这些当放置前置，一行不改）；
// 未实现的 table/kanban/code/image 维持 dock-tool-* 禁用占位；AI 按钮保留 dock-tool-ask-ai
// （board-ai-overlay.spec 依赖）。
import type { ReactNode } from "react";
import {
  Cable,
  Code2,
  Eraser,
  Hand,
  Image as ImageIcon,
  Kanban,
  Link2,
  MousePointer2,
  PenLine,
  Shapes,
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
  | "draw"
  | "eraser"
  | "table"
  | "kanban"
  | "code"
  | "image"
  | "embed"
  | "link";

interface DockTool {
  key: DockToolKey;
  name: string;
  testId: string;
  icon: ReactNode;
  disabled?: boolean;
}

const ICON = "h-4 w-4";

// 三个分组（组间渲染分隔符），顺序与原型一致；draw/eraser 是原型没有但功能已上线的工具，
// 按 reskin 规格放进第二组末尾（不能丢能力）。
const DOCK_GROUPS: DockTool[][] = [
  [
    { key: "select", name: "选择", testId: "board-tool-select", icon: <MousePointer2 className={ICON} /> },
    { key: "pan", name: "平移", testId: "board-tool-pan", icon: <Hand className={ICON} /> },
  ],
  [
    { key: "sticky", name: "便利贴", testId: "add-note", icon: <StickyNote className={ICON} /> },
    { key: "text", name: "文本", testId: "add-text", icon: <Type className={ICON} /> },
    { key: "shape", name: "形状", testId: "board-tool-shape", icon: <Shapes className={ICON} /> },
    { key: "connector", name: "连接线", testId: "board-tool-connector", icon: <Cable className={ICON} /> },
    { key: "draw", name: "手绘", testId: "board-tool-draw", icon: <PenLine className={ICON} /> },
    { key: "eraser", name: "橡皮擦", testId: "board-tool-eraser", icon: <Eraser className={ICON} /> },
  ],
  [
    { key: "table", name: "表格", testId: "dock-tool-table", icon: <Table2 className={ICON} />, disabled: true },
    { key: "kanban", name: "看板", testId: "dock-tool-kanban", icon: <Kanban className={ICON} />, disabled: true },
    { key: "code", name: "代码", testId: "dock-tool-code", icon: <Code2 className={ICON} />, disabled: true },
    { key: "image", name: "图片", testId: "dock-tool-image", icon: <ImageIcon className={ICON} />, disabled: true },
    { key: "embed", name: "嵌入", testId: "add-embed", icon: <ImageIcon className={ICON} /> },
    { key: "link", name: "链接", testId: "add-link", icon: <Link2 className={ICON} /> },
  ],
];

export function BoardBottomDock({
  activeTool,
  activePanel,
  onSelectTool,
  onShapeMenu,
  aiOpen,
  onToggleAi,
}: {
  activeTool: string;
  // 打开中的 dock 二级面板（形状 picker / 链接输入），供 shape/link 按钮的
  // aria-expanded 与 active 高亮反映真实展开态。
  activePanel?: "shape" | "link" | null;
  onSelectTool: (tool: DockToolKey) => void;
  // uc-widgets-004：形状类型切换的下拉箭头（board-tool-shape-menu）——点形状按钮本体是
  // "沿用上次类型直接创建"（主流程 4），切换类型走这个独立小箭头开 shape picker。
  onShapeMenu?: () => void;
  aiOpen: boolean;
  onToggleAi: () => void;
}) {
  return (
    <div
      data-testid="board-bottom-dock"
      aria-label="Board 工具 dock"
      className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-[3px] rounded-[14px] border border-[#e0e0e0] bg-white p-[6px] shadow-[0_8px_26px_rgba(0,0,0,.14)]"
    >
      {DOCK_GROUPS.map((group, gi) => (
        <div key={gi} className="contents">
          {gi > 0 && <div aria-hidden className="mx-[3px] h-[22px] w-px bg-[#e0e0e0]" />}
          {group.map((tool) => {
            const expanded = tool.key === "shape" || tool.key === "link" ? activePanel === tool.key : undefined;
            const active = activeTool === tool.key || expanded === true;
            return (
              <div key={tool.key} className="contents">
                <button
                  type="button"
                  data-testid={tool.testId}
                  title={tool.disabled ? `${tool.name}（暂不可用）` : tool.name}
                  aria-label={tool.name}
                  aria-pressed={active}
                  aria-expanded={expanded}
                  disabled={tool.disabled}
                  onClick={() => onSelectTool(tool.key)}
                  className={cn(
                    "flex h-[38px] w-[38px] items-center justify-center rounded-[9px] transition-colors duration-200",
                    "hover:bg-[#f0f0f0] hover:text-black",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent",
                    active ? "bg-[#f0f0f0] text-black" : "text-[#707070]"
                  )}
                >
                  {tool.icon}
                </button>
                {tool.key === "shape" && onShapeMenu && (
                  <button
                    type="button"
                    data-testid="board-tool-shape-menu"
                    aria-label="选择形状类型"
                    aria-expanded={activePanel === "shape"}
                    onClick={onShapeMenu}
                    className={cn(
                      "flex h-[38px] w-4 items-center justify-center rounded-[9px] text-[#707070] transition-colors duration-200",
                      "hover:bg-[#f0f0f0] hover:text-black",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    )}
                  >
                    <span className="text-10 leading-none">▾</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ))}

      <div aria-hidden className="mx-[3px] h-[22px] w-px bg-[#e0e0e0]" />

      {/* Ask AI：原型为 38×38 黑底方块（非长胶囊） */}
      <button
        type="button"
        data-testid="dock-tool-ask-ai"
        title="Ask AI"
        aria-label="唤起 Board AI"
        aria-pressed={aiOpen}
        onClick={onToggleAi}
        className={cn(
          "flex h-[38px] w-[38px] items-center justify-center rounded-[9px] bg-black text-[11px] font-bold text-white",
          "transition-all duration-200 hover:bg-[#282828] active:scale-95",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        )}
      >
        AI
      </button>
    </div>
  );
}
