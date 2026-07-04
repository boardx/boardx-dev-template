"use client";
// p20/F08 Room Survey 入口（uc-rr-007）：房间 Survey tab 只列本房间问卷卡片，
// owner/admin 可新建（预置 room_id 进入 p13 创建器）/暂停/删除；member 可答题+查看已发布结果。
// 问卷本体（题型/答题/报告）全部复用 p13 全局 /surveys 与 /survey/[id]/answer，不改动。
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { BarChart3, FileText, PauseCircle, PlayCircle, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface RoomSurveyCard {
  id: number;
  title: string;
  description: string;
  status: "active" | "paused";
  responses: number;
  updatedAt: string;
  isOwner: boolean;
  shareUrl: string;
}

const STATUS_LABEL: Record<RoomSurveyCard["status"], string> = {
  active: "Active",
  paused: "Paused",
};

function formatUpdated(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Updated just now";
  return `Updated ${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

export default function RoomSurveysPage() {
  const params = useParams<{ id: string }>();
  const roomId = params.id;

  const [surveys, setSurveys] = useState<RoomSurveyCard[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/rooms/${roomId}/surveys`);
      if (!res.ok) {
        setError(res.status === 403 ? "你不是该房间成员，无法访问" : "加载房间问卷失败，请重试");
        setLoading(false);
        return;
      }
      const d = await res.json();
      setSurveys(d.surveys ?? []);
      setCanManage(Boolean(d.canManage));
    } catch {
      setError("加载房间问卷失败，请重试");
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  async function toggleStatus(survey: RoomSurveyCard) {
    setBusyId(survey.id);
    setError("");
    const res = await fetch(`/api/surveys/${survey.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive: survey.status !== "active" }),
    });
    setBusyId(null);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "更新问卷状态失败");
      return;
    }
    await load();
  }

  async function deleteCard(survey: RoomSurveyCard) {
    setBusyId(survey.id);
    setError("");
    const res = await fetch(`/api/surveys/${survey.id}`, { method: "DELETE" });
    setBusyId(null);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "删除问卷失败");
      return;
    }
    setConfirmDeleteId(null);
    await load();
  }

  return (
    <div data-testid="room-survey-tab" className="mx-auto max-w-content px-9 pb-14 pt-7">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-20 font-bold tracking-tight text-foreground">Room surveys</h1>
        <div className="flex items-center gap-2">
          <Link href="/surveys" data-testid="room-survey-view-team-link">
            <Button variant="outline" size="sm">
              View team surveys
            </Button>
          </Link>
          {canManage && (
            <Link href={`/surveys?roomId=${roomId}`} data-testid="room-survey-create">
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" strokeWidth={1.5} />
                New room survey
              </Button>
            </Link>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" data-testid="room-survey-error" className="mt-4 text-13 text-destructive">
          {error}
        </p>
      )}

      <div className="mt-5">
        {loading ? (
          <div data-testid="room-survey-loading" className="grid animate-pulse gap-3 md:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-32 rounded-lg border border-border bg-muted/40" />
            ))}
          </div>
        ) : surveys.length === 0 ? (
          <div
            data-testid="room-survey-empty"
            className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-16 text-center"
          >
            <p className="text-sm font-medium text-foreground">No surveys in this room yet</p>
            <p className="text-sm text-muted-foreground">
              {canManage
                ? "Create a room survey to collect responses from room members."
                : "Room owner/admin can create a survey here."}
            </p>
            {canManage && (
              <Link href={`/surveys?roomId=${roomId}`} data-testid="room-survey-create-empty">
                <Button size="sm" className="mt-1 gap-1.5">
                  <Plus className="h-4 w-4" strokeWidth={1.5} />
                  New room survey
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div data-testid="room-survey-list" className="grid gap-3 md:grid-cols-2">
            {surveys.map((s) => (
              <article
                key={s.id}
                data-testid="room-survey-card"
                data-survey-id={s.id}
                className="rounded-12 border border-border bg-card p-4 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 data-testid={`room-survey-title-${s.id}`} className="truncate text-15 font-semibold text-foreground">
                      {s.title}
                    </h2>
                    {s.description && <p className="mt-1 truncate text-12 text-muted-foreground">{s.description}</p>}
                  </div>
                  <Badge data-testid={`room-survey-status-${s.id}`} variant={s.status === "active" ? "success" : "muted"}>
                    {STATUS_LABEL[s.status]}
                  </Badge>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-12">
                  <div>
                    <p className="text-muted-foreground">Responses</p>
                    <p data-testid={`room-survey-responses-${s.id}`} className="mt-1 font-medium text-foreground">
                      {s.responses}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Updated</p>
                    <p className="mt-1 font-medium text-foreground">{formatUpdated(s.updatedAt)}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <a href={s.shareUrl} data-testid={`room-survey-answer-${s.id}`}>
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <BarChart3 className="h-4 w-4" strokeWidth={1.5} />
                      Answer
                    </Button>
                  </a>
                  <a href={`/surveys/${s.id}/results`} data-testid={`room-survey-report-${s.id}`}>
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <FileText className="h-4 w-4" strokeWidth={1.5} />
                      Report
                    </Button>
                  </a>
                  {canManage && (
                    <>
                      <Button
                        data-testid={`room-survey-toggle-${s.id}`}
                        variant="outline"
                        size="sm"
                        disabled={busyId === s.id}
                        onClick={() => void toggleStatus(s)}
                        className="gap-1.5"
                      >
                        {s.status === "active" ? (
                          <PauseCircle className="h-4 w-4" strokeWidth={1.5} />
                        ) : (
                          <PlayCircle className="h-4 w-4" strokeWidth={1.5} />
                        )}
                        {s.status === "active" ? "Pause" : "Activate"}
                      </Button>
                      <Button
                        data-testid={`room-survey-delete-${s.id}`}
                        variant="destructive"
                        size="sm"
                        disabled={busyId === s.id}
                        onClick={() => setConfirmDeleteId(s.id)}
                        className="gap-1.5"
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                        Delete
                      </Button>
                    </>
                  )}
                </div>

                {confirmDeleteId === s.id && (
                  <div data-testid={`room-survey-delete-confirm-${s.id}`} className="mt-3 rounded-lg border border-destructive/40 p-3">
                    <p className="text-12 text-foreground">Delete {s.title} permanently?</p>
                    <div className="mt-2 flex gap-2">
                      <Button
                        data-testid={`room-survey-delete-confirm-button-${s.id}`}
                        variant="destructive"
                        size="sm"
                        disabled={busyId === s.id}
                        onClick={() => void deleteCard(s)}
                      >
                        Confirm delete
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setConfirmDeleteId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
