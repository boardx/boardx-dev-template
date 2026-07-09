"use client";
// p22 Studio 全屏三栏工作区（沉浸式，脱离房间壳——见 rooms/layout.tsx 与
// rooms/[id]/layout.tsx 对 studio 路由的脱壳处理）。对齐原型里 Studio 为独立全屏路由、
// Room Workspace 三栏（左 sources · 中产物 · 右生成配置）的设计。
//
// 交付形态（ui-prototyper）：左栏 RoomFilesPanel 与右栏 StudioPanel 都是**真实组件**，
// 左栏接真 API（房间文件库）；右栏 Studio 生成配置面板真实渲染，但生成逻辑（onGenerate/
// 真实 sources 可用性）需 thread 上下文，暂以本地 state + 占位喂 props，接真后端是下一步。
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft, FileAudio, FileText, Presentation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RoomFilesPanel } from "@/components/room-files/room-files-panel";
import {
  StudioPanel,
  type StudioArtifactType,
  type StudioArtifactSource,
} from "@/components/studio/studio-panel";

const MOCK_ARTIFACTS = [
  { id: "art_1", type: "audio", title: "Sprint retro 音频概览", threadName: "Sprint Planning", updated: "2h ago" },
  { id: "art_2", type: "slides", title: "User journey 演示文稿", threadName: "Product Alpha 讨论", updated: "yesterday" },
  { id: "art_3", type: "report", title: "Roadmap 要点报告", threadName: "Sprint Planning", updated: "3d ago" },
] as const;

const ICONS = { audio: FileAudio, slides: Presentation, report: FileText } as const;

export default function RoomStudioPage() {
  const params = useParams<{ id: string }>();
  const roomId = params.id;

  // Studio 生成配置的本地 state（骨架：真实面板渲染，生成逻辑接真后端为下一步）。
  const [studioType, setStudioType] = useState<StudioArtifactType>("audio");
  const [studioSource, setStudioSource] = useState<StudioArtifactSource>("room_files");
  const [studioPrompt, setStudioPrompt] = useState("");

  return (
    <div data-testid="room-studio-tab" className="flex h-full min-h-0 flex-col">
      {/* 顶部：返回房间 + 标题（全屏工作区自带导航，替代被脱壳的房间头部） */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4">
        <Link
          href={`/rooms/${roomId}/boards`}
          data-testid="room-studio-back"
          className="flex items-center gap-0.5 text-13 text-muted-foreground transition-colors duration-200 hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          返回房间
        </Link>
        <span className="text-13 text-border-strong">/</span>
        <h1 className="text-15 font-semibold text-foreground">Studio</h1>
      </header>

      {/* 三栏工作区：左 房间文件 sources | 中 产物区 | 右 生成配置面板 */}
      <div className="grid min-h-0 flex-1 grid-cols-[16rem_1fr_18rem] overflow-hidden">
        {/* 左：房间文件 sources（真实组件，接真 API） */}
        <aside data-testid="pane-files" className="flex min-h-0 flex-col gap-2 border-r border-border bg-muted/20 p-4">
          <RoomFilesPanel roomId={String(roomId)} chatId="" />
        </aside>

        {/* 中：Studio 产物区 */}
        <section data-testid="pane-artifacts" className="min-h-0 overflow-y-auto p-6">
          <div className="mx-auto max-w-2xl">
            <h2 className="text-15 font-semibold text-foreground">本房间的 Studio 产物</h2>
            <p className="mb-4 text-13 text-muted-foreground">音频概览、演示文稿、报告等生成结果</p>
            <ul data-testid="room-studio-artifact-list" className="flex flex-col gap-2">
              {MOCK_ARTIFACTS.map((a) => {
                const Icon = ICONS[a.type];
                return (
                  <li
                    key={a.id}
                    data-testid={`room-studio-artifact-${a.id}`}
                    className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors duration-200 hover:border-border-strong"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-13 font-medium text-foreground">{a.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        来自 {a.threadName} · {a.updated}
                      </p>
                    </div>
                    <Button variant="secondary" size="sm" className="shrink-0" disabled>
                      Open
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* 右：Studio 生成配置面板（真实组件，本地 state；生成逻辑接真后端为下一步） */}
        <StudioPanel
          canEdit
          type={studioType}
          onTypeChange={setStudioType}
          source={studioSource}
          onSourceChange={setStudioSource}
          prompt={studioPrompt}
          onPromptChange={setStudioPrompt}
          sources={null}
          pending={[]}
          generating={false}
          genError=""
          onGenerate={() => {}}
          onRetry={() => {}}
        />
      </div>
    </div>
  );
}
