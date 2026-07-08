"use client";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CanvasViewport } from "@/components/board/canvas-viewport";
import {
  FabricCanvas,
  type ItemMove,
  type ItemResize,
  type RenderItem,
  type ViewportState,
} from "@/components/board/fabric-canvas";
import { type Guide, type SpacingHint } from "@/lib/canvas-snap";
import { BoardBottomDock, type DockToolKey } from "@/components/board/board-bottom-dock";
import { BoardAiOverlay } from "@/components/board/board-ai-panel";
import {
  publishConnectionState,
  publishCursor,
  screenToBoardPoint,
  setOperating,
  viewportContainerRect,
} from "@/lib/collab-bus";
import {
  applyEncodedUpdate,
  type CollabItemFields,
  createBoardDoc,
  encodeFullState,
  encodeUpdate,
  onLocalUpdate,
  onRemoteItemsChange,
  readItems as readCollabItems,
  reconcileLocalEdits,
  seedItems,
  syncItemsIntoDoc,
  upsertItem,
} from "@repo/collab";
import { isSafeLinkUrl } from "@repo/canvas";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Cable,
  Eraser,
  Hand,
  Image,
  LayoutTemplate,
  Link2,
  MousePointer2,
  Paintbrush,
  PenLine,
  Redo2,
  RefreshCw,
  Shapes,
  StickyNote,
  Type,
  Undo2,
} from "lucide-react";

interface Item {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  type: string;
  color?: string | null;
}

// 便签外观色 token → 样式（F11）。对齐 BoardX Prototype 柔彩便签（#fff7cc/#dbe8f7/#d8efe6/#fde2dd）。
// null/未知 → 默认 amber(=tag-yellow)。色 key 为持久化数据，勿改（见 widget-sticky e2e）。
const COLORS: Record<string, string> = {
  amber: "bg-tag-yellow border-border-strong text-foreground",
  blue: "bg-tag-blue border-border-strong text-foreground",
  green: "bg-tag-green border-border-strong text-foreground",
  pink: "bg-tag-pink border-border-strong text-foreground",
};
const COLOR_TOKENS = Object.keys(COLORS);
// color 字段可为复合 "<base>[:bold][|k=v...]"（uc-widget-menu-002 字重 + p6:F12 文本样式）：
// "<base>" 决定色/文本/嵌入判别；紧随其后可选的 ":bold" 段（历史格式，勿改）决定字重；
// "|" 之后是任意数量的 "k=v" 样式段（font/size/align/italic），供 F12 文本样式面板使用。
// 三者互不影响，解析时先按 "|" 切出样式段，再从首段（base[:bold]）里剥离 base 与 bold。
const splitColor = (c?: string | null) => (c ?? "amber").split("|");
const baseColor = (c?: string | null) => (splitColor(c)[0] ?? "amber").split(":")[0] || "amber";
const isBold = (it: { color?: string | null }) => (splitColor(it.color)[0] ?? "").endsWith(":bold");
const colorClass = (c?: string | null) => COLORS[baseColor(c)] ?? COLORS.amber;

// p6:F12 文本样式段解析："|" 之后的 "k=v" 列表。
const styleSegs = (c?: string | null) => splitColor(c).slice(1);
const styleGet = (c: string | null | undefined, key: string): string | null => {
  for (const seg of styleSegs(c)) {
    const [k, ...rest] = seg.split("=");
    if (k === key) return rest.join("=");
  }
  return null;
};
const isItalic = (it: { color?: string | null }) => styleGet(it.color, "italic") === "1";
// p6:F20（uc-widget-menu-003 锁定/解锁）：锁定态编码为 color 的 "|locked=1" 样式段，沿用
// F12/F19 建立的 "|k=v" 哨兵编码约定，不新增持久化列。锁定后不可移动/缩放/旋转/编辑，
// Widget Menu 显示解锁入口（见 wm-lock/wm-unlock）。
const getLocked = (it: { color?: string | null }) => styleGet(it.color, "locked") === "1";
// p6:F21（uc-widgets-010 编组/解组）：编组编码为 color 的 "|group=<groupId>" 样式段，沿用
// F12/F19/F20 建立的 "|k=v" 哨兵编码约定，不新增持久化列/表。groupId 取该组任一成员（编组时
// 触发编组动作所在的选中集合里的第一个 item）的 id 作为组标识，够用且不需要额外的 id 生成器。
// 范围克制（notes 同步说明）：不支持组嵌套（编组时若成员已属于某组，直接用新 groupId 覆盖旧值，
// 相当于「重新编组」，不做多级分组树）；组内对象允许通过双击等既有单选路径再单独选中/编辑
// （不额外禁止，最简单可靠）。
const getGroupId = (it: { color?: string | null }): string | null => styleGet(it.color, "group");
const getFontFamily = (it: { color?: string | null }) => styleGet(it.color, "font") ?? DEFAULT_FONT;
const getFontSize = (it: { color?: string | null }) => {
  const v = styleGet(it.color, "size");
  const n = v != null ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_FONT_SIZE;
};
const getAlign = (it: { color?: string | null }): "left" | "center" | "right" => {
  const v = styleGet(it.color, "align");
  if (v === "center" || v === "right" || v === "left") return v;
  // 未显式设置对齐时的默认值：文本块沿用「左对齐」，便签/其它沿用「居中」（与既有视觉一致）。
  return baseColor(it.color) === "text" ? "left" : "center";
};

// p6:F19（uc-widget-menu-002）：边框色/边框宽/透明度样式段，沿用 F12 建立的 "|k=v" 编码约定，
// 不新增持久化列（color 仍是唯一可扩展的透传字段）。
// 边框宽同时承担「线宽」语义（uc-widget-menu-002 的线宽项）：本轮画布尚无独立的形状/连接线
// 组件类型，故线宽与边框宽复用同一个 "|borderw=" 段，避免预留不会被使用的字段。
const BORDER_TOKENS = ["none", "gray", "blue", "red"] as const;
type BorderToken = (typeof BORDER_TOKENS)[number];
const DEFAULT_BORDER: BorderToken = "none";
const getBorder = (it: { color?: string | null }): BorderToken => {
  const v = styleGet(it.color, "border");
  return (BORDER_TOKENS as readonly string[]).includes(v ?? "") ? (v as BorderToken) : DEFAULT_BORDER;
};
const BORDER_WIDTH_OPTIONS = [1, 2, 4] as const;
const DEFAULT_BORDER_WIDTH = 1;
const getBorderWidth = (it: { color?: string | null }): number => {
  const v = styleGet(it.color, "borderw");
  const n = v != null ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_BORDER_WIDTH;
};
const OPACITY_OPTIONS = [100, 75, 50, 25] as const;
const DEFAULT_OPACITY = 100;
const getOpacity = (it: { color?: string | null }): number => {
  const v = styleGet(it.color, "opacity");
  const n = v != null ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 && n <= 100 ? n : DEFAULT_OPACITY;
};
// uc-widget-menu-002「文字色」：与便签/背景底色（base token）分离的独立文字颜色，
// F12 之前从未提供文字色控制（此前仅有底色/加粗）。留空 = 跟随主题前景色（既有视觉不变）。
const TEXT_COLOR_TOKENS = ["default", "slate", "blue", "green", "red"] as const;
type TextColorToken = (typeof TEXT_COLOR_TOKENS)[number];
const DEFAULT_TEXT_COLOR: TextColorToken = "default";
const getTextColor = (it: { color?: string | null }): TextColorToken => {
  const v = styleGet(it.color, "textcolor");
  return (TEXT_COLOR_TOKENS as readonly string[]).includes(v ?? "") ? (v as TextColorToken) : DEFAULT_TEXT_COLOR;
};
// 样式字段集合（用于「应用格式」把源对象的可复用样式整体复制到目标对象）。
const STYLE_KEYS = ["font", "size", "align", "italic", "border", "borderw", "opacity", "textcolor"] as const;
// 「应用格式」（uc-widget-menu-010）：把源对象的完整可复用样式（背景/字重 head +
// 字体/字号/对齐/斜体/边框/线宽/透明度/文字色样式段）整体复制为目标对象的新 color 值，
// 只复制外观样式，不带 text/位置/尺寸。目标原有样式段全部被源样式覆盖（非合并），
// 语义对齐「格式刷」直觉——应用后目标与源外观一致。
const applyFormatColor = (source: { color?: string | null }, targetIsText: boolean): string => {
  const [srcHead] = splitColor(source.color);
  // 目标若为文本组件，强制保留 "text" 判别头（透明块，不套背景色/tag 色）；
  // 否则采用源的 base[:bold]（含背景色 + 字重）。
  const head = targetIsText ? TEXT_MARK + (isBold(source) ? ":bold" : "") : (srcHead ?? "amber");
  const segs = STYLE_KEYS.map((k) => {
    const v = styleGet(source.color, k);
    return v != null ? `${k}=${v}` : null;
  }).filter((s): s is string => s !== null);
  return [head, ...segs].join("|");
};
// 用新的 k=v 覆盖/追加样式段，保留 base[:bold] 与其它未涉及的样式段。
const withStyle = (color: string | null | undefined, patch: Record<string, string | null>): string => {
  const [head, ...segs] = splitColor(color);
  const map = new Map(
    segs.map((seg) => {
      const [k, ...rest] = seg.split("=");
      return [k, rest.join("=")] as const;
    }),
  );
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) map.delete(k);
    else map.set(k, v);
  }
  const rest = [...map.entries()].map(([k, v]) => `${k}=${v}`);
  return [head, ...rest].join("|");
};

// p6:F12（uc-widget-menu-013 编辑文本样式）：字体/字号可选项。
// 值为渲染层直接消费的 CSS font-family / px 数值，持久化在 color 的 "|font="/"|size=" 段。
const FONT_OPTIONS = [
  { value: "sans-serif", label: "无衬线" },
  { value: "serif", label: "衬线" },
  { value: "monospace", label: "等宽" },
] as const;
const DEFAULT_FONT = FONT_OPTIONS[0].value;
const FONT_SIZE_OPTIONS = [12, 14, 16, 20, 24, 32] as const;
const DEFAULT_FONT_SIZE = 12;

// 文本（Text）组件（uc-board-menu-003）。
// 约束（范围纪律）：当前 @repo/canvas 的 validateNewItem 只放行 type ∈ {note,rect}，
// 服务端校验/路由不可改。故文本组件在「线上」仍以 type:"note" 持久化，
// 用 color 哨兵值 "text" 作为判别位（color 字段经 POST/PATCH/GET 全程原样透传，
// 刷新后仍在）。客户端据此把它渲染为「透明无边框文本块」，与便签区分。
const TEXT_MARK = "text";
const DEFAULT_TEXT = "文本";
const isText = (it: { color?: string | null }) => baseColor(it.color) === TEXT_MARK;
// 形状（Shape）组件（uc-widgets-004）：服务端原生放行 type:"rect"，按 type 判别，无需 color 哨兵。
const isShape = (it: { type: string }) => it.type === "rect";
// p6:F15：具体形状种类沿用 F12/F19/F20/F21 建立的 color "|k=v" 哨兵编码约定，不新增持久化列
// （服务端 validateNewItem 仍只认 type ∈ {note,rect}）。UC uc-widgets-004 业务规则 5 明确当前
// 界面确认展示 6 种：圆形/三角形/菱形/圆角矩形/矩形/六边形。
const SHAPE_TYPES = ["rect", "rounded", "circle", "triangle", "diamond", "hexagon"] as const;
type ShapeType = (typeof SHAPE_TYPES)[number];
const DEFAULT_SHAPE_TYPE: ShapeType = "rect";
const SHAPE_LABELS: Record<ShapeType, string> = {
  rect: "矩形",
  rounded: "圆角矩形",
  circle: "圆形",
  triangle: "三角形",
  diamond: "菱形",
  hexagon: "六边形",
};
const getShapeType = (it: { color?: string | null }): ShapeType => {
  const v = styleGet(it.color, "shape");
  return (SHAPE_TYPES as readonly string[]).includes(v ?? "") ? (v as ShapeType) : DEFAULT_SHAPE_TYPE;
};
// 形状工具「记住上次选择」（UC 主流程 4）：本地会话状态足够，无需持久化到服务端。
const SHAPE_TOOL_LAST_KEY = "board_shape_tool_last";

// 可刷新组件（uc-widget-menu-009 刷新组件）：模拟「内容会重新加载」的嵌入/资源类组件
// （如图片、文件、外链预览）。线上仍以 type:"note" 持久化 + color:"embed" 哨兵判别。
// 普通便签/文本/形状为「不可刷新」（内容即静态文字），Widget Menu 中刷新入口不显示，
// 仅在对象不支持时展示禁用的「刷新暂不可用」，满足 UC：类型不支持则隐藏/置灰刷新入口。
const EMBED_MARK = "embed";
const DEFAULT_EMBED = "嵌入内容";
const isReloadable = (it: { color?: string | null }) => baseColor(it.color) === EMBED_MARK;

// p7:F12（uc-board-menu-011）：链接组件。沿用 TEXT_MARK/EMBED_MARK 建立的 color 哨兵约定，
// 线上以 type:"note" 落库（服务端 validateNewItem 只放行 note/rect，不可改）+ color 判别头
// "link"，URL 存于 "|url=<encodeURIComponent 后的完整 URL>" 样式段。**URL 必须
// encodeURIComponent**：URL 里可能含 "|"（撞 splitColor 的段分隔符）和 "="（撞 k=v 分隔符），
// 不编码会把哨兵切碎（真实风险，不是理论）。item.text 存域名（hostname），供卡片展示。
const LINK_MARK = "link";
const isLink = (it: { color?: string | null }) => baseColor(it.color) === LINK_MARK;
// getLinkUrl 除了 decode，还做**协议白名单纵深防御**（isSafeLinkUrl）：即使服务端守门被
// 绕过、或历史数据里已存了 javascript:/data: 哨兵，客户端也拒绝把它当作可打开链接返回。
// 打开路径（双击/wm-open-link）与渲染派生视图共用此函数，从源头保证不会打开危险协议。
const getLinkUrl = (it: { color?: string | null }): string | null => {
  const v = styleGet(it.color, "url");
  if (!v) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(v);
  } catch {
    return null; // 编码损坏时视为无链接（防御，不抛错）
  }
  return isSafeLinkUrl(decoded) ? decoded : null;
};

// p7:F14(uc-context-menu-003)：图层顺序。渲染顺序原本 = items 数组顺序（服务端按 created_at
// 排序），无 z 持久化列。沿用 withStyle 的 "|k=v" 哨兵约定，把层序编码为 color 的 "|z=<整数>"
// 段：客户端渲染前按 (z ?? 0, 原数组下标) 稳定排序，上移/下移/置顶/置底 = 重算 z 后 PATCH
// color——不加数据库列、不改服务端白名单，刷新/协作端天然一致。
const getZ = (it: { color?: string | null }): number => {
  const v = styleGet(it.color, "z");
  const n = v != null ? Number(v) : NaN;
  return Number.isFinite(n) ? n : 0;
};

// p6:F17（uc-widgets-006 手绘）：手绘笔迹组件。沿用既有 color "|k=v" 哨兵编码约定：
// 线上以 type:"note" 落库 + color:"draw" 判别头（服务端 validateNewItem 白名单不可改）。
// 笔迹点序列存入既有 text 字段（JSON 字符串 {"points":[[x,y],...]}，点为相对 item 左上角
// 的局部坐标，随 x/y 移动天然跟随；缩放时渲染层按 w/h 与点集原始包围盒的比例线性缩放）。
// 笔色/线宽复用 F19 已有的 "|border="/"|borderw=" 段（同连接线的复用理由：不重复定义色板）。
const DRAW_MARK = "draw";
const DEFAULT_DRAW_WIDTH = 3; // 画笔默认线宽（比默认边框 1px 粗，符合"笔迹"视觉）
const isDraw = (it: { color?: string | null }) => baseColor(it.color) === DRAW_MARK;
const parseDrawPoints = (text: string): Array<{ x: number; y: number }> => {
  try {
    const j = JSON.parse(text) as { points?: unknown };
    if (Array.isArray(j?.points)) {
      return j.points
        .filter((p): p is [number, number] => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]))
        .map(([x, y]) => ({ x, y }));
    }
  } catch {
    // 非法 JSON：按空笔迹处理（渲染层画占位框），不抛错破坏整个画布渲染
  }
  return [];
};

// p6:F18（uc-widgets-008 图表）：图表组件。线上以 type:"note" 落库 + color:"chart|kind=bar"
// 哨兵，text 字段存图表数据 JSON（{"labels":["A","B"],"values":[3,5]}）。渲染层用 fabric.Rect
// 组合画简单柱状图（不引入图表库）。数据编辑：选中后 Widget Menu 的「编辑数据」入口（或双击）
// 打开既有 DOM textarea 直接编辑 text JSON，保存后重渲染。
const CHART_MARK = "chart";
const isChart = (it: { color?: string | null }) => baseColor(it.color) === CHART_MARK;
const DEFAULT_CHART_DATA = { labels: ["A", "B", "C"], values: [3, 5, 2] };
const parseChartData = (text: string): { labels: string[]; values: number[] } | null => {
  try {
    const j = JSON.parse(text) as { labels?: unknown; values?: unknown };
    if (
      Array.isArray(j?.labels) &&
      Array.isArray(j?.values) &&
      j.values.length > 0 &&
      j.labels.length === j.values.length &&
      j.values.every((v) => Number.isFinite(Number(v)))
    ) {
      return { labels: j.labels.map(String), values: j.values.map(Number) };
    }
  } catch {
    // 非法 JSON：返回 null，渲染层展示「数据无效」失败反馈（UC 异常流程 1）
  }
  return null;
};

