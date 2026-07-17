import { describe, expect, it } from "vitest";
import {
  buildLegacyChatPrompt,
  buildLegacyTitle,
  buildLegacyWidgetPrompt,
  formatLegacyMessage,
  getLegacyAvaModel,
  normalizeLegacyAvaModel,
  runLegacyDigitize,
  runLegacyWidget,
} from "./ava-legacy-compat";

describe("legacy AVA compatibility helpers", () => {
  it("keeps the old getModel shape by appending the user segment", () => {
    expect(getLegacyAvaModel("user-7")).toBe("stub:legacy-avauser-7");
  });

  it("normalizes old provider names to the current safe AVA stub model", () => {
    expect(normalizeLegacyAvaModel("claude")).toBe("stub:default");
    expect(normalizeLegacyAvaModel("gemini")).toBe("stub:default");
    expect(normalizeLegacyAvaModel("stub:planner")).toBe("stub:planner");
  });

  it("builds widget and chat prompts from legacy DTO fields", () => {
    expect(
      buildLegacyWidgetPrompt({
        prompt: "Summarize",
        targetData: "Quarterly revenue notes",
        image: "https://example.test/board.png",
        responseFormat: "markdown",
      })
    ).toContain("Target data: Quarterly revenue notes");

    expect(
      buildLegacyChatPrompt({
        messages: ["Earlier message", { role: "assistant", content: "Previous answer" }],
        prompt: "What changed?",
        images: ["https://example.test/a.png"],
      })
    ).toContain("assistant: Previous answer");
  });

  it("formats legacy role/content messages without [object Object] corruption", () => {
    expect(formatLegacyMessage({ role: "user", content: "Hello" })).toBe("user: Hello");
    expect(formatLegacyMessage({ role: "assistant", content: [{ type: "text", text: "Answer" }] })).toBe(
      "assistant: Answer"
    );
  });

  it("creates bounded AVA titles from legacy title requests", () => {
    expect(buildLegacyTitle("  Explain the migration plan for AVA compatibility endpoints  ")).toBe(
      "Explain the migration plan for AVA compatibility endpoints"
    );
    expect(buildLegacyTitle("")).toBe("New AVA chat");
  });

  it("returns deterministic widget and digitize results through the current AI gateway", async () => {
    const widget = await runLegacyWidget({
      prompt: "List next steps",
      targetData: "AVA migration",
      responseFormat: "json",
      isMultigroup: true,
      requestId: "req-1",
    });
    expect(widget).toMatchObject({ format: "json", requestId: "req-1" });

    const digitized = await runLegacyDigitize({ imageUrl: "https://example.test/board.png" });
    expect(digitized.imageUrl).toBe("https://example.test/board.png");
    expect(digitized.widgets[0]?.type).toBe("note");
    expect(digitized.widgets[0]?.text).toContain("AVA");
  });
});
