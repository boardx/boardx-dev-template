import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// shadcn 惯用的 className 合并工具
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
