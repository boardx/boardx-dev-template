import type { FeedbackAttachment } from "@repo/data";

export function normalizeFeedbackAttachments(value: unknown): FeedbackAttachment[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name.slice(0, 160) : "";
    const type = typeof record.type === "string" ? record.type.slice(0, 80) : "";
    const dataUrl = typeof record.dataUrl === "string" ? record.dataUrl : "";
    if (!name || !type.startsWith("image/") || !dataUrl.startsWith("data:image/")) return [];
    return [{ name, type, dataUrl }];
  }).slice(0, 3);
}
