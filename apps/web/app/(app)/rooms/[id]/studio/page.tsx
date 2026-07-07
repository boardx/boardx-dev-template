"use client";
// p22/F04（评估型，UI 先行原型）：Studio 顶级 tab 落地页。
// 原型 roomTabDefs 把 Studio 列为与 Chat 并列的顶级路由；此前被 oldcode 的 Chat 重构
// 顺手折叠成聊天线程内的侧栏，本页面把它恢复成可独立到达的入口。
// 真实生成能力仍在聊天工作区三栏内（RoomStudioPanel），本页先用 mock 数据展示
// "本房间近期 Studio 产物"的落地体验，供人类在 UI 签核时判断是否需要这个独立入口，
// 以及产物列表本身是否有价值——不接后端，纯 mock（ui-prototyper 契约）。
import { useParams } from "next/navigation";
import Link from "next/link";
import { FileAudio, FileText, Presentation } from "lucide-react";
import { Button } from "@/components/ui/button";

const MOCK_ARTIFACTS = [
  { id: "art_1", type: "audio", title: "Sprint retro 音频概览", threadName: "Sprint Planning", updated: "2h ago" },
  { id: "art_2", type: "slides", title: "User journey 演示文稿", threadName: "Product Alpha 讨论", updated: "yesterday" },
  { id: "art_3", type: "report", title: "Roadmap 要点报告", threadName: "Sprint Planning", updated: "3d ago" },
] as const;

const ICONS = { audio: FileAudio, slides: Presentation, report: FileText } as const;

export default function RoomStudioPage() {
  const params = useParams<{ id: string }>();
  const roomId = params.id;

  return (
    <div data-testid="room-studio-tab" className="mx-auto max-w-3xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-15 font-semibold text-foreground">Studio</h2>
          <p className="text-13 text-muted-foreground">本房间生成的音频概览、演示文稿、报告等 Studio 产物</p>
        </div>
        <Link href={`/rooms/${roomId}/chats`} className="text-13 text-primary hover:underline" data-testid="room-studio-open-in-chat">
          在聊天工作区打开 Studio →
        </Link>
      </div>

      <ul data-testid="room-studio-artifact-list" className="flex flex-col gap-2">
        {MOCK_ARTIFACTS.map((a) => {
          const Icon = ICONS[a.type];
          return (
            <li
              key={a.id}
              data-testid={`room-studio-artifact-${a.id}`}
              className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:border-border-strong"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-13 font-medium text-foreground">{a.title}</p>
                <p className="truncate text-xs text-muted-foreground">来自 {a.threadName} · {a.updated}</p>
              </div>
              <Button variant="secondary" size="sm" className="shrink-0" disabled>
                Open
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
