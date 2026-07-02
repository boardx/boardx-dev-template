// apps/workflow-worker/src/presentationJob.ts — 演示文稿生成任务处理（P12 F02）
// 消费 boardx.presentation-generation 队列：调用 @repo/ai 的 stub 生成器产出占位幻灯片 +
// PPTX/PDF 二进制内容，写入对象存储（@repo/storage），成功则回写 ready + 两个 object_key，
// 失败回写 error + 消息（不吞错误，供预览卡片重试）。任务需幂等：重复消费同一 artifactId
// 时以数据库当前态为准。
import {
  generatePresentation,
  type PresentationSource,
  type PresentationSlide,
} from "@repo/ai";
import { buildPresentationObjectKey, ensureBucket, putObject } from "@repo/storage";

export interface PresentationJobData {
  artifactId: string;
  roomId: number;
  chatId: number;
  topic: string;
  source: PresentationSource;
  instructions: string;
  pages: number;
  style: string;
  sourceLabel: string;
}

export interface PresentationJobOutcome {
  status: "ready" | "error";
  title?: string;
  slides?: PresentationSlide[];
  pptxObjectKey?: string;
  pdfObjectKey?: string;
  errorMessage?: string;
}

/** 处理一个演示文稿生成任务：生成占位幻灯片+PPTX/PDF → 写对象存储 → 返回终态。
 *  IO（生成 + 存储）与队列/DB 回写解耦，便于单测覆盖成功/失败分支。 */
export async function processPresentationJob(
  data: PresentationJobData
): Promise<PresentationJobOutcome> {
  try {
    const result = await generatePresentation({
      topic: data.topic,
      source: data.source,
      instructions: data.instructions,
      pages: data.pages,
      style: data.style,
      sourceLabel: data.sourceLabel,
    });
    const pptxObjectKey = buildPresentationObjectKey({
      roomId: data.roomId,
      chatId: data.chatId,
      artifactId: data.artifactId,
      fileName: `${data.artifactId}.pptx`,
    });
    const pdfObjectKey = buildPresentationObjectKey({
      roomId: data.roomId,
      chatId: data.chatId,
      artifactId: data.artifactId,
      fileName: `${data.artifactId}.pdf`,
    });
    await ensureBucket();
    await putObject(pptxObjectKey, result.pptxContent, "application/vnd.openxmlformats-officedocument.presentationml.presentation");
    await putObject(pdfObjectKey, result.pdfContent, "application/pdf");
    return {
      status: "ready",
      title: result.title,
      slides: result.slides,
      pptxObjectKey,
      pdfObjectKey,
    };
  } catch (err) {
    return { status: "error", errorMessage: err instanceof Error ? err.message : String(err) };
  }
}
