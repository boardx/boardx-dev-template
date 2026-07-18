"use client";
// apps/web/components/voice-input.tsx — 通用语音录制+转写控件（P18 F07 起交付于 AVA）
//
// 差距：phase-p9-ava-chat 的 F09（语音输入）此前 blocked——不仅转写服务（STT）未就绪，
// 连"点麦克风→请求权限→录音中看到时长/音量→结束"这条纯前端路径都完全没有实现（无
// MediaRecorder、无麦克风按钮）。本组件把这条纯前端路径做实：真实
// `getUserMedia` 权限请求 + 真实 `MediaRecorder` 录音 + 真实 `AnalyserNode` 音量可视化 +
// 真实计时器；录音结束后把录制的音频 Blob POST 到 /api/ava/transcribe，由该端点调用
// P18 F06 落地的 STT provider（`packages/ai` `transcribeAudio`，OpenAI Whisper API）
// 做真实转写，转写结果经 `onTranscribed` 回调交给调用方处理（不关心回填到哪，AVA 回填
// 输入框，Board（p7:F10）用来创建文本组件）。
//
// 从 app/(app)/ava/voice-input.tsx 挪到这个共享位置（p7:F10 起）：转写这条前端路径与
// AVA 业务完全解耦，Board 复用同一套录音/波形/错误处理，没有理由为第二个消费者复制一份。
// API 端点 /api/ava/transcribe 命名带 "ava" 前缀是历史遗留（p18 交付时的路由归属），
// 但接口本身与业务无关，跨域复用不需要为此新开路由。
//
// 边界状态覆盖 uc-ava-008：权限拒绝 / 无麦克风 / 浏览器不支持 / 录音过短 / 转写失败
// （含服务端体积超限 413 / MIME 不在白名单 415，均复用同一个 transcription-failed
// 错误分支——`!res.ok` 对任意非 2xx 状态码统一处理，不需要为 413/415 单开新状态）。
// 取消录音（cancel）不产生任何文本，也不报错。
//
// TODO(F07 覆盖缺口)：voice-error 的 permission-denied / no-device / unsupported /
// too-short 四个分支目前无 e2e 断言（需要 mock getUserMedia 拒绝/无设备，或 mock
// MediaRecorder 不存在，Playwright 目前用 fake-device 走通过路径，尚未验证失败路径）。
// 413/415 已在 ava-voice-input.spec.ts 补了断言，此 TODO 只登记未覆盖部分，不阻断本次修复。
import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type VoiceState = "idle" | "requesting" | "recording" | "transcribing" | "error";
type VoiceErrorReason =
  | "permission-denied"
  | "no-device"
  | "unsupported"
  | "too-short"
  | "transcription-failed";

const ERROR_MESSAGES: Record<VoiceErrorReason, string> = {
  "permission-denied": "麦克风权限被拒绝，请在浏览器设置中允许后重试",
  "no-device": "未检测到麦克风设备",
  unsupported: "当前浏览器不支持语音输入",
  "too-short": "录音时间太短，请重试",
  "transcription-failed": "转写失败，请重试或直接输入文字",
};

const BAR_COUNT = 5;
const MIN_RECORDING_MS = 1000;
const TRANSCRIBE_ENDPOINT = "/api/ava/transcribe";
// MediaRecorder 未显式指定 mimeType 时各浏览器默认不同（Chrome 通常 audio/webm;codecs=opus）。
// 优先用 recorder.mimeType（真实生效的格式）；取不到时退回这个候选，供请求 Content-Type 参考。
const FALLBACK_RECORDING_MIME = "audio/webm";

// 服务端无 OPENAI_API_KEY 时走占位转写（见 route.ts stubTranscribe），返回文本带这个前缀；
// 前端据此判断本次是否为占位结果，向用户显式提示，不让占位文本悄悄冒充真实转写。
const STUB_TRANSCRIBE_MARKER = "[占位转写";

