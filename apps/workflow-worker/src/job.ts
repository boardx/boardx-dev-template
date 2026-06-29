// apps/workflow-worker/src/job.ts — 任务处理的纯逻辑（与 IO 解耦，可单测）
// 任务必须幂等：相同输入多次处理结果一致。

import type { JobStatus } from "@repo/data";

export interface JobData {
  id: string;
  payload: string;
}

/** 纯函数：根据 payload 决定终态。空 payload 视为失败，否则完成。 */
export function decideStatus(data: JobData): JobStatus {
  return data.payload.trim().length > 0 ? "done" : "failed";
}