// p6:F16（uc-widgets-005 + uc-widget-menu-012）：连接线组件。沿用 F12/F15/F19/F20/F21 建立的
// color "|k=v" 哨兵编码约定，不新增持久化列（服务端 validateNewItem 仍只认 type ∈ {note,rect}）。
// 线上以 type:"note" 落库 + color:"connector" 判别头，紧随其后的样式段：
//   from=<itemId>   起点绑定的组件 id（缺省=自由起点，取 fx/fy 作画布坐标）
//   to=<itemId>     终点绑定的组件 id（缺省=自由终点，取 tx/ty 作画布坐标）
//   fx=/fy=/tx=/ty= 自由端点坐标（未绑定组件的一端才需要；已绑定的一端由客户端动态重算，
//                   不落这几段——避免和动态重算的语义冲突）
//   linetype=curve  直线（缺省）/曲线，UC 业务规则 5 只确认这两种，不做折线
//   arrow=end|both  端点箭头：缺省 none（无箭头），end=尾部箭头，both=两端箭头
//   border=<token>  复用 F19 已有边框色 token 表达连接线颜色（同一套色板，不重复定义）
//   borderw=<n>     复用 F19 已有线宽段（F19 注释本就写明 borderw 承担线宽语义）
// 连接线本身的 x/y/w/h 落库为当前两端点的包围盒（仅用于列表/初始渲染与拖拽命中的粗略范围，
// 精确端点位置由客户端按 from/to 绑定的组件当前矩形每次动态重算，参见 fabric-canvas.tsx
// 的 resolveConnectorEndpoints——这才是"组件移动时连接线跟随"的真正机制）。
const CONNECTOR_MARK = "connector";
const isConnector = (it: { color?: string | null }) => baseColor(it.color) === CONNECTOR_MARK;
const getConnectorFromId = (it: { color?: string | null }) => styleGet(it.color, "from");
const getConnectorToId = (it: { color?: string | null }) => styleGet(it.color, "to");
const getConnectorFreePoint = (
  it: { color?: string | null },
  which: "from" | "to",
): { x: number; y: number } | null => {
  const x = styleGet(it.color, which === "from" ? "fx" : "tx");
  const y = styleGet(it.color, which === "from" ? "fy" : "ty");
  const nx = x != null ? Number(x) : NaN;
  const ny = y != null ? Number(y) : NaN;
  return Number.isFinite(nx) && Number.isFinite(ny) ? { x: nx, y: ny } : null;
};
const CONNECTOR_LINE_TYPES = ["straight", "curve"] as const;
type ConnectorLineType = (typeof CONNECTOR_LINE_TYPES)[number];
const DEFAULT_CONNECTOR_LINE: ConnectorLineType = "straight";
const getConnectorLine = (it: { color?: string | null }): ConnectorLineType => {
  const v = styleGet(it.color, "linetype");
  return v === "curve" ? "curve" : DEFAULT_CONNECTOR_LINE;
};
const CONNECTOR_ARROW_TYPES = ["none", "end", "both"] as const;
type ConnectorArrowType = (typeof CONNECTOR_ARROW_TYPES)[number];
const DEFAULT_CONNECTOR_ARROW: ConnectorArrowType = "none";
const getConnectorArrow = (it: { color?: string | null }): ConnectorArrowType => {
  const v = styleGet(it.color, "arrow");
  return (CONNECTOR_ARROW_TYPES as readonly string[]).includes(v ?? "")
    ? (v as ConnectorArrowType)
    : DEFAULT_CONNECTOR_ARROW;
};
const CONNECTOR_STROKE_COLORS: Record<string, string> = {
  none: "#334155", // 无边框 token 复用为连接线默认深灰色（连接线始终需要可见描边，语义不同于形状的“无边框”）
  gray: "#6b7280",
  blue: "#2563eb",
  red: "#dc2626",
};

