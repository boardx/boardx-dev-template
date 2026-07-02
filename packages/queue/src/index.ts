// packages/queue/src/index.ts — CAP-WORKFLOW BullMQ 封装（连 Redis）
// 原则：队列名集中常量；任务处理必须幂等（worker 可能重试）。

import { Queue, Worker, type Processor, type ConnectionOptions } from "bullmq";

// ─── 队列名常量（单一来源，避免 magic string）────────────────────────────────

export const QUEUE_NAMES = {
  jobs: "boardx.jobs",
  kbFileProcessing: "boardx.kb-file-processing", // CAP-FILE：解析/切分/向量化（p10-F01）
  studioGeneration: "boardx.studio-generation", // CAP-AI：Studio 音频概览/信息图/演示生成（p12-F01）
  presentationGeneration: "boardx.presentation-generation", // CAP-AI：演示文稿生成（p12-F02）
  presentationRevision: "boardx.presentation-revision", // CAP-AI：演示文稿修订/单页优化（p12-F03）
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// ─── Redis 连接配置（纯函数，可单测）────────────────────────────────────────

export interface RedisConn {
  host: string;
  port: number;
}

/** 从 REDIS_URL（redis://host:port）或 REDIS_HOST/PORT 解析。 */
export function resolveRedisConnection(env: NodeJS.ProcessEnv = process.env): RedisConn {
  if (env.REDIS_URL) {
    const u = new URL(env.REDIS_URL);
    return { host: u.hostname, port: Number(u.port) || 6379 };
  }
  return { host: env.REDIS_HOST ?? "localhost", port: Number(env.REDIS_PORT ?? "6379") };
}

function connection(): ConnectionOptions {
  return resolveRedisConnection();
}

// ─── 工厂 ────────────────────────────────────────────────────────────────────

export function makeQueue<T = unknown>(name: QueueName): Queue<T> {
  return new Queue<T>(name, { connection: connection() });
}

export function makeWorker<T = unknown>(name: QueueName, processor: Processor<T>): Worker<T> {
  return new Worker<T>(name, processor, { connection: connection() });
}

export { Queue, Worker };
export type { Processor };
