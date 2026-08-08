"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, PanelRightClose, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface SurveyAiPanelProps {
  title?: string;
  variant?: "default" | "reference";
  intro?: string;
  contextMessage?: string;
  quickPrompts?: string[];
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
  variant = "default",
  intro,
  contextMessage,
  quickPrompts = [],
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
    <aside
      data-testid="survey-ai-panel"
      className={
        variant === "reference"
          ? "flex min-h-96 min-w-0 flex-col rounded-lg border border-border bg-background transition-colors duration-200 xl:h-full"
          : "min-w-0 border-l border-border bg-background transition-colors duration-200"
      }
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="flex items-center gap-2 text-14 font-bold text-foreground">
          <Sparkles
            className={variant === "reference" ? "h-4 w-4 text-survey" : "h-4 w-4"}
            strokeWidth={1.7}
          />
          {title}
          {variant === "reference" ? (
            <span className="rounded-full bg-tag-purple px-2 py-0.5 text-11 font-medium text-survey">
              默认开启
            </span>
          ) : null}
        </h3>
        {onCollapse ? (
          <Button type="button" size="icon" variant="ghost" aria-label="收起 AI 助手" title="收起 AI 助手" onClick={onCollapse}>
            <PanelRightClose className="h-4 w-4" strokeWidth={1.7} />
          </Button>
        ) : null}
      </div>

      <div
        className={
          variant === "reference"
            ? "flex min-h-0 flex-1 flex-col gap-4 p-4"
            : "grid gap-4 p-4"
        }
      >
        {variant === "reference" ? (
          <>
            {intro ? (
              <p className="text-12 leading-5 text-muted-foreground">{intro}</p>
            ) : null}
            {contextMessage ? (
              <div className="rounded-lg bg-secondary px-4 py-3 text-13 leading-6 text-foreground">
                {contextMessage}
              </div>
            ) : null}
            <div className="flex-1" />
            {quickPrompts.length ? (
              <div className="flex flex-wrap gap-2">
                {quickPrompts.map((item) => (
                  <Button
                    key={item}
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setPrompt(item)}
                    className="h-auto whitespace-normal rounded-full px-3 py-1.5 text-left text-12 font-normal"
                  >
                    {item}
                  </Button>
                ))}
              </div>
            ) : null}
          </>
        ) : null}

        {variant === "reference" ? (
          <div className="flex min-w-0 items-end gap-2">
            <Textarea
              aria-label="AI 修改要求"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={placeholder}
              className="min-h-11 flex-1 resize-none py-2.5"
            />
            <Button
              type="button"
              size="icon"
              aria-label={busy ? "AI 正在处理" : "发送修改要求"}
              title={busy ? "AI 正在处理" : "发送修改要求"}
              disabled={busy || !prompt.trim()}
              onClick={() => onSubmit(prompt.trim())}
              className="h-11 w-11 shrink-0 bg-survey text-survey-foreground hover:bg-survey/90"
            >
              <Send className="h-4 w-4" strokeWidth={1.7} />
            </Button>
          </div>
        ) : (
          <div className="grid gap-2">
            <Textarea
              aria-label="AI 修改要求"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={placeholder}
              className="min-h-24"
            />
            <Button
              type="button"
              size="sm"
              disabled={busy || !prompt.trim()}
              onClick={() => onSubmit(prompt.trim())}
              className="justify-between gap-2"
            >
              {busy ? "AI 正在处理…" : "生成修改建议"}
              <Send className="h-4 w-4" strokeWidth={1.7} />
            </Button>
          </div>
        )}

        {variant !== "reference" ? <div className="border-t border-border pt-4">
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
        </div> : null}
      </div>
    </aside>
  );
}
