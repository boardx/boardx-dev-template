"use client";
// 多标签输入（对齐 oldcode uc-board-005：chip 块、Enter 添加、可点移除）。
import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  inputTestId?: string;
  /** 每个已选 chip 的 testid 前缀：`${chipTestIdPrefix}-${tag}` */
  chipTestIdPrefix?: string;
}

export function TagInput({ value, onChange, placeholder, inputTestId, chipTestIdPrefix }: TagInputProps) {
  const [draft, setDraft] = useState("");

  function add(raw: string) {
    const t = raw.trim();
    if (!t || value.includes(t)) return;
    onChange([...value, t]);
    setDraft("");
  }
  function remove(tag: string) {
    onChange(value.filter((t) => t !== tag));
  }
  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Backspace" && !draft && value.length) {
      remove(value[value.length - 1]!);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <span
              key={tag}
              data-testid={chipTestIdPrefix ? `${chipTestIdPrefix}-${tag}` : undefined}
              className={cn(
                "inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5",
                "text-xs font-medium text-foreground"
              )}
            >
              {tag}
              <button
                type="button"
                onClick={() => remove(tag)}
                aria-label={`移除标签 ${tag}`}
                className="text-muted-foreground transition-colors duration-150 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <Input
        data-testid={inputTestId}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKey}
        onBlur={() => add(draft)}
        placeholder={placeholder ?? "输入标签后按 Enter"}
      />
    </div>
  );
}
