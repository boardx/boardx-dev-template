// apps/workflow-worker/src/kbFileJob.ts — kb 文件解析/切分/向量化的纯逻辑（与 IO 解耦，可单测）
// 任务必须幂等：相同输入多次处理结果一致。
// F01 范围：只需把 processing → ready 的状态机跑通（objectKey 存在即视为可处理）；
// 真实的解析/切分/向量化算法留给后续 RAG feature（F04）实现，这里不桩化成假成功——
// 只要对象已持久化（uploadOk）就判定为可处理完成，否则转 error，不吞错误。
import type { KbFileStatus } from "@repo/data";

export interface KbFileJobData {
  fileId: string;
  objectKey: string;
}

/** 纯函数：决定处理终态。objectKey 为空视为上传未落地成功 → error。 */
export function decideKbFileStatus(data: KbFileJobData): KbFileStatus {
  return data.objectKey.trim().length > 0 ? "ready" : "error";
}
