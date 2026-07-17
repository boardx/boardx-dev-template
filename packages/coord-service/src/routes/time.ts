// time.ts — GET /time：全队权威时钟（ADR-014）。
//
// 公开只读（同 /status）：任何 runtime（CC/Codex/裸脚本/CI）都能读，无需 token。
// 返回服务端 UTC 时刻 + 当前 C-cycle 的 id/边界/剩余秒。agent 一律以此为准：
//  - 判断"现在是哪个周期、还剩多久"（决定何时发 cycle-result）
//  - 校准自己的本地时钟漂移（drift 大 → 告警，别静默按错误时间协调）
// 不接受任何入参、不写库——纯读时钟，故不设速率/鉴权门。
import { describeCycle } from "../lib/cycle";
import type { Env } from "../db/types";
import type { Handler } from "../router";

export const serverTime: Handler = async (_request, _env: Env) => {
  const now = new Date();
  return Response.json({
    now: now.toISOString(),
    epoch_ms: now.getTime(),
    cycle: describeCycle(now),
  });
};
