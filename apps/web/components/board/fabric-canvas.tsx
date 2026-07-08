"use client";
// fabric-canvas.tsx — 画布渲染引擎（p6:F13）：item 的渲染与交互跑在 fabric.Canvas 上。
//
// 架构定位（见 packages/canvas 顶注）：数据权威是 React 状态（REST 持久化 +
// @repo/canvas 字段级 patch 命令），fabric 对象只是**渲染适配器**——
// props（items/selected/editing）单向驱动 reconcile；用户在画布上的手势
// （点选/Shift 多选/拖拽/双击）经 fabric 事件回调给上层，转成既有的命令与落库路径。
//
// 视口方案：CanvasViewport 仍持有 pan/zoom 状态（CSS transform 的 surface 承载
// DOM 覆盖层与 collab data-vp-* 锚点）；本组件把同一视口镜像到 fabric 的
// viewportTransform，canvas 元素自身 1:1 铺满视口（不随 CSS transform 移动，
// 避免平移后内容超出 canvas 像素区被裁剪，指针坐标换算也由 fabric 原生完成）。
//
// SSR：fabric 仅客户端可用，在 useEffect 内动态 import。
import { useEffect, useMemo, useRef } from "react";
import type { Canvas, FabricObject, Group, TPointerEventInfo, TPointerEvent } from "fabric";
import {
  computeResizeSnap,
  computeSnap,
  computeSpacingSnap,
  type Guide,
  type ResizeCorner,
  type SpacingHint,
} from "@/lib/canvas-snap";

export interface RenderItem {
  id: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  color: string | null;
  kind: "note" | "text" | "shape" | "embed" | "connector" | "draw" | "chart";
  bold: boolean;
  // p6:F12（uc-widget-menu-013）：文本样式字段，均由 color 的 "|k=v" 段解析而来。
  italic: boolean;
  fontFamily: string;
  fontSize: number;
  align: "left" | "center" | "right";
  // p6:F19（uc-widget-menu-002）：边框色/边框宽（含线宽语义）/透明度/文字色，同样由 color 的
  // "|k=v" 段解析而来（见 board-canvas.tsx 的 getBorder/getBorderWidth/getOpacity/getTextColor）。
  border: "none" | "gray" | "blue" | "red";
  borderWidth: number;
  opacity: number;
  textColor: "default" | "slate" | "blue" | "green" | "red";
  // p6:F15（uc-widgets-004）：具体形状种类，由 color 的 "|shape=xxx" 段解析而来（见
  // board-canvas.tsx 的 getShapeType）。仅 kind === "shape" 时有意义，其余 kind 恒为 "rect"。
  shapeType: "rect" | "rounded" | "circle" | "triangle" | "diamond" | "hexagon";
  reloadable: boolean;
  reloadCount: number;
  refreshedAt: number | null;
  // p6:F20（uc-widget-menu-003）：锁定态，由 color 的 "|locked=1" 段解析而来（见
  // board-canvas.tsx 的 getLocked）。锁定对象不可移动/缩放/旋转/编辑，见 styleInteractive。
  locked: boolean;
  // p6:F16（uc-widgets-005 + uc-widget-menu-012）：连接线专属几何/样式，仅 kind === "connector"
  // 时有意义。fromId/toId 为 null 表示该端为自由端点（未连接到任何组件），此时使用
  // fromPoint/toPoint 的画布坐标作为端点。绑定端点由渲染层每次 reconcile 时按当前的源/目标
  // 组件矩形重算最近边中点（纯几何，不持久化具体坐标），跟随移动天然生效。
  connector?: {
    fromId: string | null;
    toId: string | null;
    fromPoint: { x: number; y: number } | null;
    toPoint: { x: number; y: number } | null;
    line: "straight" | "curve";
    arrow: "none" | "end" | "both";
    stroke: string;
    strokeWidth: number;
  };
  // p6:F17（uc-widgets-006）：手绘笔迹点序列（item 局部坐标，相对 x/y），由 text 字段的
  // JSON（{"points":[[x,y],...]}）解析而来。仅 kind === "draw" 时有意义。渲染时按当前 w/h
  // 与点集原始包围盒的比例线性缩放（缩放组件时笔迹跟随）。
  drawPoints?: Array<{ x: number; y: number }> | null;
  // p6:F18（uc-widgets-008）：图表数据，由 text 字段的 JSON 解析而来；null = 数据无效
  // （渲染失败反馈，UC 异常流程 1）。仅 kind === "chart" 时有意义。
  chart?: { labels: string[]; values: number[] } | null;
}

export interface ViewportState {
  tx: number;
  ty: number;
  scale: number;
}

export interface ItemMove {
  id: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

// p6:F07 组件缩放提交（单选角点缩放，缩放中吸附见 object:scaling）。
export interface ItemResize {
  id: string;
  from: { x: number; y: number; w: number; h: number };
  to: { x: number; y: number; w: number; h: number };
}

interface Props {
  items: RenderItem[];
  selectedIds: string[];
  editingId: string | null;
  canEdit: boolean;
  viewport: ViewportState;
  onSelectionChange: (ids: string[]) => void;
  // 空白按下（scenePoint 为画布坐标，供图表模式在点击处创建组件，p6:F18）。
  onEmptyPointerDown: (scenePoint?: { x: number; y: number }) => void;
  onMoveCommit: (moves: ItemMove[]) => void;
  onResizeCommit: (resize: ItemResize) => void;
  onEditRequest: (id: string) => void;
  onCtxMenu: (pos: { x: number; y: number }, itemId: string | null) => void;
  onGuides: (guides: Guide[]) => void;
  onSpacing: (hints: SpacingHint[]) => void;
  onOperating: (operating: boolean) => void;
  // p6:F16（uc-widgets-005 主流程 1-3）：连接线创建模式——true 时点击一次选定起点（组件或
  // 空白处的自由端点），再点击一次选定终点即建连（两次独立点击，不做拖拽预览）。
  // 之前尝试过"按住拖拽 + mouse:move 实时预览线"的交互，会在拖拽过程中往 fabric 画布上加
  // 临时预览对象，观测到会连带影响 fabric 自身对其它对象的目标命中判定（具体机制未查清，
  // 但复现稳定），换成更简单的两次点击可完全绕开，避免在同一个诡异 bug 上无限延伸调试。
  connectorPickMode: boolean;
  onConnectorPick: (itemId: string | null, scenePoint: { x: number; y: number }) => void;
  // p6:F17（uc-widgets-006）：手绘模式——true 时开启 fabric 原生 isDrawingMode（PencilBrush），
  // 一次画笔手势结束（path:created）后把笔迹点序列（画布坐标）回调给上层持久化，临时 path
  // 对象立即从画布移除（持久化后的 item 经 reconcile 正式渲染）。
  // 注意：不采用「mouse:move 手写预览临时对象」的自研方案——那条路径此前被观测到会破坏
  // fabric 对其它对象的命中判定（见 connectorPickMode 注释的真实事故）；isDrawingMode 是
  // fabric 原生绘制通道，不往对象树里加临时预览对象。
  drawMode: boolean;
  onDrawCreated: (points: Array<{ x: number; y: number }>) => void;
  // p6:F17（uc-board-menu-012）：橡皮擦模式——点击一次即报告命中的 item（上层判定是否为
  // 手绘笔迹并删除），交互模式同 connectorPickMode 的单击拾取。
  erasePickMode: boolean;
  onErasePick: (itemId: string | null) => void;
}

type FabricNS = typeof import("fabric");

// 主题 token（globals.css 的 HSL 变量）→ 真实颜色值，canvas 无法用 tailwind class。
interface Tokens {
  foreground: string;
  primary: string;
  borderStrong: string;
  surface1: string;
  tags: Record<string, string>;
  fontFamily: string;
}

function readTokens(): Tokens {
  const cs = getComputedStyle(document.documentElement);
  const hsl = (name: string) => `hsl(${cs.getPropertyValue(name).trim()})`;
  return {
    foreground: hsl("--foreground"),
    primary: hsl("--primary"),
    borderStrong: hsl("--border-strong"),
    surface1: hsl("--surface-1"),
    // 色 key 为持久化数据（见 board-canvas COLORS 注释）：amber=tag-yellow。
    tags: {
      amber: hsl("--tag-yellow"),
      blue: hsl("--tag-blue"),
      green: hsl("--tag-green"),
      pink: hsl("--tag-pink"),
    },
    fontFamily: getComputedStyle(document.body).fontFamily || "sans-serif",
  };
}

// 点到线段的最短距离（连接线命中测试用——连接线的包围盒经常大幅覆盖其绑定的两个组件
// 之间的空白区域，若沿用矩形包围盒命中会"抢走"本该落在组件上的点击，见 p6:F16 回归）。
function pointToSegmentDistance(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq)) : 0;
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.hypot(p.x - projX, p.y - projY);
}

