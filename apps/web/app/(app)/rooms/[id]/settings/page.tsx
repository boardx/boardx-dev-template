"use client";
// issue #587：Room 设置从 Members tab 拆到独立 Settings 页。
// 承载：改房间名（rename）+ About & AI（复用 RoomAboutAiSection）+ Danger Zone（删除房间）。
// 权限：仅 owner/admin 可进（canManage）；非管理者显示无权限提示（与后端 403 一致）。
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import RoomAboutAiSection from "./RoomAboutAiSection";
import { RoomDangerZoneSection } from "@/components/room/RoomDangerZoneSection";

type Role = "owner" | "admin" | "member";

export default function RoomSettingsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const roomId = params.id;

  const [myRole, setMyRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [roomName, setRoomName] = useState("");
  const [roomDescription, setRoomDescription] = useState("");
  const [roomAiInstruction, setRoomAiInstruction] = useState("");

  // rename
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState("");
  const [nameSaved, setNameSaved] = useState(false);

  const canManage = myRole === "owner" || myRole === "admin";

  // cancelled 守卫：dev StrictMode 会双跑 effect，若不丢弃过期请求的 setState，
  // 会在用户已开始编辑后再次把 About & AI 表单重置为初始值（编辑内容被抹掉）。
  useEffect(() => {
    let cancelled = false;
    async function loadAll() {
      setLoading(true);
      const [roleRes, roomRes] = await Promise.all([
        fetch(`/api/rooms/${roomId}/members`),
        fetch(`/api/rooms/${roomId}`),
      ]);
      if (cancelled) return;
      if (roleRes.status === 401) {
        router.replace("/login");
        return;
      }
      if (roleRes.ok) {
        const d = await roleRes.json();
        if (cancelled) return;
        setMyRole((d.myRole as Role | null) ?? null);
      } else {
        setMyRole(null);
      }
      if (roomRes.ok) {
        const d = await roomRes.json();
        if (cancelled) return;
        setRoomName(d.room?.name ?? "");
        setNameDraft(d.room?.name ?? "");
        setRoomDescription(d.room?.description ?? "");
        setRoomAiInstruction(d.room?.ai_instruction ?? "");
      }
      if (!cancelled) setLoading(false);
    }
    void loadAll();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  async function saveName() {
    const name = nameDraft.trim();
    setNameError("");
    setNameSaved(false);
    if (!name) {
      setNameError("房间名不能为空");
      return;
    }
    setSavingName(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setNameError(d.errors?.name ?? d.error ?? "保存失败");
        setSavingName(false);
        return;
      }
      setRoomName(name);
      setNameSaved(true);
      // 通知房间壳（layout）实时刷新页头房间名，无需整页刷新。
      window.dispatchEvent(new CustomEvent("room:renamed", { detail: { roomId, name } }));
    } catch {
      setNameError("保存失败");
    } finally {
      setSavingName(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-9 py-7">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-26 font-bold tracking-tight text-foreground">房间设置</h1>
        <p className="text-13 text-muted-foreground">管理房间名称、描述与 AI 指令，以及删除房间。</p>
      </div>

      {error && (
        <p role="alert" data-testid="err" className="text-13 text-destructive">
          {error}
        </p>
      )}

      {loading ? (
        <div data-testid="loading" className="flex animate-pulse flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-15 rounded-12 bg-muted" />
          ))}
        </div>
      ) : !canManage ? (
        <p data-testid="settings-forbidden" className="text-13 text-muted-foreground">
          你不是该房间的 owner / admin，无权管理房间设置。
        </p>
      ) : (
        <>
          {/* Rename */}
          <section
            data-testid="room-rename-section"
            className="flex flex-col gap-3 rounded-12 border border-border bg-surface-1 p-4"
          >
            <div className="flex flex-col gap-0.5">
              <h2 className="text-15 font-semibold text-foreground">房间名称</h2>
              <p className="text-11 text-muted-foreground">房间名会展示在房间页头与房间列表。</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="room-rename-input">房间名</Label>
              <Input
                id="room-rename-input"
                data-testid="room-rename-input"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                placeholder="房间名"
              />
            </div>
            {nameError && (
              <p role="alert" data-testid="room-rename-err" className="text-11 text-destructive">
                {nameError}
              </p>
            )}
            {nameSaved && !nameError && (
              <p data-testid="room-rename-ok" className="text-11 text-success">
                已保存
              </p>
            )}
            <Button
              type="button"
              size="sm"
              data-testid="room-rename-save"
              className="self-start"
              onClick={() => void saveName()}
              disabled={savingName}
            >
              {savingName ? "保存中…" : "保存"}
            </Button>
          </section>

          {/* About & AI（复用组件）*/}
          <RoomAboutAiSection
            roomId={roomId}
            initialDescription={roomDescription}
            initialAiInstruction={roomAiInstruction}
          />

          {/* Danger Zone — 仅 owner */}
          {myRole === "owner" && roomName && (
            <RoomDangerZoneSection roomId={roomId} roomName={roomName} />
          )}
        </>
      )}
    </div>
  );
}
