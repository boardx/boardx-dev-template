"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface SurveyOutlineItem {
  id: string;
  label: string;
  meta?: string;
}

interface SurveyOutlinePanelProps {
  title: string;
  items: SurveyOutlineItem[];
  selectedId?: string;
  collapsed: boolean;
  onToggle: () => void;
  onSelect: (id: string) => void;
  footer?: ReactNode;
}

export function SurveyOutlinePanel({ title, items, selectedId, collapsed, onToggle, onSelect, footer }: SurveyOutlinePanelProps) {
  if (collapsed) {
    return (
      <aside className="flex min-h-96 w-14 flex-col items-center gap-3 border-r border-border bg-background py-3">
        <Button data-testid="survey-outline-toggle" type="button" size="icon" variant="ghost" aria-label={`展开${title}`} title={`展开${title}`} onClick={onToggle}>
          <PanelLeftOpen className="h-4 w-4" strokeWidth={1.7} />
        </Button>
        <span className="grid h-7 w-7 place-items-center rounded-md bg-muted text-12 font-bold text-foreground">{items.length}</span>
      </aside>
    );
  }

  return (
    <aside className="min-w-0 border-r border-border bg-background">
      <div className="flex items-center justify-between border-b border-border px-3 py-3">
        <h3 className="text-14 font-bold text-foreground">{title}</h3>
        <Button data-testid="survey-outline-toggle" type="button" size="icon" variant="ghost" aria-label={`收起${title}`} title={`收起${title}`} onClick={onToggle}>
          <PanelLeftClose className="h-4 w-4" strokeWidth={1.7} />
        </Button>
      </div>
      <div className="grid gap-1 p-2">
        {items.map((item, index) => {
          const active = item.id === selectedId;
          return (
            <Button
              key={item.id}
              type="button"
              variant="ghost"
              className={cn(
                "h-auto min-h-14 justify-start gap-3 whitespace-normal rounded-md px-2 py-2 text-left transition-colors",
                active && "bg-foreground text-background hover:bg-foreground/90 hover:text-background",
              )}
              onClick={() => onSelect(item.id)}
            >
              <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-md bg-muted text-12 font-bold text-foreground", active && "bg-background")}>{index + 1}</span>
              <span className="min-w-0">
                <span className="block truncate text-12 font-bold">{item.label}</span>
                {item.meta ? <span className={cn("mt-1 block truncate text-11 text-muted-foreground", active && "text-background/70")}>{item.meta}</span> : null}
              </span>
            </Button>
          );
        })}
        {footer}
      </div>
    </aside>
  );
}
