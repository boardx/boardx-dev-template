"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

// 按 UC 分类排列的快捷键，按键组合与 board-canvas 实际支持的 keydown 一致。
// keys 用 token 占位：MOD = Cmd/Ctrl，按平台渲染对应样式（Mac 符号 / 其他文字）。
interface Shortcut {
  desc: string;
  keys: string[]; // 每个元素是一段按键组合，多段表示「或」
}
interface ShortcutGroup {
  category: string;
  items: Shortcut[];
}

const GROUPS: ShortcutGroup[] = [
  {
    category: "编辑",
    items: [
      { desc: "撤销", keys: ["MOD Z"] },
      { desc: "重做", keys: ["MOD Shift Z", "MOD Y"] },
      { desc: "复制", keys: ["MOD C"] },
      { desc: "粘贴", keys: ["MOD V"] },
      { desc: "删除选中", keys: ["Delete", "Backspace"] },
    ],
  },
  {
    category: "选择",
    items: [
      { desc: "全选", keys: ["MOD A"] },
      { desc: "取消选择", keys: ["Esc"] },
    ],
  },
  {
    category: "排列",
    items: [
      { desc: "移动选中（小步）", keys: ["←", "→", "↑", "↓"] },
      { desc: "移动选中（大步）", keys: ["Shift ←", "Shift →", "Shift ↑", "Shift ↓"] },
    ],
  },
];

function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  // navigator.platform 在旧浏览器仍可用；userAgent 兜底。
  const p = `${navigator.platform ?? ""} ${navigator.userAgent ?? ""}`.toLowerCase();
  return p.includes("mac");
}

// 渲染单个按键 token：MOD/Shift 等按平台映射成符号或文字。
function renderToken(token: string, mac: boolean): string {
  if (token === "MOD") return mac ? "⌘" : "Ctrl";
  if (token === "Shift") return mac ? "⇧" : "Shift";
  if (token === "Esc") return mac ? "esc" : "Esc";
  return token;
}

// 快捷键帮助：Header 更多入口 → 居中弹窗，按分类列出全部快捷键。
export function BoardShortcutsHelp() {
  const [open, setOpen] = useState(false);
  const [mac, setMac] = useState(false);

  useEffect(() => {
    setMac(isMacPlatform());
  }, []);

  // Esc 关闭弹窗（UC 主流程第 7 步）。
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/* Header 入口：更多菜单中的「快捷键」 */}
      <Button
        type="button"
        data-testid="board-shortcuts-open"
        size="sm"
        variant="ghost"
        className="justify-start"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        快捷键
      </Button>

      {open && (
        <>
          {/* 点击弹窗外部关闭（UC 主流程第 7 步） */}
          <div
            data-testid="shortcuts-help-overlay"
            className="fixed inset-0 z-40 bg-foreground/20 transition-opacity duration-200"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            data-testid="shortcuts-help-panel"
            role="dialog"
            aria-modal="true"
            aria-label="键盘快捷键"
            className="fixed left-1/2 top-1/2 z-50 max-h-[80vh] w-[min(92vw,28rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-popover p-5 text-popover-foreground shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <h2 className="text-base font-semibold text-foreground">键盘快捷键</h2>
                {/* 上下文提示（UC 主流程第 3 步） */}
                <p data-testid="shortcuts-help-hint" className="text-xs text-muted-foreground">
                  快捷键会随当前选择、输入焦点与画布状态变化。
                </p>
              </div>
              <Button
                type="button"
                data-testid="shortcuts-help-close"
                size="sm"
                variant="ghost"
                onClick={() => setOpen(false)}
              >
                关闭
              </Button>
            </div>

            <div className="mt-4 flex flex-col gap-4">
              {GROUPS.map((g) => (
                <section key={g.category} data-testid={`shortcuts-group-${g.category}`}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {g.category}
                  </p>
                  <ul className="flex flex-col gap-1.5">
                    {g.items.map((s) => (
                      <li key={s.desc} className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-foreground">{s.desc}</span>
                        <span className="flex flex-wrap items-center justify-end gap-1">
                          {s.keys.map((combo, ci) => (
                            <span key={combo} className="flex items-center gap-1">
                              {ci > 0 && <span className="text-xs text-muted-foreground">或</span>}
                              {combo.split(" ").map((tok, ti) => (
                                <kbd
                                  key={`${combo}-${ti}`}
                                  className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground"
                                >
                                  {renderToken(tok, mac)}
                                </kbd>
                              ))}
                            </span>
                          ))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
