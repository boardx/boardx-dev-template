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
import type { Canvas, Group, TPointerEventInfo, TPointerEvent } from "fabric";
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
  kind: "note" | "text" | "shape" | "embed";
  bold: boolean;
  reloadable: boolean;
  reloadCount: number;
  refreshedAt: number | null;
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
  onEmptyPointerDown: () => void;
  onMoveCommit: (moves: ItemMove[]) => void;
  onResizeCommit: (resize: ItemResize) => void;
  onEditRequest: (id: string) => void;
  onCtxMenu: (pos: { x: number; y: number }, itemId: string | null) => void;
  onGuides: (guides: Guide[]) => void;
  onSpacing: (hints: SpacingHint[]) => void;
  onOperating: (operating: boolean) => void;
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

// 画布坐标命中测试（顶层优先 = items 数组末尾优先，与 z-order 一致）。
function hitTest(items: RenderItem[], p: { x: number; y: number }): string | null {
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i]!;
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
    bold: boolean;
    reloadable: boolean;
    reloadCount: number;
    refreshedAt: number | null;
    z: number;
  }>;
  getSelectedIds: () => string[];
  getItemScreenRect: (id: string) => { x: number; y: number; width: number; height: number } | null;
  getCanvasBlankScreenPoint: () => { x: number; y: number } | null;
  getFabricObjectCount: () => number;
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
        // 视觉签名变化 → 重建对象（items 数量小，重建比细粒度增量更新简单且不易漏）。
        const sig = JSON.stringify([
          it.x, it.y, it.w, it.h, it.text, it.color, it.kind, it.bold,
          s.editingId === it.id, s.canEdit,
        ]);
        let g = objsRef.current.get(it.id);
        if (g && objectSigRef.current.get(g) !== sig) {
          fc.remove(g);
          g = undefined;
        }
        if (!g) {
          g = buildItemObject(fabric, tokens, it, s.editingId === it.id, s.canEdit);
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
      if (!sameStringSet(getActiveObjectIds(fc, objectItemIdRef.current), s.selectedIds)) {
        fc.discardActiveObject();
        if (sel.length === 1) {
          fc.setActiveObject(sel[0]!);
        } else if (sel.length > 1) {
          const as = new fabric.ActiveSelection(sel, { canvas: fc });
          styleInteractive(as, tokensRef.current!, s.canEdit);
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
        const e = opt.e as MouseEvent;
        const target = opt.target as Group | undefined;
        const fcNow = fcRef.current;
        if (!fcNow) return;
        const scene = fcNow.getScenePoint(e);
        const hitId = hitTest(s.items, scene);

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
        } else {
          // 空白：清除选择/关闭菜单；不阻断冒泡 → CanvasViewport 照常拖拽平移。
          s.onEmptyPointerDown();
        }
      });

      fc.on("object:moving", (opt) => {
        const s = propsRef.current;
        const g = gestureRef.current;
        const t = opt.target as Group | undefined;
        if (!g || !t || !s.canEdit) return;
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
              bold: it.bold,
              reloadable: it.reloadable,
              reloadCount: it.reloadCount,
              refreshedAt: it.refreshedAt,
              z,
            })),
          getSelectedIds: () => [...propsRef.current.selectedIds],
          getItemScreenRect: (id: string) => {
            const it = propsRef.current.items.find((x) => x.id === id);
            const fcNow = fcRef.current;
            if (!it || !fcNow) return null;
            return itemToScreenRect(fcNow, propsRef.current.viewport, it);
          },
          getCanvasBlankScreenPoint: () => {
            const fcNow = fcRef.current;
            if (!fcNow) return null;
            return findCanvasBlankScreenPoint(fcNow, propsRef.current.viewport, propsRef.current.items);
          },
          getFabricObjectCount: () => fcRef.current?.getObjects().length ?? 0,
        };
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

type Interactive = {
  set: (opts: Record<string, unknown>) => unknown;
};

// 交互属性：选中框（border）颜色对齐 ring-primary；无旋转控制点。
// p6:F07：单选 item 开放四个**角点**缩放控制（缩放中吸附见 object:scaling）；
// 中点控制与多选（ActiveSelection）缩放仍关闭，锁定能力 deferred。
function styleInteractive(obj: Interactive, tokens: Tokens, canEdit: boolean, resizable = false) {
  const resize = resizable && canEdit;
  obj.set({
    hasControls: resize,
    hasBorders: true,
    borderColor: tokens.primary,
    borderScaleFactor: 2,
    padding: 2,
    lockRotation: true,
    lockScalingX: !resize,
    lockScalingY: !resize,
    lockMovementX: !canEdit,
    lockMovementY: !canEdit,
    hoverCursor: canEdit ? "grab" : "default",
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
  const bg = new fabric.Rect({
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
    stroke: isTextKind ? undefined : tokens.borderStrong,
    strokeWidth: isTextKind ? 0 : isShapeKind ? 2 : 1,
    strokeUniform: true,
  });
  const pad = 8; // p-2
  const text = new fabric.Textbox(it.text, {
    width: Math.max(8, it.w - pad * 2),
    fontSize: 12, // text-xs
    lineHeight: 1.35,
    fontFamily: tokens.fontFamily,
    fontWeight: it.bold ? "700" : "400",
    fill: tokens.foreground,
    textAlign: isTextKind ? "left" : "center",
    splitByGrapheme: true, // 中文无空格也按字素折行
    editable: false, // 文本编辑走 DOM textarea 覆盖层（保留 item-edit-<id> 锚点）
    ...(isTextKind
      ? { left: pad, top: pad, originX: "left" as const, originY: "top" as const }
      : { left: it.w / 2, top: it.h / 2, originX: "center" as const, originY: "center" as const }),
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
  });
  styleInteractive(g as unknown as Interactive, tokens, canEdit, true);
  return g;
}
