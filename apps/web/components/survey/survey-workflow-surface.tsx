import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SurveyWorkflowSurfaceProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function SurveyWorkflowSurface({
  children,
  className,
  contentClassName,
}: SurveyWorkflowSurfaceProps) {
  return (
    <div
      data-testid="survey-workflow-surface"
      className={cn("min-h-full border-t-2 border-survey bg-survey/5", className)}
    >
      <div
        data-testid="survey-workflow-content"
        className={cn("w-full p-4 sm:p-6", contentClassName)}
      >
        {children}
      </div>
    </div>
  );
}