// 画布坐标命中测试（顶层优先 = items 数组末尾优先，与 z-order 一致）。
// p6:F16：连接线不用矩形包围盒命中（包围盒常年横跨两个被连组件之间的大片空白，会抢走
// 本该落在组件本体上的点击），改用「指针到线段的距离 ≤ 命中容差」精确判定。
const CONNECTOR_HIT_TOLERANCE = 6;
function hitTest(items: RenderItem[], p: { x: number; y: number }): string | null {
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i]!;
    if (it.kind === "connector" && it.connector) {
      const { from, to } = resolveConnectorEndpoints(it.connector, items);
      if (it.connector.line === "curve") {
        // 曲线：用直线中点+真实弯曲中点+两端点组成的折线近似（4 点 3 段），足够满足点击命中精度。
        const mid = connectorMidpoint(from, to, "curve");
        const hit =
          pointToSegmentDistance(p, from, mid) <= CONNECTOR_HIT_TOLERANCE ||
          pointToSegmentDistance(p, mid, to) <= CONNECTOR_HIT_TOLERANCE;
        if (hit) return it.id;
      } else if (pointToSegmentDistance(p, from, to) <= CONNECTOR_HIT_TOLERANCE) {
        return it.id;
      }
      continue;
    }
    if (p.x >= it.x && p.x <= it.x + it.w && p.y >= it.y && p.y <= it.y + it.h) return it.id;
  }
  return null;
}

// e2e 测试锚点（策略 2，issue #269）：DOM item 锚点消失后，测试经 window.__canvasTestApi
// 读取渲染层状态、计算 <canvas> 上的点击坐标。仅非生产环境暴露。
export interface CanvasTestApi {
  engine: "fabric";
  getItems: () => Array<{
    id: string;
    type: string;
    x: number;
    y: number;
    w: number;
    h: number;
    text: string;
    color: string | null;
    kind: "note" | "text" | "shape" | "embed" | "connector" | "draw" | "chart";
    bold: boolean;
    italic: boolean;
    fontFamily: string;
    fontSize: number;
    align: "left" | "center" | "right";
    border: "none" | "gray" | "blue" | "red";
    borderWidth: number;
    opacity: number;
    textColor: "default" | "slate" | "blue" | "green" | "red";
    shapeType: "rect" | "rounded" | "circle" | "triangle" | "diamond" | "hexagon";
    reloadable: boolean;
    reloadCount: number;
    refreshedAt: number | null;
    locked: boolean;
    z: number;
  }>;
  getSelectedIds: () => string[];
  getItemScreenRect: (id: string) => { x: number; y: number; width: number; height: number } | null;
  getCanvasBlankScreenPoint: () => { x: number; y: number } | null;
  getFabricObjectCount: () => number;
  // p6:F16：连接线当前实际渲染的端点画布坐标（跟随源/目标组件移动后的最新值），
  // 供 e2e 断言「组件移动后连接线跟随」而不依赖内部私有状态。
  getConnectorEndpoints: (id: string) => { from: { x: number; y: number }; to: { x: number; y: number } } | null;
}

declare global {
  interface Window {
    __canvasTestApi?: CanvasTestApi;
  }
}

