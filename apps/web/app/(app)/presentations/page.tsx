"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Presentation, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface Slide {
  n: number;
  title: string;
}
interface Deck {
  id: string;
  title: string;
  pages: number;
  style: string;
  prompt: string;
  status: string;
  slides: Slide[];
}

const STYLE_LABEL: Record<string, string> = {
  minimal: "Minimal",
  vibrant: "Vibrant",
  calm: "Calm",
};

function DeckSkeleton() {
  return (
    <div data-testid="loading" className="animate-pulse space-y-3">
      <div className="h-5 w-40 rounded-7 bg-muted" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 rounded-9 bg-muted" />
        ))}
      </div>
    </div>
  );
}

export default function PresentationsPage() {
  const router = useRouter();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [pages, setPages] = useState("10");
  const [style, setStyle] = useState("minimal");
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/presentations");
    if (res.status === 401) {
      router.replace("/login");
      setError("请先登录");
      setLoading(false);
      return;
    }
    if (!res.ok) {
      setError("加载失败");
      setLoading(false);
      return;
    }
    setDecks((await res.json()).decks ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setGenError("");
    setGenerating(true);
    const res = await fetch("/api/presentations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, pages: Number(pages), style, prompt }),
    });
    setGenerating(false);
    if (res.status === 201) {
      setTitle("");
      setPrompt("");
      await load();
    } else {
      const d = await res.json().catch(() => ({}));
      setGenError(d.errors?.title ?? d.error ?? "生成失败");
    }
  }

  return (
    <div className="mx-auto max-w-content px-9 pb-14 pt-7">
      <div className="flex items-center gap-2.5">
        <Presentation className="h-6 w-6 text-foreground" strokeWidth={1.5} />
        <h1 className="text-26 font-bold tracking-tight text-foreground">Presentations</h1>
      </div>
      <p className="mt-1.5 text-13 text-muted-foreground">
        基于主题与大纲生成演示文稿（演示用 stub，不含真实生成）。
      </p>

      {error && (
        <p role="alert" data-testid="err" className="mt-4 text-13 text-destructive">
          {error}
        </p>
      )}

      {/* 配置表单 */}
      <form
        onSubmit={generate}
        className="mt-6 flex flex-col gap-4 rounded-12 border border-border bg-surface-1 p-4.5"
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="deck-title">标题</Label>
          <Input
            id="deck-title"
            data-testid="deck-title"
            placeholder="例如：Q3 产品发布计划"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="deck-pages">页数</Label>
            <Select
              id="deck-pages"
              data-testid="deck-pages"
              value={pages}
              onChange={(e) => setPages(e.target.value)}
            >
              <option value="5">5 页</option>
              <option value="10">10 页</option>
              <option value="15">15 页</option>
              <option value="20">20 页</option>
            </Select>
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="deck-style">风格</Label>
            <Select
              id="deck-style"
              data-testid="deck-style"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
            >
              <option value="minimal">Minimal</option>
              <option value="vibrant">Vibrant</option>
              <option value="calm">Calm</option>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="deck-prompt">大纲提示（可选）</Label>
          <Input
            id="deck-prompt"
            data-testid="deck-prompt"
            placeholder="受众、重点或语气…留空则按当前对话与文件生成"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </div>

        {genError && (
          <p role="alert" data-testid="err-generate" className="text-13 text-destructive">
            {genError}
          </p>
        )}

        <Button
          data-testid="generate"
          type="submit"
          size="sm"
          disabled={generating}
          className="self-start gap-1.5"
        >
          <Sparkles className="h-4 w-4" strokeWidth={1.75} />
          {generating ? "生成中…" : "生成演示文稿"}
        </Button>
      </form>

      {/* 结果 */}
      <div className="mt-8">
        <h2 className="text-15 font-semibold text-foreground">已生成</h2>
        <div className="mt-3">
          {loading ? (
            <DeckSkeleton />
          ) : decks.length === 0 ? (
            <div
              data-testid="empty"
              className="flex flex-col items-center justify-center gap-2 rounded-12 border border-dashed border-border-strong py-15 text-center"
            >
              <Presentation className="h-7 w-7 text-muted-foreground" strokeWidth={1.5} />
              <p className="text-13 font-medium text-foreground">还没有演示文稿</p>
              <p className="text-11 text-muted-foreground">填写上方配置并点击生成</p>
            </div>
          ) : (
            <ul data-testid="deck-list" className="flex flex-col gap-4">
              {decks.map((d) => (
                <li
                  key={d.id}
                  data-testid={`deck-${d.id}`}
                  className="rounded-12 border border-border bg-surface-1 p-4 transition-colors hover:border-border-strong"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-13 font-semibold text-foreground">{d.title}</span>
                    <div className="flex flex-none items-center gap-1.5">
                      <Badge variant="muted">{STYLE_LABEL[d.style] ?? d.style}</Badge>
                      <Badge variant="muted">{d.pages} 页</Badge>
                    </div>
                  </div>
                  {/* 幻灯片缩略占位（无真实渲染） */}
                  <ol className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                    {d.slides.map((sl) => (
                      <li
                        key={sl.n}
                        className="relative overflow-hidden rounded-9 border border-border bg-surface-2"
                      >
                        <span className="absolute left-1.5 top-1.5 rounded-7 bg-foreground px-1.5 text-10 font-semibold text-background">
                          {sl.n}
                        </span>
                        <div className="flex h-20 items-end p-2">
                          <span className="line-clamp-2 text-11 text-muted-foreground">{sl.title}</span>
                        </div>
                      </li>
                    ))}
                  </ol>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
