"use client";

import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import {
  BarChart,
  FunnelChart,
  GaugeChart,
  HeatmapChart,
  LineChart,
  PieChart,
  RadarChart,
  ScatterChart,
} from "echarts/charts";
import {
  GridComponent,
  LegendComponent,
  RadarComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([
  BarChart,
  FunnelChart,
  GaugeChart,
  HeatmapChart,
  LineChart,
  PieChart,
  RadarChart,
  ScatterChart,
  GridComponent,
  LegendComponent,
  RadarComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
  CanvasRenderer,
]);

export function SurveyEChartsCanvas({
  option,
  testId,
  ariaLabel,
  className = "h-80 min-h-80 w-full",
}: {
  option: Record<string, unknown>;
  testId: string;
  ariaLabel: string;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const instance = echarts.init(container, undefined, { renderer: "canvas" });
    instance.setOption(option, true);
    const resizeObserver = new ResizeObserver(() => instance.resize());
    resizeObserver.observe(container);
    return () => {
      resizeObserver.disconnect();
      instance.dispose();
    };
  }, [option]);

  return (
    <div
      ref={containerRef}
      data-testid={testId}
      className={className}
      role="img"
      aria-label={ariaLabel}
    />
  );
}
