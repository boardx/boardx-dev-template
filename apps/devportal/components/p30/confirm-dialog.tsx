"use client";
// p30 原型用不可跳过确认弹窗（UC-13：token 轮换/退役「确认不可跳过」）。
// 不引新依赖：语义 token + role="dialog" 手写覆盖层；requireText 时必须原样输入才解锁确认。
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ConfirmDialog({
  testid,
  title,
  body,
  confirmLabel,
  requireText,
  destructive,
  onConfirm,
  onCancel,
}: {
  testid: string;
  title: string;
  body: string;
  confirmLabel: string;
  /** 需要用户原样输入的文本（如 agent 全名）；缺省则普通确认 */
  requireText?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState("");
  const locked = requireText !== undefined && typed !== requireText;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-darkest/60 p-4" role="presentation" onClick={onCancel}>
      <div
        data-testid={testid}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-brand rounded-14 border border-border bg-background p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-15 font-semibold text-foreground">{title}</h2>
        <p className="mt-2 text-13 leading-relaxed text-muted-foreground">{body}</p>
        {requireText !== undefined && (
          <div className="mt-3 flex flex-col gap-1.5">
            <Label htmlFor={`${testid}-input`}>
              输入 <span className="font-mono text-12">{requireText}</span> 以确认（不可跳过）
            </Label>
            <Input
              id={`${testid}-input`}
              data-testid={`${testid}-input`}
              value={typed}
              autoComplete="off"
              onChange={(e) => setTyped(e.target.value)}
              placeholder={requireText}
            />
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            取消
          </Button>
          <Button
            size="sm"
            variant={destructive ? "destructive" : "default"}
            data-testid={`${testid}-confirm`}
            disabled={locked}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
