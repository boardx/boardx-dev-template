import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-28 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground transition-colors placeholder:text-placeholder focus-visible:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:bg-disabled disabled:text-disabled-foreground",
      className
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
