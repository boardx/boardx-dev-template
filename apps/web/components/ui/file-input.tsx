"use client";
import { forwardRef } from "react";

// 受控文件选择器封装：原生 <input type="file"> 仅允许出现在 components/ui/ 内
// （app/ 页面层由 lint-design.sh 禁止裸 <input>）。页面通过 ref 触发 click。
export interface FileInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  "aria-label": string;
}

export const FileInput = forwardRef<HTMLInputElement, FileInputProps>(
  ({ className, ...props }, ref) => (
    <input ref={ref} type="file" className={className ?? "hidden"} {...props} />
  ),
);
FileInput.displayName = "FileInput";
