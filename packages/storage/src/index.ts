// packages/storage/src/index.ts — CAP-FILE 对象存储封装（S3 兼容，本地 MinIO）
// 原则：只暴露 key 级操作；调用方不碰 SDK 类型/凭据。被 p10 知识库上传复用，
// AVA 附件（p9-F08）/ Studio 演示读文件也复用本层，不要各自再造 S3 client。

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Readable } from "node:stream";

// ─── 连接配置（纯函数，可单测）──────────────────────────────────────────────

export interface StorageConfig {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  forcePathStyle: boolean;
}

/** 从环境变量解析对象存储配置。默认对齐 infra/docker-compose.yml 的本地 MinIO。 */
export function resolveStorageConfig(env: NodeJS.ProcessEnv = process.env): StorageConfig {
  return {
    endpoint: env.S3_ENDPOINT ?? "http://localhost:9090",
    region: env.S3_REGION ?? "us-east-1",
    accessKeyId: env.S3_ACCESS_KEY ?? "boardx",
    secretAccessKey: env.S3_SECRET_KEY ?? "boardx123",
    bucket: env.S3_BUCKET ?? "boardx-kb",
    forcePathStyle: (env.S3_FORCE_PATH_STYLE ?? "true") !== "false",
  };
}

// ─── 对象 key 规范：kb/{scope}/{ownerId}/{fileId}/{原始文件名} ─────────────────
// 隔离 scope/owner，避免跨租户/跨用户越权访问同一 key。

export function buildKbObjectKey(params: {
  scope: string;
  ownerId: string | number;
  fileId: string;
  fileName: string;
}): string {
  const safeName = params.fileName.replace(/[/\\]/g, "_");
  return `kb/${params.scope}/${params.ownerId}/${params.fileId}/${safeName}`;
}

// ─── 上传校验（纯函数，前后端共用同一份规则，避免规则漂移）────────────────────

export const KB_ALLOWED_EXT = ["pdf", "txt", "md", "doc", "docx", "json", "csv", "xlsx", "xls"];
export const KB_MAX_BYTES = 50 * 1024 * 1024; // 50MB

export function extOf(fileName: string): string {
  const i = fileName.lastIndexOf(".");
  return i >= 0 ? fileName.slice(i + 1).toLowerCase() : "";
}

export type KbUploadValidation =
  | { ok: true }
  | { ok: false; reason: "unsupported_type" | "too_large"; message: string };

/** 类型 + 大小校验，前端预检和后端二次校验共用同一规则（不可只在前端做，防绕过）。 */
export function validateKbUpload(fileName: string, sizeBytes: number): KbUploadValidation {
  const ext = extOf(fileName);
  if (!KB_ALLOWED_EXT.includes(ext)) {
    return {
      ok: false,
      reason: "unsupported_type",
      message: `不支持的文件类型 .${ext || "?"}（仅 ${KB_ALLOWED_EXT.join("/")}）`,
    };
  }
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return { ok: false, reason: "too_large", message: "文件大小无效" };
  }
  if (sizeBytes > KB_MAX_BYTES) {
    return { ok: false, reason: "too_large", message: "文件过大（上限 50MB）" };
  }
  return { ok: true };
}

// ─── AVA 聊天附件（p9-F08）：独立的 key 前缀/校验规则，与 KB 隔离 ──────────────
// 支持图片/音频/常见文档；上限更小（聊天场景不需要 KB 级的大文件）。

export const AVA_ALLOWED_EXT = [
  // 图片
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  // 音频
  "mp3",
  "wav",
  "m4a",
  "ogg",
  // 常见文档
  "pdf",
  "txt",
  "md",
  "doc",
  "docx",
  "csv",
];
export const AVA_MAX_BYTES = 20 * 1024 * 1024; // 20MB
export const AVA_MAX_ATTACHMENTS_PER_MESSAGE = 5;

export type AvaAttachmentKind = "image" | "audio" | "file";

/** 按扩展名归类，用于前端预览条决定缩略图（image）/波形图标（audio）/通用文件图标（file）。 */
export function avaAttachmentKind(fileName: string): AvaAttachmentKind {
  const ext = extOf(fileName);
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) return "image";
  if (["mp3", "wav", "m4a", "ogg"].includes(ext)) return "audio";
  return "file";
}

export function buildAvaObjectKey(params: {
  ownerId: string | number;
  attachmentId: string;
  fileName: string;
}): string {
  const safeName = params.fileName.replace(/[/\\]/g, "_");
  return `ava/${params.ownerId}/${params.attachmentId}/${safeName}`;
}

/** 类型 + 大小 + 数量校验，前端预检和后端二次校验共用同一规则（不可只在前端做，防绕过）。 */
export function validateAvaUpload(
  fileName: string,
  sizeBytes: number
): KbUploadValidation {
  const ext = extOf(fileName);
  if (!AVA_ALLOWED_EXT.includes(ext)) {
    return {
      ok: false,
      reason: "unsupported_type",
      message: `不支持的文件类型 .${ext || "?"}（仅支持图片/音频/常见文档）`,
    };
  }
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return { ok: false, reason: "too_large", message: "文件大小无效" };
  }
  if (sizeBytes > AVA_MAX_BYTES) {
    return { ok: false, reason: "too_large", message: "文件过大（上限 20MB）" };
  }
  return { ok: true };
}

// ─── 客户端（单例）──────────────────────────────────────────────────────────

let client: S3Client | undefined;
let cfg: StorageConfig | undefined;

function getClient(): { client: S3Client; cfg: StorageConfig } {
  if (!client || !cfg) {
    cfg = resolveStorageConfig();
    client = new S3Client({
      endpoint: cfg.endpoint,
      region: cfg.region,
      credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
      forcePathStyle: cfg.forcePathStyle,
    });
  }
  return { client, cfg };
}

/** 确保桶存在（本地开发体验；生产环境由运维预建，此调用是幂等的 no-op）。 */
export async function ensureBucket(): Promise<void> {
  const { client, cfg } = getClient();
  try {
    await client.send(new HeadBucketCommand({ Bucket: cfg.bucket }));
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: cfg.bucket }));
  }
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  const { client, cfg } = getClient();
  await client.send(
    new PutObjectCommand({ Bucket: cfg.bucket, Key: key, Body: body, ContentType: contentType })
  );
}

export async function getObjectStream(key: string): Promise<Readable> {
  const { client, cfg } = getClient();
  const res = await client.send(new GetObjectCommand({ Bucket: cfg.bucket, Key: key }));
  return res.Body as Readable;
}

export async function deleteObject(key: string): Promise<void> {
  const { client, cfg } = getClient();
  await client.send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: key }));
}

/** 带鉴权的临时下载 URL（默认 5 分钟过期），不泄露对象存储直链/凭据。 */
export async function presignGetUrl(key: string, expiresInSeconds = 300): Promise<string> {
  const { client, cfg } = getClient();
  return getSignedUrl(client, new GetObjectCommand({ Bucket: cfg.bucket, Key: key }), {
    expiresIn: expiresInSeconds,
  });
}

/** 测试/关闭期用：重置单例，便于隔离测试环境配置。 */
export function resetStorageClient(): void {
  client = undefined;
  cfg = undefined;
}
