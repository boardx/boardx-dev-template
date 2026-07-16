"use client";

import { useMemo, useState, type ReactNode } from "react";
import { BarChart3, Copy, GripVertical, Image as ImageIcon, Maximize2, MoreHorizontal, RotateCcw, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createDefaultReportLayout,
  moveReportModule,
  resizeReportModule,
  updateReportModulePrompt,
  type ReportLayoutModule,
  type ReportLayoutModuleType,
} from "@/lib/survey-report-layout";
import { cn } from "@/lib/utils";

interface ReportLayoutCanvasProps {
  chartPreview?: ReactNode;
  prompts?: Partial<Record<ReportLayoutModuleType, string>>;
  onPromptChange?: (type: ReportLayoutModuleType, prompt: string) => void;
}

const moduleIcons = { chart: BarChart3, image: ImageIcon, text: Type };
const moduleLabels = { chart: "图表", image: "图片", text: "文本" };

export function ReportLayoutCanvas({ chartPreview, prompts, onPromptChange }: ReportLayoutCanvasProps) {
  const initial = useMemo(() => createDefaultReportLayout().map((module) => ({ ...module, prompt: prompts?.[module.type] || module.prompt })), [prompts]);
  const [modules, setModules] = useState<ReportLayoutModule[]>(initial);
  const [selectedId, setSelectedId] = useState<ReportLayoutModuleType>("chart");
  const selected = modules.find((module) => module.id === selectedId) ?? modules[0]!;

  function updateSelected(next: ReportLayoutModule) {
    setModules((current) => current.map((module) => module.id === next.id ? next : module));
  }

  function patchPrompt(value: string) {
    setModules((current) => updateReportModulePrompt(current, selected.id, value));
    onPromptChange?.(selected.type, value);
  }

  return (
    <div data-testid="report-layout-canvas" className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_280px]">
      <section className="min-w-0 border border-border bg-background">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
          <div className="flex gap-1">
            {(["chart", "image", "text"] as const).map((type) => {
              const Icon = moduleIcons[type];
              return <Button key={type} type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => setSelectedId(type)}><Icon className="h-4 w-4" />{moduleLabels[type]}</Button>;
            })}
          </div>
          <div className="flex gap-1">
            <Button type="button" size="icon" variant="ghost" aria-label="预览报表" title="预览报表"><Maximize2 className="h-4 w-4" /></Button>
            <Button type="button" size="icon" variant="ghost" aria-label="自动排版" title="自动排版" onClick={() => setModules(createDefaultReportLayout())}><RotateCcw className="h-4 w-4" /></Button>
          </div>
        </div>
        <div className="grid grid-cols-12 gap-2 bg-muted/20 p-2">
          {modules.map((module) => {
            const Icon = moduleIcons[module.type];
            const active = module.id === selected.id;
            return (
              <article
                key={module.id}
                data-testid={`report-layout-module-${module.type}`}
                className={cn("relative min-h-40 overflow-hidden border bg-background transition-colors", active ? "border-foreground ring-1 ring-foreground" : "border-border")}
                style={{ gridColumn: `${module.x + 1} / span ${module.w}`, gridRow: `${module.y + 1} / span ${module.h}` }}
                onClick={() => setSelectedId(module.id)}
              >
                <header className="flex items-center justify-between border-b border-border px-2 py-2">
                  <span className="flex min-w-0 items-center gap-2 text-12 font-bold"><GripVertical className="h-4 w-4 text-muted-foreground" /><Icon className="h-4 w-4" />{module.title}</span>
                  <span className="flex items-center gap-1">
                    <span className="text-10 text-muted-foreground">{module.w}列 × {module.h}行</span>
                    <Button type="button" size="icon" variant="ghost" aria-label="复制模块" title="复制模块"><Copy className="h-3.5 w-3.5" /></Button>
                    <Button type="button" size="icon" variant="ghost" aria-label="更多模块操作" title="更多模块操作"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
                  </span>
                </header>
                <div className="p-3">
                  {module.type === "chart" ? chartPreview ?? <div className="grid h-44 place-items-center bg-muted text-12 text-muted-foreground">图表预览</div> : null}
                  {module.type === "image" ? <div className="grid min-h-44 place-items-center bg-muted text-center text-12 text-muted-foreground"><span><ImageIcon className="mx-auto mb-2 h-8 w-8" />图片生成预览</span></div> : null}
                  {module.type === "text" ? <p className="text-13 leading-6 text-foreground">当前样本覆盖主要年级和性别分组。正式报告将基于真实答卷说明差异，并明确标注样本限制。</p> : null}
                </div>
                {active ? <span aria-hidden="true" className="absolute bottom-0 right-0 h-3 w-3 border-b-2 border-r-2 border-foreground" /> : null}
              </article>
            );
          })}
        </div>
      </section>

      <aside className="border border-border bg-background">
        <div className="border-b border-border px-3 py-3">
          <p className="text-13 font-bold text-foreground">模块设置</p>
          <p className="mt-1 text-11 text-muted-foreground">当前：{moduleLabels[selected.type]}模块</p>
        </div>
        <div className="grid gap-4 p-3">
          <div className="grid grid-cols-3 gap-1">
            <Button type="button" size="sm">内容</Button><Button type="button" size="sm" variant="ghost">数据</Button><Button type="button" size="sm" variant="ghost">样式</Button>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`report-layout-prompt-${selected.type}`}>{moduleLabels[selected.type]}生成提示词</Label>
            <Textarea id={`report-layout-prompt-${selected.type}`} data-testid={`report-layout-prompt-${selected.type}`} value={selected.prompt} onChange={(event) => patchPrompt(event.target.value)} className="min-h-28" />
            <Button type="button" size="sm" className="gap-1.5"><RotateCcw className="h-4 w-4" />重新生成</Button>
          </div>
          <div className="border-t border-border pt-3">
            <p className="text-12 font-bold text-foreground">位置与大小</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => updateSelected(moveReportModule(selected, { x: selected.x - 1, y: selected.y }))}>左移</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => updateSelected(moveReportModule(selected, { x: selected.x + 1, y: selected.y }))}>右移</Button>
              <Button data-testid="report-module-resize-smaller" type="button" size="sm" variant="outline" onClick={() => updateSelected(resizeReportModule(selected, { w: selected.w - 1, h: selected.h - 1 }))}>缩小</Button>
              <Button data-testid="report-module-resize-larger" type="button" size="sm" variant="outline" onClick={() => updateSelected(resizeReportModule(selected, { w: selected.w + 1, h: selected.h + 1 }))}>放大</Button>
            </div>
          </div>
          {selected.type === "chart" ? <p className="border-t border-border pt-3 text-11 leading-5 text-muted-foreground">X 轴：题目选项 · Y 轴：回答人数 · 聚合：计数</p> : null}
        </div>
      </aside>
    </div>
  );
}
