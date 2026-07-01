"use client";

import { useState } from "react";
import { MessageSquareText } from "lucide-react";
import { FeedbackDialog } from "@/components/feedback/feedback-dialog";
import { cn } from "@/lib/utils";

export function FeedbackLauncher({
  className,
  successClassName,
  testId = "feedback-entry",
}: {
  className?: string;
  successClassName?: string;
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  return (
    <>
      <button
        onClick={() => {
          setSubmitted(false);
          setOpen(true);
        }}
        title="提交反馈"
        aria-label="提交反馈"
        data-testid={testId}
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-9 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className
        )}
      >
        <MessageSquareText className="h-4 w-4" />
      </button>
      <FeedbackDialog open={open} onClose={() => setOpen(false)} onSubmitted={() => setSubmitted(true)} />
      {submitted && (
        <div
          role="status"
          data-testid="feedback-success"
          className={cn(
            "fixed bottom-4 left-20 z-50 rounded-9 border border-border bg-popover px-3 py-2 text-sm text-foreground shadow-lg",
            successClassName
          )}
        >
          提交成功
        </div>
      )}
    </>
  );
}
