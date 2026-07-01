// apps/workflow-worker/src/main.ts — CAP-WORKFLOW BullMQ worker 进程
// 消费 boardx.jobs / boardx.kb-file-processing 队列，处理后把状态回写 Postgres。幂等。

import { makeWorker, QUEUE_NAMES } from "@repo/queue";
import { setJobStatus, setKbFileStatus, markStudioArtifactReady, markStudioArtifactError } from "@repo/data";
import { decideStatus, type JobData } from "./job";
import { decideKbFileStatus, type KbFileJobData } from "./kbFileJob";
import { processStudioJob, type StudioJobData } from "./studioJob";

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

// CAP-AI：Studio 音频概览/信息图/演示文稿生成（p12-F01）。processStudioJob 内部已捕获生成
// 失败，这里按返回的终态回写 DB（不复用 BullMQ 的 failed 事件语义，因为「生成失败」是
// 业务终态而非任务异常——任务本身处理成功，只是生成结果是 error）。
const studioWorker = makeWorker<StudioJobData>(QUEUE_NAMES.studioGeneration, async (job) => {
  const outcome = await processStudioJob(job.data);
  if (outcome.status === "ready") {
    await markStudioArtifactReady(job.data.artifactId, outcome.objectKey!, outcome.title!);
  } else {
    await markStudioArtifactError(job.data.artifactId, outcome.errorMessage ?? "生成失败");
  }
  return { artifactId: job.data.artifactId, status: outcome.status };
});

studioWorker.on("completed", (job) => {
  console.log(`✓ studio ${job.data.artifactId}`);
});
studioWorker.on("failed", async (job, err) => {
  console.error(`✗ studio ${job?.data.artifactId} 任务异常:`, err.message);
  if (job) await markStudioArtifactError(job.data.artifactId, err.message);
});

console.log(
  `workflow-worker 已启动，监听队列 ${QUEUE_NAMES.jobs} / ${QUEUE_NAMES.kbFileProcessing} / ${QUEUE_NAMES.studioGeneration}`
);
