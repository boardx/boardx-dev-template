"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

// 新用户欢迎引导卡（bottom-left 浮层）。
// board-shell reskin（issue #468）后本组件不再自带页面顶部的触发按钮行：
// 旧的「快捷键」面板与 shortcuts-help.tsx（More 菜单 → board-shortcuts-open）功能重复，整块删除；
// 「欢迎引导」重开入口移进 Header 的 ⋯More 菜单（welcome-reopen 菜单项），
// 通过 reopenTick 递增通知本组件重新展示（组件自身保持 localStorage 的关闭记忆）。
export function BoardHelpGuide({ reopenTick = 0 }: { reopenTick?: number }) {
  const [guideDismissed, setGuideDismissed] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.localStorage.getItem("board_welcome_dismissed") === "1") {
      setGuideDismissed(true);
    }
  }, []);

  useEffect(() => {
    if (reopenTick > 0) {
      setGuideDismissed(false);
      if (typeof window !== "undefined") window.localStorage.removeItem("board_welcome_dismissed");
    }
  }, [reopenTick]);

  function dismissGuide() {
    setGuideDismissed(true);
    if (typeof window !== "undefined") window.localStorage.setItem("board_welcome_dismissed", "1");
  }

  if (guideDismissed) return null;
  return (
    <div
      data-testid="welcome-guide"
      className="absolute bottom-4 left-4 z-10 w-80 rounded-lg border border-primary/30 bg-primary/5 p-4 shadow-lg"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-foreground">欢迎来到白板 ✨</p>
          <p className="text-xs text-muted-foreground">
            用底部工具栏添加便签、形状与连接线，快捷键见 Header 的 ⋯ 菜单。
          </p>
        </div>
        <Button data-testid="welcome-dismiss" size="sm" variant="ghost" onClick={dismissGuide}>
          关闭
        </Button>
      </div>
    </div>
  );
}
