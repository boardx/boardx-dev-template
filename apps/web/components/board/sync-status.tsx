"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

// 同步状态（UC-board-header-009）：只读状态入口，告诉用户白板是否仍在同步。
// 原型阶段无真实 realtime 后端，仅反映简单客户端状态：
//   synced  —— 没有待同步变化（稳态，绿）
//   saving  —— 触发更新后短暂的「保存中」（黄）
//   offline —— 断线（灰）
// 点击不改变画布内容，仅作只读展示（UC 主流程第 7 步）。
type SyncState = "synced" | "saving" | "offline";

const META: Record<SyncState, { label: string; dot: string; text: string }> = {
  synced: { label: "已同步", dot: "bg-tag-green", text: "text-success" },
  saving: { label: "保存中", dot: "bg-tag-yellow", text: "text-foreground" },
  offline: { label: "连接异常", dot: "bg-muted-foreground", text: "text-muted-foreground" },
};

// controlledState（uc-canvas-005）：由实时协作层驱动真实同步状态。
// 传入时组件转为「受控只读」，反映跨客户端同步周期（synced/saving）；
// 不传时保持既有本地行为（UC-board-header-009）。
export function BoardSyncStatus({ controlledState }: { controlledState?: SyncState } = {}) {
  const [localState, setState] = useState<SyncState>("synced");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const state = controlledState ?? localState;

  // 监听浏览器在线/离线，模拟同步异常分支（UC 异常流程 3）。
  useEffect(() => {
    function onOffline() {
      setState("offline");
    }
    function onOnline() {
      setState("synced");
    }
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setState("offline");
    }
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  // 模拟一次保存：短暂切到「保存中」，随后回到「已同步」（UC 主流程 3→5）。
  function simulateSave() {
    if (controlledState) return; // 受控时点击只读，不改本地状态
    if (state === "offline") return;
    setState("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("synced"), 800);
  }

  const meta = META[state];

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      data-testid="board-sync-status"
      data-sync-state={state}
      title="同步数据状态"
      aria-label={`同步状态：${meta.label}`}
      aria-live="polite"
      onClick={simulateSave}
      className="h-7 gap-1.5 rounded-full border border-border bg-card px-2.5 text-xs font-medium transition-colors duration-200 hover:bg-muted"
    >
      <span
        data-testid="board-sync-dot"
        aria-hidden="true"
        className={`size-2 rounded-full ${meta.dot} ${state === "saving" ? "animate-pulse" : ""}`}
      />
      <span data-testid="board-sync-label" className={meta.text}>
        {meta.label}
      </span>
    </Button>
  );
}
