import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@repo/storage", () => ({
  buildStudioObjectKey: vi.fn(
    (p: { roomId: number; chatId: number; artifactId: string; fileName: string }) =>
      `studio/${p.roomId}/${p.chatId}/${p.artifactId}/${p.fileName}`
  ),
  ensureBucket: vi.fn(async () => {}),
  putObject: vi.fn(async () => {}),
}));

import { processStudioJob } from "./studioJob";
import { STUDIO_FORCE_FAIL_MARKER } from "@repo/ai";
import { putObject } from "@repo/storage";

describe("processStudioJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("成功生成 → ready 且写对象存储", async () => {
    const outcome = await processStudioJob({
      artifactId: "sa_1",
      roomId: 1,
      chatId: 2,
      type: "audio",
      source: "current_chat",
      prompt: "总结本周讨论",
      sourceLabel: "当前聊天",
    });
    expect(outcome.status).toBe("ready");
    expect(outcome.objectKey).toContain("studio/1/2/sa_1/");
    expect(outcome.title).toContain("音频概览");
    expect(putObject).toHaveBeenCalledTimes(1);
  });

  it("强制失败触发词 → error，不写对象存储，保留错误信息", async () => {
    const outcome = await processStudioJob({
      artifactId: "sa_2",
      roomId: 1,
      chatId: 2,
      type: "infographic",
      source: "room_files",
      prompt: STUDIO_FORCE_FAIL_MARKER,
      sourceLabel: "房间文件",
    });
    expect(outcome.status).toBe("error");
    expect(outcome.errorMessage).toBeTruthy();
    expect(putObject).not.toHaveBeenCalled();
  });
});
