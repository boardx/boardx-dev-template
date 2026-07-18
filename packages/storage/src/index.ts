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

/** 从环境变量解析对象存储配置。默认对齐 infra/docker-compose.yml 的本地 MinIO。
 *  生产环境（NODE_ENV=production）禁止回退默认口令：缺 S3_ACCESS_KEY / S3_SECRET_KEY
 *  直接抛错 fail-fast，宁可起不来也不能带着 boardx/boardx123 上线（p29-F01 gitleaks 审计项）。 */
export function resolveStorageConfig(env: NodeJS.ProcessEnv = process.env): StorageConfig {
  const isProduction = env.NODE_ENV === "production";
  const accessKeyId = env.S3_ACCESS_KEY?.trim();
  const secretAccessKey = env.S3_SECRET_KEY?.trim();
  if (isProduction && (!accessKeyId || !secretAccessKey)) {
    const missing = [
      !accessKeyId ? "S3_ACCESS_KEY" : null,
      !secretAccessKey ? "S3_SECRET_KEY" : null,
    ].filter(Boolean);
    throw new Error(
      `[storage] NODE_ENV=production 下缺少 ${missing.join(" / ")}，` +
        "拒绝回退到默认凭据（boardx/boardx123）。请在部署环境显式配置对象存储凭据。"
    );
  }
  return {
    endpoint: env.S3_ENDPOINT ?? "http://localhost:9090",
    region: env.S3_REGION ?? "us-east-1",
    accessKeyId: accessKeyId ?? "boardx",
    secretAccessKey: secretAccessKey ?? "boardx123",
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

// ─── Studio 制品对象 key：studio/{roomId}/{chatId}/{artifactId}/{文件名}（P12 F01）──
// 与 kb/ 前缀区分命名空间，同一 bucket 内隔离 studio 生成产物与知识库文件。

export function buildStudioObjectKey(params: {
  roomId: string | number;
  chatId: string | number;
  artifactId: string;
  fileName: string;
}): string {
  const safeName = params.fileName.replace(/[/\\]/g, "_");
  return `studio/${params.roomId}/${params.chatId}/${params.artifactId}/${safeName}`;
}

// ─── 演示文稿制品对象 key：presentations/{roomId}/{chatId}/{artifactId}/{文件名}（P12 F02）──
// 独立前缀，与 studio/、kb/ 隔离命名空间。一个制品有 PPTX + PDF 两个 key（见 presentations.ts）。

export function buildPresentationObjectKey(params: {
  roomId: string | number;
  chatId: string | number;
  artifactId: string;
  fileName: string;
}): string {
  const safeName = params.fileName.replace(/[/\\]/g, "_");
  return `presentations/${params.roomId}/${params.chatId}/${params.artifactId}/${safeName}`;
}

// ─── 房间级文件库对象 key：rooms/{roomId}/files/{fileId}/{文件名}（p20-F03，uc-rr-003）──
// 独立前缀，与 kb/、ava/ 等隔离命名空间；房间是唯一的所有权边界，chat_thread_id 不进 key
// （它只是元数据里的来源标注，不是存储路径的一部分——同一房间文件不因线程视角不同而重复存储）。

export const ROOM_FILE_ALLOWED_EXT = [
  "pdf",
  "txt",
  "md",
  "doc",
  "docx",
  "json",
  "csv",
  "xlsx",
  "xls",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
];
export const ROOM_FILE_MAX_BYTES = 50 * 1024 * 1024; // 50MB，与 KB 上传平面同口径

export function buildRoomFileObjectKey(params: {
  roomId: string | number;
  fileId: string;
  fileName: string;
}): string {
  const safeName = params.fileName.replace(/[/\\]/g, "_");
  return `rooms/${params.roomId}/files/${params.fileId}/${safeName}`;
}

// ─── 白板封面对象 key：board-covers/{boardId}/{时间戳}.{ext}（p24 board-mgmt）──
// 上传的封面把 objectKey 存进 boards.cover；展示时经服务端签发临时 GET URL。
// 时间戳做唯一后缀，避免同板多次上传的缓存串（无 Math.random 依赖，毫秒足够）。

export const BOARD_COVER_ALLOWED_EXT = ["png", "jpg", "jpeg", "webp", "gif"];
export const BOARD_COVER_MAX_BYTES = 5 * 1024 * 1024; // 5MB

export function buildBoardCoverObjectKey(params: { boardId: number; fileName: string }): string {
  const ext = extOf(params.fileName) || "png";
  return `board-covers/${params.boardId}/${Date.now()}.${ext}`;
}

/** 类型 + 大小校验，前后端共用同一规则（服务端二次校验用,防绕过）。 */
export function validateRoomFileUpload(fileName: string, sizeBytes: number): KbUploadValidation {
  const ext = extOf(fileName);
  if (!ROOM_FILE_ALLOWED_EXT.includes(ext)) {
    return {
      ok: false,
      reason: "unsupported_type",
      message: `Unsupported file type .${ext || "?"}`,
    };
  }
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return { ok: false, reason: "too_large", message: "文件大小无效" };
  }
  if (sizeBytes > ROOM_FILE_MAX_BYTES) {
    return { ok: false, reason: "too_large", message: "文件过大（上限 50MB）" };
  }
  return { ok: true };
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
let bucketReady: Promise<void> | undefined;

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
  if (!bucketReady) {
    bucketReady = (async () => {
      const { client, cfg } = getClient();
      try {
        await client.send(new HeadBucketCommand({ Bucket: cfg.bucket }));
      } catch {
        await client.send(new CreateBucketCommand({ Bucket: cfg.bucket }));
      }
    })().catch((err) => {
      bucketReady = undefined;
      throw err;
    });
  }
  return bucketReady;
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

/** 带鉴权的临时直传 URL（默认 5 分钟过期）：前端拿到后用 PUT 直接写对象存储，
 *  写完再调用 confirm 接口落库（p20-F03 房间文件"预签名→直传→confirm"上传平面）。 */
export async function presignPutUrl(
  key: string,
  contentType: string,
  expiresInSeconds = 300
): Promise<string> {
  const { client, cfg } = getClient();
  return getSignedUrl(
    client,
    new PutObjectCommand({ Bucket: cfg.bucket, Key: key, ContentType: contentType }),
    { expiresIn: expiresInSeconds }
  );
}

/** 测试/关闭期用：重置单例，便于隔离测试环境配置。 */
export function resetStorageClient(): void {
  client = undefined;
  cfg = undefined;
  bucketReady = undefined;
}
