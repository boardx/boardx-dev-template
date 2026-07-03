// packages/ai/src/sttProvider.ts — STT 转写 provider：OpenAI Whisper API（P18 F06）
//
// CAP-AI 的第一个语音转写（Speech-to-Text）能力，解开 p9-F09 ↔ p7-F10 的循环阻塞：
// 两边今后统一依赖本能力，而不是互相指望对方。
//
// 与 anthropicProvider 同一手法：零 SDK 依赖，直接 fetch OpenAI 的
// POST /v1/audio/transcriptions（multipart/form-data，model=whisper-1），
// 拿到 { text } 即返回。选型理由见 requirements/03-voice-input-stt.md
// 「选型决策（F06 落地）」一节。
//
// 配置（均走环境变量，凭证不进代码库）：
//   OPENAI_API_KEY  必填。缺失时调用抛出可读错误（不发请求，上层可落失败态）。
//   STT_BASE_URL    可选。默认官方端点；可指向兼容 Whisper API 的代理/自建网关。
//   STT_MODEL       可选。默认 whisper-1。

export const DEFAULT_STT_BASE_URL = "https://api.openai.com";
export const DEFAULT_STT_MODEL = "whisper-1";

export interface TranscribeAudioInput {
  /** 音频原始字节（如 MediaRecorder 产出的 webm/wav）。 */
  audio: Uint8Array | ArrayBuffer;
  /** MIME 类型，默认 audio/wav。影响服务端解码器选择。 */
  mimeType?: string;
  /** multipart 里的文件名（Whisper 依据扩展名辅助判断格式），默认 audio.wav。 */
  filename?: string;
  /** ISO-639-1 语言提示（如 "zh"）。可选，缺省由服务端自动检测。 */
  language?: string;
}

export interface TranscribeResult {
  text: string;
}

export interface SttProvider {
  transcribeAudio(input: TranscribeAudioInput): Promise<TranscribeResult>;
}

export interface SttProviderOptions {
  /** 显式传入 key；缺省时每次调用读 process.env.OPENAI_API_KEY（支持运行中更换）。 */
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  /** 测试注入用；缺省用全局 fetch。 */
  fetchImpl?: typeof fetch;
}

/** 统一成 Uint8Array，供 Blob 构造（lib 无 DOM，但 Node 18+ 全局有 Blob/FormData）。 */
function toBytes(audio: Uint8Array | ArrayBuffer): Uint8Array {
  return audio instanceof Uint8Array ? audio : new Uint8Array(audio);
}

export function createSttProvider(options: SttProviderOptions = {}): SttProvider {
  const resolveKey = () => options.apiKey ?? process.env.OPENAI_API_KEY ?? "";
  const resolveBaseUrl = () =>
    (options.baseUrl ?? process.env.STT_BASE_URL ?? DEFAULT_STT_BASE_URL).replace(/\/$/, "");
  const resolveModel = () => options.model ?? process.env.STT_MODEL ?? DEFAULT_STT_MODEL;
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    async transcribeAudio(input: TranscribeAudioInput): Promise<TranscribeResult> {
      const apiKey = resolveKey();
      if (!apiKey) {
        throw new Error(
          "STT provider 未配置：缺少 OPENAI_API_KEY（在 .env 配置后重试；可用 STT_BASE_URL 指向兼容 Whisper API 的自建端点）"
        );
      }

      const form = new FormData();
      const bytes = toBytes(input.audio);
      form.append(
        "file",
        new Blob([bytes], { type: input.mimeType ?? "audio/wav" }),
        input.filename ?? "audio.wav"
      );
      form.append("model", resolveModel());
      if (input.language) form.append("language", input.language);

      const res = await fetchImpl(`${resolveBaseUrl()}/v1/audio/transcriptions`, {
        method: "POST",
        headers: {
          // 不手写 content-type：multipart 边界由运行时按 FormData 自动生成。
          authorization: `Bearer ${apiKey}`,
        },
        body: form,
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(
          `STT API 请求失败（HTTP ${res.status}）${detail ? `: ${detail.slice(0, 300)}` : ""}`
        );
      }

      const json = (await res.json().catch(() => null)) as { text?: unknown } | null;
      if (!json || typeof json.text !== "string") {
        throw new Error("STT API 响应缺少 text 字段（期望 JSON { text: string }）");
      }
      return { text: json.text };
    },
  };
}

/** 默认实例：key/baseUrl/model 全部走环境变量（调用时读取，无 key 环境只在真正转写时才报错）。 */
export const sttProvider: SttProvider = createSttProvider();

/** 便捷函数形态：transcribeAudio(input) → Promise<{ text }>，走默认实例。 */
export function transcribeAudio(input: TranscribeAudioInput): Promise<TranscribeResult> {
  return sttProvider.transcribeAudio(input);
}
