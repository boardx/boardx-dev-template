"use client";
// 演示文稿生成配置弹窗（P12 F02）：主题/来源（聊天/文件/说明）/页数/风格 → 触发异步生成。
// 来源为空时禁用生成（uc-presentations-001 业务规则）。
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export type PresentationSource = "current_chat" | "room_files" | "instructions";

export interface PresentationSources {
  current_chat: { available: boolean; count: number };
  room_files: { available: boolean; count: number };
  instructions: { available: boolean; count: number };
}

const SOURCE_LABEL: Record<PresentationSource, string> = {
  current_chat: "当前聊天",
  room_files: "房间文件",
  instructions: "说明",
};

interface PresentationConfigModalProps {
  open: boolean;
  onClose: () => void;
  topic: string;
  onTopicChange: (v: string) => void;
  source: PresentationSource;
  onSourceChange: (v: PresentationSource) => void;
  instructions: string;
  onInstructionsChange: (v: string) => void;
  pages: number;
  onPagesChange: (v: number) => void;
  style: string;
  onStyleChange: (v: string) => void;
  sources: PresentationSources | null;
  generating: boolean;
  genError: string;
  onGenerate: () => void;
}

export function PresentationConfigModal({
  open,
  onClose,
  topic,
  onTopicChange,
  source,
  onSourceChange,
  instructions,
  onInstructionsChange,
  pages,
  onPagesChange,
  style,
  onStyleChange,
  sources,
  generating,
  genError,
  onGenerate,
}: PresentationConfigModalProps) {
  if (!open) return null;

  // 来源可用性：instructions 来源必须填了说明文本才算「有来源」；current_chat/room_files
  // 由服务端来源计数决定（与 Studio 面板一致的判定，见 apps/web/lib/studio.ts）。
  const sourceAvailable =
    source === "instructions"
      ? instructions.trim().length > 0
      : sources
        ? sources[source].available
        : false;

  return (
    <div
      data-testid="presentation-config-modal"
      role="dialog"
      aria-modal="true"
      aria-label="生成演示文稿"
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
    >
      <div className="flex w-full max-w-md flex-col gap-4 rounded-lg border border-border bg-background p-5 shadow-[0_16px_40px_rgba(0,0,0,.18)]">
        <div className="flex items-center justify-between">
          <h2 className="text-15 font-semibold text-foreground">生成演示文稿</h2>
          <Button type="button" size="sm" variant="ghost" data-testid="presentation-config-close" onClick={onClose}>
            ✕
          </Button>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="presentation-topic">主题</Label>
          <Input
            id="presentation-topic"
            data-testid="presentation-topic"
            placeholder="例如：Q3 产品评审演示"
            value={topic}
            onChange={(e) => onTopicChange(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>来源</Label>
          <div className="flex flex-col gap-1">
            {(["current_chat", "room_files", "instructions"] as PresentationSource[]).map((s) => {
              const available = s === "instructions" ? true : sources ? sources[s].available : true;
              const active = source === s;
              return (
                <Button
                  key={s}
                  type="button"
                  size="sm"
                  variant={active ? "secondary" : "ghost"}
                  data-testid={`presentation-source-${s}`}
                  aria-pressed={active}
                  disabled={s !== "instructions" && sources !== null && !available}
                  onClick={() => onSourceChange(s)}
                  className="justify-start"
                >
                  {SOURCE_LABEL[s]}
                  {s !== "instructions" && sources && !available && (
                    <span className="ml-1 text-11 text-placeholder">（不可用）</span>
                  )}
                </Button>
              );
            })}
          </div>
          {sources && !sources.current_chat.available && !sources.room_files.available && (
            <p data-testid="presentation-no-source-hint" className="text-11 text-muted-foreground">
              聊天/文件来源暂不可用：上传房间文件、先发消息，或改用「说明」来源。
            </p>
          )}
        </div>

        {source === "instructions" && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="presentation-instructions">说明</Label>
            <textarea
              id="presentation-instructions"
              data-testid="presentation-instructions"
              value={instructions}
              onChange={(e) => onInstructionsChange(e.target.value)}
              placeholder="描述这份演示要涵盖的内容…"
              rows={3}
              className="flex w-full resize-none rounded-lg border border-input bg-background px-2.5 py-2 text-13 text-foreground placeholder:text-placeholder focus-visible:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary"
            />
          </div>
        )}

        <div className="flex gap-3">
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="presentation-pages">页数</Label>
            <Select
              id="presentation-pages"
              data-testid="presentation-pages"
              value={String(pages)}
              onChange={(e) => onPagesChange(Number(e.target.value))}
            >
              <option value="5">5 页</option>
              <option value="8">8 页</option>
              <option value="10">10 页</option>
              <option value="15">15 页</option>
              <option value="20">20 页</option>
            </Select>
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="presentation-style">风格</Label>
            <Select
              id="presentation-style"
              data-testid="presentation-style"
              value={style}
              onChange={(e) => onStyleChange(e.target.value)}
            >
              <option value="minimal">Minimal</option>
              <option value="vibrant">Vibrant</option>
              <option value="calm">Calm</option>
            </Select>
          </div>
        </div>

        {genError && (
          <p role="alert" data-testid="presentation-config-error" className="text-12 text-destructive">
            {genError}
          </p>
        )}

        <Button
          type="button"
          data-testid="presentation-config-generate"
          disabled={generating || !sourceAvailable}
          onClick={onGenerate}
        >
          {generating ? "生成中…" : "生成演示"}
        </Button>
      </div>
    </div>
  );
}
