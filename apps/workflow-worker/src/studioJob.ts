// apps/workflow-worker/src/studioJob.ts — Studio 生成任务处理（P12 F01）
// 消费 boardx.studio-generation 队列：调用 @repo/ai 的 stub 生成器产出占位制品，
// 写入对象存储（@repo/storage），成功则回写 ready + object_key，失败回写 error + 消息
// （不吞错误，供面板重试）。任务需幂等：重复消费同一 artifactId 时以数据库当前态为准。
import { generateStudioArtifact, type StudioArtifactType, type StudioArtifactSource } from "@repo/ai";
import { buildStudioObjectKey, ensureBucket, putObject } from "@repo/storage";

export interface StudioJobData {
  artifactId: string;
  roomId: number;
  chatId: number;
  type: StudioArtifactType;
  source: StudioArtifactSource;
  prompt: string;
  sourceLabel: string;
}

export interface StudioJobOutcome {
  status: "ready" | "error";
  objectKey?: string;
  title?: string;
  errorMessage?: string;
}

/** 处理一个 Studio 生成任务：生成占位制品 → 写对象存储 → 返回终态。
 *  IO（生成 + 存储）与队列/DB 回写解耦，便于单测覆盖成功/失败分支。 */
export async function processStudioJob(data: StudioJobData): Promise<StudioJobOutcome> {
  try {
    const result = await generateStudioArtifact({
      type: data.type,
      source: data.source,
      prompt: data.prompt,
      sourceLabel: data.sourceLabel,
    });
    const objectKey = buildStudioObjectKey({
      roomId: data.roomId,
      chatId: data.chatId,
      artifactId: data.artifactId,
      fileName: `${data.artifactId}.${result.ext}`,
    });
    await ensureBucket();
    await putObject(objectKey, result.content, result.contentType);
    return { status: "ready", objectKey, title: result.title };
  } catch (err) {
    return { status: "error", errorMessage: err instanceof Error ? err.message : String(err) };
  }
}
