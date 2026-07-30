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
        className={cn("mx-auto w-full max-w-survey-editor p-4 sm:p-6", contentClassName)}
      >
        {children}
      </div>
    </div>
  );
}