// mimeType → 文件扩展名，按实际 MIME 精确映射（不再用 includes("webm") 的粗糙判断把
// Safari 的 audio/mp4 误标成 .wav），与服务端 /api/ava/transcribe 的同名映射口径一致。
function extForMimeType(mimeType: string): string {
  const normalized = mimeType.toLowerCase();
  if (normalized.startsWith("audio/webm")) return "webm";
  if (normalized.startsWith("audio/ogg")) return "ogg";
  if (normalized.startsWith("audio/mp4")) return "mp4";
  if (normalized.startsWith("audio/mpeg")) return "mp3";
  if (
    normalized.startsWith("audio/wav") ||
    normalized.startsWith("audio/x-wav") ||
    normalized.startsWith("audio/wave")
  )
    return "wav";
  return "webm";
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function VoiceInputControl({
  onTranscribed,
  disabled,
}: {
  onTranscribed: (text: string) => void;
  disabled?: boolean;
}) {
  const [state, setState] = useState<VoiceState>("idle");
  const [errorReason, setErrorReason] = useState<VoiceErrorReason | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [levels, setLevels] = useState<number[]>(Array(BAR_COUNT).fill(0.15));
  // 上一次转写是否命中了服务端占位 stub（无 OPENAI_API_KEY 时）——用于向用户显式提示
  // "当前使用占位转写"，而不是让占位文本悄悄表现得像真实转写结果。
  const [usedStub, setUsedStub] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);
  const cancelledRef = useRef(false);
  const chunksRef = useRef<Blob[]>([]);

  const teardown = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (timerRef.current != null) clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      void audioCtxRef.current.close();
    }
    audioCtxRef.current = null;
    analyserRef.current = null;
    recorderRef.current = null;
  }, []);

  useEffect(() => teardown, [teardown]);

  const runLevelLoop = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const step = () => {
      analyser.getByteFrequencyData(data);
      const bins = Math.floor(data.length / BAR_COUNT);
      const next = Array.from({ length: BAR_COUNT }, (_, i) => {
        const slice = data.slice(i * bins, (i + 1) * bins);
        const avg = slice.reduce((sum, v) => sum + v, 0) / (slice.length || 1);
        return Math.min(1, Math.max(0.12, avg / 160));
      });
      setLevels(next);
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  }, []);

  const startRecording = useCallback(async () => {
    setErrorReason(null);
    setUsedStub(false);
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setState("error");
      setErrorReason("unsupported");
      return;
    }
    setState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      cancelledRef.current = false;

      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx: AudioContext = new AudioContextCtor();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      audioCtxRef.current = audioCtx;
      analyserRef.current = analyser;

      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start();
      startedAtRef.current = Date.now();
      setElapsedMs(0);
      setState("recording");
      runLevelLoop();
      timerRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startedAtRef.current);
      }, 200);

      recorder.onstop = () => {
        const durationMs = Date.now() - startedAtRef.current;
        const mimeType = recorder.mimeType || FALLBACK_RECORDING_MIME;
        const audioBlob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];
        teardown();
        if (cancelledRef.current) {
          setState("idle");
          return;
        }
        if (durationMs < MIN_RECORDING_MS) {
          setState("error");
          setErrorReason("too-short");
          return;
        }
        setState("transcribing");
        void (async () => {
          try {
            const formData = new FormData();
            formData.append("file", audioBlob, `recording.${extForMimeType(mimeType)}`);
            const res = await fetch(TRANSCRIBE_ENDPOINT, { method: "POST", body: formData });
            if (!res.ok) throw new Error(`transcribe failed: ${res.status}`);
            const data = (await res.json()) as { text?: string };
            if (!data.text) throw new Error("transcribe response missing text");
            setUsedStub(data.text.startsWith(STUB_TRANSCRIBE_MARKER));
            setState("idle");
            onTranscribed(data.text);
          } catch {
            setState("error");
            setErrorReason("transcription-failed");
          }
        })();
      };
    } catch (err) {
      teardown();
      setState("error");
      const name = (err as { name?: string })?.name;
      setErrorReason(name === "NotFoundError" ? "no-device" : "permission-denied");
    }
  }, [onTranscribed, runLevelLoop, teardown]);

  const stopRecording = useCallback(() => {
    cancelledRef.current = false;
    recorderRef.current?.stop();
  }, []);

  const cancelRecording = useCallback(() => {
    cancelledRef.current = true;
    recorderRef.current?.stop();
  }, []);

  if (state === "recording") {
    return (
      <div
        data-testid="voice-recording-indicator"
        className="flex h-8 items-center gap-2 rounded-9 bg-destructive/10 px-2.5 text-destructive"
      >
        <span className="h-1.5 w-1.5 flex-none animate-pulse rounded-full bg-destructive" />
        <span className="w-9 flex-none font-mono text-11 tabular-nums">{formatElapsed(elapsedMs)}</span>
        <span className="flex h-4 flex-none items-end gap-0.5" aria-hidden="true">
          {levels.map((level, i) => (
            <span
              key={i}
              className="w-0.5 rounded-full bg-destructive transition-[height] duration-75"
              style={{ height: `${Math.round(level * 100)}%` }}
            />
          ))}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          data-testid="voice-cancel"
          aria-label="Cancel recording"
          className="h-6 w-6 text-destructive hover:bg-destructive/20 hover:text-destructive"
          onClick={cancelRecording}
        >
          <X className="h-3.5 w-3.5" strokeWidth={2} />
        </Button>
        <Button
          type="button"
          size="icon"
          data-testid="voice-stop"
          aria-label="Stop recording"
          className="h-6 w-6 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
          onClick={stopRecording}
        >
          <Square className="h-2.5 w-2.5" strokeWidth={2} fill="currentColor" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        data-testid="voice-input-trigger"
        aria-label="Use voice input"
        className="h-8 w-8 flex-none"
        disabled={disabled || state === "requesting" || state === "transcribing"}
        onClick={() => void startRecording()}
      >
        {state === "requesting" || state === "transcribing" ? (
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
        ) : (
          <Mic className="h-4 w-4" strokeWidth={1.5} />
        )}
      </Button>
      {state === "transcribing" && (
        <span data-testid="voice-transcribing" className="text-11 text-muted-foreground">
          转写中…
        </span>
      )}
      {state === "error" && errorReason && (
        <p role="alert" data-testid="voice-error" className="text-11 text-destructive">
          {ERROR_MESSAGES[errorReason]}
        </p>
      )}
      {state === "idle" && usedStub && (
        <span data-testid="voice-stub-notice" className="text-11 text-muted-foreground">
          当前使用占位转写（未配置转写服务）
        </span>
      )}
    </div>
  );
}
