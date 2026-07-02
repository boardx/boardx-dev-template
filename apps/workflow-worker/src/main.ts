// apps/workflow-worker/src/main.ts — CAP-WORKFLOW BullMQ worker 进程
// 消费 boardx.jobs / boardx.kb-file-processing 队列，处理后把状态回写 Postgres。幂等。

import { makeWorker, QUEUE_NAMES } from "@repo/queue";
import {
  setJobStatus,
  setKbFileStatus,
  markStudioArtifactProcessing,
  markStudioArtifactReady,
  markStudioArtifactError,
  markPresentationArtifactProcessing,
  markPresentationArtifactReady,
  markPresentationArtifactError,
  markPresentationRevisionProcessing,
  markPresentationRevisionReady,
  markPresentationRevisionError,
  updatePresentationArtifactSlides,
} from "@repo/data";
import { decideStatus, type JobData } from "./job";
import { decideKbFileStatus, type KbFileJobData } from "./kbFileJob";
import { processStudioJob, type StudioJobData } from "./studioJob";
import { processPresentationJob, type PresentationJobData } from "./presentationJob";
import {
  processPresentationRevisionJob,
  type PresentationRevisionJobData,
} from "./presentationRevisionJob";

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

// CAP-AI：Studio 音频概览/信息图/演示文稿生成（p12-F01）。先回写 processing（诚实反映
// queued → processing → ready/error 状态机——之前跳过这一步，面板轮询永远看不到"处理中"，
// 只会在 queued 和终态间跳变）。processStudioJob 内部已捕获生成失败，这里按返回的终态
// 回写 DB（不复用 BullMQ 的 failed 事件语义，因为「生成失败」是业务终态而非任务异常——
// 任务本身处理成功，只是生成结果是 error）。
const studioWorker = makeWorker<StudioJobData>(QUEUE_NAMES.studioGeneration, async (job) => {
  await markStudioArtifactProcessing(job.data.artifactId);
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

// CAP-AI：演示文稿生成（p12-F02）。同 studioWorker 的诚实状态机模式：先回写 processing，
// 再跑生成逻辑；「生成失败」是业务终态而非任务异常，按 processPresentationJob 返回的
// 终态回写 DB，不复用 BullMQ 的 failed 事件语义。
const presentationWorker = makeWorker<PresentationJobData>(
  QUEUE_NAMES.presentationGeneration,
  async (job) => {
    await markPresentationArtifactProcessing(job.data.artifactId);
    const outcome = await processPresentationJob(job.data);
    if (outcome.status === "ready") {
      await markPresentationArtifactReady(job.data.artifactId, {
        title: outcome.title!,
        slides: outcome.slides!,
        pptxObjectKey: outcome.pptxObjectKey!,
        pdfObjectKey: outcome.pdfObjectKey!,
      });
    } else {
      await markPresentationArtifactError(job.data.artifactId, outcome.errorMessage ?? "生成失败");
    }
    return { artifactId: job.data.artifactId, status: outcome.status };
  }
);

presentationWorker.on("completed", (job) => {
  console.log(`✓ presentation ${job.data.artifactId}`);
});
presentationWorker.on("failed", async (job, err) => {
  console.error(`✗ presentation ${job?.data.artifactId} 任务异常:`, err.message);
  if (job) await markPresentationArtifactError(job.data.artifactId, err.message);
});

// CAP-AI：演示文稿修订/单页优化（p12-F03）。同 presentationWorker 的诚实状态机模式。
// 成功后原地更新 presentation_artifacts 的 title/slides；失败只回写 revision 的 error 态，
// 不触碰 presentation_artifacts——保证「修订失败不破坏原可查看结果」。
const presentationRevisionWorker = makeWorker<PresentationRevisionJobData>(
  QUEUE_NAMES.presentationRevision,
  async (job) => {
    await markPresentationRevisionProcessing(job.data.revisionId);
    const outcome = await processPresentationRevisionJob(job.data);
    if (outcome.status === "ready") {
      await updatePresentationArtifactSlides(job.data.artifactId, {
        title: outcome.title,
        slides: outcome.slides!,
      });
      await markPresentationRevisionReady(job.data.revisionId, { summary: outcome.summary });
    } else {
      await markPresentationRevisionError(job.data.revisionId, outcome.errorMessage ?? "修订失败");
    }
    return { revisionId: job.data.revisionId, status: outcome.status };
  }
);

presentationRevisionWorker.on("completed", (job) => {
  console.log(`✓ presentation-revision ${job.data.revisionId}`);
});
presentationRevisionWorker.on("failed", async (job, err) => {
  console.error(`✗ presentation-revision ${job?.data.revisionId} 任务异常:`, err.message);
  if (job) await markPresentationRevisionError(job.data.revisionId, err.message);
});

console.log(
  `workflow-worker 已启动，监听队列 ${QUEUE_NAMES.jobs} / ${QUEUE_NAMES.kbFileProcessing} / ${QUEUE_NAMES.studioGeneration} / ${QUEUE_NAMES.presentationGeneration} / ${QUEUE_NAMES.presentationRevision}`
);
