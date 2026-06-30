"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AudioLines, Presentation, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type ArtifactType = "audio" | "slides" | "infographic";

interface Artifact {
  id: string;
  type: ArtifactType;
  title: string;
  prompt: string;
  config: Record<string, string>;
  status: "ready";
  preview: string;
  createdAt: number;
}

const TOOLS: { type: ArtifactType; name: string; desc: string; icon: typeof AudioLines }[] = [
  { type: "audio", name: "音频概览", desc: "双主持人对话式音频，从来源生成。", icon: AudioLines },
  { type: "slides", name: "演示文稿", desc: "结构化幻灯片，附 PPTX 与预览页。", icon: Presentation },
  { type: "infographic", name: "信息图", desc: "单页视觉摘要，按方向与详细度生成。", icon: BarChart3 },
];

const TYPE_LABEL: Record<ArtifactType, string> = {
  audio: "音频概览",
  slides: "演示文稿",
  infographic: "信息图",
};

const textareaCls =
  "flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground transition-colors placeholder:text-placeholder focus-visible:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50";

export default function StudioPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);

  const [type, setType] = useState<ArtifactType>("audio");
  const [prompt, setPrompt] = useState("");
  // slides
  const [format, setFormat] = useState("16:9");
  const [length, setLength] = useState("10");
  // infographic
  const [orientation, setOrientation] = useState("portrait");
  const [detail, setDetail] = useState("standard");

  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      const s = await (await fetch("/api/auth/session")).json();
      if (!alive) return;
      if (!s.user) {
        router.replace("/login");
        return;
      }
      setAuthChecked(true);
      const res = await fetch("/api/studio");
      if (!alive) return;
      if (!res.ok) {
        setError("加载历史制品失败");
        setLoading(false);
        return;
      }
      setArtifacts((await res.json()).artifacts ?? []);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setGenError("");
    setGenerating(true);
    const config: Record<string, string> =
      type === "slides"
        ? { format, length }
        : type === "infographic"
          ? { orientation, detail }
          : {};
    const res = await fetch("/api/studio", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type, prompt, config }),
    });
    if (res.status === 201) {
      const { artifact } = await res.json();
      setArtifacts((prev) => [artifact, ...prev]);
      setPrompt("");
    } else {
      const d = await res.json().catch(() => ({}));
      setGenError(d.errors?.type ?? d.error ?? "生成失败，请重试");
    }
    setGenerating(false);
  }

  if (!authChecked && loading) {
    return (
      <div className="mx-auto max-w-content px-9 pb-14 pt-7">
        <div data-testid="loading" className="animate-pulse">
          <div className="h-7 w-40 rounded-md bg-muted" />
          <div className="mt-6 h-44 rounded-12 bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-content px-9 pb-14 pt-7">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-26 font-bold tracking-tight text-foreground">Studio</h1>
          <p className="mt-1 text-13 text-muted-foreground">选择产物类型，配置后生成音频概览、演示文稿或信息图。</p>
        </div>
      </div>

      {error && (
        <p role="alert" data-testid="error" className="mt-4 text-13 text-destructive">
          {error}
        </p>
      )}

      {/* 类型 tabs */}
      <div data-testid="type-tabs" role="tablist" aria-label="产物类型" className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {TOOLS.map((t) => {
          const Icon = t.icon;
          const active = type === t.type;
          return (
            <Button
              key={t.type}
              type="button"
              variant="outline"
              role="tab"
              aria-selected={active}
              data-testid={`type-${t.type}`}
              onClick={() => setType(t.type)}
              className={cn(
                "h-auto flex-col items-start gap-2 whitespace-normal rounded-12 p-4 text-left font-normal",
                active ? "border-foreground bg-surface-1" : "border-border hover:border-border-strong",
              )}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-foreground">
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-13 font-semibold text-foreground">{t.name}</span>
              <span className="text-xs text-muted-foreground">{t.desc}</span>
            </Button>
          );
        })}
      </div>

      {/* 配置表单 */}
      <form onSubmit={generate} data-testid="studio-form" className="mt-5 flex flex-col gap-4 rounded-12 border border-border bg-surface-1 p-5">
        <div className="text-13 font-semibold text-foreground">生成 {TYPE_LABEL[type]}</div>

        {type === "slides" && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="slides-format">格式</Label>
              <Select id="slides-format" data-testid="cfg-format" value={format} onChange={(e) => setFormat(e.target.value)}>
                <option value="16:9">16:9</option>
                <option value="4:3">4:3</option>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="slides-length">长度</Label>
              <Select id="slides-length" data-testid="cfg-length" value={length} onChange={(e) => setLength(e.target.value)}>
                <option value="5">5 张</option>
                <option value="10">10 张</option>
                <option value="20">20 张</option>
              </Select>
            </div>
          </div>
        )}

        {type === "infographic" && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ig-orientation">方向</Label>
              <Select id="ig-orientation" data-testid="cfg-orientation" value={orientation} onChange={(e) => setOrientation(e.target.value)}>
                <option value="portrait">竖向</option>
                <option value="landscape">横向</option>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ig-detail">详细程度</Label>
              <Select id="ig-detail" data-testid="cfg-detail" value={detail} onChange={(e) => setDetail(e.target.value)}>
                <option value="standard">标准</option>
                <option value="detailed">详细</option>
              </Select>
            </div>
          </div>
        )}

        {type === "audio" && (
          <p className="text-xs text-muted-foreground">将从你的来源生成一段双主持人对话式音频概览。</p>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="studio-prompt">提示词（可选）</Label>
          <textarea
            id="studio-prompt"
            data-testid="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="聚焦、语气、受众… 使用 @ 引用文件"
            rows={3}
            className={cn(textareaCls, "resize-none")}
          />
        </div>

        {genError && (
          <p role="alert" data-testid="gen-error" className="text-13 text-destructive">
            {genError}
          </p>
        )}

        <Button type="submit" size="sm" data-testid="generate" disabled={generating} className="self-start">
          {generating ? "生成中…" : "生成"}
        </Button>
      </form>

      {/* 生成中占位 */}
      {generating && (
        <div data-testid="generating" role="status" aria-busy="true" className="mt-4 flex items-center gap-3 rounded-12 border border-border bg-background px-4 py-3">
          <span className="h-2 w-2 animate-ping rounded-full bg-primary" />
          <span className="text-13 text-muted-foreground">正在生成 {TYPE_LABEL[type]}…</span>
        </div>
      )}

      {/* 结果列表 */}
      <div className="mt-6">
        <div className="mb-3 text-11 font-semibold uppercase tracking-wide text-muted-foreground">历史制品</div>
        {loading ? (
          <div data-testid="results-loading" className="animate-pulse">
            <div className="h-16 rounded-12 bg-muted" />
          </div>
        ) : artifacts.length === 0 ? (
          <div data-testid="empty" className="rounded-12 border border-dashed border-border-strong px-4 py-10 text-center text-13 text-muted-foreground">
            还没有生成任何制品。选择类型并点击生成。
          </div>
        ) : (
          <ul data-testid="result-list" className="flex flex-col gap-3">
            {artifacts.map((a) => (
              <li
                key={a.id}
                data-testid={`artifact-${a.id}`}
                className="flex items-start gap-3 rounded-12 border border-border bg-background px-4 py-3 transition-colors hover:border-border-strong"
              >
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
                  {a.type === "audio" ? <AudioLines className="h-4 w-4" /> : a.type === "slides" ? <Presentation className="h-4 w-4" /> : <BarChart3 className="h-4 w-4" />}
                </span>
                <div className="flex-1">
                  <div className="text-13 font-semibold text-foreground">{a.title}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{a.preview}</div>
                  {a.prompt && <div className="mt-1 text-xs text-placeholder">提示词：{a.prompt}</div>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
