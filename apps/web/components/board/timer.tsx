"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

type Phase = "idle" | "running" | "paused" | "ended";

const STATUS_TEXT: Record<Phase, string> = {
  idle: "未开始",
  running: "运行中",
  paused: "已暂停",
  ended: "已结束",
};

function mmss(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// 协作计时器（本期本地；多人共享同步在 p8 接 Yjs 后增强）。
export function BoardTimer() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [durationMin, setDurationMin] = useState(5);
  const [remaining, setRemaining] = useState(0);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (phase === "running") {
      tick.current = setInterval(() => {
        setRemaining((r) => {
          if (r <= 1) {
            setPhase("ended");
            return 0;
          }
          return r - 1;
        });
      }, 1000);
    }
    return () => {
      if (tick.current) clearInterval(tick.current);
    };
  }, [phase]);

  function start() {
    setRemaining(durationMin * 60);
    setPhase("running");
  }

  return (
    <div data-testid="board-timer" className="flex items-center gap-2">
      {phase === "idle" || phase === "ended" ? (
        <>
          <Select
            data-testid="timer-duration"
            className="w-20"
            value={String(durationMin)}
            onChange={(e) => setDurationMin(Number(e.target.value))}
          >
            <option value="1">1 分</option>
            <option value="5">5 分</option>
            <option value="10">10 分</option>
            <option value="15">15 分</option>
          </Select>
          <Button data-testid="timer-start" size="sm" variant="secondary" onClick={start}>
            {phase === "ended" ? "重新开始" : "开始计时"}
          </Button>
          {phase === "ended" && (
            <span data-testid="timer-ended" className="text-xs text-destructive">
              时间到
            </span>
          )}
        </>
      ) : (
        <>
          <span data-testid="timer-remaining" className="font-mono text-sm tabular-nums text-foreground">
            {mmss(remaining)}
          </span>
          {phase === "running" ? (
            <Button data-testid="timer-pause" size="sm" variant="ghost" onClick={() => setPhase("paused")}>
              暂停
            </Button>
          ) : (
            <Button data-testid="timer-resume" size="sm" variant="ghost" onClick={() => setPhase("running")}>
              继续
            </Button>
          )}
          <Button data-testid="timer-stop" size="sm" variant="ghost" onClick={() => { setPhase("idle"); setRemaining(0); }}>
            停止
          </Button>
        </>
      )}
      <span data-testid="timer-status" className="text-xs text-muted-foreground">
        {STATUS_TEXT[phase]}
      </span>
    </div>
  );
}
