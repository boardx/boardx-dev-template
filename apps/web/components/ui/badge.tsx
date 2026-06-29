import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "success" | "muted";

const variants: Record<Variant, string> = {
  default: "bg-neutral-900 text-white",
  success: "bg-green-600 text-white",
  muted: "bg-neutral-200 text-neutral-700",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
}

// 最小 shadcn 风格组件（cn + variant），证明 UI 栈贯通。
export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-sm font-medium",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
