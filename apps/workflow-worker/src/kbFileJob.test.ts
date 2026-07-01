import { describe, it, expect } from "vitest";
import { decideKbFileStatus } from "./kbFileJob";

describe("decideKbFileStatus", () => {
  it("有 objectKey → ready（对象已持久化，视为可处理完成）", () => {
    expect(decideKbFileStatus({ fileId: "kbf_1", objectKey: "kb/personal/1/kbf_1/a.pdf" })).toBe(
      "ready"
    );
  });

  it("objectKey 为空 → error（不吞错误，不假装成功）", () => {
    expect(decideKbFileStatus({ fileId: "kbf_2", objectKey: "" })).toBe("error");
    expect(decideKbFileStatus({ fileId: "kbf_3", objectKey: "   " })).toBe("error");
  });
});
