export type ReportLayoutModuleType = "chart" | "image" | "text";

export interface ReportLayoutModule {
  id: ReportLayoutModuleType;
  type: ReportLayoutModuleType;
  title: string;
  prompt: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const GRID_COLUMNS = 12;
const MIN_WIDTH = 3;
const MIN_HEIGHT = 2;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function createDefaultReportLayout(): ReportLayoutModule[] {
  return [
    {
      id: "chart",
      type: "chart",
      title: "学生基础信息分布",
      prompt: "展示各年级男女学生人数分布，突出年级差异，使用整数并显示数值标签。",
      x: 0,
      y: 0,
      w: 8,
      h: 5,
    },
    {
      id: "image",
      type: "image",
      title: "学生画像视觉摘要",
      prompt: "生成简洁的学生画像信息图，呈现年级、性别和家庭结构，不添加无关装饰。",
      x: 8,
      y: 0,
      w: 4,
      h: 5,
    },
    {
      id: "text",
      type: "text",
      title: "基础信息分析结论",
      prompt: "根据真实样本概括人口学分布，先给结论，再说明证据和样本限制。",
      x: 0,
      y: 5,
      w: 12,
      h: 3,
    },
  ];
}

export function moveReportModule(
  module: ReportLayoutModule,
  position: Pick<ReportLayoutModule, "x" | "y">,
): ReportLayoutModule {
  return {
    ...module,
    x: clamp(Math.round(position.x), 0, GRID_COLUMNS - module.w),
    y: Math.max(0, Math.round(position.y)),
  };
}

export function resizeReportModule(
  module: ReportLayoutModule,
  size: Pick<ReportLayoutModule, "w" | "h">,
): ReportLayoutModule {
  return {
    ...module,
    w: clamp(Math.round(size.w), MIN_WIDTH, GRID_COLUMNS - module.x),
    h: Math.max(MIN_HEIGHT, Math.round(size.h)),
  };
}

export function updateReportModulePrompt(
  modules: ReportLayoutModule[],
  moduleId: ReportLayoutModule["id"],
  prompt: string,
): ReportLayoutModule[] {
  return modules.map((module) => module.id === moduleId ? { ...module, prompt } : module);
}
