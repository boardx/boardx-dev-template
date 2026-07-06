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
import { setOperating } from "@/lib/collab-bus";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Cable,
  Hand,
  Image,
  LayoutTemplate,
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

type BoardTool = "select" | "pan" | "sticky" | "draw" | "text" | "connector" | "shape" | "assets" | "templates";

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

// 画布：渲染 board-keyed items（ADR-0002）+ 选择/键盘（F06）+ 复制粘贴（F08）+ 撤销/重做（F09）。
// 视口（平移/缩放/小地图）复用 CanvasViewport（F05）。marquee 框选 deferred（与拖拽平移冲突，留后续）。
//
// p6:F13 渲染引擎：item 的渲染与指针交互（选中框/拖拽/多选/双击）由 FabricCanvas
// （fabric.Canvas 适配器）承担；本组件仍是数据权威（REST 持久化 + 撤销栈 + 剪贴板），
// 周边 DOM UI（工具栏 / Widget Menu / 右键菜单 / selection-count / 参考线 / 编辑框 / 徽标）不变。
export function BoardCanvas({ boardId, canEdit }: { boardId: string; canEdit: boolean }) {
  const [items, setItems] = useState<Item[]>([]);
  // applyColors 的同步真值来源：React 的 setState(updater) 不保证 updater 在调用点同步
  // 执行（可能被推迟到下一次渲染阶段），所以不能指望"setItems(prev => ...) 内部算出的
  // 新值"能在紧接着的同步代码里读到。同一交互序列里连续调用多个样式 setter（或应用格式
  // 连续应用到多个目标）时，若各自都从 `items` state closure 读基准色，会读到过期值、
  // 后写覆盖前写（p6:F16/F21 verify 各自独立抓到的同一类真实回归）。用 ref 维护真正同步、
  // 每次 applyColors 调用后立刻前进的 items 快照，取代对 setState 时序的依赖。
  const itemsRef = useRef<Item[]>(items);
  itemsRef.current = items;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null); // F11 文本编辑中的便签
  const [activeTool, setActiveTool] = useState<BoardTool>("select");
  const [aiOpen, setAiOpen] = useState(false); // F01: Board AI 浮层/board chat 面板开关，dock 与浮层共享同一真值
  const [openPanel, setOpenPanel] = useState<"assets" | "templates" | "shape" | null>(null);
  // p6:F15（uc-widgets-004 主流程 4）：形状工具记住上次选择的形状类型，默认矩形。
  const [lastShapeType, setLastShapeType] = useState<ShapeType>(DEFAULT_SHAPE_TYPE);
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
  function queuePatch(id: string, body: Record<string, unknown>): Promise<unknown> {
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
    return next;
  }

  const clipboard = useRef<Item[]>([]); // 应用内剪贴板（F08）
  const undoStack = useRef<Op[]>([]); // F09
  const redoStack = useRef<Op[]>([]);
  // 视口快照（CanvasViewport 上报），供 fabric viewportTransform 镜像与测试 API 坐标换算。
  const [vp, setVp] = useState<ViewportState>({ tx: 0, ty: 0, scale: 1 });
  // fabric 拖拽进行中（onOperating 回调驱动）：轮询同步在拖拽中不合并服务端快照。
  const draggingRef = useRef(false);

  // p6:F19 修复：load() 用服务端快照整体覆盖 items（其它 F0x 既有行为，不改）。
  // 若此时仍有未落地的 PATCH（如样式改动后立即触发了 load，如新增组件后的 await load()），
  // 服务端快照可能还不包含最新样式，覆盖会让乐观更新「凭空消失」（真实回归，非测试假象）。
  // 先等所有排队中的 PATCH 落地，再拉取快照，保证 load() 不会撤销尚未确认的用户操作。
  const load = useCallback(async () => {
    await Promise.all(patchQueue.current.values());
    const res = await fetch(`/api/boards/${boardId}/items`);
    if (res.ok) setItems((await res.json()).items ?? []);
  }, [boardId]);

  useEffect(() => {
    void load();
  }, [load]);

  // uc-collab-001：文本编辑进行中也算「正在操作」，供他人看到「谁在操作」（editingId 存在 = 编辑中）。
  useEffect(() => {
    setOperating(editingId != null);
  }, [editingId]);

  // ── 实时协作同步（uc-canvas-005）────────────────────────────────────────
  // 轮询服务端 item 列表，让其它在线用户的新增/移动/删除在本地画布上出现，
  // 达成「在线用户看到一致的 Board 内容」（UC 后置条件 1）。
  // 只在本地无进行中编辑/拖拽时才合并服务端快照，避免打断本地操作。
  //
  // p6:F21 rebase 后回归修复：与 load()（见上方 F19 注释）同样的竞态在这里也存在，
  // 且此前未被同一套防线覆盖——本地样式改动（toggleBold/setBorder/setOpacity/应用格式…）
  // 经 queuePatch 异步落库，PATCH 尚未落地时若这个每 1.5s 跑一次的轮询恰好拿到旧服务端快照，
  // 会把 patchQueue 里还没落库的乐观更新整体覆盖回旧值（真实回归，e2e 诊断实测复现：应用格式
  // 断言 bold/border/opacity 偶发丢失，根因正是取样时读到了被本轮询覆盖的中间态源样式，而非
  // applyFormatColor/onFabricSelection 本身逻辑有误）。修法与 load() 一致：patchQueue 非空
  // （有 PATCH 在途）时，本轮跳过合并，下个 1.5s 周期再试，不覆盖尚未确认的本地操作。
  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    async function poll() {
      if (!stop && !editingId && !draggingRef.current && patchQueue.current.size === 0) {
        try {
          const res = await fetch(`/api/boards/${boardId}/items`);
          if (
            res.ok &&
            !stop &&
            !editingId &&
            !draggingRef.current &&
            patchQueue.current.size === 0
          ) {
            const next = ((await res.json()).items ?? []) as Item[];
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
      undoStack.current.push({ kind: "move", moves });
      redoStack.current = [];
      await apiMove(moves, false);
    },
    [apiMove],
  );

  // p6:F07 缩放提交：可逆 resize 命令 + PATCH 落库（吸附已在 fabric 层作用于终态尺寸）。
  const onResizeCommit = useCallback(
    async (resize: ItemResize) => {
      setItems((prev) => prev.map((it) => (it.id === resize.id ? { ...it, ...resize.to } : it)));
      setSelected(new Set([resize.id]));
      undoStack.current.push({ kind: "resize", resize });
      redoStack.current = [];
      await apiResize(resize.id, resize.to);
    },
    [apiResize],
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
      const expanded = new Set(ids);
      const itemById = new Map(items.map((it) => [it.id, it]));
      for (const id of ids) {
        const found = itemById.get(id);
        const gid = found ? getGroupId(found) : null;
        if (gid == null) continue;
        for (const it of items) {
          if (getGroupId(it) === gid) expanded.add(it.id);
        }
      }
      setSelected(expanded);
    },
    [formatSource, items, canEdit],
  );

  // 空白按下：清除选择 + 关闭右键菜单（旧 items-layer onClick 语义），随后视口照常平移。
  const onEmptyPointerDown = useCallback(() => {
    if (formatSource) return; // 取样模式下点击空白不清空选择/退出（Esc 才退出，主流程 7）
    setSelected(new Set());
    setCtxMenu(null);
  }, [formatSource]);

  const onEditRequest = useCallback(
    (id: string) => {
      // p6:F20（uc-widget-menu-003）：锁定对象不可编辑（主流程 3），双击进入编辑态短路。
      if (!canEdit) return;
      const target = items.find((it) => it.id === id);
      if (target && getLocked(target)) return;
      setEditingId(id);
    },
    [canEdit, items],
  );

  const onFabricCtxMenu = useCallback(
    (pos: { x: number; y: number }, itemId: string | null) => {
      if (!canEdit) return;
      if (itemId && !selected.has(itemId)) setSelected(new Set([itemId]));
      setCtxMenu(pos);
    },
    [canEdit, selected],
  );

  // uc-collab-001：拖拽开始/结束 → 操作态上报；同时挡住轮询合并（见 poll）。
  const onOperating = useCallback((op: boolean) => {
    draggingRef.current = op;
    setOperating(op);
  }, []);

  // fabric 渲染层的输入视图：把 color 哨兵/字重等判别预解析成渲染语义（fabric 组件不懂业务哨兵）。
  const renderItems = useMemo<RenderItem[]>(
    () =>
      items.map((it) => ({
        id: it.id,
        type: it.type,
        x: it.x,
        y: it.y,
        w: it.w,
        h: it.h,
        text: it.text,
        color: it.color ?? null,
        kind: isText(it) ? "text" : isShape(it) ? "shape" : isReloadable(it) ? "embed" : "note",
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
      })),
    [items, reload],
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
    const embedItem: Item = { ...item, color: EMBED_MARK };
    recordOp({ kind: "add", items: [embedItem] });
    await load();
    setSelected(new Set([item.id]));
  }

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
      recordOp({ kind: "move", moves });
      await apiMove(moves, false);
    },
    [canEdit, selected, items, apiMove]
  );

  const pasteClipboard = useCallback(async () => {
    if (!canEdit || clipboard.current.length === 0) return;
    const created: Item[] = [];
    for (const it of clipboard.current) {
      const res = await fetch(`/api/boards/${boardId}/items`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: it.type, x: it.x + 20, y: it.y + 20, text: it.text }),
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
    await fetch(`/api/board-items/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
  }

  // 落库一批 color 变更。compute 基于 itemsRef.current（同步真值）求值并立刻推进
  // itemsRef，而不是依赖"预先算好 updates 数组"——数组是从 `items` state closure 算的，
  // 同一交互序列连续调用多个样式 setter（或应用格式连续应用到多个目标）时，closure 可能
  // 是过期的，导致除最后一次外全部丢失（p6:F16/F21 verify 各自独立抓到的同一类真实回归，
  // 与 p6:F19 修的 queuePatch 落库乱序是同一类"并发写用了过期读"问题，只是发生在客户端
  // state 计算层，queuePatch 本身防不住）。
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

  // p6:F20（uc-widget-menu-003）：切换选中组件锁定态，编码为 color 的 "|locked=1" 样式段。
  // 多选混合锁定态时（业务规则 6：批量锁定/解锁）：若全部已锁定 → 批量解锁；否则（含未锁定
  // 或混合）→ 批量锁定，与 toggleBold 的「全真取消，否则全部置真」语义一致。
  async function toggleLocked() {
    const targets = items.filter((it) => selected.has(it.id));
    if (targets.length === 0) return;
    const allLocked = targets.every(getLocked);
    await applyColors((it) => (!selected.has(it.id) ? null : withStyle(it.color, { locked: allLocked ? null : "1" })));
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
      recordOp({ kind: "move", moves });
      await apiMove(moves, false);
    },
    [canEdit, selected, items, apiMove],
  );

  // p6:F19（uc-widget-menu-010）：进入/退出格式取样模式。仅支持单选一个文本/便签类对象作为格式来源
  // （形状/嵌入组件无文字排版语义，不作为来源，业务规则 1）。
  function startFormatPaint() {
    if (!canEdit) return;
    const sel = items.filter((it) => selected.has(it.id));
    if (sel.length !== 1) return;
    const source = sel[0]!;
    if (isShape(source) || isReloadable(source)) return;
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
    const target = itemsRef.current.find((it) => it.id === targetId);
    if (!target || isShape(target) || isReloadable(target)) return false;
    const newColor = applyFormatColor({ color: formatSource.color }, isText(target));
    await applyColors((it) => (it.id === targetId ? newColor : null));
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

  // uc-context-menu-003：调整图层顺序（z-order）。items 数组顺序即 DOM 绘制顺序，
  // 越靠后越在上层（同 z-index、position:absolute → 后绘制覆盖先绘制）。
  // 通过重排 items 数组实现「置顶/上移/下移/置底」，并保留选中态。
  // z-order 为纯客户端视图关注点（后端 item 无 order 字段），重排数组即改变遮挡关系。
  const arrange = useCallback(
    (mode: "front" | "forward" | "backward" | "back") => {
      if (!canEdit || selected.size === 0) return;
      setItems((prev) => {
        if (!prev.some((it) => selected.has(it.id))) return prev;
        const sel = prev.filter((it) => selected.has(it.id));
        const rest = prev.filter((it) => !selected.has(it.id));
        if (mode === "front") return [...rest, ...sel];
        if (mode === "back") return [...sel, ...rest];
        const next = [...prev];
        if (mode === "forward") {
          // 整体上移一层：从右往左，把每个选中项与其右侧最近的未选中项交换，
          // 保留选中项彼此相对次序。
          for (let i = next.length - 2; i >= 0; i--) {
            if (selected.has(next[i]!.id) && !selected.has(next[i + 1]!.id)) {
              [next[i], next[i + 1]] = [next[i + 1]!, next[i]!];
            }
          }
        } else {
          // 整体下移一层：从左往右，把每个选中项与其左侧最近的未选中项交换。
          for (let i = 1; i < next.length; i++) {
            if (selected.has(next[i]!.id) && !selected.has(next[i - 1]!.id)) {
              [next[i], next[i - 1]] = [next[i - 1]!, next[i]!];
            }
          }
        }
        return next;
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
        return setSelected(new Set());
      }
      const mod = e.metaKey || e.ctrlKey;
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
  }, [items, selected, deleteSelected, moveSelected, pasteClipboard, undo, redo]);

  return (
    <div className="relative flex flex-1 flex-col">
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
            <BoardMenuButton testId="board-tool-draw" label="手绘" active={false} disabled>
              <PenLine className="h-4 w-4" />
            </BoardMenuButton>
            <BoardMenuButton testId="add-text" label="文本" active={activeTool === "text"} onClick={() => void addText()}>
              <Type className="h-4 w-4" />
            </BoardMenuButton>
            <BoardMenuButton testId="board-tool-connector" label="连接线" active={false} disabled>
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
            <Button data-testid="undo" size="icon" variant="ghost" title="撤销" aria-label="撤销" onClick={() => void undo()}>
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button data-testid="redo" size="icon" variant="ghost" title="重做" aria-label="重做" onClick={() => void redo()}>
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
          {/* 颜色色板（F11）：仅对便签生效；选中项全为文本时隐藏（文本为透明块，不套柔彩色） */}
          {!items.filter((it) => selected.has(it.id)).every(isText) &&
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
          {/* uc-widget-menu-013 文本样式：字体/字号/斜体/对齐/转便利贴。仅对文本或便签生效
              （含文字的对象）；形状/嵌入组件无文字排版语义，不显示（业务规则 1）。 */}
          {(() => {
            const sel = items.filter((it) => selected.has(it.id));
            const allTextLike = sel.length > 0 && sel.every((it) => isText(it) || (!isShape(it) && !isReloadable(it)));
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
              嵌入组件（图片/文件占位）暂不开放，避免和刷新/裁剪能力冲突。 */}
          {(() => {
            const sel = items.filter((it) => selected.has(it.id));
            const eligible = sel.length > 0 && sel.every((it) => !isReloadable(it));
            if (!eligible) return null;
            const first = sel[0]!;
            const mixedBorder = !sel.every((it) => getBorder(it) === getBorder(first));
            const mixedBorderWidth = !sel.every((it) => getBorderWidth(it) === getBorderWidth(first));
            const mixedOpacity = !sel.every((it) => getOpacity(it) === getOpacity(first));
            const mixedTextColor = !sel.every((it) => getTextColor(it) === getTextColor(first));
            return (
              <>
                <select
                  data-testid="wm-border"
                  aria-label="边框色"
                  value={mixedBorder ? "" : getBorder(first)}
                  onChange={(e) => void setBorder(e.target.value as BorderToken)}
                  className="h-7 rounded-md border border-input bg-background px-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {mixedBorder && <option value="">混合</option>}
                  <option value="none">无边框</option>
                  <option value="gray">灰色</option>
                  <option value="blue">蓝色</option>
                  <option value="red">红色</option>
                </select>
                <select
                  data-testid="wm-border-width"
                  aria-label="边框/线宽"
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
              （形状/嵌入无可复用的文字排版样式，不作为来源，业务规则 1）。 */}
          {selected.size === 1 &&
            items
              .filter((it) => selected.has(it.id))
              .every((it) => !isShape(it) && !isReloadable(it)) && (
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

      {/* 右键上下文菜单（uc-context-menu-001）：复用复制/粘贴/副本/删除 */}
      {canEdit && ctxMenu && (
        <div
          data-testid="context-menu"
          role="menu"
          style={{ position: "fixed", left: ctxMenu.x, top: ctxMenu.y }}
          className="z-30 w-36 rounded-md border bg-popover p-1 text-popover-foreground shadow-lg"
        >
          {selected.size > 0 && (
            <>
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
              {/* uc-context-menu-003：调整图层顺序（z-order）。重排后关闭菜单、保留选中态。 */}
              <div className="my-1 h-px bg-border" />
              <button
                type="button"
                data-testid="ctx-bring-front"
                className="flex w-full items-center rounded px-2 py-1.5 text-left text-13 transition-colors hover:bg-muted"
                onClick={() => {
                  arrange("front");
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
                  arrange("forward");
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
                  arrange("backward");
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
                  arrange("back");
                  setCtxMenu(null);
                }}
              >
                置于底层
              </button>
              <div className="my-1 h-px bg-border" />
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
            </>
          )}
          <button
            type="button"
            data-testid="ctx-paste"
            className="flex w-full items-center rounded px-2 py-1.5 text-left text-13 transition-colors hover:bg-muted disabled:opacity-40"
            disabled={clipboard.current.length === 0}
            onClick={() => {
              void pasteClipboard();
              setCtxMenu(null);
            }}
          >
            粘贴
          </button>
          <button
            type="button"
            data-testid="ctx-lock-unavailable"
            className="flex w-full items-center rounded px-2 py-1.5 text-left text-13 text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
            disabled
            title="锁定能力将在后续组件权限矩阵接入"
          >
            锁定暂不可用
          </button>
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
