"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { BoardTimer } from "@/components/board/timer";
import { BoardHelpGuide } from "@/components/board/help-guide";
import { BoardShortcutsHelp } from "@/components/board/shortcuts-help";
import { BoardPresence } from "@/components/board/presence";
import { BoardStatistics } from "@/components/board/board-statistics";
import { SlidesPanel } from "@/components/board/slides-panel";
import { BoardCanvas } from "@/components/board/board-canvas";
import { LocalWorkspace } from "@/components/board/local-workspace";

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

  // 分享面板
  const [sharing, setSharing] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const [shareUrl, setShareUrl] = useState("");

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

  // 分享链接：客户端按当前 origin 计算
  useEffect(() => {
    if (typeof window !== "undefined") {
      setShareUrl(`${window.location.origin}/boards/${boardId}`);
    }
  }, [boardId]);

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("error");
    }
    setTimeout(() => setCopyStatus("idle"), 2000);
  }

  const visibilityLabel =
    board?.visibility === "public"
      ? "公开（任何持链接者可访问）"
      : board?.visibility === "team"
        ? "团队成员可访问"
        : "房间成员可访问";

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
      <header
        data-testid="board-header"
        className="flex items-center justify-between border-b bg-card px-4 py-2.5"
      >
        <div className="flex items-center gap-2">
          {/* p7:F01（uc-board-header-008）：返回房间列表页。备份保存中不可离开的检查留给
              F08（备份恢复）落地时接入——目前没有备份能力，没有东西可以阻塞，先只做
              导航本身，不假装已经有备份感知。
              （p22/F04 原本打算在此加一个几乎相同的返回链接，发现 p7:F01 已经做了，
              避免重复实现——直接复用这个既有的 board-back 按钮，见 F04 e2e spec。） */}
          <Button
            data-testid="board-back"
            size="icon"
            variant="ghost"
            title="返回"
            aria-label="返回"
            onClick={() => router.push(board?.room_id ? `/rooms/${board.room_id}/boards` : "/boards")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 data-testid="board-title" className="text-base font-semibold text-foreground">
            {board?.name}
          </h1>
          <Badge variant="muted" data-testid="board-role">
            {role}
          </Badge>
          {/* 实时协作（uc-canvas-005）：在线成员头像 + 真实同步状态。
              内含 BoardSyncStatus（受控），并每 ~1.5s 心跳/拉取在线成员。 */}
          <BoardPresence boardId={String(boardId)} />
        </div>
        <div className="flex items-center gap-2">
          {/* 板统计（uc-board-header-014）：只读组件计数面板 */}
          <BoardStatistics boardId={String(boardId)} />
          {/* 快捷键帮助（所有可访问者可见，只读不改权限） */}
          <BoardShortcutsHelp />
          {/* 协作计时器（所有协作者可用） */}
          <BoardTimer />
          {/* 幻灯片管理（uc-board-header-005）：侧栏创建/排序/展示/导出 */}
          <SlidesPanel boardId={String(boardId)} />
          <LocalWorkspace boardId={String(boardId)} canEdit={canEdit} />
          {/* 分享（所有可访问者可见：复制链接 + 可见性说明 + 二维码占位） */}
          <Button
            data-testid="board-share"
            size="sm"
            variant="secondary"
            aria-expanded={sharing}
            onClick={() => setSharing((v) => !v)}
            className="relative z-40"
          >
            {sharing ? "关闭分享" : "分享"}
          </Button>
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

      {/* 分享白板面板 */}
      {sharing && (
        <div
          data-testid="share-panel"
          role="dialog"
          aria-label="分享白板"
          className="absolute right-4 top-20 z-30 w-80 rounded-xl border bg-popover p-4 text-popover-foreground shadow-xl"
        >
          <h2 className="text-sm font-semibold text-foreground">分享白板</h2>

          {/* 可见性说明（复用 board.visibility） */}
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            访问范围
          </p>
          <p data-testid="share-visibility" className="mt-1 text-sm text-foreground">
            {visibilityLabel}
          </p>

          {/* 复制分享链接 */}
          <div className="mt-3 flex flex-col gap-1.5">
            <Label htmlFor="share-url">分享链接</Label>
            <div className="flex gap-2">
              <Input
                id="share-url"
                data-testid="share-url"
                readOnly
                value={shareUrl}
                aria-label="分享链接"
                className="flex-1"
              />
              <Button
                type="button"
                data-testid="share-copy"
                size="sm"
                variant="default"
                onClick={copyShareLink}
              >
                复制链接
              </Button>
            </div>
            {copyStatus === "copied" && (
              <p data-testid="share-copy-status" className="text-xs text-muted-foreground">
                已复制到剪贴板
              </p>
            )}
            {copyStatus === "error" && (
              <p data-testid="share-copy-status" role="alert" className="text-xs text-destructive">
                复制失败，请手动复制
              </p>
            )}
          </div>

          {/* 二维码（占位） */}
          <div className="mt-3 border-t pt-3">
            <Button
              type="button"
              data-testid="share-qr-toggle"
              size="sm"
              variant="outline"
              className="w-full"
              aria-expanded={showQr}
              onClick={() => setShowQr((v) => !v)}
            >
              {showQr ? "隐藏二维码" : "显示二维码"}
            </Button>
            {showQr && (
              <div className="mt-3 flex flex-col items-center gap-2">
                <div
                  data-testid="share-qr"
                  aria-label="分享二维码占位"
                  className="size-28 rounded-md border bg-muted"
                />
                <p className="text-xs text-muted-foreground">二维码占位 · 后续接入生成</p>
              </div>
            )}
          </div>
        </div>
      )}

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

      {/* 画布（P6：F05 视口 + F06 board-keyed items 渲染/选择/键盘） */}
      <BoardCanvas boardId={String(boardId)} canEdit={canEdit} />
    </div>
  );
}
