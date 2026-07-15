"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, PanelRightClose, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface SurveyAiPanelProps {
  title?: string;
  placeholder: string;
  resultLabel: string;
  changeCount?: number;
  busy?: boolean;
  onSubmit: (prompt: string) => void;
  onPreview?: () => void;
  onApply?: () => void;
  onCollapse?: () => void;
}

export function SurveyAiPanel({
  title = "AI 助手",
  placeholder,
  resultLabel,
  changeCount = 3,
  busy = false,
  onSubmit,
  onPreview,
  onApply,
  onCollapse,
}: SurveyAiPanelProps) {
  const [prompt, setPrompt] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);

  return (
    <aside data-testid="survey-ai-panel" className="min-w-0 border-l border-border bg-background">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="flex items-center gap-2 text-14 font-bold text-foreground">
          <Sparkles className="h-4 w-4" strokeWidth={1.7} />
          {title}
        </h3>
        {onCollapse ? (
          <Button type="button" size="icon" variant="ghost" aria-label="收起 AI 助手" title="收起 AI 助手" onClick={onCollapse}>
            <PanelRightClose className="h-4 w-4" strokeWidth={1.7} />
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 p-4">
        <div className="grid gap-2">
          <Textarea
            aria-label="AI 修改要求"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder={placeholder}
            className="min-h-24"
          />
          <Button type="button" size="sm" disabled={busy || !prompt.trim()} onClick={() => onSubmit(prompt.trim())} className="justify-between gap-2">
            {busy ? "AI 正在处理…" : "生成修改建议"}
            <Send className="h-4 w-4" strokeWidth={1.7} />
          </Button>
        </div>

        <div className="border-t border-border pt-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-success text-success-foreground">✓</span>
            <div className="min-w-0 flex-1">
              <p className="text-13 font-bold text-foreground">{resultLabel}</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-1 h-7 gap-1 px-0 text-12"
                onClick={() => setDetailsOpen((open) => !open)}
              >
                查看 {changeCount} 项修改
                {detailsOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
          {detailsOpen ? (
            <ul className="mt-3 grid gap-2 border-l border-border pl-3 text-12 text-muted-foreground">
              <li>优化内容结构和表达</li>
              <li>保留现有数据与发布设置</li>
              <li>应用前可在主工作区检查差异</li>
            </ul>
          ) : null}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button data-testid="survey-ai-preview" type="button" variant="outline" size="sm" onClick={onPreview}>预览变更</Button>
            <Button data-testid="survey-ai-apply" type="button" size="sm" onClick={onApply}>直接应用</Button>
          </div>
        </div>
      </div>
    </aside>
  );
}
