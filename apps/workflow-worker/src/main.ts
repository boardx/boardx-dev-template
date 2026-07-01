// apps/workflow-worker/src/main.ts — CAP-WORKFLOW BullMQ worker 进程
// 消费 boardx.jobs / boardx.kb-file-processing 队列，处理后把状态回写 Postgres。幂等。

import { makeWorker, QUEUE_NAMES } from "@repo/queue";
import { setJobStatus, setKbFileStatus } from "@repo/data";
import { decideStatus, type JobData } from "./job";
import { decideKbFileStatus, type KbFileJobData } from "./kbFileJob";

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

// CAP-FILE：kb 文件解析/切分/向量化（p10-F01 地基；真实算法留给后续 RAG feature）。
const kbFileWorker = makeWorker<KbFileJobData>(QUEUE_NAMES.kbFileProcessing, async (job) => {
  const status = decideKbFileStatus(job.data);
  await setKbFileStatus(job.data.fileId, status);
  return { fileId: job.data.fileId, status };
});

kbFileWorker.on("completed", (job) => {
  console.log(`✓ kb-file ${job.data.fileId} → ${decideKbFileStatus(job.data)}`);
});
kbFileWorker.on("failed", async (job, err) => {
  console.error(`✗ kb-file ${job?.data.fileId} 失败:`, err.message);
  if (job) await setKbFileStatus(job.data.fileId, "error", err.message);
});

console.log(
  `workflow-worker 已启动，监听队列 ${QUEUE_NAMES.jobs} / ${QUEUE_NAMES.kbFileProcessing}`
);
