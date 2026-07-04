"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  type Viewport,
  DEFAULT_VIEWPORT,
  zoomBy,
  toPercent,
  resetViewport,
  ZOOM_IN_FACTOR,
  ZOOM_OUT_FACTOR,
} from "@/lib/viewport";
import { publishViewport, subscribeFollow } from "@/lib/collab-bus";

// 画布视口：拖拽平移 + 滚轮缩放 + 缩放控制条 + 小地图（P6 F05，纯前端，无 items 依赖）。
// uc-collab-001 协作感知增强：把本地视口上报到 collab-bus（供心跳广播给他人 → 他人可「跟随视角」），
// 并订阅跟随目标——正在跟随他人时，本地视口贴合被跟随者的视口（业务规则 2：跟随只改视角）。
//
// p6:F13 渲染引擎切换：新增 underlay 槽（fabric <canvas>，1:1 铺满视口、不吃 CSS transform）
// 与 onViewportChange 回调（把 vp 镜像到 fabric viewportTransform）。surface 仍保留
// CSS transform（承载 DOM 覆盖层：对齐参考线/编辑框/徽标 + collab 的 data-vp-* 锚点），
// 但改为 pointer-events-none，让指针事件落到下方的 fabric canvas 上再冒泡回本组件平移。
export function CanvasViewport({
  children,
  underlay,
  onViewportChange,
}: {
  children?: React.ReactNode;
  underlay?: React.ReactNode;
  onViewportChange?: (vp: Viewport) => void;
}) {
  const [vp, setVp] = useState<Viewport>(DEFAULT_VIEWPORT);
  const pan = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  // 是否正在跟随他人：跟随时本地平移/缩放操作被禁用（视角由被跟随者驱动）。
  const [following, setFollowing] = useState(false);

  // 每次本地视口变化，向 collab-bus 上报（心跳读取后广播；uc-collab-001 视角字段），
  // 并同步给渲染引擎（fabric viewportTransform，p6:F13）。
  useEffect(() => {
    publishViewport({ tx: vp.tx, ty: vp.ty, scale: vp.scale });
    onViewportChange?.(vp);
  }, [vp, onViewportChange]);

  // 订阅跟随目标：有目标 → 贴合其视口并进入跟随态；null → 退出跟随。
  useEffect(() => {
    return subscribeFollow((target) => {
      if (!target) {
        setFollowing(false);
        return;
      }
      setFollowing(true);
      setVp({ tx: target.viewport.tx, ty: target.viewport.ty, scale: target.viewport.scale });
    });
  }, []);

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    if (following) return; // 跟随中：视角由被跟随者驱动，忽略本地缩放
    setVp((v) => ({ ...v, scale: zoomBy(v.scale, e.deltaY < 0 ? ZOOM_IN_FACTOR : ZOOM_OUT_FACTOR) }));
  }
  function onDown(e: React.MouseEvent) {
    if (following) return; // 跟随中：忽略本地平移
    pan.current = { x: e.clientX, y: e.clientY, tx: vp.tx, ty: vp.ty };
  }
  function onMove(e: React.MouseEvent) {
    if (!pan.current) return;
    setVp((v) => ({ ...v, tx: pan.current!.tx + (e.clientX - pan.current!.x), ty: pan.current!.ty + (e.clientY - pan.current!.y) }));
  }
  function onUp() {
    pan.current = null;
  }

  const pct = toPercent(vp.scale);

  return (
    <div className="relative flex-1 overflow-hidden bg-muted/30">
      {/* 画布表面 */}
      <div
        data-testid="canvas-viewport"
        className="h-full w-full cursor-grab active:cursor-grabbing"
        onWheel={onWheel}
        onMouseDown={onDown}
        onMouseMove={onMove}
        onMouseUp={onUp}
        onMouseLeave={onUp}
      >
        {/* 渲染引擎层（fabric <canvas>）：1:1 铺满，不参与 CSS transform（F13） */}
        {underlay}
        <div
          data-testid="canvas-surface"
          data-following={following ? "true" : "false"}
          data-vp-tx={Math.round(vp.tx)}
          data-vp-ty={Math.round(vp.ty)}
          data-vp-scale={vp.scale}
          style={{ transform: `translate(${vp.tx}px, ${vp.ty}px) scale(${vp.scale})`, transformOrigin: "0 0" }}
          className={"h-full w-full" + (underlay ? " pointer-events-none" : "")}
        >
          {children ?? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              画布（组件编辑随 P6 后续 feature 接入）
            </div>
          )}
        </div>
      </div>

      {/* 缩放控制条 */}
      <div
        data-testid="zoom-control"
        className="absolute bottom-4 right-4 flex items-center gap-1 rounded-md border bg-card px-2 py-1 shadow-sm"
      >
        <Button data-testid="zoom-out" size="icon" variant="ghost" className="h-7 w-7" onClick={() => setVp((v) => ({ ...v, scale: zoomBy(v.scale, ZOOM_OUT_FACTOR) }))}>
          −
        </Button>
        <span data-testid="zoom-percent" className="min-w-[3rem] text-center font-mono text-xs tabular-nums text-foreground">
          {pct}%
        </span>
        <Button data-testid="zoom-in" size="icon" variant="ghost" className="h-7 w-7" onClick={() => setVp((v) => ({ ...v, scale: zoomBy(v.scale, ZOOM_IN_FACTOR) }))}>
          +
        </Button>
        <Button data-testid="zoom-reset" size="sm" variant="ghost" className="h-7" onClick={() => setVp(resetViewport())}>
          重置
        </Button>
      </div>

      {/* 小地图 */}
      <div
        data-testid="minimap"
        className="absolute bottom-4 left-4 h-24 w-32 overflow-hidden rounded-md border bg-card/80 shadow-sm"
      >
        <div
          data-testid="minimap-viewport"
          className="absolute border border-primary bg-primary/10"
          style={{
            width: `${Math.min(100, 100 / vp.scale)}%`,
            height: `${Math.min(100, 100 / vp.scale)}%`,
            left: `${Math.max(0, Math.min(80, -vp.tx / 20))}%`,
            top: `${Math.max(0, Math.min(80, -vp.ty / 20))}%`,
          }}
        />
      </div>
    </div>
  );
}