export function FabricCanvas(props: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const fcRef = useRef<Canvas | null>(null);
  const nsRef = useRef<FabricNS | null>(null);
  const tokensRef = useRef<Tokens | null>(null);
  const objsRef = useRef<Map<string, Group>>(new Map());
  const objectSigRef = useRef<WeakMap<Group, string>>(new WeakMap());
  const objectItemIdRef = useRef<WeakMap<Group, string>>(new WeakMap());
  // 拖拽手势：mouse:down（有 target）→ object:moving（吸附）→ object:modified（提交 move）。
  // 位置提交走纯 delta 数学（items 初始位 + fabric 位移），不读 fabric 的绝对坐标，
  // 避免 group 描边外扩 / ActiveSelection 相对坐标带来的漂移。
  const gestureRef = useRef<{
    moved: boolean;
    scaled: boolean; // p6:F07：本手势是角点缩放（object:scaling 置位），提交走 onResizeCommit
    ids: string[];
    init: Record<string, { x: number; y: number }>;
    initRect: { x: number; y: number; w: number; h: number } | null; // 单选手势的初始矩形（缩放用）
    lastRect: { x: number; y: number; w: number; h: number } | null; // 缩放中最近一次吸附后的矩形（提交用）
    downScene: { x: number; y: number }; // mouse:down 的画布坐标（缩放的指针意图基准）
    initLeft: number;
    initTop: number;
  } | null>(null);
  const pendingReconcileRef = useRef(false);

  // 最新 props 快照，供 fabric 事件处理器读取（处理器只绑定一次）。
  const propsRef = useRef(props);
  propsRef.current = props;

  const reconcile = useMemo(() => {
    return function reconcile() {
      const fc = fcRef.current;
      const fabric = nsRef.current;
      const tokens = tokensRef.current;
      if (!fc || !fabric || !tokens) return;
      // 拖拽进行中不重建对象（否则 fabric 正在拖的对象被移除，手势断裂）；结束后补跑。
      if (gestureRef.current) {
        pendingReconcileRef.current = true;
        return;
      }
      const s = propsRef.current;

      const seen = new Set<string>();
      s.items.forEach((it, z) => {
        // p6:F16：连接线的视觉签名还依赖绑定的源/目标组件当前矩形（跟随移动的关键——
        // 源/目标移动时它们自身的 sig 变了，但连接线本身的 x/y/w/h/text/color 未变，
        // 若不把锚点矩形也计入 sig，连接线不会因对端移动而重建，导致视觉上不跟随）。
        const anchorSig =
          it.kind === "connector" && it.connector
            ? [it.connector.fromId, it.connector.toId].map((id) => {
                const a = id ? s.items.find((x) => x.id === id) : undefined;
                return a ? [a.x, a.y, a.w, a.h] : null;
              })
            : null;
        // 视觉签名变化 → 重建对象（items 数量小，重建比细粒度增量更新简单且不易漏）。
        const sig = JSON.stringify([
          it.x, it.y, it.w, it.h, it.text, it.color, it.kind, it.bold, it.locked,
          s.editingId === it.id, s.canEdit, anchorSig,
        ]);
        let g = objsRef.current.get(it.id);
        if (g && objectSigRef.current.get(g) !== sig) {
          fc.remove(g);
          g = undefined;
        }
        if (!g) {
          g =
            it.kind === "connector" && it.connector
              ? buildConnectorObject(fabric, tokens, it, s.items, s.canEdit)
              : it.kind === "draw"
                ? buildDrawObject(fabric, tokens, it, s.canEdit)
                : it.kind === "chart"
                  ? buildChartObject(fabric, tokens, it, s.canEdit)
                  : buildItemObject(fabric, tokens, it, s.editingId === it.id, s.canEdit);
          objectSigRef.current.set(g, sig);
          objectItemIdRef.current.set(g, it.id);
          fc.add(g);
          objsRef.current.set(it.id, g);
        }
        fc.moveObjectTo(g, z); // z-order：items 数组顺序即绘制顺序（同 DOM 时代语义）
        seen.add(it.id);
      });
      for (const [id, g] of objsRef.current) {
        if (!seen.has(id)) {
          fc.remove(g);
          objsRef.current.delete(id);
        }
      }

      // 选中态：React selected 是唯一权威 → 映射为 activeObject / ActiveSelection（选中框由 fabric 绘制）。
      const sel = s.selectedIds
        .map((id) => objsRef.current.get(id))
        .filter((o): o is Group => Boolean(o));
      // issue#316：仅当 fabric 当前 active 集合与 React 权威选中集不一致时才重建，
      // 避免每次 reconcile 无条件 discardActiveObject 造成非拖拽态选中框闪烁。
      // （被选中对象因 sig 变化重建时，fc.remove 会把它从 active 集合剔除 → 集合
      // 必然与 selectedIds 不一致 → 仍会走重建分支，不会漏选。）
      if (!sameStringSet(getActiveObjectIds(fc, objectItemIdRef.current), s.selectedIds)) {
        fc.discardActiveObject();
        if (sel.length === 1) {
          fc.setActiveObject(sel[0]!);
        } else if (sel.length > 1) {
          const as = new fabric.ActiveSelection(sel, { canvas: fc });
          // p6:F20：多选时若任一成员锁定，整组按锁定处理——fabric 把 ActiveSelection 当整体拖拽，
          // 子对象各自的 lockMovementX/Y 不生效，必须在组一级也挡住（object:moving 的补充防线
          // 覆盖极端时序，这里是主防线）。
          const selectedIds = new Set(s.selectedIds);
          const anyLocked = s.items.some((it) => selectedIds.has(it.id) && it.locked);
          styleInteractive(as, tokensRef.current!, s.canEdit, false, anyLocked);
          fc.setActiveObject(as);
        }
      }
      fc.requestRenderAll();
    };
  }, []);

  // 初始化 fabric.Canvas（仅客户端；StrictMode 双挂载安全）。
  useEffect(() => {
    let disposed = false;
    let ro: ResizeObserver | null = null;
    let fc: Canvas | null = null;

    (async () => {
      const fabric = await import("fabric");
      const host = hostRef.current;
      if (disposed || !host) return;
      nsRef.current = fabric;
      tokensRef.current = readTokens();

      const el = document.createElement("canvas");
      el.setAttribute("data-testid", "board-fabric-canvas");
      host.appendChild(el);
      fc = new fabric.Canvas(el, {
        // marquee 框选禁用：空白处拖拽 = 视口平移（与 DOM 时代一致，框选 deferred）。
        selection: false,
        // p6:F07 角点缩放：两轴独立跟随指针（fabric 默认等比缩放会让宽高联动，
        // 移动边无法精确对齐参考线）；按住 Shift（uniScaleKey）仍可临时等比。
        uniformScaling: false,
        preserveObjectStacking: true,
        renderOnAddRemove: false,
        fireRightClick: true,
        stopContextMenu: true, // 右键菜单由上层的 context-menu DOM 组件接管
      });
      if (disposed) {
        void fc.dispose();
        return;
      }
      fcRef.current = fc;

      const resize = () => {
        if (!fc || !host.isConnected) return;
        fc.setDimensions({ width: host.clientWidth, height: host.clientHeight });
        applyViewport();
        fc.requestRenderAll();
      };
      const applyViewport = () => {
        const { tx, ty, scale } = propsRef.current.viewport;
        fc?.setViewportTransform([scale, 0, 0, scale, tx, ty]);
      };
      ro = new ResizeObserver(resize);
      ro.observe(host);
      resize();

      // ── 手势事件 ───────────────────────────────────────────────────────────
      fc.on("mouse:down", (opt: TPointerEventInfo<TPointerEvent>) => {
        const s = propsRef.current;
        // p6:F17：手绘模式下所有指针事件交给 fabric 原生 PencilBrush 处理（isDrawingMode），
        // 不做命中/选中/平移逻辑（否则绘制起笔会误触发选中态变化）。
        if (s.drawMode) return;
        const e = opt.e as MouseEvent;
        const target = opt.target as Group | undefined;
        const fcNow = fcRef.current;
        if (!fcNow) return;
        const scene = fcNow.getScenePoint(e);
        const hitId = hitTest(s.items, scene);
        const hitConnector = hitId ? s.items.find((it) => it.id === hitId && it.kind === "connector") : undefined;

        // p6:F17（uc-board-menu-012）：橡皮擦模式——单击拾取命中对象，上层判定是否为手绘
        // 笔迹并删除（stroke 级删除）；不进入拖拽/选中路径。
        if (s.erasePickMode && s.canEdit && e.button === 0) {
          e.stopPropagation();
          s.onErasePick(hitId);
          return;
        }

        // p6:F16（uc-widgets-005 主流程 2-3）：连接线创建模式——点击一次即选定一个端点（组件
        // 或空白处的自由端点），不做拖拽手势/实时预览（两次独立点击，见 onConnectorPick）。
        if (s.connectorPickMode && s.canEdit && e.button === 0) {
          e.stopPropagation();
          s.onConnectorPick(hitId, scene);
          return;
        }
        if (e.button === 2) {
          // 右键：选中命中对象并请求上下文菜单（空白处也开菜单，含粘贴），不参与拖拽/平移。
          if (!s.canEdit) return;
          s.onCtxMenu({ x: e.clientX, y: e.clientY }, hitId);
          return;
        }
        if (target) {
          // 命中 item（或 ActiveSelection）：阻断视口平移，开始（潜在的）拖拽手势。
          e.stopPropagation();
          const asObjs =
            "getObjects" in target && !objectItemIdRef.current.get(target)
              ? (target as unknown as { getObjects: () => Group[] }).getObjects()
              : null;
          const ids = asObjs
            ? asObjs.map((o) => objectItemIdRef.current.get(o)).filter((x): x is string => Boolean(x))
            : objectItemIdRef.current.get(target)
              ? [objectItemIdRef.current.get(target)!]
              : [];
          const init: Record<string, { x: number; y: number }> = {};
          for (const it of s.items) if (ids.includes(it.id)) init[it.id] = { x: it.x, y: it.y };
          const single = ids.length === 1 ? s.items.find((it) => it.id === ids[0]) : undefined;
          gestureRef.current = {
            moved: false,
            scaled: false,
            ids,
            init,
            initRect: single ? { x: single.x, y: single.y, w: single.w, h: single.h } : null,
            lastRect: null,
            downScene: { x: scene.x, y: scene.y },
            initLeft: target.left ?? 0,
            initTop: target.top ?? 0,
          };
          if (hitId) {
            if (e.shiftKey) {
              // Shift 多选：翻转命中项的选中态（与 DOM selectItem(id, additive) 一致）。
              const next = s.selectedIds.includes(hitId)
                ? s.selectedIds.filter((x) => x !== hitId)
                : [...s.selectedIds, hitId];
              s.onSelectionChange(next);
            } else if (!s.selectedIds.includes(hitId)) {
              s.onSelectionChange([hitId]);
            }
          }
          if (s.canEdit) s.onOperating(true); // uc-collab-001：开始操作
        } else if (hitConnector) {
          // p6:F16：连接线的 fabric Group 包围盒（由子对象绝对画布坐标算出）与其视觉细线并不
          // 贴合，fabric 自身的默认目标检测经常判定"未命中任何对象"（target 为 undefined）——
          // 这里用我们自己的精确命中测试（hitTest 对连接线做「指针到线段距离」判定）兜底：
          // 命中了连接线但 fabric 没找到 target 时，仍按"命中一个可选中对象"处理（当前版本
          // 连接线本体不支持整体拖拽，只支持点击选中——端点拖拽重连是后续增量，故不建立
          // gestureRef，只做选中状态切换，避免拖拽路径缺失手柄而行为不完整）。
          e.stopPropagation();
          if (e.shiftKey) {
            const next = s.selectedIds.includes(hitId!)
              ? s.selectedIds.filter((x) => x !== hitId)
              : [...s.selectedIds, hitId!];
            s.onSelectionChange(next);
          } else if (!s.selectedIds.includes(hitId!)) {
            s.onSelectionChange([hitId!]);
          }
        } else {
          // 空白：清除选择/关闭菜单；不阻断冒泡 → CanvasViewport 照常拖拽平移。
          // scenePoint 供图表模式在点击处创建组件（p6:F18）。
          s.onEmptyPointerDown({ x: scene.x, y: scene.y });
        }
      });

      // p6:F17：一次画笔手势结束——fabric PencilBrush 在画布上留下临时 fabric.Path，这里
      // 提取路径命令里的点序列（画布坐标）回调上层持久化，并立即移除临时对象（持久化后的
      // item 会经 reconcile 以受控方式重建，避免画布上残留一份不受 items 驱动的孤儿对象）。
      fc.on("path:created", (opt) => {
        const s = propsRef.current;
        const path = (opt as { path?: FabricObject }).path;
        const fcNow = fcRef.current;
        if (path && fcNow) fcNow.remove(path);
        fcNow?.requestRenderAll();
        if (!path || !s.drawMode || !s.canEdit) return;
        const raw = (path as unknown as { path?: Array<Array<string | number>> }).path ?? [];
        const pts: Array<{ x: number; y: number }> = [];
        for (const cmd of raw) {
          // 路径命令（M/L/Q/C…）的最后两个数即该命令的终点坐标；对笔迹持久化而言取每段
          // 终点足够还原轨迹（控制点是 fabric 平滑的派生值，不需要存）。
          if (cmd.length >= 3) {
            const x = Number(cmd[cmd.length - 2]);
            const y = Number(cmd[cmd.length - 1]);
            if (Number.isFinite(x) && Number.isFinite(y)) pts.push({ x, y });
          }
        }
        if (pts.length >= 2) s.onDrawCreated(pts);
      });

      fc.on("object:moving", (opt) => {
        const s = propsRef.current;
        const g = gestureRef.current;
        const t = opt.target as Group | undefined;
        if (!g || !t || !s.canEdit) return;
        // p6:F20（uc-widget-menu-003）：锁定对象不可移动。单选对象已由 styleInteractive 的
        // lockMovementX/Y 从源头挡住（fabric 不会派发本事件）；这里补一道防线覆盖多选场景
        // （ActiveSelection 的拖拽由分组本身响应，子对象各自的 lockMovementX/Y 不生效）。
        if (g.ids.some((id) => s.items.find((it) => it.id === id)?.locked)) {
          t.set({ left: g.initLeft, top: g.initTop });
          t.setCoords();
          return;
        }
        g.moved = true;
        // 候选位置 = 初始 item 位置 + fabric 位移（纯 delta，见 gestureRef 注释）。
        const dx = (t.left ?? 0) - g.initLeft;
        const dy = (t.top ?? 0) - g.initTop;
        const leadId = g.ids[0];
        const lead = leadId ? s.items.find((it) => it.id === leadId) : undefined;
        if (!lead) return;
        const dragged =
          g.ids.length === 1
            ? { x: lead.x + dx, y: lead.y + dy, w: lead.w, h: lead.h }
            : selectionBBox(s.items, g.ids, dx, dy);
        const others = s.items
          .filter((it) => !g.ids.includes(it.id))
          .map((it) => ({ x: it.x, y: it.y, w: it.w, h: it.h }));
        const { snapDX, snapDY, guides } = computeSnap(dragged, others);
        // p6:F07 等间距：某轴未发生边/中心吸附时，检测等间距吸附并给出间距提示。
        const xAligned = guides.some((g) => g.orientation === "v");
        const yAligned = guides.some((g) => g.orientation === "h");
        const spacing = computeSpacingSnap(
          { x: dragged.x + snapDX, y: dragged.y + snapDY, w: dragged.w, h: dragged.h },
          others,
        );
        const adjX = snapDX + (xAligned ? 0 : spacing.snapDX);
        const adjY = snapDY + (yAligned ? 0 : spacing.snapDY);
        const hints = spacing.hints.filter((h) =>
          h.orientation === "h" ? !xAligned : !yAligned,
        );
        if (adjX || adjY) {
          t.set({ left: (t.left ?? 0) + adjX, top: (t.top ?? 0) + adjY });
          t.setCoords();
        }
        s.onGuides(guides);
        s.onSpacing(hints);
      });

      // p6:F07 角点缩放吸附：移动中的边接近邻居的边/中心时吸附并显示参考线。
      // 尺寸由**指针意图**决定：以 mouse:down 的 scene 坐标为基准的指针位移直接推
      // 目标矩形（fabric 原生 scale 含描边/padding 偏差，未拖动的轴也会漂移 ~1px，
      // 不采用），吸附后反推 scaleX/scaleY 写回 fabric 对象。
      fc.on("object:scaling", (opt) => {
        const s = propsRef.current;
        const g = gestureRef.current;
        const t = opt.target as Group | undefined;
        const corner = (opt as { transform?: { corner?: string } }).transform?.corner;
        const fcNow = fcRef.current;
        if (!g || !t || !s.canEdit || !g.initRect || !fcNow) return;
        if (corner !== "tl" && corner !== "tr" && corner !== "bl" && corner !== "br") return;
        // p6:F20：锁定对象不可缩放。缩放仅对单选开放（见 styleInteractive 的 hasControls），
        // 正常路径下锁定对象已在源头被 lockScalingX/Y 挡住，这里是防御性补充。
        if (g.ids.some((id) => s.items.find((it) => it.id === id)?.locked)) return;
        g.scaled = true;
        const it = g.initRect;
        const scene = fcNow.getScenePoint((opt as unknown as { e: TPointerEvent }).e);
        const dx = scene.x - g.downScene.x;
        const dy = scene.y - g.downScene.y;
        let x = it.x;
        let y = it.y;
        let w = it.w;
        let h = it.h;
        if (corner.includes("l")) {
          x = it.x + dx;
          w = it.w - dx;
        } else {
          w = it.w + dx;
        }
        if (corner.includes("t")) {
          y = it.y + dy;
          h = it.h - dy;
        } else {
          h = it.h + dy;
        }
        const others = s.items
          .filter((i) => !g.ids.includes(i.id))
          .map((i) => ({ x: i.x, y: i.y, w: i.w, h: i.h }));
        const { snapDX, snapDY, guides } = computeResizeSnap({ x, y, w, h }, others, corner as ResizeCorner);
        // 吸附增量作用在移动边上：l/t 角点还需同步平移原点。
        if (snapDX && corner.includes("l")) {
          x += snapDX;
          w -= snapDX;
        } else if (snapDX) {
          w += snapDX;
        }
        if (snapDY && corner.includes("t")) {
          y += snapDY;
          h -= snapDY;
        } else if (snapDY) {
          h += snapDY;
        }
        // 最小尺寸钳制（8px），l/t 角点缩到底时固定对侧边。
        if (w < 8) {
          if (corner.includes("l")) x = it.x + it.w - 8;
          w = 8;
        }
        if (h < 8) {
          if (corner.includes("t")) y = it.y + it.h - 8;
          h = 8;
        }
        t.set({
          left: g.initLeft + (x - it.x),
          top: g.initTop + (y - it.y),
          scaleX: w / it.w,
          scaleY: h / it.h,
        });
        t.setCoords();
        g.lastRect = { x, y, w, h };
        s.onGuides(guides);
      });

      fc.on("object:modified", (opt) => {
        const s = propsRef.current;
        const g = gestureRef.current;
        const t = opt.target as Group | undefined;
        if (!g || !t) return;
        // p6:F07 缩放提交：终态矩形取缩放中最近一次吸附后的 lastRect，整数化后走字段级落库。
        if (g.scaled && g.initRect && g.lastRect && g.ids.length === 1) {
          const it = g.initRect;
          const to = {
            x: Math.round(g.lastRect.x),
            y: Math.round(g.lastRect.y),
            w: Math.round(g.lastRect.w),
            h: Math.round(g.lastRect.h),
          };
          s.onGuides([]);
          s.onSpacing([]);
          s.onResizeCommit({ id: g.ids[0]!, from: { ...it }, to });
          return;
        }
        if (!g.moved) return;
        const dx = (t.left ?? 0) - g.initLeft;
        const dy = (t.top ?? 0) - g.initTop;
        const moves: ItemMove[] = g.ids
          .filter((id) => g.init[id])
          .map((id) => {
            const f = g.init[id]!;
            return { id, fromX: f.x, fromY: f.y, toX: f.x + dx, toY: f.y + dy };
          });
        s.onGuides([]);
        s.onSpacing([]);
        if (moves.length) s.onMoveCommit(moves);
      });

      fc.on("mouse:up", (opt: TPointerEventInfo<TPointerEvent>) => {
        const s = propsRef.current;
        const g = gestureRef.current;
        gestureRef.current = null;
        s.onOperating(false);
        s.onGuides([]);
        s.onSpacing([]);
        if (g && !g.moved) {
          // 纯点击（未拖动）：非 Shift 时收敛为单选（DOM 时代 click 的非叠加选择语义）。
          const e = opt.e as MouseEvent;
          const fcNow = fcRef.current;
          if (fcNow && !e.shiftKey && e.button === 0) {
            const hitId = hitTest(s.items, fcNow.getScenePoint(e));
            if (hitId) s.onSelectionChange([hitId]);
          }
        }
        if (pendingReconcileRef.current) {
          pendingReconcileRef.current = false;
          reconcile();
        }
      });

      fc.on("mouse:dblclick", (opt: TPointerEventInfo<TPointerEvent>) => {
        const s = propsRef.current;
        if (!s.canEdit) return;
        const fcNow = fcRef.current;
        if (!fcNow) return;
        const hitId = hitTest(s.items, fcNow.getScenePoint(opt.e));
        if (hitId) s.onEditRequest(hitId);
      });

      // ── e2e 测试 API（仅非生产环境）──────────────────────────────────────
      if (process.env.NODE_ENV !== "production" && !disposed && fcRef.current) {
        window.__canvasTestApi = {
          engine: "fabric",
          getItems: () =>
            propsRef.current.items.map((it, z) => ({
              id: it.id,
              type: it.type,
              x: it.x,
              y: it.y,
              w: it.w,
              h: it.h,
              text: it.text,
              color: it.color,
              kind: it.kind,
              bold: it.bold,
              italic: it.italic,
              fontFamily: it.fontFamily,
              fontSize: it.fontSize,
              align: it.align,
              border: it.border,
              borderWidth: it.borderWidth,
              opacity: it.opacity,
              textColor: it.textColor,
              shapeType: it.shapeType,
              reloadable: it.reloadable,
              reloadCount: it.reloadCount,
              refreshedAt: it.refreshedAt,
              locked: it.locked,
              z,
            })),
          getSelectedIds: () => [...propsRef.current.selectedIds],
          getItemScreenRect: (id: string) => {
            const it = propsRef.current.items.find((x) => x.id === id);
            const fcNow = fcRef.current;
            if (!it || !fcNow) return null;
            // p6:F16：连接线是线段而非矩形——测试锚点需要一个"点击后能真正命中线体"的屏幕矩形，
            // 直接用两端点包围盒的话，中心点（既有 clickItem 的点击目标）多数情况落在线外
            // （斜线的包围盒中心并不在线上）。改为返回以线段中点为中心的一个小矩形，
            // 使 clickItem/itemScreenRect 的既有"点击中心"逻辑对连接线同样成立。
            if (it.kind === "connector" && it.connector) {
              const { from, to } = resolveConnectorEndpoints(it.connector, propsRef.current.items);
              const { x: mx, y: my } = connectorMidpoint(from, to, it.connector.line);
              const size = 10;
              return itemToScreenRect(fcNow, propsRef.current.viewport, {
                x: mx - size / 2,
                y: my - size / 2,
                w: size,
                h: size,
              });
            }
            return itemToScreenRect(fcNow, propsRef.current.viewport, it);
          },
          getCanvasBlankScreenPoint: () => {
            const fcNow = fcRef.current;
            if (!fcNow) return null;
            return findCanvasBlankScreenPoint(fcNow, propsRef.current.viewport, propsRef.current.items);
          },
          getFabricObjectCount: () => fcRef.current?.getObjects().length ?? 0,
          getConnectorEndpoints: (id: string) => {
            const it = propsRef.current.items.find((x) => x.id === id);
            if (!it || it.kind !== "connector" || !it.connector) return null;
            return resolveConnectorEndpoints(it.connector, propsRef.current.items);
          },
        };
      }

      // p6:F17：fabric 异步加载完成时手绘模式可能已激活（用户先点了手绘按钮），补一次同步
      // （上面的 drawMode effect 在 fc 为 null 时空跑过，不会再触发）。
      if (propsRef.current.drawMode) {
        fc.isDrawingMode = true;
        const brush = new fabric.PencilBrush(fc);
        brush.color = "#334155";
        brush.width = 3;
        fc.freeDrawingBrush = brush;
      }

      reconcile();
    })();

    return () => {
      disposed = true;
      ro?.disconnect();
      if (process.env.NODE_ENV !== "production") delete window.__canvasTestApi;
      const c = fcRef.current;
      fcRef.current = null;
      objsRef.current.clear();
      objectSigRef.current = new WeakMap();
      objectItemIdRef.current = new WeakMap();
      // dispose 会移除 fabric 包装 DOM；异步竞态下（import 未完成即卸载）无 canvas 可清。
      void c?.dispose();
      if (hostRef.current) hostRef.current.innerHTML = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // props 变化 → 同步 fabric 对象。
  useEffect(() => {
    reconcile();
  }, [reconcile, props.items, props.selectedIds, props.editingId, props.canEdit]);

  // p6:F17：手绘模式开关 → fabric 原生 isDrawingMode + PencilBrush（fabric v7 不再默认创建
  // freeDrawingBrush，需显式实例化）。笔迹外观：深灰 3px（与持久化默认 borderw=3 一致，
  // 绘制中的即时视觉 ≈ 落库后的最终视觉）。
  useEffect(() => {
    const fc = fcRef.current;
    const fabric = nsRef.current;
    if (!fc || !fabric) return;
    fc.isDrawingMode = props.drawMode;
    if (props.drawMode) {
      const brush = new fabric.PencilBrush(fc);
      brush.color = "#334155";
      brush.width = 3;
      fc.freeDrawingBrush = brush;
    }
  }, [props.drawMode]);

  // 视口变化 → 镜像到 fabric viewportTransform。
  useEffect(() => {
    const fc = fcRef.current;
    if (!fc) return;
    fc.setViewportTransform([
      props.viewport.scale, 0, 0, props.viewport.scale, props.viewport.tx, props.viewport.ty,
    ]);
    fc.requestRenderAll();
  }, [props.viewport]);

  return <div ref={hostRef} data-testid="fabric-host" className="absolute inset-0" />;
}

function sameStringSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const seen = new Set(a);
  return b.every((x) => seen.has(x));
}

function getActiveObjectIds(fc: Canvas, itemIds: WeakMap<Group, string>): string[] {
  const active = fc.getActiveObject() as Group | undefined;
  if (!active) return [];
  if ("getObjects" in active && !itemIds.get(active)) {
    return (active as unknown as { getObjects: () => Group[] })
      .getObjects()
      .map((o) => itemIds.get(o))
      .filter((x): x is string => Boolean(x));
  }
  const id = itemIds.get(active);
  return id ? [id] : [];
}

function itemToScreenRect(
  fc: Canvas,
  viewport: ViewportState,
  it: Pick<RenderItem, "x" | "y" | "w" | "h">,
): { x: number; y: number; width: number; height: number } {
  const rect = fc.getElement().getBoundingClientRect();
  return {
    x: rect.left + viewport.tx + it.x * viewport.scale,
    y: rect.top + viewport.ty + it.y * viewport.scale,
    width: it.w * viewport.scale,
    height: it.h * viewport.scale,
  };
}

function screenToScene(
  fc: Canvas,
  viewport: ViewportState,
  p: { x: number; y: number },
): { x: number; y: number } {
  const rect = fc.getElement().getBoundingClientRect();
  return {
    x: (p.x - rect.left - viewport.tx) / viewport.scale,
    y: (p.y - rect.top - viewport.ty) / viewport.scale,
  };
}

function findCanvasBlankScreenPoint(
  fc: Canvas,
  viewport: ViewportState,
  items: RenderItem[],
): { x: number; y: number } | null {
  const rect = fc.getElement().getBoundingClientRect();
  const margin = 24;
  const xs = [
    rect.left + rect.width - 30,
    rect.left + 30,
    rect.left + rect.width / 2,
    rect.left + rect.width * 0.25,
    rect.left + rect.width * 0.75,
  ];
  const ys = [
    rect.top + 18,
    rect.top + rect.height / 2,
    rect.top + rect.height * 0.25,
    rect.top + rect.height * 0.75,
  ];
  for (const y of ys) {
    if (y < rect.top + margin || y > rect.bottom - margin) continue;
    for (const x of xs) {
      if (x < rect.left + margin || x > rect.right - margin) continue;
      if (!hitTest(items, screenToScene(fc, viewport, { x, y }))) return { x, y };
    }
  }
  return null;
}

// 多选拖拽时以整体包围盒作为吸附主体（单选时用被拖 item 本身，见调用处）。
function selectionBBox(
  items: RenderItem[],
  ids: string[],
  dx: number,
  dy: number,
): { x: number; y: number; w: number; h: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const it of items) {
    if (!ids.includes(it.id)) continue;
    minX = Math.min(minX, it.x);
    minY = Math.min(minY, it.y);
    maxX = Math.max(maxX, it.x + it.w);
    maxY = Math.max(maxY, it.y + it.h);
  }
  return { x: minX + dx, y: minY + dy, w: maxX - minX, h: maxY - minY };
}

// p6:F16（uc-widgets-005）：连接线端点几何。绑定到组件的一端不存具体坐标，而是每次
// reconcile 时按当前组件矩形重算——这样组件移动/缩放时连接线天然跟随（纯几何，无需
// 额外监听）。锚点算法：取目标矩形四条边中点里离对端最近的一个（比"固定挂某条边"更贴合
// 「组件移动时连接线自然改向」的直觉，也不依赖 oldcode 的多端口模型，成本更低）。
function rectEdgeMidpoints(r: { x: number; y: number; w: number; h: number }) {
  return [
    { x: r.x + r.w / 2, y: r.y }, // 上
    { x: r.x + r.w / 2, y: r.y + r.h }, // 下
    { x: r.x, y: r.y + r.h / 2 }, // 左
    { x: r.x + r.w, y: r.y + r.h / 2 }, // 右
  ];
}
function nearestAnchor(r: { x: number; y: number; w: number; h: number }, toward: { x: number; y: number }) {
  const pts = rectEdgeMidpoints(r);
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

// 解析连接线的实际端点：绑定组件时按当前矩形动态重算最近锚点；自由端点用存储的画布坐标。
function resolveConnectorEndpoints(
  conn: NonNullable<RenderItem["connector"]>,
  items: RenderItem[],
): { from: { x: number; y: number }; to: { x: number; y: number } } {
  const fromItem = conn.fromId ? items.find((i) => i.id === conn.fromId) : undefined;
  const toItem = conn.toId ? items.find((i) => i.id === conn.toId) : undefined;
  // 先取对端的粗略参考点（另一端矩形中心，或自由端点坐标）决定"朝向"，再各自选最近边锚点。
  const toRoughRef = toItem
    ? { x: toItem.x + toItem.w / 2, y: toItem.y + toItem.h / 2 }
    : (conn.toPoint ?? { x: 0, y: 0 });
  const fromRoughRef = fromItem
    ? { x: fromItem.x + fromItem.w / 2, y: fromItem.y + fromItem.h / 2 }
    : (conn.fromPoint ?? { x: 0, y: 0 });
  const from = fromItem ? nearestAnchor(fromItem, toRoughRef) : (conn.fromPoint ?? { x: 0, y: 0 });
  const to = toItem ? nearestAnchor(toItem, fromRoughRef) : (conn.toPoint ?? { x: 0, y: 0 });
  return { from, to };
}

// 连接线路径上的中点（曲线时按渲染同款的法线外扩公式算出真实弯曲中点，而非两端点的直线
// 中点——直线中点在曲线上通常不落在线体本身，命中测试/测试锚点都需要这个真实中点）。
function connectorMidpoint(
  from: { x: number; y: number },
  to: { x: number; y: number },
  line: "straight" | "curve",
): { x: number; y: number } {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  if (line !== "curve") return { x: mx, y: my };
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const bend = len * 0.18;
  // 二次贝塞尔在 t=0.5 处的点 = 0.25*from + 0.5*control + 0.25*to（control = 直线中点 + 法线外扩）。
  const cx = mx + nx * bend;
  const cy = my + ny * bend;
  return { x: 0.25 * from.x + 0.5 * cx + 0.25 * to.x, y: 0.25 * from.y + 0.5 * cy + 0.25 * to.y };
}

// p6:F16（uc-widget-menu-012）：箭头三角形几何——按线段末端方向角计算三角形三个顶点
// （思路参考 oldcode canvasx-main 的 arrowhead 绘制：以终点为顶点，沿线方向反向展开两翼）。
function arrowheadPoints(tip: { x: number; y: number }, angle: number, size: number) {
  const spread = Math.PI / 7; // 翼展角度
  const back = angle + Math.PI;
  return [
    tip,
    { x: tip.x + size * Math.cos(back - spread), y: tip.y + size * Math.sin(back - spread) },
    { x: tip.x + size * Math.cos(back + spread), y: tip.y + size * Math.sin(back + spread) },
  ];
}

type Interactive = {
  set: (opts: Record<string, unknown>) => unknown;
};

// 交互属性：选中框（border）颜色对齐 ring-primary；无旋转控制点。
// p6:F07：单选 item 开放四个**角点**缩放控制（缩放中吸附见 object:scaling）；
// 中点控制与多选（ActiveSelection）缩放仍关闭。
// p6:F20（uc-widget-menu-003）：锁定对象不可移动/缩放/旋转——等价于把 canEdit 当作 false
// 对待（locked 与 !canEdit 共用同一套 fabric 锁定标志），额外去掉控制点（hasControls）避免
// 用户看到可拖拽的缩放手柄却拖不动。
function styleInteractive(obj: Interactive, tokens: Tokens, canEdit: boolean, resizable = false, locked = false) {
  const interactive = canEdit && !locked;
  const resize = resizable && interactive;
  obj.set({
    hasControls: resize,
    hasBorders: true,
    borderColor: tokens.primary,
    borderScaleFactor: 2,
    padding: 2,
    lockRotation: true,
    lockScalingX: !resize,
    lockScalingY: !resize,
    lockMovementX: !interactive,
    lockMovementY: !interactive,
    hoverCursor: interactive ? "grab" : "default",
    moveCursor: "grabbing",
    cornerColor: tokens.primary,
    cornerStrokeColor: tokens.primary,
    transparentCorners: false,
    cornerSize: 8,
    touchCornerSize: 16,
  });
  if (resize) {
    (obj as unknown as { setControlsVisibility: (v: Record<string, boolean>) => void }).setControlsVisibility({
      mt: false,
      mb: false,
      ml: false,
      mr: false,
      mtr: false,
    });
  }
}

// p6:F15（uc-widgets-004）：按具体形状类型构建局部坐标系 [0,w]x[0,h] 内的背景对象。
// 三角形/菱形/六边形的顶点坐标按单位框架给出再乘以 w/h（随 item 尺寸线性缩放），
// 不依赖固定路径数据，缩放（object:scaling → scaleX/scaleY）时形状自然跟随。
function buildShapePath(
  fabric: FabricNS,
  shapeType: RenderItem["shapeType"],
  w: number,
  h: number,
  style: { fill: string; stroke: string | undefined; strokeWidth: number },
): FabricObject {
  const common = {
    left: 0,
    top: 0,
    originX: "left" as const,
    originY: "top" as const,
    fill: style.fill,
    stroke: style.stroke,
    strokeWidth: style.strokeWidth,
    strokeUniform: true,
    strokeLineJoin: "round" as const,
  };
  switch (shapeType) {
    case "circle":
      return new fabric.Ellipse({ ...common, rx: w / 2, ry: h / 2 });
    case "rounded":
      return new fabric.Rect({ ...common, width: w, height: h, rx: Math.min(w, h) * 0.2, ry: Math.min(w, h) * 0.2 });
    case "triangle":
      return new fabric.Polygon(
        [
          { x: w / 2, y: 0 },
          { x: w, y: h },
          { x: 0, y: h },
        ],
        common,
      );
    case "diamond":
      return new fabric.Polygon(
        [
          { x: w / 2, y: 0 },
          { x: w, y: h / 2 },
          { x: w / 2, y: h },
          { x: 0, y: h / 2 },
        ],
        common,
      );
    case "hexagon":
      return new fabric.Polygon(
        [
          { x: w * 0.29, y: 0 },
          { x: w * 0.71, y: 0 },
          { x: w, y: h / 2 },
          { x: w * 0.71, y: h },
          { x: w * 0.29, y: h },
          { x: 0, y: h / 2 },
        ],
        common,
      );
    case "rect":
    default:
      return new fabric.Rect({ ...common, width: w, height: h, rx: 0, ry: 0 });
  }
}

// 单个 item → fabric.Group（背景矩形 + 文本）。样式对齐 DOM 时代（F11 柔彩便签 /
// 透明文本块 / 粗边框形状），色 token 语义不变。
function buildItemObject(
  fabric: FabricNS,
  tokens: Tokens,
  it: RenderItem,
  editing: boolean,
  canEdit: boolean,
): Group {
  const isTextKind = it.kind === "text";
  const isShapeKind = it.kind === "shape";
  const base = (it.color ?? "amber").split(":")[0] || "amber";
  const fill = isTextKind
    ? "transparent"
    : isShapeKind
      ? tokens.surface1
      : tokens.tags[base] ?? tokens.tags.amber!;
  // p6:F19（uc-widget-menu-002）：用户可调边框色/边框宽（"none" 沿用原有默认描边，
  // 文本块仍保持无边框——边框是「新增」外观，不应破坏文本块的透明块视觉基线）。
  const BORDER_COLORS: Record<string, string> = { gray: "#6b7280", blue: "#2563eb", red: "#dc2626" };
  const customStroke = it.border !== "none" ? BORDER_COLORS[it.border] : undefined;
  const stroke = isTextKind ? customStroke : (customStroke ?? tokens.borderStrong);
  const strokeWidth = isTextKind
    ? customStroke
      ? it.borderWidth
      : 0
    : it.border !== "none"
      ? it.borderWidth
      : isShapeKind
        ? 2
        : 1;
  // p6:F15（uc-widgets-004）：形状 kind 按具体形状类型渲染不同的 fabric 背景对象（矩形/圆角矩形
  // 复用 fabric.Rect；圆形用 fabric.Ellipse 按 w/h 独立缩放；三角形/菱形/六边形用 fabric.Polygon，
  // 点坐标按 [0,w]x[0,h] 的局部框架给出，随 item 尺寸线性缩放，无需为每种形状单独维护路径数据）。
  const bg = isShapeKind
    ? buildShapePath(fabric, it.shapeType, it.w, it.h, { fill, stroke, strokeWidth })
    : new fabric.Rect({
        // fabric v7 默认 origin 改为 center/center，这里的局部布局按 left/top 语义写死
        left: 0,
        top: 0,
        originX: "left",
        originY: "top",
        width: it.w,
        height: it.h,
        rx: isTextKind ? 0 : 7,
        ry: isTextKind ? 0 : 7,
        fill,
        stroke,
        strokeWidth,
        strokeUniform: true,
      });
  const pad = 8; // p-2
  // p6:F12（uc-widget-menu-013）：字体/字号/斜体/对齐均可由用户调整，取值来自 RenderItem
  // （由 color 的 "|k=v" 样式段解析而来）。水平对齐（left/center/right）独立于 kind 的默认
  // 垂直布局：文本块沿用原「顶对齐」，便签/形状沿用原「垂直居中」，只有水平锚点随 align 变化。
  const textAlign = it.align;
  const horizOrigin =
    textAlign === "center"
      ? { originX: "center" as const, left: it.w / 2 }
      : textAlign === "right"
        ? { originX: "right" as const, left: it.w - pad }
        : { originX: "left" as const, left: pad };
  // p6:F19（uc-widget-menu-002）：文字色独立于底色/tag 色，未设置（"default"）跟随主题前景色
  // （与既有视觉一致）。
  const TEXT_COLORS: Record<string, string> = {
    slate: "#334155",
    blue: "#2563eb",
    green: "#16a34a",
    red: "#dc2626",
  };
  const textFill = TEXT_COLORS[it.textColor] ?? tokens.foreground;
  const text = new fabric.Textbox(it.text, {
    width: Math.max(8, it.w - pad * 2),
    fontSize: it.fontSize,
    lineHeight: 1.35,
    fontFamily: it.fontFamily === "sans-serif" ? tokens.fontFamily : it.fontFamily,
    fontWeight: it.bold ? "700" : "400",
    fontStyle: it.italic ? "italic" : "normal",
    fill: textFill,
    textAlign,
    splitByGrapheme: true, // 中文无空格也按字素折行
    editable: false, // 文本编辑走 DOM textarea 覆盖层（保留 item-edit-<id> 锚点）
    ...(isTextKind ? { top: pad, originY: "top" as const } : { top: it.h / 2, originY: "center" as const }),
    ...horizOrigin,
  });
  // 编辑中：隐藏 canvas 文本，避免与 DOM textarea 双重显示（背景仍由 fabric 画）。
  text.visible = !editing;

  const g = new fabric.Group([bg, text], {
    left: it.x,
    top: it.y,
    originX: "left",
    originY: "top",
    subTargetCheck: false,
    selectable: true,
    // p6:F19（uc-widget-menu-002 透明度）：整体透明度，1-100 映射为 fabric 的 0-1 opacity。
    opacity: it.opacity / 100,
  });
  styleInteractive(g as unknown as Interactive, tokens, canEdit, true, it.locked);
  return g;
}

// p6:F17（uc-widgets-006）：手绘笔迹渲染。points 为 item 局部坐标（相对 x/y，创建时已归一化
// 到以包围盒左上角为原点），按当前 w/h 与点集原始包围盒的比例线性缩放（object:scaling →
// w/h 落库后重建，笔迹随组件缩放自然拉伸）。笔色/线宽复用 border/borderWidth 字段
// （"none" = 默认深灰墨色——笔迹始终需要可见描边，语义同连接线的 stroke 默认色）。
const DRAW_STROKE_COLORS: Record<string, string> = {
  none: "#334155",
  gray: "#6b7280",
  blue: "#2563eb",
  red: "#dc2626",
};
function buildDrawObject(fabric: FabricNS, tokens: Tokens, it: RenderItem, canEdit: boolean): Group {
  const pts = it.drawPoints ?? [];
  const stroke = DRAW_STROKE_COLORS[it.border] ?? DRAW_STROKE_COLORS.none!;
  let body: FabricObject;
  if (pts.length >= 2) {
    // 原始包围盒（min 恒为 0，创建时已归一化），按当前 w/h 求缩放比。
    const origW = Math.max(1, ...pts.map((p) => p.x));
    const origH = Math.max(1, ...pts.map((p) => p.y));
    const sx = it.w / origW;
    const sy = it.h / origH;
    body = new fabric.Polyline(
      pts.map((p) => ({ x: p.x * sx, y: p.y * sy })),
      {
        left: 0,
        top: 0,
        originX: "left",
        originY: "top",
        fill: "",
        stroke,
        strokeWidth: it.borderWidth,
        strokeUniform: true,
        strokeLineCap: "round",
        strokeLineJoin: "round",
      },
    );
  } else {
    // 点序列无效（text JSON 损坏等）：画一个可选中/可删除的虚线占位框，保留对象可识别状态。
    body = new fabric.Rect({
      left: 0,
      top: 0,
      originX: "left",
      originY: "top",
      width: it.w,
      height: it.h,
      fill: "transparent",
      stroke,
      strokeWidth: 1,
      strokeDashArray: [4, 4],
      strokeUniform: true,
    });
  }
  const g = new fabric.Group([body], {
    left: it.x,
    top: it.y,
    originX: "left",
    originY: "top",
    subTargetCheck: false,
    selectable: true,
    opacity: it.opacity / 100,
  });
  styleInteractive(g as unknown as Interactive, tokens, canEdit, true, it.locked);
  return g;
}

// p6:F18（uc-widgets-008）：图表渲染——按 text 里的数据 JSON 画简单柱状图（fabric.Rect 组合 +
// 标签 Textbox），不引入图表库。数据无效时展示失败反馈占位（UC 异常流程 1：渲染失败展示
// 失败反馈并保留图表组件的可识别状态）。所有子对象用 [0,w]x[0,h] 局部坐标，随 w/h 重建重排。
function buildChartObject(fabric: FabricNS, tokens: Tokens, it: RenderItem, canEdit: boolean): Group {
  const objs: FabricObject[] = [
    new fabric.Rect({
      left: 0,
      top: 0,
      originX: "left",
      originY: "top",
      width: it.w,
      height: it.h,
      rx: 7,
      ry: 7,
      fill: tokens.surface1,
      stroke: tokens.borderStrong,
      strokeWidth: 1,
      strokeUniform: true,
    }),
  ];
  const data = it.chart;
  if (data && data.values.length > 0) {
    const pad = 12;
    const labelH = 18;
    const innerW = Math.max(8, it.w - pad * 2);
    const innerH = Math.max(8, it.h - pad * 2 - labelH);
    const n = data.values.length;
    const slot = innerW / n;
    const barW = Math.max(4, slot * 0.6);
    const maxV = Math.max(...data.values.map((v) => Math.abs(v)), 1);
    data.values.forEach((v, i) => {
      const barH = Math.max(2, (Math.abs(v) / maxV) * innerH);
      const cx = pad + slot * i + slot / 2;
      objs.push(
        new fabric.Rect({
          left: cx - barW / 2,
          top: pad + innerH - barH,
          originX: "left",
          originY: "top",
          width: barW,
          height: barH,
          rx: 2,
          ry: 2,
          fill: tokens.primary,
        }),
      );
      objs.push(
        new fabric.Textbox(String(data.labels[i] ?? ""), {
          left: cx,
          top: pad + innerH + 4,
          originX: "center",
          originY: "top",
          width: slot,
          fontSize: 11,
          fontFamily: tokens.fontFamily,
          fill: tokens.foreground,
          textAlign: "center",
          splitByGrapheme: true,
          editable: false,
        }),
      );
    });
  } else {
    // 数据无效：失败反馈（保留可识别的图表占位，可选中后经「编辑数据」修复）。
    objs.push(
      new fabric.Textbox("图表数据无效\n选中后点「编辑数据」修复", {
        left: it.w / 2,
        top: it.h / 2,
        originX: "center",
        originY: "center",
        width: Math.max(8, it.w - 16),
        fontSize: 12,
        fontFamily: tokens.fontFamily,
        fill: tokens.foreground,
        textAlign: "center",
        splitByGrapheme: true,
        editable: false,
      }),
    );
  }
  const g = new fabric.Group(objs, {
    left: it.x,
    top: it.y,
    originX: "left",
    originY: "top",
    subTargetCheck: false,
    selectable: true,
    opacity: it.opacity / 100,
  });
  styleInteractive(g as unknown as Interactive, tokens, canEdit, true, it.locked);
  return g;
}

// p6:F16（uc-widgets-005 + uc-widget-menu-012）：连接线渲染。与其它 item 不同，连接线的
// "位置"由两个端点的绝对画布坐标决定，不是一个 [x,y,w,h] 局部框——用一个 left:0/top:0 的
// Group 承载线体 + 箭头，子对象坐标直接写绝对画布坐标（简单可靠，牺牲一点 Group 变换开销）。
// 线型：straight 用直线 Path("M..L.."）；curve 用二次贝塞尔，控制点取两端点中点沿法线方向
// 外扩，弯曲程度与距离成比例（纯几何，足够表达"关系有弧度"，不需要用户可拖的控制点）。
function buildConnectorObject(
  fabric: FabricNS,
  tokens: Tokens,
  it: RenderItem,
  items: RenderItem[],
  canEdit: boolean,
): Group {
  const conn = it.connector!;
  const { from, to } = resolveConnectorEndpoints(conn, items);
  const stroke = conn.stroke;
  const strokeWidth = conn.strokeWidth;
  const objs: FabricObject[] = [];

  let pathData: string;
  let endAngle: number; // 终点处线段方向角（箭头朝向）
  let startAngle: number; // 起点处线段方向角（反向箭头朝向）
  if (conn.line === "curve") {
    const mx = (from.x + to.x) / 2;
    const my = (from.y + to.y) / 2;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    // 法线方向外扩，弯曲幅度取线长的 18%（视觉上明显区分直线，但不过分夸张）。
    const nx = -dy / len;
    const ny = dx / len;
    const bend = len * 0.18;
    const cx = mx + nx * bend;
    const cy = my + ny * bend;
    pathData = `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`;
    endAngle = Math.atan2(to.y - cy, to.x - cx);
    startAngle = Math.atan2(from.y - cy, from.x - cx);
  } else {
    pathData = `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
    endAngle = Math.atan2(to.y - from.y, to.x - from.x);
    startAngle = endAngle + Math.PI;
  }

  const path = new fabric.Path(pathData, {
    left: 0,
    top: 0,
    fill: "",
    stroke,
    strokeWidth,
    strokeUniform: true,
    selectable: false,
    evented: false,
  });
  objs.push(path);

  const arrowSize = 8 + strokeWidth * 2;
  if (conn.arrow === "end" || conn.arrow === "both") {
    const pts = arrowheadPoints(to, endAngle, arrowSize);
    objs.push(
      new fabric.Polygon(pts, {
        left: 0,
        top: 0,
        fill: stroke,
        stroke,
        strokeWidth: 1,
        selectable: false,
        evented: false,
      }),
    );
  }
  if (conn.arrow === "both") {
    const pts = arrowheadPoints(from, startAngle, arrowSize);
    objs.push(
      new fabric.Polygon(pts, {
        left: 0,
        top: 0,
        fill: stroke,
        stroke,
        strokeWidth: 1,
        selectable: false,
        evented: false,
      }),
    );
  }

  const g = new fabric.Group(objs, {
    left: 0,
    top: 0,
    originX: "left",
    originY: "top",
    subTargetCheck: false,
    selectable: true,
    hasControls: false,
    // 注意：不用 perPixelTargetFind——线体路径 fill:"" 空字符串会让 fabric 的像素级命中检测
    // 找不到目标（真实回归：点击连接线完全选不中），退回默认的包围盒命中即可；连接线的
    // 精确点击判定已经在 hitTest()（JS 侧、mouse:down/up 用）里用「指针到线段距离」单独处理，
    // fabric 自身的 target 检测只需要粗略地「知道这个区域有对象」以便触发手势，不需要精确。
  });
  styleInteractive(g as unknown as Interactive, tokens, canEdit, false, it.locked);
  return g;
}
