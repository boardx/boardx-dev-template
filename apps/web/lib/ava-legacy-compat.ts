import { defaultGateway } from "@repo/ai";

export const LEGACY_AVA_MODEL_ID = "stub:legacy-ava";
export const LEGACY_SAFE_MODEL_ID = "stub:default";

export interface LegacyAvaWidgetRequest {
  prompt?: string;
  image?: string;
  model?: string;
  targetData?: string;
  outputFormat?: unknown[];
  storeItemId?: string;
  boardId?: string;
  teamId?: string;
  format?: string;
  responseFormat?: "markdown" | "json" | string;
  artifactGeneration?: unknown;
  isMultigroup?: boolean;
  messageId?: string;
  requestId?: string;
  sessionId?: string;
  creditOwnerType?: "user" | "team";
  maxTokens?: number;
}

export interface LegacyAvaMessage {
  role?: string;
  content?: unknown;
}

export interface LegacyAvaChatRequest {
  messages?: Array<string | LegacyAvaMessage>;
  threadId?: string;
  prompt?: string;
  images?: string[];
  model?: string;
  teamId?: string;
}

export interface LegacyAvaTranslateRequest {
  text?: string;
  targetLanguage?: string;
  teamId?: string;
}

export interface LegacyAvaDigitizeRequest {
  imageUrl?: string;
  teamId?: string;
}

export function getLegacyAvaModel(user: string): string {
  return `${LEGACY_AVA_MODEL_ID}${user}`;
}

export function normalizeLegacyAvaModel(model: string | undefined): string {
  if (model?.startsWith("stub:")) return model;
  if (model?.startsWith("qwen")) return model;
  return LEGACY_SAFE_MODEL_ID;
}

export function buildLegacyWidgetPrompt(data: LegacyAvaWidgetRequest): string {
  const prompt = data.prompt?.trim() || "Complete the requested AVA widget task.";
  const targetData = data.targetData?.trim();
  const image = data.image?.trim();
  const format = data.responseFormat || data.format;
  return [
    prompt,
    targetData ? `Target data: ${targetData}` : "",
    image ? `Image: ${image}` : "",
    format ? `Response format: ${format}` : "",
    data.isMultigroup ? "Return a JSON-compatible multi-group result." : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildLegacyChatPrompt(data: LegacyAvaChatRequest): string {
  const history = Array.isArray(data.messages)
    ? data.messages.map(formatLegacyMessage).filter(Boolean).join("\n")
    : "";
  const images = Array.isArray(data.images) && data.images.length ? `Images: ${data.images.join(", ")}` : "";
  return [history, data.prompt?.trim(), images].filter(Boolean).join("\n") || "Continue the AVA chat.";
}

export function formatLegacyMessage(message: string | LegacyAvaMessage): string {
  if (typeof message === "string") return message.trim();
  const role = typeof message.role === "string" && message.role.trim() ? message.role.trim() : "user";
  const content = stringifyLegacyContent(message.content).trim();
  return content ? `${role}: ${content}` : "";
}

function stringifyLegacyContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (content == null) return "";
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) return String((part as { text?: unknown }).text ?? "");
        if (part && typeof part === "object" && "image_url" in part) {
          return `[image: ${String((part as { image_url?: unknown }).image_url ?? "")}]`;
        }
        return JSON.stringify(part);
      })
      .filter(Boolean)
      .join("\n");
  }
  return JSON.stringify(content);
}

export function buildLegacyTitle(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "New AVA chat";
  const words = normalized.split(" ").slice(0, 8).join(" ");
  return words.length > 72 ? `${words.slice(0, 69)}...` : words;
}

export async function runLegacyAvaText(
  model: string | undefined,
  content: string,
  settings?: { agentId?: string; toolIds?: string[] }
): Promise<string> {
  let output = "";
  for await (const token of defaultGateway.streamChat({
    modelId: normalizeLegacyAvaModel(model),
    messages: [{ role: "user", content }],
    settings: {
      agentId: settings?.agentId ?? "legacy-ava",
      toolIds: settings?.toolIds ?? ["board-context"],
    },
  })) {
    output += token;
  }
  return output;
}

export async function runLegacyWidget(data: LegacyAvaWidgetRequest): Promise<unknown> {
  const text = await runLegacyAvaText(data.model, buildLegacyWidgetPrompt(data));
  if (data.isMultigroup || data.responseFormat === "json") {
    return {
      result: text,
      format: "json",
      requestId: data.requestId ?? null,
      messageId: data.messageId ?? null,
    };
  }
  return text;
}

export async function runLegacyChat(data: LegacyAvaChatRequest): Promise<string> {
  return runLegacyAvaText(data.model, buildLegacyChatPrompt(data));
}

export async function streamLegacyChatData(data: LegacyAvaChatRequest): Promise<ReadableStream<Uint8Array>> {
  const encoder = new TextEncoder();
  const modelId = normalizeLegacyAvaModel(data.model);
  const prompt = buildLegacyChatPrompt(data);
  return new ReadableStream({
    async start(controller) {
      try {
        for await (const token of defaultGateway.streamChat({
          modelId,
          messages: [{ role: "user", content: prompt }],
          settings: { agentId: "legacy-ava", toolIds: ["board-context"] },
        })) {
          controller.enqueue(encoder.encode(`0:${JSON.stringify(token)}\n`));
        }
        controller.enqueue(
          encoder.encode('d:{"finishReason":"stop","usage":{"promptTokens":0,"completionTokens":0,"totalTokens":0}}\n')
        );
      } catch (error) {
        console.error(error);
        controller.enqueue(encoder.encode(`9:${JSON.stringify({ message: "AVA chat request failed" })}\n`));
      } finally {
        controller.close();
      }
    },
  });
}

export async function readLegacyJson<T>(request: Request): Promise<T> {
  return (await request.json()) as T;
}

export function legacyErrorResponse(message: string, status = 500): Response {
  return Response.json({ error: message }, { status });
}

export async function runLegacyTranslation(data: LegacyAvaTranslateRequest): Promise<string> {
  const targetLanguage = data.targetLanguage?.trim() || "en";
  const text = data.text?.trim() || "";
  return runLegacyAvaText(LEGACY_SAFE_MODEL_ID, `Translate this text to ${targetLanguage}:\n${text}`);
}

export async function runLegacyDigitize(data: LegacyAvaDigitizeRequest): Promise<{
  imageUrl: string;
  widgets: Array<{ type: "note"; text: string; x: number; y: number }>;
}> {
  const imageUrl = data.imageUrl?.trim() || "";
  const summary = await runLegacyAvaText(
    LEGACY_SAFE_MODEL_ID,
    `Digitize this whiteboard image into concise sticky-note widgets:\n${imageUrl}`
  );
  return {
    imageUrl,
    widgets: [
      {
        type: "note",
        text: summary,
        x: 120,
        y: 120,
      },
    ],
  };
}
