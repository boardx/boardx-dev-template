import { describe, expect, it } from "vitest";
import { normalizeFeedbackAttachments } from "./feedback";

describe("normalizeFeedbackAttachments", () => {
  it("只保留最多三张合法图片附件", () => {
    const out = normalizeFeedbackAttachments([
      { name: "a.png", type: "image/png", dataUrl: "data:image/png;base64,aaa" },
      { name: "b.jpg", type: "image/jpeg", dataUrl: "data:image/jpeg;base64,bbb" },
      { name: "bad.txt", type: "text/plain", dataUrl: "data:text/plain;base64,ccc" },
      { name: "c.gif", type: "image/gif", dataUrl: "data:image/gif;base64,ddd" },
      { name: "d.webp", type: "image/webp", dataUrl: "data:image/webp;base64,eee" },
    ]);

    expect(out).toEqual([
      { name: "a.png", type: "image/png", dataUrl: "data:image/png;base64,aaa" },
      { name: "b.jpg", type: "image/jpeg", dataUrl: "data:image/jpeg;base64,bbb" },
      { name: "c.gif", type: "image/gif", dataUrl: "data:image/gif;base64,ddd" },
    ]);
  });

  it("非数组或非法记录返回空数组", () => {
    expect(normalizeFeedbackAttachments(null)).toEqual([]);
    expect(normalizeFeedbackAttachments([{ name: "", type: "image/png", dataUrl: "data:image/png;base64,a" }])).toEqual([]);
    expect(normalizeFeedbackAttachments([{ name: "x.png", type: "image/png", dataUrl: "http://example.test/x.png" }])).toEqual([]);
  });
});
