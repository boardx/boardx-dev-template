"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const SHORTCUTS: { keys: string; desc: string }[] = [
  { keys: "Cmd/Ctrl + Z", desc: "撤销" },
  { keys: "Cmd/Ctrl + Shift + Z", desc: "重做" },
  { keys: "Cmd/Ctrl + C / V", desc: "复制 / 粘贴" },
  { keys: "Delete", desc: "删除选中" },
  { keys: "Space + 拖动", desc: "平移画布" },
];

// 快捷键帮助 + 新用户欢迎引导（静态内容）。
export function BoardHelpGuide() {
  const [helpOpen, setHelpOpen] = useState(false);
  const [guideDismissed, setGuideDismissed] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.localStorage.getItem("board_welcome_dismissed") === "1") {
      setGuideDismissed(true);
    }
  }, []);

  function dismissGuide() {
    setGuideDismissed(true);
    if (typeof window !== "undefined") window.localStorage.setItem("board_welcome_dismissed", "1");
  }
  function reopenGuide() {
    setGuideDismissed(false);
    if (typeof window !== "undefined") window.localStorage.removeItem("board_welcome_dismissed");
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button data-testid="help-open" size="sm" variant="ghost" onClick={() => setHelpOpen((v) => !v)}>
          快捷键
        </Button>
        {guideDismissed && (
          <Button data-testid="welcome-reopen" size="sm" variant="ghost" onClick={reopenGuide}>
            欢迎引导
          </Button>
        )}
      </div>

      {/* 快捷键帮助面板 */}
      {helpOpen && (
        <div
          data-testid="shortcuts-panel"
          className="absolute right-4 top-14 z-10 w-72 rounded-lg border bg-card p-4 shadow-lg"
        >
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">快捷键</p>
            <Button data-testid="help-close" size="sm" variant="ghost" onClick={() => setHelpOpen(false)}>
              关闭
            </Button>
          </div>
          <ul className="flex flex-col gap-1.5">
            {SHORTCUTS.map((s) => (
              <li key={s.keys} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{s.desc}</span>
                <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">{s.keys}</kbd>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 欢迎引导 */}
      {!guideDismissed && (
        <div
          data-testid="welcome-guide"
          className="absolute bottom-4 left-4 z-10 w-80 rounded-lg border border-primary/30 bg-primary/5 p-4 shadow-lg"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold text-foreground">欢迎来到白板 ✨</p>
              <p className="text-xs text-muted-foreground">
                用 Board Menu 添加便签、形状与连接线，点「快捷键」查看常用操作。
              </p>
            </div>
            <Button data-testid="welcome-dismiss" size="sm" variant="ghost" onClick={dismissGuide}>
              关闭
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