interface Move {
  id: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

// 可逆操作（F09 撤销/重做命令栈）。add 与 delete 互为逆；move/resize 记录 from/to。
type Op =
  | { kind: "add"; items: Item[] }
  | { kind: "delete"; items: Item[] }
  | { kind: "move"; moves: Move[] }
  | { kind: "resize"; resize: ItemResize }; // p6:F07 组件缩放

type BoardTool =
  | "select"
  | "pan"
  | "sticky"
  | "draw"
  | "eraser"
  | "text"
  | "connector"
  | "shape"
  | "assets"
  | "templates"
  | "chart";

// p6:F15：形状类型面板/Widget Menu 切换入口的小图标（纯 SVG，不依赖 lucide 里没有的形状）。
function ShapeGlyph({ type, className }: { type: ShapeType; className?: string }) {
  const common = { className, viewBox: "0 0 24 24", "aria-hidden": true } as const;
  switch (type) {
    case "circle":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    case "triangle":
      return (
        <svg {...common}>
          <polygon points="12,3 21,20 3,20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      );
    case "diamond":
      return (
        <svg {...common}>
          <polygon points="12,2 22,12 12,22 2,12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      );
    case "rounded":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="5" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    case "hexagon":
      return (
        <svg {...common}>
          <polygon points="7,3 17,3 22,12 17,21 7,21 2,12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      );
    case "rect":
    default:
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
  }
}

const NUDGE = 1;
const BIG_NUDGE = 10;
// 对齐吸附（uc-canvas-007）纯逻辑已抽到 @/lib/canvas-snap（F13：DOM 参考线渲染
// 与 fabric 拖拽吸附共用），本文件只渲染参考线 DOM（testid=alignment-guide 不变）。

function BoardMenuButton({
  testId,
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  testId: string;
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      data-testid={testId}
      size="sm"
      variant={active ? "secondary" : "ghost"}
      title={disabled ? `${label}（暂不可用）` : label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`transition-colors duration-200 ${
        active ? "bg-muted text-foreground ring-1 ring-border-strong" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
      <span className="text-xs">{label}</span>
    </Button>
  );
}

// p8:F02 — 把 Yjs doc 的最新状态合并回本地 items，但正在本地编辑/拖拽的那一条
// 保留本地版本，不被远端覆盖（避免打断用户正在做的操作；等编辑/拖拽结束后，
// 下一次远端事件或 editingId 清空时的兜底 reconcile 会把merge 的那部分带回来，
// 不会永久丢失——这是相对于纯"全量快照广播"方案的关键修复点）。
function mergeRemoteItems(
  prev: Item[],
  latest: Item[],
  editingId: string | null,
  dragIds: readonly string[],
): Item[] {
  const held = new Set(dragIds);
  if (editingId) held.add(editingId);
  const prevById = new Map(prev.map((it) => [it.id, it]));
  const merged = latest.map((it) => (held.has(it.id) ? prevById.get(it.id) ?? it : it));
  for (const it of prev) {
    if (held.has(it.id) && !merged.some((m) => m.id === it.id)) merged.push(it);
  }
  return merged;
}

// 画布：渲染 board-keyed items（ADR-0002）+ 选择/键盘（F06）+ 复制粘贴（F08）+ 撤销/重做（F09）。
// 视口（平移/缩放/小地图）复用 CanvasViewport（F05）。marquee 框选 deferred（与拖拽平移冲突，留后续）。
//
// p6:F13 渲染引擎：item 的渲染与指针交互（选中框/拖拽/多选/双击）由 FabricCanvas
// （fabric.Canvas 适配器）承担；本组件仍是数据权威（REST 持久化 + 撤销栈 + 剪贴板），
// 周边 DOM UI（工具栏 / Widget Menu / 右键菜单 / selection-count / 参考线 / 编辑框 / 徽标）不变。
export function BoardCanvas({ boardId, canEdit }: { boardId: string; canEdit: boolean }) {
  const [items, setItems] = useState<Item[]>([]);
  // applyColors 的同步真值来源：React 的 setState(updater) 不保证 updater 在调用点同步执行
  // （它可能被推迟到下一次渲染阶段才处理），所以不能指望"setItems(prev => ...) 内部算出的
  // 新值"能在紧接着的同步代码里读到——之前一版 fix 就是错在这里，同一交互序列里连续调用
  // 多个样式 setter 时，后面几个的 captured 读到的是空值，PATCH 悄悄丢了。这里用 ref 维护
  // 真正同步、每次 applyColors 调用后立刻前进的 items 快照，取代对 setState 时序的依赖。
  const itemsRef = useRef<Item[]>(items);
  itemsRef.current = items;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // p8:F02 — selected 的 ref 镜像，供 onOperating（useCallback，空依赖数组）读取
  // 拖拽开始时刻的最新选中集合，而不是闭包捕获的过期值。
  const selectedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);
  const [editingId, setEditingId] = useState<string | null>(null); // F11 文本编辑中的便签
  const [activeTool, setActiveTool] = useState<BoardTool>("select");
  const [aiOpen, setAiOpen] = useState(false); // F01: Board AI 浮层/board chat 面板开关，dock 与浮层共享同一真值
  const [openPanel, setOpenPanel] = useState<"assets" | "templates" | "shape" | "link" | null>(null);
  // p7:F12（uc-board-menu-011 主流程 5-6）：链接输入框草稿 + 校验错误提示。
  const [linkDraft, setLinkDraft] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  // p6:F15（uc-widgets-004 主流程 4）：形状工具记住上次选择的形状类型，默认矩形。
  const [lastShapeType, setLastShapeType] = useState<ShapeType>(DEFAULT_SHAPE_TYPE);
  // uc-board-menu-007（图表快捷键）：底层图表组件（p6:F18）尚未实现，C 键只切换「图表模式」
  // 高亮态并在画布点击时给出「即将上线」反馈，不创建任何真实对象（范围纪律：不越界实现 F18）。
  const [notice, setNotice] = useState<string | null>(null);
  // 「暂不可用」提示条自动收起（3 秒），避免像格式刷提示条那样常驻挡住画布；
  // 用户切工具/按 Esc 时也会提前清空（见 chooseTool / onKey 的 setNotice(null)）。
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(timer);
  }, [notice]);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null); // 右键上下文菜单（uc-context-menu-001）
  const [guides, setGuides] = useState<Guide[]>([]); // 拖动时的对齐参考线（uc-canvas-007）
  const [spacings, setSpacings] = useState<SpacingHint[]>([]); // p6:F07 等间距提示
  // p6:F19（uc-widget-menu-010 应用格式）：格式刷取样状态。非 null 表示已进入取样模式，
  // 值为源对象的 color（取样时快照，避免取样后源对象被继续编辑影响后续应用）。
  // 用户可连续点击多个目标应用同一格式，直到 Esc/切工具/点不兼容对象退出（主流程 6/7）。
  const [formatSource, setFormatSource] = useState<{ id: string; color: string | null } | null>(null);
  // 当前正在应用格式的目标 id（去重用，见 onFabricSelection 注释）。
  const formatApplyingRef = useRef<string | null>(null);
  // uc-widget-menu-009 刷新组件：可刷新组件的重载信号（重载次数 + 最近重载时间戳），
  // 是纯客户端的「内容已重新加载」可见反馈，随每次刷新自增。
  const [reload, setReload] = useState<Record<string, { count: number; at: number }>>({});
  const [refreshing, setRefreshing] = useState<Set<string>>(new Set()); // 刷新处理中（旋转/加载态）
  const placeN = useRef(0); // 同步自增放置位，避免连点时读到尚未刷新的 items.length 造成重叠
  // p6:F19：per-item PATCH 串行队列。多个样式段（边框/线宽/透明度/文字色…）连续快速点击时，
  // 各自独立 fetch 并发发出，网络层不保证到达服务端的顺序——后发出的 PATCH 可能先落地，
  // 早发出的 PATCH 晚落地并用旧 color 覆盖新值（观测到的真实回归，而非理论风险）。
  // 用 per-item Promise 链保证同一 item 的 PATCH 严格按发起顺序落库，不影响乐观 UI 更新
  // （setItems 仍同步先行，用户感知无延迟）。
  const patchQueue = useRef<Map<string, Promise<unknown>>>(new Map());
  // issue #414 根因：poll()/load() 的 GET 快照相对"GET 发出之后才发生的本地写入"是过期的。
  // requestGenRef 防不住（响应确实属于最新一次请求，只是比本地写入旧）；patchQueue.size
  // 守卫也防不住"响应恰好落在两次写入之间的空档"（上一条 PATCH 已落地清队、下一次点击
  // 还没发生）。e2e 插桩实测：字体/字号/斜体/对齐连续点击链中，早发的 poll 响应在空档
  // 合并进来，把 items/itemsRef 整体回滚到无样式快照，下一个 setter 基于回滚后的 color
  // 计算，其 PATCH 反过来把此前已落库的样式段全部摧毁（widget-text.spec.ts:40 间歇失败）。
  // 修复：单调写代数。每次本地写发起时 +1；poll/load 在 GET 发出前记录当前代，响应返回后
  // 代数前进过就说明快照已过期，丢弃本轮合并（下个周期会拉到含新写入的快照）。
  const writeGenRef = useRef(0);
  function queuePatch(id: string, body: Record<string, unknown>): Promise<unknown> {
    writeGenRef.current++;
    const prev = patchQueue.current.get(id) ?? Promise.resolve();
    const next = prev
      .catch(() => {})
      .then(() =>
        fetch(`/api/board-items/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
    patchQueue.current.set(id, next);
    // p6:F21 review（PR #416/#451）指出的真实泄漏：条目从不删除，map 无限增长，且 load() 里
    // `await Promise.all(patchQueue.current.values())` 会连带 await 所有历史已完成链
    // （已 resolve 的立即返回，语义上无害，但内存和遍历成本随会话时长线性涨，且任何
    // 依赖 size 判断"是否有在途 PATCH"的逻辑会永久失真）。落地后若自己仍是该 id 的
    // 最新链尾（没有更新的 PATCH 链上来）才清掉，避免误删后来者。
    void next.finally(() => {
      if (patchQueue.current.get(id) === next) patchQueue.current.delete(id);
    });
    return next;
  }

  const clipboard = useRef<Item[]>([]); // 应用内剪贴板（F08）
  const undoStack = useRef<Op[]>([]); // F09
  const redoStack = useRef<Op[]>([]);
  // p7:F01（uc-board-header-010 主流程 2）：撤销/重做按钮要反映"当前是否有可撤销/可重做
  // 记录"并禁用相应按钮——undoStack/redoStack 是 ref，改变不会触发重渲染，光看 ref.length
  // 算不出实时禁用态。加一个纯计数器，每次栈变化时 +1 强制重渲染一次，渲染时机到了再读
  // ref 的最新长度即可，不需要真的把栈本身搬进 state。
  const [historyTick, setHistoryTick] = useState(0);
  const bumpHistory = useCallback(() => setHistoryTick((t) => t + 1), []);
  const canUndo = useMemo(() => undoStack.current.length > 0, [historyTick]);
  const canRedo = useMemo(() => redoStack.current.length > 0, [historyTick]);
  // 视口快照（CanvasViewport 上报），供 fabric viewportTransform 镜像与测试 API 坐标换算。
  const [vp, setVp] = useState<ViewportState>({ tx: 0, ty: 0, scale: 1 });
  // fabric 拖拽进行中（onOperating 回调驱动）：轮询同步在拖拽中不合并服务端快照。
  const draggingRef = useRef(false);
  // p8:F02 — 拖拽/操作中的 item ids 快照（onOperating 置位时从 selectedRef 拷贝），
  // 供 mergeRemoteItems 保护正在本地操作的 item 不被远端快照/CRDT 更新覆盖。
  // 拖拽本身已下沉到 FabricCanvas（F13 重构），这里不再持有指针坐标/吸附状态，
  // 只保留"当前正在拖的是哪些 id"这一份最小信息。
  const draggingIdsRef = useRef<string[]>([]);
  const cursorIdleTimer = useRef<ReturnType<typeof setTimeout> | null>(null); // p8:F03 光标闲置自动隐藏

  // ── p8:F02 Yjs 实时同步 ──────────────────────────────────────────────────
  // docRef 是本 board 的 CRDT 状态；WS 只是把 doc 的二进制 update 转发给其它
  // 在线客户端（走 F01 的 collab-gateway，纯 relay，不解释内容）。REST 仍是
  // 冷启动/持久化的权威来源，doc 只负责"已连接客户端之间"的即时合并。
  const docRef = useRef(createBoardDoc());
  const wsRef = useRef<WebSocket | null>(null);
  const clientIdRef = useRef(crypto.randomUUID());
  const editingIdRef = useRef<string | null>(null);
  // itemsRef 复用上面（applyColors 同步真值）声明的同一个 ref——两处都需要"当前 items
  // 的同步真值"这个语义，不需要两份独立状态；load() 里对它的显式赋值
  // （itemsRef.current = next）先于 setItems/maybeSeed 同步执行，Yjs 种子逻辑读到的
  // 仍是最新值，和渲染期自动同步（itemsRef.current = items）不冲突。
  const itemsLoadedRef = useRef(false);
  // p7:F11 e2e 压测暴露的真实回归：load()（新增组件后主动调用）和 poll()（1.5s 轮询同步）
  // 都是裸 fetch 全量快照 + setItems，谁的响应后到谁生效——但网络时序不保证跟发起顺序一致。
  // 具体复现：连续两次创建组件（比如形状面板连点两种类型），第二次 addShape 结尾的
  // load() 已经拿到含两个组件的最新快照并 setItems，但如果这之前 poll() 恰好也发出过一个
  // GET（那时只有第一个组件），且它的响应因为系统负载被拖到 load() 之后才到达，就会用
  // 过期快照把刚创建的组件"覆盖没了"（e2e 断言最后一个组件的 shapeType 时而对时而错，
  // 表现为 flaky，实为真实竞态而非环境噪音）。修复：每次发起 GET 前领一个自增的请求代，
  // 响应到达时只有"仍是最新一次请求"的那个才允许生效，比谁发起得晚，不比谁响应得晚。
  const requestGenRef = useRef(0);
  // 是否已经完成"加入房间"的初次同步判定（收到 peer 的完整状态，或等待超时判定
  // 自己是第一个在线的人）。在这之前不能把本地 items 写进 doc——否则会替已存在的
  // item 独立造一份结构上互不相识的 Y.Map，后续增量 update 就合并不回去了。
  const joinSyncedRef = useRef(false);
  // issue #414 残留根因修复（PR #462 首轮 review 后按 code-reviewer 意见收紧）：
  // 只记录"本客户端在 join-sync 完成前真的编辑过"的**具体字段**，精确到 id+field，
  // 不能只记 id 就把该 id 的全量 itemsRef.current 快照传给 reconcileLocalEdits——
  // 那样即使 id 本身确实有过本地编辑（比如只移动过位置），也会连带把这个 id 里
  // 本地从未碰过、可能落后于对等端的其它字段（比如 color）一起覆盖，重新引入
  // #432 类问题（对等端刚经 applyEncodedUpdate 合并进来的更新被覆盖回旧值）。
  // 也不能靠"itemsRef.current 跟 doc 有没有差异"来判断该记哪些字段——那样会把
  // poll()/load() 带来的纯 REST 快照差异也当成本地编辑。只在真正的用户操作
  // （拖拽/缩放/文字/样式/对齐分布）落点处，显式登记这次操作到底改了哪些字段。
  const pendingJoinEditsRef = useRef<Map<string, Partial<CollabItemFields>>>(new Map());
  const markLocallyEdited = useCallback((patches: { id: string; fields: Partial<CollabItemFields> }[]) => {
    if (joinSyncedRef.current) return; // 已经走常规 [items] effect 落 doc 通道，不需要额外补记
    for (const { id, fields } of patches) {
      const existing = pendingJoinEditsRef.current.get(id);
      pendingJoinEditsRef.current.set(id, existing ? { ...existing, ...fields } : fields);
    }
  }, []);

  const maybeSeed = useCallback(() => {
    if (!joinSyncedRef.current || !itemsLoadedRef.current) return;
    seedItems(docRef.current, itemsRef.current);
    // 只对上面显式登记过的 (id, field) 做无条件差异覆盖——这些字段是本地真实编辑
    // 产生的，不是 REST 快照，才有资格越过 seedItems 的 _rev 门禁；未登记的字段
    // 完全不碰，详见 reconcileLocalEdits 的调用方契约注释。
    if (pendingJoinEditsRef.current.size > 0) {
      const patches = Array.from(pendingJoinEditsRef.current.entries()).map(([id, fields]) => ({ id, fields }));
      reconcileLocalEdits(docRef.current, patches);
      pendingJoinEditsRef.current.clear();
    }
    // seedItems 只补"任何在线客户端都还不知道"的新条目；已存在的条目里，doc
    // 内可能有比这次 REST 快照更新的字段（比如刚加入时另一人正在编辑），
    // 用 doc 当前真实状态回填一次 React state，而不是反过来拿 REST 覆盖 doc。
    setItems((prev) => mergeRemoteItems(prev, readCollabItems(docRef.current), editingIdRef.current, draggingIdsRef.current));
  }, []);

  // p6:F19 修复：load() 用服务端快照整体覆盖 items（其它 F0x 既有行为，不改）。
  // 若此时仍有未落地的 PATCH（如样式改动后立即触发了 load，如新增组件后的 await load()），
  // 服务端快照可能还不包含最新样式，覆盖会让乐观更新「凭空消失」（真实回归，非测试假象）。
  // 先等所有排队中的 PATCH 落地，再拉取快照，保证 load() 不会撤销尚未确认的用户操作。
  const load = useCallback(async () => {
    await Promise.all(patchQueue.current.values());
    const gen = ++requestGenRef.current;
    const writeGen = writeGenRef.current; // issue #414：快照相对本地写入的新鲜度基准
    const res = await fetch(`/api/boards/${boardId}/items`);
    if (res.ok && gen === requestGenRef.current) {
      const next = ((await res.json()).items ?? []) as Item[];
      // GET 在途期间有新的本地写入 → 快照已过期，合并会回滚乐观更新（见 writeGenRef 注释）。
      // 丢弃本轮；itemsLoaded/seed 交给下一次 load/poll（1.5s 内）。
      if (writeGen !== writeGenRef.current) return;
      itemsRef.current = next;
      itemsLoadedRef.current = true;
      setItems(next);
      maybeSeed();
    }
  }, [boardId, maybeSeed]);

  useEffect(() => {
    void load();
  }, [load]);

  // p8:F03 — 光标 presence：走既有 collab-bus 的 viewport/awareness 心跳通道（HTTP
  // presence 轮询），不是 F01/F02 的 WS+Yjs 传输——光标不需要 CRDT 合并语义，
  // 复用现成的 1.5s presence 心跳足够。闲置 2.5s 自动隐藏，避免残留光标误导。
  const clearLocalCursor = useCallback(() => {
    if (cursorIdleTimer.current) {
      clearTimeout(cursorIdleTimer.current);
      cursorIdleTimer.current = null;
    }
    publishCursor(null);
  }, []);

  const publishLocalCursor = useCallback((e: React.MouseEvent) => {
    // 广播画布逻辑坐标，不是发送方屏幕像素——接收端按各自的 pan/zoom 转回屏幕坐标
    // 渲染，否则窗口尺寸/缩放不同时光标会跟真实指向对不上（p8:F03 修复点）。
    const board = screenToBoardPoint(e.clientX, e.clientY, viewportContainerRect());
    publishCursor({ x: board.x, y: board.y, visible: true });
    if (cursorIdleTimer.current) clearTimeout(cursorIdleTimer.current);
    cursorIdleTimer.current = setTimeout(() => {
      cursorIdleTimer.current = null;
      publishCursor(null);
    }, 2500);
  }, []);

  useEffect(() => clearLocalCursor, [clearLocalCursor]);

  // 打开到 F01 网关的 WS 连接：先广播 sync-request 问"房间里有没有已经在线的人"，
  // 有则 apply 对方的完整状态（保证跟对方是同一批 Y.Map 结构实例，见 packages/collab
  // 的 encodeFullState 注释）；800ms 内没人应答就当自己是第一个，直接从 REST seed。
  //
  // p8:F05 重连策略：close/error 会指数退避重试（1s→2s→4s...封顶 30s，连上一次
  // 就把退避计数器复位），而不是旧版那种固定 1.5s 无限重试——网关真的挂掉时
  // 别把它打得更惨。另外，浏览器原生 WebSocket 拿不到握手失败的真实 HTTP 状态码
  // （401 也只是笼统的 error/close，无法区分"鉴权过期"和"网络抖动"），所以每次
  // 重连前先探一下 `/api/auth/session`——没登录就直接停止自动重连（重试一个必然
  // 会被拒绝的连接没有意义，用户需要重新登录）；探测本身失败（网络问题）则当作
  // 暂时性抖动，照常走退避重试。
  useEffect(() => {
    let cancelled = false;
    let ws: WebSocket | null = null;
    let syncTimer: ReturnType<typeof setTimeout> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let backoffMs = 1000;
    const MAX_BACKOFF_MS = 30_000;

    function scheduleRetry() {
      if (cancelled) return;
      const wait = backoffMs;
      backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
      retryTimer = setTimeout(() => void connect(), wait);
    }

    async function connect() {
      if (cancelled) return;
      joinSyncedRef.current = false;
      publishConnectionState("connecting");

      try {
        const authRes = await fetch("/api/auth/session");
        if (authRes.ok) {
          const body = (await authRes.json()) as { user?: unknown };
          if (!body?.user) {
            publishConnectionState("disconnected"); // 会话已失效：不再自动重连
            return;
          }
        }
      } catch {
        // 探测请求本身失败（网络问题），当作暂时性抖动，继续走下面的重试路径。
      }
      if (cancelled) return;

      const configRes = await fetch("/api/collab/config").catch(() => null);
      if (!configRes?.ok) {
        if (!cancelled) scheduleRetry();
        return;
      }
      const { wsUrl } = (await configRes.json()) as { wsUrl: string };
      if (cancelled) return;
      ws = new WebSocket(`${wsUrl}?boardId=${encodeURIComponent(boardId)}`);
      wsRef.current = ws;
      // 仅非生产环境暴露调试句柄（e2e 用它模拟断线）；生产环境不应该让任意脚本
      // 能读到/关闭这个内部连接。
      if (process.env.NODE_ENV !== "production") {
        (window as Window & { __boardCollabWs?: WebSocket | null }).__boardCollabWs = ws;
      }

      ws.addEventListener("open", () => {
        if (cancelled || !ws) return;
        backoffMs = 1000; // 连上了，退避计数器复位
        publishConnectionState("connected");
        ws.send(JSON.stringify({ type: "y-sync-request", boardId, from: clientIdRef.current }));
        syncTimer = setTimeout(() => {
          if (cancelled || joinSyncedRef.current) return;
          joinSyncedRef.current = true; // 没人应答：自己是第一个在线的，直接种子化
          maybeSeed();
        }, 800);
      });

      ws.addEventListener("message", (event) => {
        if (cancelled) return;
        // F01 网关把"转发自其它客户端"的消息包一层自己的信封：
        // { type: "message", boardId, data: "<发送方原始文本>", fromClientId, via }。
        // 网关自己直接发的消息（如刚连上时的 {type:"connected"}）不走这层信封。
        // 这里先剥掉信封，取出 data 里才是我们自己的业务消息（y-sync-request/
        // y-sync-response/y-update），再解析一次——只解析一层会把 outer.type
        // （恒为 "message"）当成业务类型，永远匹配不上，是本文件早期版本的真实 bug
        // （被同文件里原有的 REST 轮询兜底完全掩盖，playwright 测试一度"意外通过"）。
        let outer: { type?: string; data?: string } | null = null;
        try {
          outer = JSON.parse(event.data);
        } catch {
          return;
        }
        if (outer?.type !== "message" || typeof outer.data !== "string") return;
        let msg: { type?: string; from?: string; update?: string } | null = null;
        try {
          msg = JSON.parse(outer.data);
        } catch {
          return;
        }
        if (msg?.type === "y-sync-request" && msg.from !== clientIdRef.current) {
          ws?.send(
            JSON.stringify({ type: "y-sync-response", boardId, update: encodeFullState(docRef.current) }),
          );
          return;
        }
        if (msg?.type === "y-sync-response" && msg.update) {
          applyEncodedUpdate(docRef.current, msg.update);
          if (!joinSyncedRef.current) {
            joinSyncedRef.current = true;
            if (syncTimer) clearTimeout(syncTimer);
            maybeSeed();
          }
          return;
        }
        if (msg?.type === "y-update" && msg.update) {
          applyEncodedUpdate(docRef.current, msg.update);
        }
      });

      ws.addEventListener("close", () => {
        if (wsRef.current === ws) wsRef.current = null;
        if (
          process.env.NODE_ENV !== "production" &&
          (window as Window & { __boardCollabWs?: WebSocket | null }).__boardCollabWs === ws
        ) {
          (window as Window & { __boardCollabWs?: WebSocket | null }).__boardCollabWs = null;
        }
        if (!cancelled) {
          publishConnectionState("disconnected");
          scheduleRetry();
        }
      });
      ws.addEventListener("error", () => {
        ws?.close();
      });
    }

    void connect();

    const offLocal = onLocalUpdate(docRef.current, (update) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "y-update", boardId, update: encodeUpdate(update) }));
      }
    });
    const offRemote = onRemoteItemsChange(docRef.current, (latest) => {
      setItems((prev) => mergeRemoteItems(prev, latest, editingIdRef.current, draggingIdsRef.current));
    });

    return () => {
      cancelled = true;
      if (syncTimer) clearTimeout(syncTimer);
      if (retryTimer) clearTimeout(retryTimer);
      offLocal();
      offRemote();
      ws?.close();
      wsRef.current = null;
      publishConnectionState("disconnected");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId]);

  // 本地 items 变化（不管是用户操作、旧的 REST 轮询合并、还是上面 maybeSeed 的
  // reconcile）都镜像进 doc，这样才能广播给其它人。syncItemsIntoDoc 对没有真的
  // 变化的字段是幂等的，所以"这次变化本来就是从 doc 读回来的"不会又广播回去。
  useEffect(() => {
    if (!joinSyncedRef.current) return;
    syncItemsIntoDoc(docRef.current, items);
  }, [items]);

  useEffect(() => {
    editingIdRef.current = editingId;
    // 编辑刚结束：把编辑期间被"保留本地版本"挡住的远端变更（如果有）拉回来，
    // 不必等下一次远端事件才生效——这是相对旧方案"编辑中收到的变更永久丢失"的修复点。
    if (editingId == null && joinSyncedRef.current) {
      setItems((prev) => mergeRemoteItems(prev, readCollabItems(docRef.current), null, draggingIdsRef.current));
    }
  }, [editingId]);

  // uc-collab-001：文本编辑进行中也算「正在操作」，供他人看到「谁在操作」（editingId 存在 = 编辑中）。
  useEffect(() => {
    setOperating(editingId != null);
  }, [editingId]);

  // ── 实时协作同步（uc-canvas-005）────────────────────────────────────────
  // 轮询服务端 item 列表，让其它在线用户的新增/移动/删除在本地画布上出现，
  // 达成「在线用户看到一致的 Board 内容」（UC 后置条件 1）。
  // 只在本地无进行中编辑/拖拽时才合并服务端快照，避免打断本地操作。
  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    async function poll() {
      // p6:F21 v2（#451）：requestGenRef 只防"请求间乱序"（后发请求的响应先到），防不住
      // "响应比本地乐观写入更旧"——poll 的 GET 在某次样式 PATCH 落库前发出、落库后才返回
      // 时，gen 仍是最新，快照却是旧的，会把刚写入的乐观更新整体冲掉。patchQueue.size===0
      // 守卫挡住"有 PATCH 在途"的窗口；但 issue #414 发现它挡不住"响应恰好落在两次写入
      // 之间的空档"（上一条 PATCH 已落地清队、下一次点击还没发生，size 短暂归零）——早发
      // 的 poll 响应在此空档合并进来，把 items/itemsRef 回滚到无样式快照，下一个 setter
      // 基于回滚值计算，其 PATCH 反过来摧毁此前已落库的样式段（widget-text.spec.ts:40
      // 间歇失败根因，e2e 插桩实测复现）。补 writeGenRef 单调写代数：GET 发出前记录，响应
      // 返回后代数前进过即快照已过期，丢弃本轮合并（下个周期会拉到含新写入的快照）。
      if (!stop && !editingId && !draggingRef.current && patchQueue.current.size === 0) {
        try {
          const gen = ++requestGenRef.current;
          const writeGen = writeGenRef.current; // issue #414：快照相对本地写入的新鲜度基准
          const res = await fetch(`/api/boards/${boardId}/items`);
          if (
            res.ok &&
            gen === requestGenRef.current &&
            writeGen === writeGenRef.current && // issue #414：GET 在途期间无新本地写入，快照才可合并
            !stop &&
            !editingId &&
            !draggingRef.current &&
            patchQueue.current.size === 0
          ) {
            const next = ((await res.json()).items ?? []) as Item[];
            itemsRef.current = next;
            setItems((prev) =>
              JSON.stringify(prev) === JSON.stringify(next) ? prev : next
            );
          }
        } catch {
          // 网络异常忽略；下个周期重试（UC 异常流程 2）
        }
      }
      if (!stop) timer = setTimeout(poll, 1500);
    }
    timer = setTimeout(poll, 1500);
    return () => {
      stop = true;
      if (timer) clearTimeout(timer);
    };
  }, [boardId, editingId]);

  // ── 落库原子操作（撤销/重做与正常操作共用）──────────────────────────────
  const apiDelete = useCallback(
    (ids: string[]) => Promise.all(ids.map((id) => fetch(`/api/board-items/${id}`, { method: "DELETE" }))),
    []
  );
  const apiRestore = useCallback(
    (its: Item[]) =>
      Promise.all(
        its.map(async (it) => {
          await fetch(`/api/boards/${boardId}/items`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ id: it.id, type: it.type, x: it.x, y: it.y, w: it.w, h: it.h, text: it.text }),
          });
          // 路由 restore 分支不读 color；用 PATCH 补回外观色（含文本哨兵），保证撤销删除后仍是原样。
          if (it.color != null) {
            await fetch(`/api/board-items/${it.id}`, {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ color: it.color }),
            });
          }
        })
      ),
    [boardId]
  );
  const apiMove = useCallback(
    (moves: Move[], useFrom: boolean) =>
      Promise.all(
        moves.map((m) =>
          fetch(`/api/board-items/${m.id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(useFrom ? { x: m.fromX, y: m.fromY } : { x: m.toX, y: m.toY }),
          })
        )
      ),
    []
  );

  // p6:F07 组件缩放落库（PATCH x/y/w/h；undo 用 from，redo 用 to）。
  const apiResize = useCallback(
    (id: string, rect: { x: number; y: number; w: number; h: number }) =>
      fetch(`/api/board-items/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(rect),
      }),
    []
  );

  function recordOp(op: Op) {
    undoStack.current.push(op);
    redoStack.current = [];
    bumpHistory();
  }

  // ── fabric 渲染层回调（F13）：手势在 fabric.Canvas 上发生，这里转成既有命令/落库路径 ──
  // 拖拽移动提交：可逆 move 命令 + PATCH 落库（等价于旧 DOM onDragUp 的收尾）。
  const onMoveCommit = useCallback(
    async (moves: ItemMove[]) => {
      const map = new Map(moves.map((m) => [m.id, m]));
      setItems((prev) =>
        prev.map((it) => {
          const m = map.get(it.id);
          return m ? { ...it, x: m.toX, y: m.toY } : it;
        }),
      );
      setSelected(new Set(moves.map((m) => m.id)));
      markLocallyEdited(moves.map((m) => ({ id: m.id, fields: { x: m.toX, y: m.toY } })));
      undoStack.current.push({ kind: "move", moves });
      redoStack.current = [];
      bumpHistory();
      await apiMove(moves, false);
    },
    [apiMove, markLocallyEdited],
  );

  // p6:F07 缩放提交：可逆 resize 命令 + PATCH 落库（吸附已在 fabric 层作用于终态尺寸）。
  const onResizeCommit = useCallback(
    async (resize: ItemResize) => {
      setItems((prev) => prev.map((it) => (it.id === resize.id ? { ...it, ...resize.to } : it)));
      setSelected(new Set([resize.id]));
      markLocallyEdited([{ id: resize.id, fields: resize.to }]);
      undoStack.current.push({ kind: "resize", resize });
      redoStack.current = [];
      bumpHistory();
      await apiResize(resize.id, resize.to);
    },
    [apiResize, markLocallyEdited],
  );

  const onFabricSelection = useCallback(
    (ids: string[]) => {
      // p6:F19（uc-widget-menu-010 主流程 4/6）：取样模式下，点击单个目标即应用格式，
      // 不改变常规选中态（保持取样模式继续可用，直到用户显式退出——主流程 6）。
      // 注：fabric 的 mouse:down 与 mouse:up 对同一次「纯点击」（未拖动）都会各触发一次
      // onSelectionChange（既有行为，非本轮引入），故用 formatApplyingRef 去重，避免同一目标
      // 被并发 applyFormatTo 两次（虽然幂等无害，但会造成不必要的重复 PATCH）。
      if (formatSource && ids.length === 1 && ids[0] !== formatSource.id) {
        const targetId = ids[0]!;
        if (formatApplyingRef.current === targetId) return;
        formatApplyingRef.current = targetId;
        void applyFormatTo(targetId).finally(() => {
          if (formatApplyingRef.current === targetId) formatApplyingRef.current = null;
        });
        return;
      }
      // p6:F21（uc-widgets-010 主流程 6：编组整体选中）：选中集合中任一对象属于某个组时，
      // 把该组全部成员并入选中集合（编组后整体选中/整体拖动/整体删除，业务规则由此达成——
      // fabric 层不感知 groupId，只在这里把点击命中的单个/多个 id 展开为组闭包）。
      // 读 itemsRef 而非 items closure（v2 复跑抓到的真实竞态）：groupSelected 刚写完
      // group 段、React 还没把带新 items 的回调重渲染下发给 fabric 层时，用户立刻点击组
      // 成员会走到旧闭包——items 里还没有 group 段，组闭包展开失败（间歇复现"编组后点击
      // 成员仍只选中自己"）。itemsRef 由 applyColors 同步推进，永远是最新真值。
      const latest = itemsRef.current;
      const expanded = new Set(ids);
      const itemById = new Map(latest.map((it) => [it.id, it]));
      for (const id of ids) {
        const found = itemById.get(id);
        const gid = found ? getGroupId(found) : null;
        if (gid == null) continue;
        for (const it of latest) {
          if (getGroupId(it) === gid) expanded.add(it.id);
        }
      }
      setSelected(expanded);
    },
    [formatSource, canEdit],
  );

  // 空白按下：清除选择 + 关闭右键菜单（旧 items-layer onClick 语义），随后视口照常平移。
  // p6:F18（uc-board-menu-007）：图表模式下点击画布 = 在点击处创建真实图表组件（替换此前
  // 的「即将上线」占位反馈），scenePoint 为 fabric 换算好的画布坐标。
  const onEmptyPointerDown = useCallback(
    (scenePoint?: { x: number; y: number }) => {
      if (formatSource) return; // 取样模式下点击空白不清空选择/退出（Esc 才退出，主流程 7）
      if (activeTool === "chart") {
        if (canEdit && scenePoint) void addChart(scenePoint);
        return;
      }
      setSelected(new Set());
      setCtxMenu(null);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [formatSource, activeTool, canEdit],
  );

  const onEditRequest = useCallback(
    (id: string) => {
      // p6:F20（uc-widget-menu-003）：锁定对象不可编辑（主流程 3），双击进入编辑态短路。
      if (!canEdit) return;
      const target = items.find((it) => it.id === id);
      if (target && getLocked(target)) return;
      // p7:F12：链接组件双击 = 在新标签打开链接（不进入文本编辑——text 是展示用域名，
      // 手改会与 url 哨兵脱节；URL 修改路径留给后续 OG 预览增强，见 feature notes）。
      if (target && isLink(target)) {
        const url = getLinkUrl(target); // 已含协议白名单校验（纵深防御）
        if (url) window.open(url, "_blank", "noopener,noreferrer");
        else setNotice("该链接协议不被允许，无法打开");
        return;
      }
      setEditingId(id);
    },
    [canEdit, items],
  );

  const onFabricCtxMenu = useCallback(
    (pos: { x: number; y: number }, itemId: string | null) => {
      if (!canEdit) return;
      if (itemId && !selected.has(itemId)) setSelected(new Set([itemId]));
      // p7:F14（uc-context-menu-001 备选流程 1）：空白处右键 = 画布级菜单，不携带对象级动作
      // ——清空选中，菜单按 selected.size === 0 渲染画布级入口（粘贴/选择所有）。
      if (!itemId) setSelected(new Set());
      setCtxMenu(pos);
    },
    [canEdit, selected],
  );

  // uc-collab-001：拖拽开始/结束 → 操作态上报；同时挡住轮询合并（见 poll）。
  // p8:F02：拖拽开始时快照当前选中 ids，供 mergeRemoteItems 保护中途不被远端覆盖；
  // 结束后清空——此时最新落库结果已经过 apiMove/apiResize，远端快照理应与本地一致。
  const onOperating = useCallback((op: boolean) => {
    draggingRef.current = op;
    draggingIdsRef.current = op ? Array.from(selectedRef.current) : [];
    setOperating(op);
  }, []);

  // p7:F14（uc-context-menu-003）：渲染顺序 = 按 (z, 原数组下标) 稳定排序后的顺序。
  // z 缺省为 0，全部缺省时排序退化为服务端 created_at 顺序（与旧行为完全一致）。
  // fabric reconcile 按该顺序添加对象（z-order 即添加顺序），测试 API getItems() 的 z
  // （数组下标）自然反映排序后的层序。
  const sortedItems = useMemo<Item[]>(
    () =>
      items
        .map((it, i) => [it, i] as const)
        .sort((a, b) => getZ(a[0]) - getZ(b[0]) || a[1] - b[1])
        .map(([it]) => it),
    [items],
  );

  // fabric 渲染层的输入视图：把 color 哨兵/字重等判别预解析成渲染语义（fabric 组件不懂业务哨兵）。
  const renderItems = useMemo<RenderItem[]>(
    () =>
      sortedItems.map((it) => ({
        id: it.id,
        type: it.type,
        x: it.x,
        y: it.y,
        w: it.w,
        h: it.h,
        text: it.text,
        color: it.color ?? null,
        kind: isConnector(it)
          ? "connector"
          : isLink(it)
            ? "link"
            : isDraw(it)
              ? "draw"
              : isChart(it)
                ? "chart"
                : isText(it)
                  ? "text"
                  : isShape(it)
                    ? "shape"
                    : isReloadable(it)
                      ? "embed"
                      : "note",
        linkUrl: getLinkUrl(it),
        bold: isBold(it),
        italic: isItalic(it),
        fontFamily: getFontFamily(it),
        fontSize: getFontSize(it),
        align: getAlign(it),
        border: getBorder(it),
        borderWidth: getBorderWidth(it),
        opacity: getOpacity(it),
        textColor: getTextColor(it),
        shapeType: getShapeType(it),
        reloadable: isReloadable(it),
        reloadCount: reload[it.id]?.count ?? 0,
        refreshedAt: reload[it.id]?.at ?? null,
        locked: getLocked(it),
        // p6:F17：手绘笔迹点序列（item 局部坐标），由 text 字段的 JSON 解析而来。
        drawPoints: isDraw(it) ? parseDrawPoints(it.text) : null,
        // p6:F18：图表数据（labels/values），由 text 字段的 JSON 解析而来；null = 数据无效。
        chart: isChart(it) ? parseChartData(it.text) : undefined,
        // p6:F16：连接线专属几何/样式派生视图（见上方 connector "|k=v" 段约定）。
        connector: isConnector(it)
          ? {
              fromId: getConnectorFromId(it),
              toId: getConnectorToId(it),
              fromPoint: getConnectorFreePoint(it, "from") ?? { x: it.x, y: it.y },
              toPoint: getConnectorFreePoint(it, "to") ?? { x: it.x + it.w, y: it.y + it.h },
              line: getConnectorLine(it),
              arrow: getConnectorArrow(it),
              stroke: CONNECTOR_STROKE_COLORS[getBorder(it)] ?? CONNECTOR_STROKE_COLORS.none!,
              strokeWidth: getBorderWidth(it),
            }
          : undefined,
      })),
    [sortedItems, reload],
  );
  const selectedIdList = useMemo(
    () => items.filter((it) => selected.has(it.id)).map((it) => it.id),
    [items, selected],
  );
  const editingItem = editingId ? items.find((it) => it.id === editingId) ?? null : null;
  // p6:F20（uc-widget-menu-003 主流程 4）：全部选中项已锁定 → Widget Menu 只保留锁定状态入口。
  const allSelectedLocked = useMemo(() => {
    const sel = items.filter((it) => selected.has(it.id));
    return sel.length > 0 && sel.every(getLocked);
  }, [items, selected]);

  async function addNote() {
    setActiveTool("sticky");
    setOpenPanel(null);
    const x = 40;
    const y = 40 + placeN.current++ * 130;
    const res = await fetch(`/api/boards/${boardId}/items`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "note", x, y, text: "便签" }),
    });
    if (res.status === 201) {
      const { item } = await res.json();
      recordOp({ kind: "add", items: [item] });
      await load();
      setSelected(new Set([item.id]));
    }
  }

  // 文本（Text）组件创建（uc-board-menu-003）：在画布放置默认文本块并自动选中。
  // 线上以 type:"note" 持久化 + color:"text" 哨兵；创建后立即 PATCH 写入 color 标记，
  // 使刷新/重载后仍判别为文本（见上方 TEXT_MARK 注释）。
  async function addText() {
    setActiveTool("text");
    setOpenPanel(null);
    const x = 220;
    const y = 40 + placeN.current++ * 130;
    // 服务端 validateNewItem 仅放行 note/rect（不可改）；以 note 落库，再用 color 哨兵标记为文本。
    const res = await fetch(`/api/boards/${boardId}/items`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "note", x, y, text: DEFAULT_TEXT }),
    });
    if (res.status !== 201) return;
    const { item } = (await res.json()) as { item: Item };
    // 持久化文本标记（color 哨兵），刷新后仍可判别为文本块。
    await fetch(`/api/board-items/${item.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ color: TEXT_MARK }),
    });
    // p7:F11 e2e 压测暴露的真实回归——见 addShape 里的详细注释：poll() 若在 POST/PATCH
    // 之间的窗口发起过 GET，会把无 color 的旧版本"卡死"进 collab doc，之后 seedItems
    // 永远不会覆盖。这里同样直接 upsertItem 无条件写入，规避同一类竞态。
    upsertItem(docRef.current, item.id, { color: TEXT_MARK });
    const textItem: Item = { ...item, color: TEXT_MARK };
    recordOp({ kind: "add", items: [textItem] });
    await load();
    setSelected(new Set([item.id]));
  }

  // 形状（Shape）组件创建（uc-widgets-004 主流程 1-5）：Board Menu「形状」入口旁的下拉选形状
  // 类型，创建后系统记住该类型供下次沿用（主流程 4）。线上以 type:"rect" 落库（服务端原生放行），
  // 具体形状种类经 color 的 "|shape=<token>" 哨兵表达（不新增持久化列），创建后立即 PATCH 写入，
  // 刷新后仍可判别（同 F12/F19/F20 的 text/embed/locked 哨兵约定）。
  async function addShape(shapeType: ShapeType = lastShapeType) {
    setActiveTool("shape");
    setOpenPanel(null);
    setLastShapeType(shapeType);
    // 放置位与便签/文本一致（x=40，纵向按 placeN 递增），不再用旧的固定 x=400——
    // 400 恰好落在选中后自动出现的 Widget Menu 悬浮层正下方（该浮层 absolute 定位在
    // 视口顶部居中区域），导致新建形状一创建就被浮层盖住、拦截了鼠标事件（dblclick 编辑/
    // 拖拽移动均因此失效，真实回归见 e2e 诊断：点空白取消选中后同一手势对形状完全生效）。
    const x = 40;
    const y = 40 + placeN.current++ * 130;
    // 默认占位文字（对齐便签/文本/嵌入组件已有的 DEFAULT_TEXT/DEFAULT_EMBED 模式，也是
    // board-menu-001 既有回归断言的期望：新建矩形默认文案「矩形」）。用户仍可清空成空形状
    // （UC 备选流程 1：只创建空形状时系统保留空形状，稍后仍可输入文本）。
    const res = await fetch(`/api/boards/${boardId}/items`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "rect", x, y, text: SHAPE_LABELS[shapeType] }),
    });
    if (res.status !== 201) return;
    const { item } = (await res.json()) as { item: Item };
    const color = shapeType === DEFAULT_SHAPE_TYPE ? null : `amber|shape=${shapeType}`;
    if (color) {
      await fetch(`/api/board-items/${item.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ color }),
      });
      // p7:F11 e2e 压测暴露的真实回归（packages/collab 边界，非本 feature 范围，narrow
      // 本地规避）：seedItems() 对 doc 里已存在的 id 直接跳过、不覆盖（"避免打断本地在飞
      // 编辑"是其设计初衷）。但如果 1.5s 的后台 poll() 恰好在"POST 已落库、PATCH 还没
      // 落库"这个窗口期发起过一次 GET，会把这个新 item 的无 color 版本通过
      // syncItemsIntoDoc 写进 doc；一旦 doc 认识了这个 id，之后 seedItems 就再也不会
      // 用 REST 的最新快照覆盖它，导致 color 从此在 doc 视角"卡死"在空值，mergeRemoteItems
      // 又会用这个卡死的值覆盖掉刚 load() 回来的正确数据（复现条件苛刻，系统负载越高
      // 越容易触发，故此前观测为不稳定的 flaky 现象，实为真实竞态）。这里直接 upsertItem
      // 无条件写入 doc（不像 seedItems 那样跳过已存在的 key），确保 doc 侧不会卡在旧值。
      // 根治需要 packages/collab 增加版本号/时间戳裁决，超出 coord-board 的 area，
      // 留给 coord-collab 评估（见 evidence 里的记录）。
      upsertItem(docRef.current, item.id, { color });
    }
    const shapeItem: Item = { ...item, color };
    recordOp({ kind: "add", items: [shapeItem] });
    await load();
    setSelected(new Set([item.id]));
  }

  // 嵌入/资源组件创建（uc-widget-menu-009）：可刷新组件。线上以 type:"note" 落库 +
  // color:"embed" 哨兵，创建后立即 PATCH 写入标记，刷新/重载后仍判别为可刷新组件。
  async function addEmbed() {
    setActiveTool("assets");
    setOpenPanel(null);
    const x = 580;
    const y = 40 + placeN.current++ * 130;
    const res = await fetch(`/api/boards/${boardId}/items`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "note", x, y, text: DEFAULT_EMBED }),
    });
    if (res.status !== 201) return;
    const { item } = (await res.json()) as { item: Item };
    await fetch(`/api/board-items/${item.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ color: EMBED_MARK }),
    });
    // p7:F11 e2e 压测暴露的真实回归——见 addShape 里的详细注释，同一类 poll()/seedItems
    // 竞态在所有"创建后立即 PATCH color 哨兵"的创建函数里都存在，这里同样规避。
    upsertItem(docRef.current, item.id, { color: EMBED_MARK });
    const embedItem: Item = { ...item, color: EMBED_MARK };
    recordOp({ kind: "add", items: [embedItem] });
    await load();
    setSelected(new Set([item.id]));
  }

  // p7:F12（uc-board-menu-011 主流程 5-7）：创建链接组件。校验 URL（空/格式不可用时在输入框
  // 内提示，不创建）；通过后以 type:"note" 落库（text=域名，供卡片展示标题/域名），再 PATCH
  // color 写入 "link|url=<encodeURIComponent(URL)>" 哨兵，并 upsertItem 直写 collab doc
  // （防 poll()/seedItems 竞态把无 color 版本卡进 doc，见 addShape 的详细注释）。
  async function addLink(raw: string) {
    const input = raw.trim();
    if (!input) {
      setLinkError("请输入链接地址");
      return;
    }
    // 含空白字符的输入直接判为格式不可用：浏览器的 WHATWG URL 解析器会把主机名里的空格
    // 百分号编码后「成功解析」（"not a valid url" → https://not%20a%20valid%20url/，与 Node
    // 的抛错行为不同，e2e 实测），单靠 new URL 抛错兜不住这类明显非 URL 的输入。
    if (/\s/.test(input)) {
      setLinkError("链接格式不可用，请修改后重试");
      return;
    }
    // 无 scheme 时默认按 https 补全（用户常直接粘贴 example.com/x）。
    const candidate = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(input) ? input : `https://${input}`;
    let url: URL;
    try {
      url = new URL(candidate);
    } catch {
      setLinkError("链接格式不可用，请修改后重试");
      return;
    }
    // 协议白名单（stored XSS 前置防御，与服务端 isColorSafe / 打开路径共用同一判定）：
    // 拒绝 javascript:/data:/vbscript: 等（含大小写/空白变体，WHATWG 归一化后由白名单拦下）。
    if (!isSafeLinkUrl(url.href)) {
      setLinkError("仅支持 http/https 链接");
      return;
    }
    // 主机名不得残留百分号编码（浏览器解析器把非法字符编码进 host 而不报错）。
    if (!url.hostname || url.hostname.includes("%")) {
      setLinkError("链接格式不可用，请修改后重试");
      return;
    }
    const x = 40;
    const y = 40 + placeN.current++ * 130;
    const res = await fetch(`/api/boards/${boardId}/items`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "note", x, y, w: 220, h: 60, text: url.hostname }),
    });
    if (res.status !== 201) {
      setLinkError("创建失败，请稍后重试"); // UC 异常流程 1：失败反馈，保留已有内容
      return;
    }
    const { item } = (await res.json()) as { item: Item };
    const color = withStyle(LINK_MARK, { url: encodeURIComponent(url.href) });
    await fetch(`/api/board-items/${item.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ color }),
    });
    // 注意：这里写入**全字段**而不是只写 { color }——若 doc 尚不认识该 id，只写 color 会
    // 造出一个 text=""/x=0 的残缺 Y.Map，随后 mergeRemoteItems 用它覆盖 React state，
    // 链接卡片的域名文本会被清空（F12 verify 实测抓到的真实回归，非理论）。
    upsertItem(docRef.current, item.id, {
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
      text: item.text,
      type: item.type,
      color,
    });
    const linkItem: Item = { ...item, color };
    recordOp({ kind: "add", items: [linkItem] });
    await load();
    setSelected(new Set([item.id]));
    setOpenPanel(null);
    setLinkDraft("");
    setLinkError(null);
  }

  // p7:F12：在新标签打开链接组件的 URL（Widget Menu「打开链接」入口 + 双击组件）。
  // getLinkUrl 已做协议白名单校验（纵深防御）：不安全/损坏的哨兵返回 null，此处不打开并提示。
  // window.open 带 noopener,noreferrer 防 tabnabbing。
  const openLink = useCallback(
    (id: string) => {
      const target = itemsRef.current.find((it) => it.id === id);
      const url = target ? getLinkUrl(target) : null;
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      else setNotice("该链接协议不被允许，无法打开");
    },
    [],
  );

  // p6:F17（uc-widgets-006 主流程 1-3）：一次画笔手势结束（fabric PencilBrush path:created）
  // → 把笔迹持久化为手绘组件。points 为画布坐标；归一化为相对包围盒左上角的局部坐标存入
  // text（JSON），x/y/w/h 落为包围盒。服务端 POST 忽略 w/h（用 note 默认尺寸），故 w/h 与
  // color 哨兵合并成一次 PATCH 补写；随后 upsertItem 直写 collab doc（防 poll()/seedItems
  // 竞态，同 addShape/addText/addEmbed 的既有规避模式）。
  const onDrawCreated = useCallback(
    async (points: Array<{ x: number; y: number }>) => {
      if (!canEdit || points.length < 2) return;
      // 采样点抽稀：PencilBrush 逐 mousemove 记点，长笔迹可能上千点；隔点保留（首尾必留），
      // 上限 ~300 点，控制 text JSON 体积，视觉上无感知差异。
      const MAX_POINTS = 300;
      const step = Math.max(1, Math.ceil(points.length / MAX_POINTS));
      const sampled = points.filter((_, i) => i % step === 0 || i === points.length - 1);
      const xs = sampled.map((p) => p.x);
      const ys = sampled.map((p) => p.y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const w = Math.max(8, Math.round(Math.max(...xs) - minX));
      const h = Math.max(8, Math.round(Math.max(...ys) - minY));
      const local = sampled.map((p) => [Math.round((p.x - minX) * 10) / 10, Math.round((p.y - minY) * 10) / 10]);
      const res = await fetch(`/api/boards/${boardId}/items`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "note", x: Math.round(minX), y: Math.round(minY), text: JSON.stringify({ points: local }) }),
      });
      if (res.status !== 201) return;
      const { item } = (await res.json()) as { item: Item };
      const color = `${DRAW_MARK}|borderw=${DEFAULT_DRAW_WIDTH}`;
      await fetch(`/api/board-items/${item.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ color, w, h }),
      });
      // 注意写完整字段而非只写 {color,w,h}：doc 里若还没有这个 id，upsertItem 会新建一个
      // 只含部分字段的条目，而 seedItems 对已存在 id 永不覆盖 → text（点序列 JSON）在 doc
      // 视角长期缺失，mergeRemoteItems 的合并窗口里 items 会短暂拿到 text 为空的版本
      // （F17 verify 抓到的真实回归：e2e 读到 kind=draw 但 text 空，JSON 解析失败）。
      upsertItem(docRef.current, item.id, { x: item.x, y: item.y, w, h, text: item.text, type: item.type, color });
      const drawItem: Item = { ...item, color, w, h };
      recordOp({ kind: "add", items: [drawItem] });
      await load();
      setSelected(new Set([item.id]));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canEdit, boardId, load],
  );

  // p6:F17（uc-widgets-006 主流程 8 / uc-board-menu-012）：橡皮擦模式下点击笔迹 → 删除整条
  // 笔迹（stroke 级删除，最小可用；像素级擦除不在本期范围）。只作用于手绘对象（业务规则 4：
  // 橡皮擦只删除绘制内容），锁定笔迹不可擦（备选流程 3）；删除走既有 DELETE + recordOp 撤销栈。
  const onErasePick = useCallback(
    (itemId: string | null) => {
      if (!canEdit || !itemId) return;
      const target = itemsRef.current.find((it) => it.id === itemId);
      if (!target || !isDraw(target)) return; // 非笔迹对象：橡皮擦不作用（不误删便签/形状）
      if (getLocked(target)) {
        setNotice("笔迹已锁定，无法擦除");
        return;
      }
      setItems((prev) => prev.filter((it) => it.id !== itemId));
      setSelected((prev) => {
        if (!prev.has(itemId)) return prev;
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
      recordOp({ kind: "delete", items: [target] });
      void apiDelete([itemId]);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canEdit, apiDelete],
  );

  // p6:F18（uc-board-menu-007 + uc-widgets-008）：图表模式下点击画布 → 在点击处创建柱状图
  // 组件（默认示例数据）。type:"note" 落库 + color:"chart|kind=bar" 哨兵，text 存数据 JSON；
  // w/h 与 color 合并一次 PATCH 补写（POST 忽略 w/h），并 upsertItem 直写 doc 防竞态。
  async function addChart(pt: { x: number; y: number }) {
    const x = Math.round(pt.x);
    const y = Math.round(pt.y);
    const res = await fetch(`/api/boards/${boardId}/items`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "note", x, y, text: JSON.stringify(DEFAULT_CHART_DATA) }),
    });
    if (res.status !== 201) return;
    const { item } = (await res.json()) as { item: Item };
    const color = `${CHART_MARK}|kind=bar`;
    const w = 280;
    const h = 180;
    await fetch(`/api/board-items/${item.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ color, w, h }),
    });
    // 写完整字段防 doc 局部条目竞态（同 onDrawCreated 的注释——text 是图表数据 JSON，缺失
    // 会导致合并窗口里图表短暂渲染为「数据无效」）。
    upsertItem(docRef.current, item.id, { x: item.x, y: item.y, w, h, text: item.text, type: item.type, color });
    const chartItem: Item = { ...item, color, w, h };
    recordOp({ kind: "add", items: [chartItem] });
    await load();
    setSelected(new Set([item.id]));
    setActiveTool("select"); // 一次一个图表的创建节奏（同连接线），创建后回到选择工具
  }

  // 连接线创建（uc-widgets-005 主流程 2-3）：两次独立点击——点第一下记录起点（组件或空白处
  // 的自由端点），点第二下记录终点并立即建连（见下方 connectorFirstPick 状态 + onConnectorPick
  // 回调）。之前尝试过"按住拖拽 + 实时预览线"的单手势交互，观测到会连带影响 fabric 自身对其它
  // 对象的点击命中判定（真实回归，具体内部机制未查清但复现稳定）；两次点击更简单也更容易验证，
  // 完全避开了那条路径，是范围内可接受的交互简化（UC 主流程 3 描述的是"拖拽"，两次点击是同一
  // 用户意图——选定源、选定目标——的等价简化实现，在 notes 里如实记录这个取舍）。
  // fromId/toId 为 null 时该端是自由端点，落库其画布坐标
  // （fx/fy 或 tx/ty 段）；绑定组件的一端不落坐标，交由客户端每次按组件当前矩形动态重算
  // （这是"组件移动时连接线跟随"的机制，见 fabric-canvas.tsx 的 resolveConnectorEndpoints）。
  // 线上以 type:"note" 落库（服务端只放行 note/rect），x/y/w/h 落为两端点的包围盒（供
  // 命中测试/初始渲染参考，非跟随时的权威值）。
  async function createConnector(
    fromId: string | null,
    toId: string | null,
    fromPoint: { x: number; y: number },
    toPoint: { x: number; y: number },
  ) {
    const x = Math.min(fromPoint.x, toPoint.x);
    const y = Math.min(fromPoint.y, toPoint.y);
    const w = Math.max(8, Math.abs(toPoint.x - fromPoint.x));
    const h = Math.max(8, Math.abs(toPoint.y - fromPoint.y));
    const res = await fetch(`/api/boards/${boardId}/items`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "note", x, y, w, h, text: "" }),
    });
    if (res.status !== 201) return;
    const { item } = (await res.json()) as { item: Item };
    const segs: Record<string, string | null> = {};
    if (fromId) segs.from = fromId;
    else {
      segs.fx = String(fromPoint.x);
      segs.fy = String(fromPoint.y);
    }
    if (toId) segs.to = toId;
    else {
      segs.tx = String(toPoint.x);
      segs.ty = String(toPoint.y);
    }
    const color = withStyle(CONNECTOR_MARK, segs);
    await fetch(`/api/board-items/${item.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ color }),
    });
    const connItem: Item = { ...item, color };
    recordOp({ kind: "add", items: [connItem] });
    await load();
    setSelected(new Set([item.id]));
    setActiveTool("select"); // 建连后回到选择工具（对齐一次一条连接线的创建节奏，同 addShape 之外的其它一次性创建工具）
  }

  // 连接线创建的两次点击状态机（见上方 createConnector 注释的交互取舍）：第一次点击记录
  // 起点，第二次点击记录终点并调用 createConnector 建连。点击的组件解析为其边界矩形最近
  // 边中点，空白处点击记为自由端点（画布坐标）。
  const [connectorFirstPick, setConnectorFirstPick] = useState<{
    id: string | null;
    point: { x: number; y: number };
  } | null>(null);

  function nearestEdgeMidpoint(
    r: { x: number; y: number; w: number; h: number },
    toward: { x: number; y: number },
  ): { x: number; y: number } {
    const pts = [
      { x: r.x + r.w / 2, y: r.y },
      { x: r.x + r.w / 2, y: r.y + r.h },
      { x: r.x, y: r.y + r.h / 2 },
      { x: r.x + r.w, y: r.y + r.h / 2 },
    ];
    let best = pts[0]!;
    let bestD = Infinity;
    for (const p of pts) {
      const d = (p.x - toward.x) ** 2 + (p.y - toward.y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  const onConnectorPick = useCallback(
    (itemId: string | null, scenePoint: { x: number; y: number }) => {
      if (!canEdit) return;
      const hitItem = itemId ? items.find((it) => it.id === itemId) : undefined;
      // 连接线本身不能作为新连接线的端点（避免连接线连连接线的无意义嵌套）。
      if (hitItem && isConnector(hitItem)) return;
      if (!connectorFirstPick) {
        const point = hitItem ? nearestEdgeMidpoint(hitItem, scenePoint) : scenePoint;
        setConnectorFirstPick({ id: itemId, point });
        return;
      }
      // 起终点是同一个组件时不建连（无意义的自环），保留第一次选择等待用户重新点选终点。
      if (itemId && itemId === connectorFirstPick.id) return;
      const point = hitItem ? nearestEdgeMidpoint(hitItem, connectorFirstPick.point) : scenePoint;
      const first = connectorFirstPick;
      setConnectorFirstPick(null);
      void createConnector(first.id, itemId, first.point, point);
    },
    [canEdit, items, connectorFirstPick],
  );

  // uc-widget-menu-009：刷新选中的可刷新组件。仅对 color:"embed" 的组件生效；
  // 主流程 = 显示处理中 → 重新获取该组件内容（重走 GET /items）→ 内容/状态更新并保持选中。
  // 可见反馈：重载计数自增 + 时间戳更新（data-testid=widget-reloaded-<id>）。
  const refreshSelected = useCallback(async () => {
    if (!canEdit) return;
    const targets = items.filter((it) => selected.has(it.id) && isReloadable(it));
    if (targets.length === 0) return; // 不支持刷新的对象不执行（入口本就不显示）
    const ids = targets.map((t) => t.id);
    setRefreshing((prev) => new Set([...prev, ...ids])); // 处理中/旋转状态
    // 重新获取该组件内容：原组件保持在画布中（load 覆盖同 id）。
    await load();
    setReload((prev) => {
      const next = { ...prev };
      const now = Date.now();
      for (const id of ids) next[id] = { count: (prev[id]?.count ?? 0) + 1, at: now };
      return next;
    });
    setRefreshing((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
    setSelected(new Set(ids)); // 刷新后保持选中
  }, [canEdit, items, selected, load]);

  function chooseTool(tool: BoardTool) {
    setActiveTool(tool);
    if (tool === "assets" || tool === "templates") setOpenPanel(tool);
    else setOpenPanel(null);
    if (tool === "select") setSelected(new Set());
    setFormatSource(null); // uc-widget-menu-010 主流程 7：切工具即退出取样模式
    if (tool !== "connector") setConnectorFirstPick(null); // 切出连接线工具即丢弃未完成的起点选择
    setNotice(null); // uc-board-menu-007/012 备选流程 1：切到其它工具即退出「暂不可用」提示
  }

  // 底部悬浮 dock（F01，对齐 prototype FigJam 工具栏）复用同一套 activeTool 真值与
  // add* 动作，不引入第二套工具状态；disabled 的新工具（table/kanban/code/image）
  // 点击不做任何事（按钮本身已 disabled，这里仅作类型收窄防御）。
  function chooseDockTool(tool: DockToolKey) {
    if (tool === "sticky") {
      void addNote();
      return;
    }
    if (tool === "text") {
      void addText();
      return;
    }
    if (tool === "shape") {
      void addShape();
      return;
    }
    if (tool === "select" || tool === "pan") {
      chooseTool(tool);
    }
  }

  function selectItem(id: string, additive: boolean) {
    setSelected((prev) => {
      const next = new Set(additive ? prev : []);
      if (additive && prev.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // p6:F20（uc-widget-menu-003）：键盘方向键微移选中对象——锁定对象不可移动，过滤后为空则跳过。
  const moveSelected = useCallback(
    async (dx: number, dy: number) => {
      if (!canEdit || selected.size === 0) return;
      const targets = items.filter((it) => selected.has(it.id) && !getLocked(it));
      if (targets.length === 0) return;
      const ids = new Set(targets.map((it) => it.id));
      const moves: Move[] = targets.map((it) => ({ id: it.id, fromX: it.x, fromY: it.y, toX: it.x + dx, toY: it.y + dy }));
      setItems((prev) => prev.map((it) => (ids.has(it.id) ? { ...it, x: it.x + dx, y: it.y + dy } : it)));
      markLocallyEdited(targets.map((it) => ({ id: it.id, fields: { x: it.x + dx, y: it.y + dy } })));
      recordOp({ kind: "move", moves });
      await apiMove(moves, false);
    },
    [canEdit, selected, items, apiMove, markLocallyEdited]
  );

  const pasteClipboard = useCallback(async () => {
    if (!canEdit || clipboard.current.length === 0) return;
    const created: Item[] = [];
    for (const it of clipboard.current) {
      const res = await fetch(`/api/boards/${boardId}/items`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        // p7:F12/F14：带上 w/h——链接卡片等非默认尺寸组件复制/粘贴后保持原尺寸
        // （旧版只传 x/y/text，粘贴出的副本会退回服务端默认尺寸）。
        body: JSON.stringify({ type: it.type, x: it.x + 20, y: it.y + 20, w: it.w, h: it.h, text: it.text }),
      });
      if (res.status !== 201) continue;
      const copy = (await res.json()).item as Item;
      // 保留外观色（含文本组件的 color:"text" 哨兵），使复制出的文本仍是文本块。
      if (it.color != null) {
        await fetch(`/api/board-items/${copy.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ color: it.color }),
        });
        copy.color = it.color;
      }
      created.push(copy);
    }
    if (created.length) recordOp({ kind: "add", items: created });
    await load();
    setSelected(new Set(created.map((c) => c.id)));
  }, [canEdit, boardId, load]);

  function duplicateSelected() {
    clipboard.current = items.filter((it) => selected.has(it.id));
    void pasteClipboard();
  }

  // F11：保存便签文字（双击编辑 → 失焦/回车）
  async function saveText(id: string, text: string) {
    setEditingId(null);
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, text } : it)));
    markLocallyEdited([{ id, fields: { text } }]);
    await fetch(`/api/board-items/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
  }

  // 落库一批 color 变更。compute 基于 itemsRef.current（同步真值）求值并立刻推进
  // itemsRef，而不是依赖 setState(updater) 的执行时机——React 不保证 updater 在调用点
  // 同步跑完，同一交互序列里连续调用多个样式 setter（如连接线的 border/borderWidth/
  // 线型/箭头）时，若指望"上一次 setItems 的 updater 已经算完"来读最新值，会读到空/
  // 过期数据，导致除最后一次外全部丢失（p6:F16 verify 抓到的真实回归）。用 ref 让每次
  // applyColors 调用后 itemsRef.current 立刻前进，下一个调用总能读到刚写完的结果，
  // 与 React 何时真正渲染无关。这跟 p6:F19 修的 queuePatch 落库乱序是同一类"并发写用了
  // 过期读"问题，只是这次发生在客户端 state 计算层，queuePatch 本身防不住。
  async function applyColors(compute: (it: Item) => string | null) {
    const captured: { id: string; color: string }[] = [];
    const next = itemsRef.current.map((it) => {
      const color = compute(it);
      if (color == null) return it;
      captured.push({ id: it.id, color });
      return { ...it, color };
    });
    itemsRef.current = next;
    setItems(next);
    markLocallyEdited(captured.map((u) => ({ id: u.id, fields: { color: u.color } })));
    await Promise.all(captured.map((u) => queuePatch(u.id, { color: u.color })));
  }

  // F11：改选中便签颜色（保留字重 :bold 修饰 + p6:F12 样式段）
  async function setColor(base: string) {
    await applyColors((it) => {
      if (!selected.has(it.id) || getLocked(it)) return null;
      const head = base + (isBold(it) ? ":bold" : "");
      const segs = styleSegs(it.color);
      return [head, ...segs].join("|");
    });
  }

  // uc-widget-menu-002：切换选中组件字重（bold/normal），编码为 color 的 :bold 后缀。
  async function toggleBold() {
    const targets = items.filter((it) => selected.has(it.id) && !getLocked(it));
    if (targets.length === 0) return;
    const allBold = targets.every(isBold); // 全粗 → 取消；否则 → 全部加粗
    await applyColors((it) => {
      if (!selected.has(it.id) || getLocked(it)) return null;
      const b = baseColor(it.color);
      const segs = styleSegs(it.color);
      const head = allBold ? b : `${b}:bold`;
      return [head, ...segs].join("|");
    });
  }

  // uc-widget-menu-013：切换选中组件斜体（italic），编码为 color 的 "|italic=1" 样式段。
  async function toggleItalic() {
    const targets = items.filter((it) => selected.has(it.id) && !getLocked(it));
    if (targets.length === 0) return;
    const allItalic = targets.every(isItalic);
    await applyColors((it) =>
      !selected.has(it.id) || getLocked(it) ? null : withStyle(it.color, { italic: allItalic ? null : "1" }),
    );
  }

  // uc-widget-menu-013：设置选中组件字体，编码为 color 的 "|font=<slug>" 样式段。
  async function setFontFamily(font: string) {
    await applyColors((it) =>
      !selected.has(it.id) || getLocked(it)
        ? null
        : withStyle(it.color, { font: font === DEFAULT_FONT ? null : font }),
    );
  }

  // uc-widget-menu-013：设置选中组件字号，编码为 color 的 "|size=<n>" 样式段。
  async function setFontSize(size: number) {
    await applyColors((it) =>
      !selected.has(it.id) || getLocked(it)
        ? null
        : withStyle(it.color, { size: size === DEFAULT_FONT_SIZE ? null : String(size) }),
    );
  }

  // uc-widget-menu-013：设置选中组件文本对齐方式，编码为 color 的 "|align=<left|center|right>" 样式段。
  async function setAlign(align: "left" | "center" | "right") {
    await applyColors((it) =>
      !selected.has(it.id) || getLocked(it) ? null : withStyle(it.color, { align: align === "left" ? null : align }),
    );
  }

  // p6:F19（uc-widget-menu-002）：设置选中组件边框色，编码为 color 的 "|border=<token>" 样式段。
  async function setBorder(token: BorderToken) {
    await applyColors((it) =>
      !selected.has(it.id) || getLocked(it)
        ? null
        : withStyle(it.color, { border: token === DEFAULT_BORDER ? null : token }),
    );
  }

  // p6:F19（uc-widget-menu-002）：设置选中组件边框宽/线宽，编码为 color 的 "|borderw=<n>" 样式段。
  async function setBorderWidth(width: number) {
    await applyColors((it) =>
      !selected.has(it.id) || getLocked(it)
        ? null
        : withStyle(it.color, { borderw: width === DEFAULT_BORDER_WIDTH ? null : String(width) }),
    );
  }

  // p6:F19（uc-widget-menu-002）：设置选中组件透明度，编码为 color 的 "|opacity=<1-100>" 样式段。
  async function setOpacity(value: number) {
    await applyColors((it) =>
      !selected.has(it.id) || getLocked(it)
        ? null
        : withStyle(it.color, { opacity: value === DEFAULT_OPACITY ? null : String(value) }),
    );
  }

  // p6:F19（uc-widget-menu-002）：设置选中组件文字色，编码为 color 的 "|textcolor=<token>" 样式段。
  async function setTextColor(token: TextColorToken) {
    await applyColors((it) =>
      !selected.has(it.id) || getLocked(it)
        ? null
        : withStyle(it.color, { textcolor: token === DEFAULT_TEXT_COLOR ? null : token }),
    );
  }

  // p6:F15（uc-widgets-004 备选流程 3 / 业务规则 6）：切换已有形状的具体类型，编码为 color 的
  // "|shape=<token>" 样式段。仅通过 Widget Menu 的可见入口（wm-shape-type）暴露，符合 UC 业务
  // 规则 6「已有形状类型切换由 Widget Menu 可见入口决定」。
  async function setShapeType(shapeType: ShapeType) {
    await applyColors((it) =>
      !selected.has(it.id) || !isShape(it) || getLocked(it)
        ? null
        : withStyle(it.color, { shape: shapeType === DEFAULT_SHAPE_TYPE ? null : shapeType }),
    );
  }

  // p6:F16（uc-widget-menu-012 主流程 6）：设置选中连接线的路径形态（直线/曲线），
  // 编码为 color 的 "|linetype=curve" 样式段（直线为缺省，省略该段）。
  async function setConnectorLine(line: ConnectorLineType) {
    await applyColors((it) =>
      !selected.has(it.id) || !isConnector(it) || getLocked(it)
        ? null
        : withStyle(it.color, { linetype: line === DEFAULT_CONNECTOR_LINE ? null : line }),
    );
  }

  // p6:F16（uc-widget-menu-012 主流程 4/5）：设置选中连接线的端点箭头（无/尾部/两端），
  // 编码为 color 的 "|arrow=<token>" 样式段（无箭头为缺省，省略该段）。
  async function setConnectorArrow(arrow: ConnectorArrowType) {
    await applyColors((it) =>
      !selected.has(it.id) || !isConnector(it) || getLocked(it)
        ? null
        : withStyle(it.color, { arrow: arrow === DEFAULT_CONNECTOR_ARROW ? null : arrow }),
    );
  }

  // p6:F20（uc-widget-menu-003）：切换选中组件锁定态，编码为 color 的 "|locked=1" 样式段。
  // 多选混合锁定态时（业务规则 6：批量锁定/解锁）：若全部已锁定 → 批量解锁；否则（含未锁定
  // 或混合）→ 批量锁定，与 toggleBold 的「全真取消，否则全部置真」语义一致。
  async function toggleLocked() {
    const targets = items.filter((it) => selected.has(it.id));
    if (targets.length === 0) return;
    const allLocked = targets.every(getLocked);
    await applyColors((it) =>
      !selected.has(it.id) ? null : withStyle(it.color, { locked: allLocked ? null : "1" }),
    );
  }

  // p6:F21（uc-widgets-010 主流程 6：编组/解组）：把选中的 ≥2 个未锁定对象编成一组，
  // 编码为 color 的 "|group=<groupId>" 样式段（groupId 取选中集合中第一个 item 的 id）。
  // 锁定对象不参与编组（业务规则 5：锁定组件不得通过多选操作绕过锁定限制），若过滤后不足
  // 2 个则短路不执行。已属于某组的成员重新编组时直接覆盖旧 groupId（不支持组嵌套，范围克制）。
  async function groupSelected() {
    const targets = items.filter((it) => selected.has(it.id) && !getLocked(it));
    if (targets.length < 2) return;
    const groupId = targets[0]!.id;
    const targetIds = new Set(targets.map((it) => it.id));
    await applyColors((it) => (targetIds.has(it.id) ? withStyle(it.color, { group: groupId }) : null));
    setSelected(targetIds);
  }

  // 解组：清除选中集合中所有对象的 group 段，恢复为可独立选择的组件（主流程 6 后半）。
  async function ungroupSelected() {
    const targets = items.filter((it) => selected.has(it.id) && getGroupId(it) != null && !getLocked(it));
    if (targets.length === 0) return;
    const targetIds = new Set(targets.map((it) => it.id));
    await applyColors((it) => (targetIds.has(it.id) ? withStyle(it.color, { group: null }) : null));
  }

  // p6:F21（uc-widget-menu-011 对齐选中组件）：选中 ≥2 个对象后按包围盒批量对齐/等间距分布。
  // 基准以选中对象（过滤锁定项后）的包围盒为准；锁定对象不参与移动（业务规则 5，沿用
  // F20 的 moveSelected/deleteSelected「先过滤 getLocked 再操作」模式）。过滤后不足 2 个则短路。
  type AlignMode = "left" | "right" | "top" | "bottom" | "hcenter" | "vcenter" | "distribute-h" | "distribute-v";
  const alignSelected = useCallback(
    async (mode: AlignMode) => {
      if (!canEdit) return;
      const targets = items.filter((it) => selected.has(it.id) && !getLocked(it));
      if (targets.length < 2) return;

      let moves: Move[];
      if (mode === "distribute-h" || mode === "distribute-v") {
        // 等间距分布：按主轴排序，首尾位置不变，中间按总跨度均匀分布间隙。
        const axis = mode === "distribute-h" ? "x" : "y";
        const size = mode === "distribute-h" ? "w" : "h";
        const sorted = [...targets].sort((a, b) => a[axis] - b[axis]);
        if (sorted.length < 3) {
          moves = []; // 少于 3 个对象等间距分布没有意义（首尾已固定，无中间项可调整）
        } else {
          const totalSpan =
            (sorted[sorted.length - 1]![axis] + sorted[sorted.length - 1]![size]) - sorted[0]![axis];
          const totalSize = sorted.reduce((sum, it) => sum + it[size], 0);
          const gap = (totalSpan - totalSize) / (sorted.length - 1);
          let cursor = sorted[0]![axis];
          moves = sorted.map((it, i) => {
            const from = { fromX: it.x, fromY: it.y };
            if (i === 0) {
              cursor += it[size] + gap;
              return { id: it.id, ...from, toX: it.x, toY: it.y };
            }
            const pos = cursor;
            cursor += it[size] + gap;
            return {
              id: it.id,
              ...from,
              toX: axis === "x" ? pos : it.x,
              toY: axis === "y" ? pos : it.y,
            };
          });
        }
      } else {
        const minX = Math.min(...targets.map((it) => it.x));
        const maxX = Math.max(...targets.map((it) => it.x + it.w));
        const minY = Math.min(...targets.map((it) => it.y));
        const maxY = Math.max(...targets.map((it) => it.y + it.h));
        moves = targets.map((it) => {
          let toX = it.x;
          let toY = it.y;
          if (mode === "left") toX = minX;
          else if (mode === "right") toX = maxX - it.w;
          else if (mode === "hcenter") toX = minX + (maxX - minX) / 2 - it.w / 2;
          else if (mode === "top") toY = minY;
          else if (mode === "bottom") toY = maxY - it.h;
          else if (mode === "vcenter") toY = minY + (maxY - minY) / 2 - it.h / 2;
          return { id: it.id, fromX: it.x, fromY: it.y, toX, toY };
        });
      }

      moves = moves.filter((m) => m.toX !== m.fromX || m.toY !== m.fromY);
      if (moves.length === 0) return;
      const map = new Map(moves.map((m) => [m.id, m]));
      setItems((prev) => prev.map((it) => (map.has(it.id) ? { ...it, x: map.get(it.id)!.toX, y: map.get(it.id)!.toY } : it)));
      markLocallyEdited(moves.map((m) => ({ id: m.id, fields: { x: m.toX, y: m.toY } })));
      recordOp({ kind: "move", moves });
      await apiMove(moves, false);
    },
    [canEdit, selected, items, apiMove, markLocallyEdited],
  );

  // p6:F19（uc-widget-menu-010）：进入/退出格式取样模式。仅支持单选一个文本/便签类对象作为格式来源
  // （形状/嵌入组件无文字排版语义，不作为来源，业务规则 1）。
  function startFormatPaint() {
    if (!canEdit) return;
    const sel = items.filter((it) => selected.has(it.id));
    if (sel.length !== 1) return;
    const source = sel[0]!;
    if (isShape(source) || isReloadable(source) || isLink(source)) return; // p7:F12：链接头会随格式复制污染目标，排除
    setFormatSource({ id: source.id, color: source.color ?? null });
  }
  function exitFormatPaint() {
    setFormatSource(null);
  }

  // p6:F19（uc-widget-menu-010）：把取样格式应用到目标对象。目标为形状/嵌入/锁定或与来源相同对象时
  // 视为不兼容（异常流程/备选流程 2），不应用也不退出取样模式，交由调用方决定是否提示。
  // 返回 true 表示已应用；false 表示目标不兼容。
  async function applyFormatTo(targetId: string): Promise<boolean> {
    if (!formatSource || !canEdit) return false;
    if (targetId === formatSource.id) return false;
    const target = items.find((it) => it.id === targetId);
    // 应用格式会重写 color 判别头，会导致类型丢失，故形状/嵌入/链接（p7:F12）/手绘/图表
    // （p6:F17/F18）一律视为不兼容目标。
    if (
      !target ||
      isShape(target) ||
      isReloadable(target) ||
      isLink(target) ||
      isDraw(target) ||
      isChart(target)
    )
      return false;
    const newColor = applyFormatColor({ color: formatSource.color }, isText(target));
    await applyColors((it) => (it.id === target.id ? newColor : null));
    return true;
  }

  // uc-widget-menu-014：把选中的单个文本组件按行/段拆分为多个便利贴（批量 add 命令）。
  // 拆分规则：先按空行分段（连续换行视为段落分隔），再在段内按行拆分；
  // 拆分后的每一行/条目 trim 后为空则跳过。文本为空或拆分不出任何非空片段时，不创建便利贴、保留原文本。
  // 成功后原文本组件保留在画布（异常流程 2：转换失败保留原文本；主流程未要求删除原文本）。
  async function convertToStickyNotes() {
    if (!canEdit) return;
    const targets = items.filter((it) => selected.has(it.id) && isText(it));
    if (targets.length !== 1) return; // 仅支持单选文本对象转换
    const source = targets[0]!;
    const lines = source.text
      .split(/\n{2,}/) // 先按空行分段
      .flatMap((block) => block.split("\n")) // 段内再按行拆
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (lines.length === 0) return; // 无法拆分：保留原文本组件，不创建便利贴
    const cols = Math.min(4, lines.length);
    const gapX = 180;
    const gapY = 130;
    const created: Item[] = [];
    for (let i = 0; i < lines.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = source.x + col * gapX;
      const y = source.y + source.h + 20 + row * gapY;
      const res = await fetch(`/api/boards/${boardId}/items`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "note", x, y, text: lines[i] }),
      });
      if (res.status !== 201) continue;
      const item = (await res.json()).item as Item;
      created.push(item);
    }
    if (created.length === 0) return; // 全部创建失败：保留原文本组件（异常流程 2）
    recordOp({ kind: "add", items: created });
    await load();
    setSelected(new Set(created.map((c) => c.id))); // 新便利贴按多选态展示（主流程 4）
  }

  // uc-context-menu-003 / p7:F14：调整图层顺序（z-order）并**持久化**。
  // 旧版只重排本地 items 数组（刷新即丢）；现改为：在按 (z, 原下标) 排序后的当前层序上
  // 计算目标顺序，然后把每个 item 的 z 段写成其目标下标（仅 PATCH 与现值不同的项——
  // 首次操作会给多数 item 补显式 z，之后每次只动少数项）。排序读取见 sortedItems/getZ。
  // 多选时按选中集合整体移动，保留选中项彼此相对次序（uc-003 主流程 6）；锁定对象允许
  // 被层级动作调整（uc-001 前端入口 3：锁定对象菜单收窄但保留层级入口）。
  const arrange = useCallback(
    async (mode: "front" | "forward" | "backward" | "back") => {
      if (!canEdit || selected.size === 0) return;
      const cur = itemsRef.current
        .map((it, i) => [it, i] as const)
        .sort((a, b) => getZ(a[0]) - getZ(b[0]) || a[1] - b[1])
        .map(([it]) => it);
      if (!cur.some((it) => selected.has(it.id))) return;
      let order: Item[];
      if (mode === "front") {
        order = [...cur.filter((it) => !selected.has(it.id)), ...cur.filter((it) => selected.has(it.id))];
      } else if (mode === "back") {
        order = [...cur.filter((it) => selected.has(it.id)), ...cur.filter((it) => !selected.has(it.id))];
      } else {
        order = [...cur];
        if (mode === "forward") {
          // 整体上移一层：从上层往下扫，把每个选中项与其上方最近的未选中项交换。
          for (let i = order.length - 2; i >= 0; i--) {
            if (selected.has(order[i]!.id) && !selected.has(order[i + 1]!.id)) {
              [order[i], order[i + 1]] = [order[i + 1]!, order[i]!];
            }
          }
        } else {
          // 整体下移一层：从底层往上扫，把每个选中项与其下方最近的未选中项交换。
          for (let i = 1; i < order.length; i++) {
            if (selected.has(order[i]!.id) && !selected.has(order[i - 1]!.id)) {
              [order[i], order[i - 1]] = [order[i - 1]!, order[i]!];
            }
          }
        }
      }
      const zByld = new Map(order.map((it, idx) => [it.id, idx]));
      // applyColors：乐观更新 + per-item 串行 PATCH 落库（复用既有样式段写路径）。
      // 目标 z 与当前生效 z 相同的项返回 null（不 PATCH）；每次操作后所有 item 的生效 z
      // 恰为其目标下标（0..n-1 各一次），不会产生并列。
      await applyColors((it) => {
        const target = zByld.get(it.id);
        if (target == null || getZ(it) === target) return null;
        return withStyle(it.color, { z: String(target) });
      });
    },
    [canEdit, selected]
  );

  // uc-widget-menu-008 主流程 5：多选删除时，系统删除允许对象；遇到锁定对象时保留这些对象
  // （部分失败）。锁定对象保持选中，便于用户看到哪些没被删除。
  const deleteSelected = useCallback(async () => {
    if (!canEdit || selected.size === 0) return;
    const targeted = items.filter((it) => selected.has(it.id));
    const removed = targeted.filter((it) => !getLocked(it));
    if (removed.length === 0) return; // 全部锁定 → 删除入口本就不显示/不可用，防御性短路
    const removedIds = new Set(removed.map((it) => it.id));
    setItems((prev) => prev.filter((it) => !removedIds.has(it.id)));
    setSelected(new Set(targeted.filter((it) => getLocked(it)).map((it) => it.id)));
    recordOp({ kind: "delete", items: removed });
    await apiDelete(removed.map((it) => it.id));
  }, [canEdit, selected, items, apiDelete]);

  const undo = useCallback(async () => {
    if (!canEdit) return;
    const op = undoStack.current.pop();
    if (!op) return;
    if (op.kind === "add") await apiDelete(op.items.map((i) => i.id));
    else if (op.kind === "delete") await apiRestore(op.items);
    else if (op.kind === "resize") await apiResize(op.resize.id, op.resize.from);
    else await apiMove(op.moves, true);
    redoStack.current.push(op);
    bumpHistory();
    setSelected(new Set());
    await load();
  }, [canEdit, apiDelete, apiRestore, apiMove, apiResize, load]);

  const redo = useCallback(async () => {
    if (!canEdit) return;
    const op = redoStack.current.pop();
    if (!op) return;
    if (op.kind === "add") await apiRestore(op.items);
    else if (op.kind === "delete") await apiDelete(op.items.map((i) => i.id));
    else if (op.kind === "resize") await apiResize(op.resize.id, op.resize.to);
    else await apiMove(op.moves, false);
    undoStack.current.push(op);
    bumpHistory();
    setSelected(new Set());
    await load();
  }, [canEdit, apiDelete, apiRestore, apiMove, apiResize, load]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      if (e.key === "Escape") {
        setOpenPanel(null);
        setActiveTool("select");
        setFormatSource(null); // uc-widget-menu-010 主流程 7：Esc 退出取样模式
        setNotice(null);
        setCtxMenu(null); // uc-context-menu-001 主流程 7：Esc 关闭右键菜单且不执行动作
        return setSelected(new Set());
      }
      const mod = e.metaKey || e.ctrlKey;
      // uc-board-menu-007：无修饰键的纯 "c"/"C" 才切换图表模式（区别于下方 mod+C 复制）。
      // 仅编辑者可用；Board Menu 当前不直接渲染图表按钮，只有这一条快捷键入口。
      if (!mod && !e.shiftKey && !e.altKey && (e.key === "c" || e.key === "C") && canEdit) {
        e.preventDefault();
        setActiveTool((prev) => (prev === "chart" ? "select" : "chart"));
        setOpenPanel(null);
        setNotice(null);
        return;
      }
      if (mod && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        return void (e.shiftKey ? redo() : undo());
      }
      if (mod && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        return void redo();
      }
      if (mod && (e.key === "a" || e.key === "A")) {
        e.preventDefault();
        return setSelected(new Set(items.map((it) => it.id)));
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        return void deleteSelected();
      }
      if (mod && (e.key === "c" || e.key === "C")) {
        e.preventDefault();
        clipboard.current = items.filter((it) => selected.has(it.id));
        return;
      }
      if (mod && (e.key === "v" || e.key === "V")) {
        e.preventDefault();
        return void pasteClipboard();
      }
      const step = e.shiftKey ? BIG_NUDGE : NUDGE;
      if (e.key === "ArrowLeft") return void moveSelected(-step, 0);
      if (e.key === "ArrowRight") return void moveSelected(step, 0);
      if (e.key === "ArrowUp") return void moveSelected(0, -step);
      if (e.key === "ArrowDown") return void moveSelected(0, step);
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [items, selected, deleteSelected, moveSelected, pasteClipboard, undo, redo, canEdit]);

  return (
    <div className="relative flex flex-1 flex-col" onMouseMove={publishLocalCursor} onMouseLeave={clearLocalCursor}>
      {/* Board Menu：编辑者可见的工具入口；不可用能力保留禁用状态，避免误导为已实现。 */}
      {canEdit && (
        <div className="relative border-b bg-card px-3 py-1.5">
          <div data-testid="board-menu" aria-label="Board Menu" className="flex items-center gap-1.5">
            <BoardMenuButton
              testId="board-tool-select"
              label="选择"
              active={activeTool === "select"}
              onClick={() => chooseTool("select")}
            >
              <MousePointer2 className="h-4 w-4" />
            </BoardMenuButton>
            <BoardMenuButton
              testId="board-tool-pan"
              label="平移"
              active={activeTool === "pan"}
              onClick={() => chooseTool("pan")}
            >
              <Hand className="h-4 w-4" />
            </BoardMenuButton>
            <BoardMenuButton testId="add-note" label="便利贴" active={activeTool === "sticky"} onClick={() => void addNote()}>
              <StickyNote className="h-4 w-4" />
            </BoardMenuButton>
            {/* p6:F17（uc-widgets-006 / uc-board-menu-006）：手绘工具——激活后画布进入 fabric
                isDrawingMode（PencilBrush 自由绘制），松开鼠标即持久化为手绘组件（见
                onDrawCreated）。 */}
            <BoardMenuButton
              testId="board-tool-draw"
              label="手绘"
              active={activeTool === "draw"}
              onClick={() => chooseTool("draw")}
            >
              <PenLine className="h-4 w-4" />
            </BoardMenuButton>
            {/* p6:F17（uc-board-menu-012）：橡皮擦——激活后点击某条笔迹删除该笔迹（stroke 级
                删除，见 onErasePick）；只作用于手绘对象，不误删其它组件。 */}
            <BoardMenuButton
              testId="board-tool-eraser"
              label="橡皮擦"
              active={activeTool === "eraser"}
              onClick={() => chooseTool("eraser")}
            >
              <Eraser className="h-4 w-4" />
            </BoardMenuButton>
            <BoardMenuButton testId="add-text" label="文本" active={activeTool === "text"} onClick={() => void addText()}>
              <Type className="h-4 w-4" />
            </BoardMenuButton>
            {/* p6:F16（uc-widgets-005 前端入口 1-2）：连接线工具——激活后依次点击两个组件
                （或空白处，作为自由端点）建立连接（见 onConnectorPick 的两次点击状态机 +
                createConnector）。 */}
            <BoardMenuButton
              testId="board-tool-connector"
              label="连接线"
              active={activeTool === "connector"}
              onClick={() => chooseTool("connector")}
            >
              <Cable className="h-4 w-4" />
            </BoardMenuButton>
            {/* p6:F15（uc-widgets-004 前端入口 1/2）：形状入口点击直接用上次选择的类型创建
                （主流程 4：沿用上次），旁边的下拉箭头（board-tool-shape-menu）展开形状类型面板
                （主流程 1-3：展示可创建的形状类型下拉菜单，供切换）。 */}
            <BoardMenuButton testId="board-tool-shape" label="形状" active={activeTool === "shape"} onClick={() => void addShape()}>
              <Shapes className="h-4 w-4" />
            </BoardMenuButton>
            <button
              type="button"
              data-testid="board-tool-shape-menu"
              aria-label="选择形状类型"
              aria-expanded={openPanel === "shape"}
              onClick={() => setOpenPanel((p) => (p === "shape" ? null : "shape"))}
              className="flex h-9 w-4 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
            >
              <span className="text-10 leading-none">▾</span>
            </button>
            {/* p7:F12（uc-board-menu-011）：链接组件创建入口——点击展开 URL 输入面板，
                校验通过后在画布放置链接卡片（见 addLink）。 */}
            <BoardMenuButton
              testId="add-link"
              label="链接"
              active={openPanel === "link"}
              onClick={() => {
                setOpenPanel((p) => (p === "link" ? null : "link"));
                setLinkError(null);
              }}
            >
              <Link2 className="h-4 w-4" />
            </BoardMenuButton>
            <BoardMenuButton
              testId="board-tool-assets"
              label="资源"
              active={activeTool === "assets"}
              onClick={() => chooseTool("assets")}
            >
              <Image className="h-4 w-4" />
            </BoardMenuButton>
            {/* 嵌入/资源组件（可刷新）：uc-widget-menu-009 的刷新入口只对这类组件出现 */}
            <BoardMenuButton testId="add-embed" label="嵌入" active={false} onClick={() => void addEmbed()}>
              <RefreshCw className="h-4 w-4" />
            </BoardMenuButton>
            <BoardMenuButton
              testId="board-tool-templates"
              label="模板"
              active={activeTool === "templates"}
              onClick={() => chooseTool("templates")}
            >
              <LayoutTemplate className="h-4 w-4" />
            </BoardMenuButton>

            <div className="mx-1 h-5 w-px bg-border" />
            <Button
              data-testid="undo"
              size="icon"
              variant="ghost"
              title="撤销"
              aria-label="撤销"
              disabled={!canUndo}
              onClick={() => void undo()}
            >
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button
              data-testid="redo"
              size="icon"
              variant="ghost"
              title="重做"
              aria-label="重做"
              disabled={!canRedo}
              onClick={() => void redo()}
            >
              <Redo2 className="h-4 w-4" />
            </Button>
            <span data-testid="selection-count" className="ml-1 text-xs text-muted-foreground">
              已选 {selected.size}
            </span>
          </div>

          {/* p6:F15（uc-widgets-004 主流程 1-3）：形状类型下拉——当前确认展示圆形/三角形/菱形/
              圆角矩形/矩形/六边形（业务规则 5）。选中后把该类型设为当前形状工具并立即创建一个
              该类型的形状（与「点击形状入口沿用上次类型」共用同一个 addShape，只是显式指定类型）。 */}
          {openPanel === "shape" && (
            <div
              data-testid="board-shape-panel"
              className="absolute left-3 top-12 z-20 w-56 rounded-lg border bg-popover p-2 shadow-lg"
            >
              <div className="grid grid-cols-3 gap-1.5">
                {SHAPE_TYPES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    data-testid={`board-shape-${s}`}
                    aria-label={SHAPE_LABELS[s]}
                    title={SHAPE_LABELS[s]}
                    onClick={() => void addShape(s)}
                    className="flex flex-col items-center gap-1 rounded-md border border-transparent p-2 text-10 text-muted-foreground hover:border-input hover:bg-accent"
                  >
                    <ShapeGlyph type={s} className="h-5 w-5" />
                    {SHAPE_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* p7:F12（uc-board-menu-011 主流程 5-6）：链接输入面板——输入 URL、校验（空/格式
              不可用时就地提示，UC 主流程 6），确认后创建链接组件。 */}
          {openPanel === "link" && (
            <div
              data-testid="board-link-panel"
              className="absolute left-3 top-12 z-20 w-72 rounded-lg border bg-popover p-3 shadow-lg"
            >
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void addLink(linkDraft);
                }}
              >
                <input
                  data-testid="board-link-url"
                  aria-label="链接地址"
                  placeholder="https://example.com"
                  autoFocus
                  value={linkDraft}
                  onChange={(e) => {
                    setLinkDraft(e.target.value);
                    setLinkError(null);
                  }}
                  className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                {linkError && (
                  <div data-testid="board-link-error" role="alert" className="mt-1.5 text-xs text-destructive">
                    {linkError}
                  </div>
                )}
                <Button data-testid="board-link-submit" type="submit" size="sm" className="mt-2 w-full">
                  添加到画布
                </Button>
              </form>
            </div>
          )}

          {openPanel === "assets" && (
            <div
              data-testid="board-assets-panel"
              className="absolute left-3 top-12 z-20 w-72 rounded-lg border bg-popover p-3 shadow-lg"
            >
              <input
                data-testid="board-assets-search"
                aria-label="搜索资源"
                placeholder="搜索图片或图标"
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <div className="mt-2 flex gap-1.5">
                <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium">图片</span>
                <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium">图标</span>
              </div>
            </div>
          )}

          {openPanel === "templates" && (
            <div
              data-testid="board-templates-panel"
              className="absolute left-3 top-12 z-20 w-72 rounded-lg border bg-popover p-3 shadow-lg"
            >
              <div className="text-xs font-semibold text-muted-foreground">模板</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button type="button" className="rounded-md border bg-background p-2 text-left text-xs">
                  Brainstorm
                </button>
                <button type="button" className="rounded-md border bg-background p-2 text-left text-xs">
                  Kanban
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Widget Menu：选中驱动的悬浮操作（F10）。能力随 widget type 矩阵扩展（F17 样式/F18 锁定…）。
          当前 item 均为便签，动作统一；多选展示交集动作。 */}
      {canEdit && selected.size > 0 && (
        <div
          data-testid="widget-menu"
          // p6:F21：对齐/编组按钮加入后单行操作数明显增多，改为 flex-wrap + max-w 避免菜单宽度
          // 超出视口在两侧「溢出」并遮挡画布空白区域（真实回归：曾导致点击视口边缘空白处误命中
          // 菜单而非清空选择，见 canvas-select.spec.ts「点选/Shift多选/点空白清除」）。
          className="absolute left-1/2 top-14 z-20 flex max-w-[92vw] flex-wrap -translate-x-1/2 items-center gap-1 rounded-md border bg-card px-2 py-1 shadow-lg"
        >
          <span className="px-1 text-xs text-muted-foreground">{selected.size} 项</span>
          {/* p6:F20（uc-widget-menu-003 主流程 3/4，业务规则 1）：全部选中项已锁定时，样式/编辑
              类入口整体隐藏——锁定对象只保留锁定状态入口（此处即下方的解锁）与删除（已置灰）。
              混合锁定态（部分选中项锁定）仍展示样式入口，setColor/toggleBold 等 setter 已各自
              过滤掉锁定项，只对未锁定项生效。 */}
          {!allSelectedLocked && (
            <>
          {/* 颜色色板（F11）：仅对便签生效；选中项全为文本或连接线时隐藏（文本为透明块、连接线
              用边框色表达线条颜色，都不套柔彩背景色，业务规则 1：菜单入口按对象类型区分）。
              连接线/链接（p7:F12）/手绘/图表（p6:F17/F18）的 color 头都是类型判别位，setColor
              会把头替换成色 token 导致类型丢失，故选中含这些类型时色板整体隐藏（笔色走 wm-border）。 */}
          {!items.filter((it) => selected.has(it.id)).every((it) => isText(it) || isConnector(it)) &&
            items
              .filter((it) => selected.has(it.id))
              .every((it) => !isConnector(it) && !isLink(it) && !isDraw(it) && !isChart(it)) &&
            COLOR_TOKENS.map((c) => (
            <button
              key={c}
              type="button"
              data-testid={`wm-color-${c}`}
              aria-label={`颜色 ${c}`}
              onClick={() => void setColor(c)}
              className={"h-5 w-5 rounded-full border " + colorClass(c)}
            />
          ))}
          {/* p6:F16 业务规则 1：连接线无文字排版语义，字重入口不展示（与形状/嵌入组件的
              既有隐藏逻辑一致，只是本行 wm-bold 历史上未对形状/嵌入设门，这里只加连接线判断，
              不改动既有对形状/嵌入的展示行为，范围最小化）。 */}
          {!items.filter((it) => selected.has(it.id)).every(isConnector) &&
            items.filter((it) => selected.has(it.id)).every((it) => !isDraw(it) && !isChart(it)) && (
            <Button
              data-testid="wm-bold"
              size="sm"
              variant="ghost"
              aria-label="字重加粗"
              aria-pressed={items.filter((it) => selected.has(it.id)).every(isBold)}
              className="font-bold"
              onClick={() => void toggleBold()}
            >
              B
            </Button>
          )}
          {/* uc-widget-menu-013 文本样式：字体/字号/斜体/对齐/转便利贴。仅对文本或便签生效
              （含文字的对象）；形状/嵌入组件无文字排版语义，不显示（业务规则 1）。 */}
          {(() => {
            const sel = items.filter((it) => selected.has(it.id));
            const allTextLike =
              sel.length > 0 &&
              sel.every(
                (it) =>
                  isText(it) ||
                  (!isShape(it) && !isReloadable(it) && !isConnector(it) && !isLink(it) && !isDraw(it) && !isChart(it)),
              );
            if (!allTextLike) return null;
            const first = sel[0]!;
            const mixedFont = !sel.every((it) => getFontFamily(it) === getFontFamily(first));
            const mixedSize = !sel.every((it) => getFontSize(it) === getFontSize(first));
            const mixedAlign = !sel.every((it) => getAlign(it) === getAlign(first));
            const allItalic = sel.every(isItalic);
            return (
              <>
                <select
                  data-testid="wm-font"
                  aria-label="字体"
                  value={mixedFont ? "" : getFontFamily(first)}
                  onChange={(e) => void setFontFamily(e.target.value)}
                  className="h-7 rounded-md border border-input bg-background px-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {mixedFont && <option value="">混合</option>}
                  {FONT_OPTIONS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <select
                  data-testid="wm-fontsize"
                  aria-label="字号"
                  value={mixedSize ? "" : String(getFontSize(first))}
                  onChange={(e) => void setFontSize(Number(e.target.value))}
                  className="h-7 rounded-md border border-input bg-background px-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {mixedSize && <option value="">混合</option>}
                  {FONT_SIZE_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <Button
                  data-testid="wm-italic"
                  size="sm"
                  variant="ghost"
                  aria-label="斜体"
                  aria-pressed={allItalic}
                  className="italic"
                  onClick={() => void toggleItalic()}
                >
                  I
                </Button>
                <Button
                  data-testid="wm-align-left"
                  size="sm"
                  variant="ghost"
                  aria-label="左对齐"
                  aria-pressed={!mixedAlign && getAlign(first) === "left"}
                  onClick={() => void setAlign("left")}
                >
                  <AlignLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  data-testid="wm-align-center"
                  size="sm"
                  variant="ghost"
                  aria-label="居中对齐"
                  aria-pressed={!mixedAlign && getAlign(first) === "center"}
                  onClick={() => void setAlign("center")}
                >
                  <AlignCenter className="h-3.5 w-3.5" />
                </Button>
                <Button
                  data-testid="wm-align-right"
                  size="sm"
                  variant="ghost"
                  aria-label="右对齐"
                  aria-pressed={!mixedAlign && getAlign(first) === "right"}
                  onClick={() => void setAlign("right")}
                >
                  <AlignRight className="h-3.5 w-3.5" />
                </Button>
              </>
            );
          })()}
          {/* p6:F19（uc-widget-menu-002）：边框色/边框宽（含线宽语义）/透明度/文字色。
              对文本/便签/形状均生效（透明度、边框是通用外观属性，不限文字类对象）；
              嵌入组件（图片/文件占位）暂不开放，避免和刷新/裁剪能力冲突。
              p6:F16（uc-widget-menu-012）：连接线复用同一套 wm-border/wm-border-width 入口
              表达"颜色/线宽"（UC 业务规则 4 明确连接线样式只描述已确认的颜色/线宽/直线曲线/
              端点箭头，无透明度和文字色语义，故连接线选中时不展示 wm-opacity/wm-textcolor）。 */}
          {(() => {
            const sel = items.filter((it) => selected.has(it.id));
            // p6:F18：图表无边框/透明度/文字色语义（外观由数据渲染决定），整节不展示。
            const eligible = sel.length > 0 && sel.every((it) => !isReloadable(it) && !isChart(it));
            if (!eligible) return null;
            const allConnectors = sel.every(isConnector);
            // p6:F17：手绘复用 wm-border/wm-border-width 表达笔色/线宽（同连接线的复用理由），
            // 但无文字色语义，textcolor 不展示；透明度保留（笔迹整体透明度有意义）。
            const allDraw = sel.every(isDraw);
            const first = sel[0]!;
            const mixedBorder = !sel.every((it) => getBorder(it) === getBorder(first));
            const mixedBorderWidth = !sel.every((it) => getBorderWidth(it) === getBorderWidth(first));
            const mixedOpacity = !sel.every((it) => getOpacity(it) === getOpacity(first));
            const mixedTextColor = !sel.every((it) => getTextColor(it) === getTextColor(first));
            return (
              <>
                <select
                  data-testid="wm-border"
                  aria-label={allConnectors ? "连接线颜色" : "边框色"}
                  value={mixedBorder ? "" : getBorder(first)}
                  onChange={(e) => void setBorder(e.target.value as BorderToken)}
                  className="h-7 rounded-md border border-input bg-background px-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {mixedBorder && <option value="">混合</option>}
                  <option value="none">{allConnectors ? "默认" : "无边框"}</option>
                  <option value="gray">灰色</option>
                  <option value="blue">蓝色</option>
                  <option value="red">红色</option>
                </select>
                <select
                  data-testid="wm-border-width"
                  aria-label={allConnectors ? "线宽" : "边框/线宽"}
                  value={mixedBorderWidth ? "" : String(getBorderWidth(first))}
                  onChange={(e) => void setBorderWidth(Number(e.target.value))}
                  className="h-7 rounded-md border border-input bg-background px-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {mixedBorderWidth && <option value="">混合</option>}
                  {BORDER_WIDTH_OPTIONS.map((w) => (
                    <option key={w} value={w}>
                      {w}px
                    </option>
                  ))}
                </select>
                {!allConnectors && (
                  <>
                    <select
                      data-testid="wm-opacity"
                      aria-label="透明度"
                      value={mixedOpacity ? "" : String(getOpacity(first))}
                      onChange={(e) => void setOpacity(Number(e.target.value))}
                      className="h-7 rounded-md border border-input bg-background px-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {mixedOpacity && <option value="">混合</option>}
                      {OPACITY_OPTIONS.map((o) => (
                        <option key={o} value={o}>
                          {o}%
                        </option>
                      ))}
                    </select>
                    {!allDraw && (
                    <select
                      data-testid="wm-textcolor"
                      aria-label="文字色"
                      value={mixedTextColor ? "" : getTextColor(first)}
                      onChange={(e) => void setTextColor(e.target.value as TextColorToken)}
                      className="h-7 rounded-md border border-input bg-background px-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {mixedTextColor && <option value="">混合</option>}
                      <option value="default">默认</option>
                      <option value="slate">石墨</option>
                      <option value="blue">蓝色</option>
                      <option value="green">绿色</option>
                      <option value="red">红色</option>
                    </select>
                    )}
                  </>
                )}
                {/* p6:F16（uc-widget-menu-012 主流程 6）：连接线专属——直线/曲线、端点箭头。 */}
                {allConnectors &&
                  (() => {
                    const mixedLine = !sel.every((it) => getConnectorLine(it) === getConnectorLine(first));
                    const mixedArrow = !sel.every((it) => getConnectorArrow(it) === getConnectorArrow(first));
                    return (
                      <>
                        <select
                          data-testid="wm-connector-line"
                          aria-label="直线/曲线"
                          value={mixedLine ? "" : getConnectorLine(first)}
                          onChange={(e) => void setConnectorLine(e.target.value as ConnectorLineType)}
                          className="h-7 rounded-md border border-input bg-background px-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {mixedLine && <option value="">混合</option>}
                          <option value="straight">直线</option>
                          <option value="curve">曲线</option>
                        </select>
                        <select
                          data-testid="wm-connector-arrow"
                          aria-label="端点箭头"
                          value={mixedArrow ? "" : getConnectorArrow(first)}
                          onChange={(e) => void setConnectorArrow(e.target.value as ConnectorArrowType)}
                          className="h-7 rounded-md border border-input bg-background px-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {mixedArrow && <option value="">混合</option>}
                          <option value="none">无箭头</option>
                          <option value="end">尾部箭头</option>
                          <option value="both">两端箭头</option>
                        </select>
                      </>
                    );
                  })()}
              </>
            );
          })()}
          {/* p6:F15（uc-widgets-004 备选流程 3 / 业务规则 6）：已有形状类型切换入口——只在选中项
              全部为形状（type:"rect"）时展示，未展示该入口时不能直接切换（与 UC 明确一致）。 */}
          {(() => {
            const sel = items.filter((it) => selected.has(it.id));
            const allShapes = sel.length > 0 && sel.every(isShape);
            if (!allShapes) return null;
            const first = sel[0]!;
            const mixedShapeType = !sel.every((it) => getShapeType(it) === getShapeType(first));
            return (
              <select
                data-testid="wm-shape-type"
                aria-label="形状类型"
                value={mixedShapeType ? "" : getShapeType(first)}
                onChange={(e) => void setShapeType(e.target.value as ShapeType)}
                className="h-7 rounded-md border border-input bg-background px-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {mixedShapeType && <option value="">混合</option>}
                {SHAPE_TYPES.map((s) => (
                  <option key={s} value={s}>
                    {SHAPE_LABELS[s]}
                  </option>
                ))}
              </select>
            );
          })()}
          {/* p6:F19（uc-widget-menu-010）：应用格式入口。仅单选一个文本/便签类对象时可进入取样模式
              （形状/嵌入/连接线无可复用的文字排版样式，不作为来源，业务规则 1）。 */}
          {/* p7:F12：链接组件在新标签打开的可见入口（uc-board-menu-011 后置：用户可继续操作组件；
              user_visible_behavior：点击在新标签打开）。双击组件同样触发（见 onEditRequest）。 */}
          {selected.size === 1 && items.filter((it) => selected.has(it.id)).every(isLink) && (
            <Button
              data-testid="wm-open-link"
              size="sm"
              variant="ghost"
              aria-label="打开链接"
              onClick={() => openLink(Array.from(selected)[0]!)}
            >
              <Link2 className="mr-1 h-3.5 w-3.5" />
              打开链接
            </Button>
          )}
          {selected.size === 1 &&
            items
              .filter((it) => selected.has(it.id))
              .every(
                (it) => !isShape(it) && !isReloadable(it) && !isConnector(it) && !isLink(it) && !isDraw(it) && !isChart(it),
              ) && (
              <Button
                data-testid="wm-apply-format"
                size="sm"
                variant="ghost"
                aria-label="应用格式"
                aria-pressed={formatSource?.id === Array.from(selected)[0]}
                onClick={() => void startFormatPaint()}
              >
                <Paintbrush className="mr-1 h-3.5 w-3.5" />
                应用格式
              </Button>
            )}
          {/* p6:F18（uc-widgets-008）：单选图表时显示「编辑数据」入口——复用既有 DOM textarea
              编辑覆盖层直接编辑 text 里的数据 JSON（{"labels":[...],"values":[...]}），保存后
              按新数据重渲染柱状图（双击图表进入同一编辑态）。 */}
          {selected.size === 1 && items.filter((it) => selected.has(it.id)).every(isChart) && (
            <Button
              data-testid="wm-chart-data"
              size="sm"
              variant="ghost"
              aria-label="编辑图表数据"
              onClick={() => setEditingId(Array.from(selected)[0]!)}
            >
              编辑数据
            </Button>
          )}
          {/* uc-widget-menu-014：仅当单选一个文本组件时显示「转换为便利贴」入口。 */}
          {selected.size === 1 && items.filter((it) => selected.has(it.id)).every(isText) && (
            <Button
              data-testid="wm-convert-to-notes"
              size="sm"
              variant="ghost"
              onClick={() => void convertToStickyNotes()}
            >
              转为便利贴
            </Button>
          )}
          {/* 刷新组件（uc-widget-menu-009）：仅当选中项全部为可刷新（embed）组件时显示刷新入口；
              否则（含不可刷新对象）显示禁用的「刷新暂不可用」，体现类型不支持则动作不可用。 */}
          {(() => {
            const sel = items.filter((it) => selected.has(it.id));
            const allReloadable = sel.length > 0 && sel.every(isReloadable);
            const busy = sel.some((it) => refreshing.has(it.id));
            return allReloadable ? (
              <Button
                data-testid="wm-refresh"
                size="sm"
                variant="ghost"
                aria-label="刷新组件"
                aria-busy={busy}
                disabled={busy}
                onClick={() => void refreshSelected()}
              >
                <RefreshCw className={"mr-1 h-3.5 w-3.5 " + (busy ? "animate-spin" : "")} />
                {busy ? "刷新中" : "刷新"}
              </Button>
            ) : (
              <Button
                data-testid="wm-refresh-unavailable"
                size="sm"
                variant="ghost"
                disabled
                title="当前组件类型不支持刷新"
              >
                刷新暂不可用
              </Button>
            );
          })()}
          <Button data-testid="wm-duplicate" size="sm" variant="ghost" onClick={duplicateSelected}>
            复制
          </Button>
          {/* p6:F21（uc-widget-menu-011 对齐选中组件）：选中 ≥2 个对象时展示对齐/分布入口；
              不足 2 个隐藏（主流程 8：选中对象不足两个时，系统隐藏多对象对齐入口）。
              锁定对象已在 alignSelected 内部过滤，混合选中态下只对未锁定项生效。
              testid 用 "wm-align-objects-*" 前缀与既有文本对齐入口 "wm-align-left/center/right"
              （uc-widget-menu-013，控制文字排版对齐）区分——两者语义完全不同，不能复用同名 testid。 */}
          {selected.size >= 2 && (
            <>
              <div className="mx-1 h-5 w-px bg-border" />
              <Button data-testid="wm-align-objects-left" size="sm" variant="ghost" aria-label="对象左对齐" onClick={() => void alignSelected("left")}>
                左对齐
              </Button>
              <Button data-testid="wm-align-objects-hcenter" size="sm" variant="ghost" aria-label="对象水平居中" onClick={() => void alignSelected("hcenter")}>
                水平居中
              </Button>
              <Button data-testid="wm-align-objects-right" size="sm" variant="ghost" aria-label="对象右对齐" onClick={() => void alignSelected("right")}>
                右对齐
              </Button>
              <Button data-testid="wm-align-objects-top" size="sm" variant="ghost" aria-label="对象顶对齐" onClick={() => void alignSelected("top")}>
                顶对齐
              </Button>
              <Button data-testid="wm-align-objects-vcenter" size="sm" variant="ghost" aria-label="对象垂直居中" onClick={() => void alignSelected("vcenter")}>
                垂直居中
              </Button>
              <Button data-testid="wm-align-objects-bottom" size="sm" variant="ghost" aria-label="对象底对齐" onClick={() => void alignSelected("bottom")}>
                底对齐
              </Button>
              {selected.size >= 3 && (
                <>
                  <Button
                    data-testid="wm-distribute-h"
                    size="sm"
                    variant="ghost"
                    aria-label="水平等间距分布"
                    onClick={() => void alignSelected("distribute-h")}
                  >
                    水平分布
                  </Button>
                  <Button
                    data-testid="wm-distribute-v"
                    size="sm"
                    variant="ghost"
                    aria-label="垂直等间距分布"
                    onClick={() => void alignSelected("distribute-v")}
                  >
                    垂直分布
                  </Button>
                </>
              )}
            </>
          )}
          {/* p6:F21（uc-widgets-010 主流程 6：编组/解组）：选中 ≥2 个对象且未全部同属一组时
              显示「编组」；选中集合中含已编组成员时显示「解组」（两者可能同时出现——如选中一个
              独立组内成员追加一个组外对象，此时点编组会把两者合并为新组，点解组只解开已有组的
              那部分，语义均以 groupSelected/ungroupSelected 内部过滤为准）。 */}
          {(() => {
            const sel = items.filter((it) => selected.has(it.id));
            const anyGrouped = sel.some((it) => getGroupId(it) != null);
            const allSameGroup =
              sel.length >= 2 && sel.every((it) => getGroupId(it) != null && getGroupId(it) === getGroupId(sel[0]!));
            return (
              <>
                {selected.size >= 2 && !allSameGroup && (
                  <Button data-testid="wm-group" size="sm" variant="ghost" aria-label="编组" onClick={() => void groupSelected()}>
                    编组
                  </Button>
                )}
                {anyGrouped && (
                  <Button data-testid="wm-ungroup" size="sm" variant="ghost" aria-label="解组" onClick={() => void ungroupSelected()}>
                    解组
                  </Button>
                )}
              </>
            );
          })()}
            </>
          )}
          {/* uc-widget-menu-008 主流程 2：对象被锁定时删除入口隐藏或不可用；全部选中项锁定时
              置灰（其余情况——含混合——仍可删，未锁定的会被删除，锁定的保留，见 deleteSelected）。 */}
          <Button
            data-testid="wm-delete"
            size="sm"
            variant="ghost"
            className="text-destructive"
            disabled={allSelectedLocked}
            title={allSelectedLocked ? "锁定组件不可删除，请先解锁" : undefined}
            onClick={() => void deleteSelected()}
          >
            删除
          </Button>
          {/* p6:F20（uc-widget-menu-003）：锁定/解锁。锁定态入口只保留「解锁」（主流程 4：
              锁定后菜单只显示锁定状态入口）；未锁定显示「锁定」。多选混合锁定态时，仍显示单一
              入口，文案取「解锁」当且仅当全部已锁定（与 toggleLocked 的批量语义一致），否则显示
              「锁定」（点击会把混合态统一收敛为全部锁定，业务规则 6 的批量锁定）。 */}
          {(() => {
            const sel = items.filter((it) => selected.has(it.id));
            const anyLocked = sel.some(getLocked);
            const mixed = anyLocked && !allSelectedLocked;
            return allSelectedLocked ? (
              <Button
                data-testid="wm-unlock"
                size="sm"
                variant="ghost"
                aria-label="解锁组件"
                onClick={() => void toggleLocked()}
              >
                解锁
              </Button>
            ) : (
              <Button
                data-testid="wm-lock"
                size="sm"
                variant="ghost"
                aria-label="锁定组件"
                title={mixed ? "选中项锁定状态不一致，点击将全部锁定" : undefined}
                onClick={() => void toggleLocked()}
              >
                锁定
              </Button>
            );
          })()}
        </div>
      )}

      {/* p6:F19（uc-widget-menu-010 主流程 2）：取样模式提示条——用户点击「应用格式」后进入，
          可连续点击目标应用同一格式，直到 Esc/切工具/点空白外的退出动作（主流程 6/7）。 */}
      {formatSource && (
        <div
          data-testid="format-paint-indicator"
          className="absolute left-1/2 top-24 z-30 flex -translate-x-1/2 items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-xs shadow-lg"
        >
          <Paintbrush className="h-3.5 w-3.5" />
          <span>格式刷已就绪：点击目标文本/便利贴应用样式（Esc 退出）</span>
          <Button data-testid="wm-apply-format-exit" size="sm" variant="ghost" onClick={exitFormatPaint}>
            退出
          </Button>
        </div>
      )}

      {/* uc-board-menu-007 / uc-board-menu-012：图表模式点击画布、或点击橡皮擦入口时的
          「暂不可用」反馈条（p6:F18 图表 / p6:F17 手绘擦除均未实现）。3 秒后自动收起，
          避免和格式刷提示条一样常驻挡住画布；用户切工具/按 Esc 时也会被清空（见 onKey/chooseTool）。 */}
      {notice && (
        <div
          data-testid="board-menu-notice"
          role="status"
          className="absolute left-1/2 top-24 z-30 -translate-x-1/2 rounded-md border bg-card px-3 py-1.5 text-xs shadow-lg"
        >
          {notice}
        </div>
      )}

      <CanvasViewport
        onViewportChange={setVp}
        underlay={
          <FabricCanvas
            items={renderItems}
            selectedIds={selectedIdList}
            editingId={editingId}
            canEdit={canEdit}
            viewport={vp}
            onSelectionChange={onFabricSelection}
            onEmptyPointerDown={onEmptyPointerDown}
            onMoveCommit={(moves) => void onMoveCommit(moves)}
            onResizeCommit={(r) => void onResizeCommit(r)}
            onEditRequest={onEditRequest}
            onCtxMenu={onFabricCtxMenu}
            onGuides={setGuides}
            onSpacing={setSpacings}
            onOperating={onOperating}
            connectorPickMode={activeTool === "connector"}
            onConnectorPick={onConnectorPick}
            drawMode={activeTool === "draw" && canEdit}
            onDrawCreated={(pts) => void onDrawCreated(pts)}
            erasePickMode={activeTool === "eraser" && canEdit}
            onErasePick={onErasePick}
          />
        }
      >
        {/* DOM 覆盖层（items 本体已由 fabric 渲染）：对齐参考线 / 文本编辑框 / 重载徽标。
            pointer-events 关闭（编辑框除外），指针事件落到下方 fabric canvas。 */}
        <div className="pointer-events-none relative h-full w-full" data-testid="items-layer">
          {/* F11：双击编辑文字 → DOM textarea 覆盖层（锚点 item-edit-<id> 不变），
              画布坐标系与 item 重合；编辑中 fabric 隐藏该 item 文字。 */}
          {editingItem && (
            <div
              className="absolute z-20"
              style={{ left: editingItem.x, top: editingItem.y, width: editingItem.w, height: editingItem.h }}
            >
              <textarea
                data-testid={`item-edit-${editingItem.id}`}
                autoFocus
                defaultValue={editingItem.text}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                onBlur={(e) => void saveText(editingItem.id, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    (e.target as HTMLTextAreaElement).blur();
                  }
                }}
                className={
                  "pointer-events-auto h-full w-full resize-none rounded bg-transparent p-2 text-xs text-foreground outline-none ring-2 ring-primary focus-visible:ring-2 focus-visible:ring-primary " +
                  (isBold(editingItem) ? "font-bold " : "") +
                  (isText(editingItem) ? "text-left" : "text-center")
                }
              />
            </div>
          )}

          {/* uc-widget-menu-009：可刷新组件的重载可见反馈（重载次数徽标）。刷新中显示旋转态。 */}
          {items.filter(isReloadable).map((it) => (
            <span
              key={`reload-${it.id}`}
              data-testid={`widget-reloaded-${it.id}`}
              data-reload-count={reload[it.id]?.count ?? 0}
              className="pointer-events-none absolute z-10 flex items-center gap-0.5 rounded-full bg-primary px-1.5 py-0.5 text-10 font-medium text-primary-foreground shadow"
              style={{ left: it.x + it.w - 10, top: it.y - 8 }}
            >
              <RefreshCw className={"h-2.5 w-2.5 " + (refreshing.has(it.id) ? "animate-spin" : "")} />
              {reload[it.id]?.count ?? 0}
            </span>
          ))}

          {/* 对齐参考线（uc-canvas-007）：拖动触发吸附时显示，与 item 同处画布坐标系。 */}
          {guides.map((g, i) => (
            <div
              key={`${g.orientation}-${g.pos}-${i}`}
              data-testid="alignment-guide"
              data-orientation={g.orientation}
              aria-hidden
              className="pointer-events-none absolute z-10 bg-primary"
              style={
                g.orientation === "v"
                  ? { left: g.pos, top: -4000, height: 8000, width: 1 }
                  : { top: g.pos, left: -4000, width: 8000, height: 1 }
              }
            />
          ))}

          {/* p6:F07 等间距提示：拖动形成等间距时，每段间隙画间距线 + 间距值徽标；释放后消失。 */}
          {spacings.flatMap((sp, i) =>
            sp.segs.map((seg, j) => (
              <div key={`spacing-${i}-${j}`}>
                <div
                  aria-hidden
                  className="pointer-events-none absolute z-10 bg-primary/60"
                  style={
                    sp.orientation === "h"
                      ? { left: seg.from, top: seg.cross, width: seg.to - seg.from, height: 1 }
                      : { left: seg.cross, top: seg.from, width: 1, height: seg.to - seg.from }
                  }
                />
                <div
                  data-testid="spacing-hint"
                  data-orientation={sp.orientation}
                  data-gap={Math.round(sp.gap)}
                  className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded bg-primary px-1 py-0.5 text-10 font-medium text-primary-foreground shadow"
                  style={
                    sp.orientation === "h"
                      ? { left: (seg.from + seg.to) / 2, top: seg.cross }
                      : { left: seg.cross, top: (seg.from + seg.to) / 2 }
                  }
                >
                  {Math.round(sp.gap)}
                </div>
              </div>
            )),
          )}
        </div>
      </CanvasViewport>

      {/* 右键上下文菜单（p7:F14，uc-context-menu-001~004）：按当前目标显示允许的操作——
          对象菜单：复制/剪切/创建副本 + 图层顺序（持久化 z，见 arrange）+ 锁定/解锁 + 删除；
          锁定对象菜单收窄（uc-001 前端入口 3）：保留复制与层级，隐藏剪切/副本/删除，锁定入口
          变为解锁；空白画布：粘贴 + 选择所有（uc-001 备选流程 1：不展示对象级动作）。
          编组/取消编组入口：依赖 p6:F21 的 groupSelected/ungroupSelected，F21 尚未合并到
          main（board-canvas 里没有编组实现），入口等 F21 合并后接线，不在本 feature 重新实现
          编组语义（见 feature notes）。 */}
      {canEdit && ctxMenu && (
        <div
          data-testid="context-menu"
          role="menu"
          style={{ position: "fixed", left: ctxMenu.x, top: ctxMenu.y }}
          className="z-30 w-36 rounded-md border bg-popover p-1 text-popover-foreground shadow-lg"
        >
          {selected.size > 0 && (
            <>
              {/* 复制不改变画布内容，锁定对象也允许（uc-001 前端入口 3）。 */}
              <button
                type="button"
                data-testid="ctx-copy"
                className="flex w-full items-center rounded px-2 py-1.5 text-left text-13 transition-colors hover:bg-muted"
                onClick={() => {
                  clipboard.current = items.filter((it) => selected.has(it.id));
                  setCtxMenu(null);
                }}
              >
                复制
              </button>
              {!allSelectedLocked && (
                <>
                  {/* uc-context-menu-002 主流程 3：剪切 = 放入待粘贴状态并从画布移除
                      （锁定项不参与——deleteSelected 本就保留锁定项，剪贴板同步排除，
                      避免"画布上还在、粘贴又多一份"的错位）。 */}
                  <button
                    type="button"
                    data-testid="ctx-cut"
                    className="flex w-full items-center rounded px-2 py-1.5 text-left text-13 transition-colors hover:bg-muted"
                    onClick={() => {
                      clipboard.current = items.filter((it) => selected.has(it.id) && !getLocked(it));
                      void deleteSelected();
                      setCtxMenu(null);
                    }}
                  >
                    剪切
                  </button>
                  <button
                    type="button"
                    data-testid="ctx-duplicate"
                    className="flex w-full items-center rounded px-2 py-1.5 text-left text-13 transition-colors hover:bg-muted"
                    onClick={() => {
                      duplicateSelected();
                      setCtxMenu(null);
                    }}
                  >
                    创建副本
                  </button>
                </>
              )}
              {/* uc-context-menu-003：调整图层顺序（z 持久化，见 arrange）。重排后关闭菜单、
                  保留选中态。锁定对象保留层级入口（uc-001 前端入口 3：锁定菜单收窄但保留层级）。 */}
              <div className="my-1 h-px bg-border" />
              <button
                type="button"
                data-testid="ctx-bring-front"
                className="flex w-full items-center rounded px-2 py-1.5 text-left text-13 transition-colors hover:bg-muted"
                onClick={() => {
                  void arrange("front");
                  setCtxMenu(null);
                }}
              >
                置于顶层
              </button>
              <button
                type="button"
                data-testid="ctx-bring-forward"
                className="flex w-full items-center rounded px-2 py-1.5 text-left text-13 transition-colors hover:bg-muted"
                onClick={() => {
                  void arrange("forward");
                  setCtxMenu(null);
                }}
              >
                上移一层
              </button>
              <button
                type="button"
                data-testid="ctx-send-backward"
                className="flex w-full items-center rounded px-2 py-1.5 text-left text-13 transition-colors hover:bg-muted"
                onClick={() => {
                  void arrange("backward");
                  setCtxMenu(null);
                }}
              >
                下移一层
              </button>
              <button
                type="button"
                data-testid="ctx-send-back"
                className="flex w-full items-center rounded px-2 py-1.5 text-left text-13 transition-colors hover:bg-muted"
                onClick={() => {
                  void arrange("back");
                  setCtxMenu(null);
                }}
              >
                置于底层
              </button>
              <div className="my-1 h-px bg-border" />
              {/* uc-context-menu-004 主流程 5/6：锁定/解锁（复用 p6:F20 的 toggleLocked 批量
                  语义：全部已锁定 → 解锁；否则（含混合）→ 全部锁定）。 */}
              {allSelectedLocked ? (
                <button
                  type="button"
                  data-testid="ctx-unlock"
                  className="flex w-full items-center rounded px-2 py-1.5 text-left text-13 transition-colors hover:bg-muted"
                  onClick={() => {
                    void toggleLocked();
                    setCtxMenu(null);
                  }}
                >
                  解锁
                </button>
              ) : (
                <button
                  type="button"
                  data-testid="ctx-lock"
                  className="flex w-full items-center rounded px-2 py-1.5 text-left text-13 transition-colors hover:bg-muted"
                  onClick={() => {
                    void toggleLocked();
                    setCtxMenu(null);
                  }}
                >
                  锁定
                </button>
              )}
              {!allSelectedLocked && (
                <button
                  type="button"
                  data-testid="ctx-delete"
                  className="flex w-full items-center rounded px-2 py-1.5 text-left text-13 text-destructive transition-colors hover:bg-muted"
                  onClick={() => {
                    void deleteSelected();
                    setCtxMenu(null);
                  }}
                >
                  删除
                </button>
              )}
            </>
          )}
          <button
            type="button"
            data-testid="ctx-paste"
            className="flex w-full items-center rounded px-2 py-1.5 text-left text-13 transition-colors hover:bg-muted disabled:opacity-40"
            disabled={clipboard.current.length === 0}
            title={clipboard.current.length === 0 ? "剪贴板暂无可粘贴内容" : undefined}
            onClick={() => {
              void pasteClipboard();
              setCtxMenu(null);
            }}
          >
            粘贴
          </button>
          {/* uc-context-menu-001 前端入口 2：空白画布级动作（无目标时不展示对象级动作）。 */}
          {selected.size === 0 && (
            <button
              type="button"
              data-testid="ctx-select-all"
              className="flex w-full items-center rounded px-2 py-1.5 text-left text-13 transition-colors hover:bg-muted"
              onClick={() => {
                setSelected(new Set(items.map((it) => it.id)));
                setCtxMenu(null);
              }}
            >
              选择所有
            </button>
          )}
        </div>
      )}

      {/* F01（uc-board-ai-001）：底部悬浮工具 dock + AI 浮层/board chat 面板，对齐
          docs/design/boardx-prototype-v1.bundle.html 的 Board 屏。仅编辑者可见操作类 dock；
          AI 浮层对所有可查看者可用（就画布内容提问不要求编辑权限）。 */}
      {canEdit && (
        <BoardBottomDock
          activeTool={activeTool}
          onSelectTool={chooseDockTool}
          aiOpen={aiOpen}
          onToggleAi={() => setAiOpen((prev) => !prev)}
        />
      )}
      <BoardAiOverlay boardId={boardId} itemCount={items.length} open={aiOpen} onOpenChange={setAiOpen} />
    </div>
  );
}
