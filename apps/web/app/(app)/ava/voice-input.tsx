"use client";
// apps/web/app/(app)/ava/voice-input.tsx — AVA 语音输入（P18 UI 先行原型，uc-ava-008）
//
// 差距：phase-p9-ava-chat 的 F09（语音输入）此前 blocked——不仅转写服务（STT）未就绪，
// 连"点麦克风→请求权限→录音中看到时长/音量→结束"这条纯前端路径都完全没有实现（无
// MediaRecorder、无麦克风按钮）。本组件把这条纯前端路径先做实：真实
// `getUserMedia` 权限请求 + 真实 `MediaRecorder` 录音 + 真实 `AnalyserNode` 音量可视化 +
// 真实计时器；唯一 mock 的环节是"转写"——STT 服务本身是另一个能力（见
// phases/phase-p18-ava-ai-realization/requirements/03-voice-input-stt.md），服务就绪前
// 用固定文案代替真实转写结果，明确标注、不假装是真实识别。
//
// 边界状态覆盖 uc-ava-008：权限拒绝 / 无麦克风 / 浏览器不支持 / 录音过短 / 转写失败。
// 取消录音（cancel）不产生任何文本，也不报错。
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

// STT 服务未就绪前的占位转写结果（见 requirements/03-voice-input-stt.md）。
// 真实接入后：用后端转写结果替换这个数组的选取逻辑，其余状态机保持不变。
const MOCK_TRANSCRIPTS = [
  "帮我总结一下这份材料的关键结论。",
  "请把这段内容改写得更简洁一些。",
  "根据以上讨论，列出三个下一步行动项。",
];

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

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);
  const cancelledRef = useRef(false);

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
        // Mock 转写延迟：真实接入 STT 后替换为等待后端响应。
        setTimeout(() => {
          const text = MOCK_TRANSCRIPTS[Math.floor(Math.random() * MOCK_TRANSCRIPTS.length)] ?? MOCK_TRANSCRIPTS[0]!;
          setState("idle");
          onTranscribed(text);
        }, 700);
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
    </div>
  );
}
