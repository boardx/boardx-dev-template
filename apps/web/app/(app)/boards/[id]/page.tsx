"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { BoardTimer } from "@/components/board/timer";
import { BoardHelpGuide } from "@/components/board/help-guide";

interface Board {
  id: number | string;
  name: string;
  visibility: string;
  room_id?: number | string;
  category?: string | null;
  description?: string | null;
  settings?: { grid?: boolean; snap?: boolean };
}

interface RoomOpt {
  id: number | string;
  name: string;
}

type Role = "owner" | "editor" | "viewer";

export default function BoardPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const boardId = params.id;
  const [board, setBoard] = useState<Board | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [canSetVisibility, setCanSetVisibility] = useState(false);
  const [anonymous, setAnonymous] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 元信息编辑
  const [editing, setEditing] = useState(false);
  const [fName, setFName] = useState("");
  const [fCategory, setFCategory] = useState("");
  const [fDescription, setFDescription] = useState("");
  const [saveError, setSaveError] = useState("");

  // 移动
  const [rooms, setRooms] = useState<RoomOpt[]>([]);
  const [moveTarget, setMoveTarget] = useState("");
  // 删除（行内确认）
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function refresh() {
    const res = await fetch(`/api/boards/${boardId}`);
    if (res.status === 401) return setError("请先登录"), setLoading(false);
    if (res.status === 403) return setError("你无权访问该白板"), setLoading(false);
    if (res.status === 404) return setError("白板不存在"), setLoading(false);
    const d = await res.json();
    setBoard(d.board);
    setRole(d.role);
    setCanManage(!!d.canManage);
    setCanSetVisibility(!!d.canSetVisibility);
    setAnonymous(!!d.anonymous);
    setFName(d.board?.name ?? "");
    setFCategory(d.board?.category ?? "");
    setFDescription(d.board?.description ?? "");
    if (d.canManage) {
      const rl = await (await fetch("/api/rooms")).json();
      setRooms((rl.rooms ?? []).filter((r: RoomOpt) => String(r.id) !== String(d.board?.room_id)));
    }
    setLoading(false);
  }

  async function move() {
    if (!moveTarget) return;
    await fetch(`/api/boards/${boardId}/move`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ targetRoomId: Number(moveTarget) }),
    });
    setMoveTarget("");
    await refresh();
  }

  async function join() {
    await fetch(`/api/boards/${boardId}/join`, { method: "POST" });
    await refresh();
  }

  async function changeSetting(key: "grid" | "snap", on: boolean) {
    await fetch(`/api/boards/${boardId}/settings`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ [key]: on }),
    });
    await refresh();
  }

  async function changeVisibility(v: string) {
    await fetch(`/api/boards/${boardId}/visibility`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ visibility: v }),
    });
    await refresh();
  }

  async function remove() {
    const roomId = board?.room_id;
    const res = await fetch(`/api/boards/${boardId}`, { method: "DELETE" });
    if (res.ok) {
      router.push(roomId ? `/rooms/${roomId}/boards` : "/boards");
    }
  }

  useEffect(() => {
    setLoading(true);
    setError("");
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId]);

  async function saveMeta(e: React.FormEvent) {
    e.preventDefault();
    setSaveError("");
    const res = await fetch(`/api/boards/${boardId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: fName, category: fCategory, description: fDescription }),
    });
    if (res.ok) {
      setEditing(false);
      await refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setSaveError(d.errors?.name ?? d.error ?? "保存失败");
    }
  }

  if (loading) {
    return (
      <div data-testid="loading" className="flex h-[60vh] animate-pulse flex-col gap-4 p-6">
        <div className="h-10 w-1/3 rounded bg-muted" />
        <div className="flex-1 rounded-lg bg-muted" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3">
        <p role="alert" data-testid="err" className="text-sm text-destructive">
          {error}
        </p>
      </div>
    );
  }

  const canEdit = role === "owner" || role === "editor";

  return (
    <div className="relative flex h-[80vh] flex-col">
      <BoardHelpGuide />
      {/* Header 占位（真实 Header 功能在 p7） */}
      <header
        data-testid="board-header"
        className="flex items-center justify-between border-b bg-card px-4 py-2.5"
      >
        <div className="flex items-center gap-2">
          <h1 data-testid="board-title" className="text-base font-semibold text-foreground">
            {board?.name}
          </h1>
          <Badge variant="muted" data-testid="board-role">
            {role}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {/* 协作计时器（所有协作者可用） */}
          <BoardTimer />
          {/* 匿名公开访问：提示登录加入 */}
          {anonymous && (
            <Button
              data-testid="login-to-join"
              size="sm"
              variant="default"
              onClick={() => router.push("/login")}
            >
              登录以加入协作
            </Button>
          )}
          {/* 已登录只读者：加入协作 */}
          {!anonymous && role === "viewer" && (
            <Button data-testid="join-collab" size="sm" variant="default" onClick={join}>
              加入协作
            </Button>
          )}
          {/* 管理者可改元信息 */}
          {canManage && (
            <Button
              data-testid="board-meta-edit"
              size="sm"
              variant="secondary"
              onClick={() => setEditing((v) => !v)}
            >
              {editing ? "取消" : "编辑信息"}
            </Button>
          )}
          {/* 只读角色隐藏编辑入口 */}
          {canEdit && (
            <Button data-testid="board-edit-entry" size="sm" variant="secondary">
              编辑
            </Button>
          )}
        </div>
      </header>

      {/* 元信息编辑表单（管理者） */}
      {editing && canManage && (
        <form
          onSubmit={saveMeta}
          data-testid="board-meta-form"
          className="flex flex-col gap-3 border-b bg-card p-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="meta-name">名称</Label>
            <Input
              id="meta-name"
              data-testid="meta-name"
              value={fName}
              onChange={(e) => setFName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="meta-category">类别</Label>
            <Input
              id="meta-category"
              data-testid="meta-category"
              value={fCategory}
              onChange={(e) => setFCategory(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="meta-description">描述</Label>
            <Input
              id="meta-description"
              data-testid="meta-description"
              value={fDescription}
              onChange={(e) => setFDescription(e.target.value)}
            />
          </div>
          {saveError && (
            <p role="alert" data-testid="meta-err" className="text-sm text-destructive">
              {saveError}
            </p>
          )}
          <Button data-testid="meta-save" type="submit" size="sm" className="self-start">
            保存
          </Button>

          {/* 移动到其他房间 */}
          <div className="mt-2 flex flex-col gap-1.5 border-t pt-3">
            <Label htmlFor="move-room">移动到房间</Label>
            <div className="flex gap-2">
              <Select
                id="move-room"
                data-testid="move-room"
                className="w-56"
                value={moveTarget}
                onChange={(e) => setMoveTarget(e.target.value)}
              >
                <option value="">选择目标房间…</option>
                {rooms.map((r) => (
                  <option key={String(r.id)} value={String(r.id)}>
                    {r.name}
                  </option>
                ))}
              </Select>
              <Button
                type="button"
                data-testid="move-btn"
                size="sm"
                variant="secondary"
                disabled={!moveTarget}
                onClick={move}
              >
                移动
              </Button>
            </div>
          </div>

          {/* 白板设置 / 交互偏好（管理者） */}
          <div data-testid="board-settings" className="mt-2 flex flex-col gap-2 border-t pt-3">
            <Label>交互偏好</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                网格
                <Select
                  data-testid="setting-grid"
                  className="w-20"
                  value={board?.settings?.grid ? "on" : "off"}
                  onChange={(e) => changeSetting("grid", e.target.value === "on")}
                >
                  <option value="off">关</option>
                  <option value="on">开</option>
                </Select>
              </label>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                吸附
                <Select
                  data-testid="setting-snap"
                  className="w-20"
                  value={board?.settings?.snap ? "on" : "off"}
                  onChange={(e) => changeSetting("snap", e.target.value === "on")}
                >
                  <option value="off">关</option>
                  <option value="on">开</option>
                </Select>
              </label>
            </div>
          </div>

          {/* 可见范围（仅房间 owner） */}
          {canSetVisibility && (
            <div className="mt-2 flex flex-col gap-1.5 border-t pt-3">
              <Label htmlFor="visibility">可见范围</Label>
              <Select
                id="visibility"
                data-testid="visibility"
                className="w-56"
                value={board?.visibility ?? "room"}
                onChange={(e) => changeVisibility(e.target.value)}
              >
                <option value="room">房间成员可见</option>
                <option value="team">团队可见</option>
                <option value="public">公开（链接可访问）</option>
              </Select>
            </div>
          )}

          {/* 删除（行内确认） */}
          <div className="mt-2 flex items-center gap-2 border-t pt-3">
            {!confirmingDelete ? (
              <Button
                type="button"
                data-testid="board-delete"
                size="sm"
                variant="destructive"
                onClick={() => setConfirmingDelete(true)}
              >
                删除白板
              </Button>
            ) : (
              <>
                <span data-testid="delete-confirm-text" className="text-sm text-destructive">
                  确认删除「{board?.name}」？此操作不可恢复。
                </span>
                <Button
                  type="button"
                  data-testid="board-delete-confirm"
                  size="sm"
                  variant="destructive"
                  onClick={remove}
                >
                  确认删除
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmingDelete(false)}>
                  取消
                </Button>
              </>
            )}
          </div>
        </form>
      )}

      {/* 画布容器占位（真实画布编辑在 p6） */}
      <div className="relative flex-1 overflow-hidden bg-muted/30">
        <div
          data-testid="canvas-placeholder"
          className="flex h-full items-center justify-center text-sm text-muted-foreground"
        >
          画布区域（p6 接入编辑能力）
        </div>
        {/* 缩放 / 小地图入口占位（真实在 p6） */}
        <div
          data-testid="zoom-minimap-placeholder"
          className="absolute bottom-4 right-4 flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-sm"
        >
          100% · 小地图
        </div>
      </div>
    </div>
  );
}
