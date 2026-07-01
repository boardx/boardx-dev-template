// packages/storage/src/index.test.ts — 纯逻辑单测（配置解析 + key 规范），不连真实 S3。
import { describe, it, expect } from "vitest";
import { resolveStorageConfig, buildKbObjectKey, validateKbUpload, extOf } from "./index";

describe("resolveStorageConfig", () => {
  it("默认值对齐本地 docker-compose 的 MinIO", () => {
    const cfg = resolveStorageConfig({} as NodeJS.ProcessEnv);
    expect(cfg.endpoint).toBe("http://localhost:9090");
    expect(cfg.bucket).toBe("boardx-kb");
    expect(cfg.forcePathStyle).toBe(true);
  });

  it("环境变量可覆盖", () => {
    const cfg = resolveStorageConfig({
      S3_ENDPOINT: "http://minio.internal:9000",
      S3_BUCKET: "custom-bucket",
    } as NodeJS.ProcessEnv);
    expect(cfg.endpoint).toBe("http://minio.internal:9000");
    expect(cfg.bucket).toBe("custom-bucket");
  });
});

describe("buildKbObjectKey", () => {
  it("按 scope/owner/fileId 隔离，避免越权碰撞", () => {
    const key = buildKbObjectKey({
      scope: "personal",
      ownerId: 42,
      fileId: "kbf_1",
      fileName: "notes.pdf",
    });
    expect(key).toBe("kb/personal/42/kbf_1/notes.pdf");
  });

  it("文件名里的路径分隔符被替换，防目录穿越", () => {
    const key = buildKbObjectKey({
      scope: "team",
      ownerId: "t7",
      fileId: "kbf_2",
      fileName: "../../etc/passwd",
    });
    expect(key).toBe("kb/team/t7/kbf_2/.._.._etc_passwd");
  });
});

describe("extOf", () => {
  it("提取小写扩展名", () => {
    expect(extOf("Notes.PDF")).toBe("pdf");
  });
  it("无扩展名返回空串", () => {
    expect(extOf("README")).toBe("");
  });
});

describe("validateKbUpload", () => {
  it("允许类型 + 合法大小 → ok", () => {
    expect(validateKbUpload("spec.pdf", 1024)).toEqual({ ok: true });
  });

  it("不支持的类型 → unsupported_type", () => {
    const r = validateKbUpload("virus.exe", 1024);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("unsupported_type");
  });

  it("超过 50MB → too_large", () => {
    const r = validateKbUpload("big.pdf", 51 * 1024 * 1024);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("too_large");
  });

  it("大小为 0 或非法 → too_large（无效大小视为不合法）", () => {
    expect(validateKbUpload("empty.pdf", 0).ok).toBe(false);
    expect(validateKbUpload("bad.pdf", NaN).ok).toBe(false);
  });
});
