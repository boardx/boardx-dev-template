"use client";
import { useRef, useState } from "react";
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

// 画布视口：拖拽平移 + 滚轮缩放 + 缩放控制条 + 小地图（P6 F05，纯前端，无 items 依赖）。
export function CanvasViewport({ children }: { children?: React.ReactNode }) {
  const [vp, setVp] = useState<Viewport>(DEFAULT_VIEWPORT);
  const pan = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    setVp((v) => ({ ...v, scale: zoomBy(v.scale, e.deltaY < 0 ? ZOOM_IN_FACTOR : ZOOM_OUT_FACTOR) }));
  }
  function onDown(e: React.MouseEvent) {
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
        <div
          data-testid="canvas-surface"
          style={{ transform: `translate(${vp.tx}px, ${vp.ty}px) scale(${vp.scale})`, transformOrigin: "0 0" }}
          className="h-full w-full"
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
