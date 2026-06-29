// apps/workflow-worker/src/main.ts — CAP-WORKFLOW BullMQ worker 进程
// 消费 boardx.jobs 队列，处理后把状态回写 Postgres。幂等。

import { makeWorker, QUEUE_NAMES } from "@repo/queue";
import { setJobStatus } from "@repo/data";
import { decideStatus, type JobData } from "./job";

const worker = makeWorker<JobData>(QUEUE_NAMES.jobs, async (job) => {
  const status = decideStatus(job.data);
  await setJobStatus(job.data.id, status);
  return { id: job.data.id, status };
});

worker.on("completed", (job) => {
  console.log(`✓ job ${job.data.id} → ${decideStatus(job.data)}`);
});
worker.on("failed", (job, err) => {
  console.error(`✗ job ${job?.data.id} 失败:`, err.message);
});

console.log(`workflow-worker 已启动，监听队列 ${QUEUE_NAMES.jobs}`);
