"use client";
// Studio 面板（P12 F01）：选生成类型 + 配置来源 → 触发异步生成，展示进行中的制品进度。
// 结果（ready/error）以卡片形式出现在聊天中（见 chats/[chatId]/page.tsx 的 studio-result 渲染），
// 本组件只负责「发起生成 + 进行中列表」，不复制结果卡片的最终展示（避免同一状态两处渲染分叉）。
import { AudioLines, BarChart3, Presentation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export type StudioArtifactType = "audio" | "infographic" | "presentation";
export type StudioArtifactSource = "room_files" | "current_chat";
export type StudioArtifactStatus = "queued" | "processing" | "ready" | "error";

export interface StudioArtifact {
  id: string;
  type: StudioArtifactType;
  source: StudioArtifactSource;
  prompt: string;
  status: StudioArtifactStatus;
  title: string | null;
  error_message: string | null;
}

export interface StudioSources {
  room_files: { available: boolean; count: number };
  current_chat: { available: boolean; count: number };
}

const TYPES: { type: StudioArtifactType; label: string; icon: typeof AudioLines }[] = [
  { type: "audio", label: "音频概览", icon: AudioLines },
  { type: "infographic", label: "信息图", icon: BarChart3 },
  { type: "presentation", label: "演示文稿", icon: Presentation },
];

const SOURCE_LABEL: Record<StudioArtifactSource, string> = {
  room_files: "房间文件",
  current_chat: "当前聊天",
};

const TYPE_LABEL: Record<StudioArtifactType, string> = {
  audio: "音频概览",
  infographic: "信息图",
  presentation: "演示文稿",
};

export { TYPE_LABEL as STUDIO_TYPE_LABEL };

interface StudioPanelProps {
  canEdit: boolean;
  type: StudioArtifactType;
  onTypeChange: (t: StudioArtifactType) => void;
  source: StudioArtifactSource;
  onSourceChange: (s: StudioArtifactSource) => void;
  prompt: string;
  onPromptChange: (p: string) => void;
  sources: StudioSources | null;
  pending: StudioArtifact[];
  generating: boolean;
  genError: string;
  onGenerate: () => void;
  onRetry: (artifactId: string) => void;
}

export function StudioPanel({
  canEdit,
  type,
  onTypeChange,
  source,
  onSourceChange,
  prompt,
  onPromptChange,
  sources,
  pending,
  generating,
  genError,
  onGenerate,
  onRetry,
}: StudioPanelProps) {
  const currentSourceAvailable = sources ? sources[source].available : false;
  const noSourceAtAll = sources ? !sources.room_files.available && !sources.current_chat.available : false;

  return (
    <aside data-testid="pane-studio" className="flex flex-col gap-3 overflow-y-auto border-l bg-muted/20 p-4">
      <p className="text-sm font-semibold text-foreground">Studio</p>

      {!canEdit ? (
        <p data-testid="studio-readonly" className="text-xs text-muted-foreground">
          只读线程，无法生成 Studio 制品。
        </p>
      ) : (
        <>
          {/* 类型选择 */}
          <div data-testid="studio-type-tabs" className="flex flex-col gap-1.5">
            <Label className="text-xs">生成类型</Label>
            <div className="flex flex-col gap-1">
              {TYPES.map((t) => {
                const Icon = t.icon;
                const active = type === t.type;
                return (
                  <Button
                    key={t.type}
                    type="button"
                    size="sm"
                    variant={active ? "secondary" : "ghost"}
                    data-testid={`studio-type-${t.type}`}
                    aria-pressed={active}
                    onClick={() => onTypeChange(t.type)}
                    className="justify-start gap-2"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {t.label}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* 来源选择 */}
          <div data-testid="studio-source-select" className="flex flex-col gap-1.5">
            <Label className="text-xs">来源</Label>
            <div className="flex flex-col gap-1">
              {(["room_files", "current_chat"] as StudioArtifactSource[]).map((s) => {
                const available = sources ? sources[s].available : true;
                const active = source === s;
                return (
                  <Button
                    key={s}
                    type="button"
                    size="sm"
                    variant={active ? "secondary" : "ghost"}
                    data-testid={`studio-source-${s}`}
                    aria-pressed={active}
                    disabled={sources !== null && !available}
                    onClick={() => onSourceChange(s)}
                    className="justify-start"
                  >
                    {SOURCE_LABEL[s]}
                    {sources && !available && <span className="ml-1 text-11 text-placeholder">（不可用）</span>}
                  </Button>
                );
              })}
            </div>
            {noSourceAtAll && (
              <p data-testid="studio-no-source" className="text-11 text-muted-foreground">
                暂无可用来源：上传房间文件或先在聊天中发送消息。
              </p>
            )}
          </div>

          {/* 提示词 */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="studio-prompt" className="text-xs">
              提示词（可选）
            </Label>
            <textarea
              id="studio-prompt"
              data-testid="studio-prompt"
              value={prompt}
              onChange={(e) => onPromptChange(e.target.value)}
              placeholder="聚焦、语气、受众…"
              rows={3}
              className="flex w-full resize-none rounded-lg border border-input bg-background px-2.5 py-2 text-13 text-foreground placeholder:text-placeholder focus-visible:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary"
            />
          </div>

          {genError && (
            <p role="alert" data-testid="studio-error" className="text-12 text-destructive">
              {genError}
            </p>
          )}

          <Button
            type="button"
            size="sm"
            data-testid="studio-generate"
            disabled={generating || !currentSourceAvailable}
            onClick={onGenerate}
          >
            {generating ? "生成中…" : "生成"}
          </Button>

          {/* 生成中制品（queued/processing）：面板内进度，最终结果去聊天里看 */}
          {pending.length > 0 && (
            <div data-testid="studio-pending-list" className="mt-2 flex flex-col gap-2">
              {pending.map((a) => (
                <div
                  key={a.id}
                  data-testid={`studio-progress-${a.id}`}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-xs"
                >
                  {a.status === "error" ? (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-destructive">{TYPE_LABEL[a.type]}生成失败</span>
                      <span className="text-11 text-muted-foreground">{a.error_message}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        data-testid={`studio-retry-${a.id}`}
                        onClick={() => onRetry(a.id)}
                      >
                        重试
                      </Button>
                    </div>
                  ) : (
                    <span data-testid="studio-generating" role="status" aria-busy="true" className="text-muted-foreground">
                      正在生成{TYPE_LABEL[a.type]}…
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </aside>
  );
}
