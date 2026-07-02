import { describe, it, expect } from "vitest";
import { generateStudioArtifact, STUDIO_FORCE_FAIL_MARKER } from "./studioGenerator";

describe("generateStudioArtifact", () => {
  it("audio 类型产出 mp3 占位内容", async () => {
    const result = await generateStudioArtifact({
      type: "audio",
      source: "current_chat",
      prompt: "聚焦本周决策",
      sourceLabel: "当前聊天",
    });
    expect(result.ext).toBe("mp3");
    expect(result.contentType).toBe("audio/mpeg");
    expect(result.content.length).toBeGreaterThan(0);
    expect(result.title).toContain("音频概览");
  });

  it("infographic 类型产出有效 PNG 占位内容", async () => {
    const result = await generateStudioArtifact({
      type: "infographic",
      source: "room_files",
      prompt: "",
      sourceLabel: "房间文件",
    });
    expect(result.ext).toBe("png");
    expect(result.contentType).toBe("image/png");
    // PNG 魔数
    expect(result.content.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  });

  it("presentation 类型产出占位内容", async () => {
    const result = await generateStudioArtifact({
      type: "presentation",
      source: "room_files",
      prompt: "季度回顾",
      sourceLabel: "房间文件",
    });
    expect(result.ext).toBe("pptx");
    expect(result.title).toContain("演示文稿");
  });

  it("prompt 含强制失败触发词时抛错（确定性验证失败态）", async () => {
    await expect(
      generateStudioArtifact({
        type: "audio",
        source: "current_chat",
        prompt: `测试 ${STUDIO_FORCE_FAIL_MARKER}`,
        sourceLabel: "当前聊天",
      })
    ).rejects.toThrow();
  });
});
