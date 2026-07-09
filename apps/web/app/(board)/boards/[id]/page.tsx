"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import QRCode from "qrcode";
import { ArrowLeft, MoreHorizontal, Redo2, Undo2 } from "lucide-react";
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
import { BoardCanvas, type BoardCanvasHandle } from "@/components/board/board-canvas";
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

// p7:F08（uc-board-header-007）：备份列表条目（不含快照体）
interface BackupRow {
  id: number | string;
  label: string;
  created_at: string;
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

  // p7:F02（uc-board-header-002）：Header 标题行内编辑，与上面"元信息编辑"侧栏
  // （改名/分类/简介一起改）是两条独立入口——本条只处理标题本身，Enter/失焦即保存。
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [titleSaving, setTitleSaving] = useState(false);
  const [titleError, setTitleError] = useState("");

  // 移动
  const [rooms, setRooms] = useState<RoomOpt[]>([]);
  const [moveTarget, setMoveTarget] = useState("");
  // 删除（行内确认）
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // p7:F08（uc-board-header-007）：备份面板。创建备份 + 列表 + 行内二次确认恢复
  //（确认模式参考本文件 board-delete 的 confirmingDelete）。
  const [backupOpen, setBackupOpen] = useState(false);
  const [backups, setBackups] = useState<BackupRow[]>([]);
  const [backupLabel, setBackupLabel] = useState("");
  const [backupBusy, setBackupBusy] = useState(false); // 创建/恢复请求进行中
  const [backupMsg, setBackupMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [confirmingRestore, setConfirmingRestore] = useState<string | null>(null); // backupId

  // 分享面板
  const [sharing, setSharing] = useState(false);

  // board-shell reskin（issue #468）：header 的撤销/重做经 BoardCanvas 的 ref 句柄调用，
  // 可用态由 onHistoryChange 回传；⋯ More 菜单收纳次要功能（统计/快捷键/Local Workspace/
  // 编辑信息/备份 + Home/Rooms 逃生口 + 危险区删除白板，UI 设计评审 P0-3 最终清单）。
  const canvasRef = useRef<BoardCanvasHandle>(null);
  const [hist, setHist] = useState({ canUndo: false, canRedo: false });
  const [moreOpen, setMoreOpen] = useState(false);
  // 删除白板两步确认（More 菜单内，独立于 meta 面板的 confirmingDelete——设计评审 P0-3：
  // 危险操作与常规项隔离，误触不可逆）。
  const [moreDeleteArmed, setMoreDeleteArmed] = useState(false);
  // 欢迎引导重开信号：More 菜单的 welcome-reopen 菜单项递增，BoardHelpGuide 监听后重展卡片。
  const [welcomeTick, setWelcomeTick] = useState(0);
  const [showQr, setShowQr] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
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

  // p7:F08：备份面板逻辑。列表刷新 / 创建 / 恢复（行内二次确认后调用）。
  async function loadBackups() {
    const res = await fetch(`/api/boards/${boardId}/backups`);
    if (res.ok) {
      const d = await res.json();
      setBackups(d.backups ?? []);
    }
  }

  function toggleBackupPanel() {
    const next = !backupOpen;
    setBackupOpen(next);
    setBackupMsg(null);
    setConfirmingRestore(null);
    if (next) void loadBackups();
  }

  async function createBackupNow(e: React.FormEvent) {
    e.preventDefault();
    const label = backupLabel.trim();
    if (!label || backupBusy) return;
    setBackupBusy(true);
    setBackupMsg(null);
    try {
      const res = await fetch(`/api/boards/${boardId}/backups`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label }),
      });
      if (res.ok) {
        setBackupLabel("");
        setBackupMsg({ kind: "ok", text: "备份已创建" });
        await loadBackups();
      } else {
        const d = await res.json().catch(() => ({}));
        setBackupMsg({ kind: "err", text: d.errors?.label ?? d.error ?? "备份失败" });
      }
    } catch {
      // uc-board-header-007 异常流程 2：失败保留原状态并提示
      setBackupMsg({ kind: "err", text: "备份失败" });
    }
    setBackupBusy(false);
  }

  async function restoreFromBackup(backupId: string) {
    if (backupBusy) return;
    setBackupBusy(true);
    setBackupMsg(null);
    try {
      const res = await fetch(`/api/boards/${boardId}/backups/${backupId}/restore`, {
        method: "POST",
      });
      if (res.ok) {
        // 恢复成功：画布 1.5s 轮询会自动拉到恢复后的 items；这里只反馈结果。
        setBackupMsg({ kind: "ok", text: "恢复成功，画布已回到备份时刻" });
      } else {
        // 异常流程 2：恢复失败（服务端事务已回滚），白板保持原状态，仅提示。
        const d = await res.json().catch(() => ({}));
        setBackupMsg({ kind: "err", text: d.error ?? "恢复失败，白板保持原状态" });
      }
    } catch {
      setBackupMsg({ kind: "err", text: "恢复失败，白板保持原状态" });
    }
    setConfirmingRestore(null);
    setBackupBusy(false);
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

  // p7:F03（uc-board-header-003 主流程 6）：展开二维码区域时才真正绘制，收起后不必
  // 保留（下次展开重新生成即可，shareUrl 稳定不变，重复生成成本可忽略）。
  useEffect(() => {
    if (!showQr || !shareUrl) return;
    let cancelled = false;
    QRCode.toDataURL(shareUrl, { width: 160, margin: 1 })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl("");
      });
    return () => {
      cancelled = true;
    };
  }, [showQr, shareUrl]);

  // p7:F02（uc-board-header-002 主流程 5）：标题保存成功后浏览器标题同步更新。
  useEffect(() => {
    if (board?.name) document.title = `${board.name} · BoardX`;
  }, [board?.name]);

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("error");
    }
    setTimeout(() => setCopyStatus("idle"), 2000);
  }

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

  // p7:F02（uc-board-header-002 主流程 2-7）：点击标题进入行内编辑；Enter/失焦保存。
  function startTitleEdit() {
    if (!canManage) return; // PATCH /api/boards/:id 服务端要求管理权限，非管理者不进入编辑态
    setTitleDraft(board?.name ?? "");
    setTitleError("");
    setTitleEditing(true);
  }

  async function commitTitleEdit() {
    if (!titleEditing) return;
    const trimmed = titleDraft.trim();
    // 主流程 3：输入为空时不保存空名，恢复为保存前的名称（不新造一个"默认名"字符串，
    // 避免把用户已经取的名字换成一个和原意无关的占位符）。
    if (!trimmed || trimmed === board?.name) {
      setTitleEditing(false);
      setTitleError("");
      return;
    }
    setTitleSaving(true);
    setTitleError("");
    const res = await fetch(`/api/boards/${boardId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    setTitleSaving(false);
    if (res.ok) {
      setTitleEditing(false);
      await refresh();
    } else {
      // 主流程 6-7：保存失败，恢复为保存前的名称并展示失败反馈，用户仍停留在当前白板。
      const d = await res.json().catch(() => ({}));
      setTitleError(d.errors?.name ?? d.error ?? "保存失败");
      setTitleEditing(false);
    }
  }

  if (loading) {
    return (
      <div data-testid="loading" className="flex h-screen animate-pulse flex-col gap-4 p-6">
        <div className="h-10 w-1/3 rounded bg-muted" />
        <div className="flex-1 rounded-lg bg-muted" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3">
        <p role="alert" data-testid="err" className="text-sm text-destructive">
          {error}
        </p>
      </div>
    );
  }

  const canEdit = role === "owner" || role === "editor";

  return (
    <div className="relative flex h-screen flex-col overflow-hidden">
      <BoardHelpGuide reopenTick={welcomeTick} />
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
          {titleEditing ? (
            <Input
              data-testid="board-title-input"
              autoFocus
              value={titleDraft}
              disabled={titleSaving}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={() => void commitTitleEdit()}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void commitTitleEdit();
                } else if (e.key === "Escape") {
                  setTitleEditing(false);
                }
              }}
              className="h-7 w-48 text-base font-semibold"
            />
          ) : (
            <h1
              data-testid="board-title"
              title={board?.name}
              onClick={startTitleEdit}
              className={`max-w-[16rem] truncate text-base font-semibold text-foreground ${
                canManage ? "cursor-text rounded px-1 transition-colors duration-200 hover:bg-muted" : ""
              }`}
            >
              {board?.name}
            </h1>
          )}
          {titleError && (
            <span role="alert" data-testid="board-title-err" className="text-xs text-destructive">
              {titleError}
            </span>
          )}
          {/* BETA 徽标（prototype header：10px/600 灰字 1px 边框圆角 5） */}
          <span className="rounded border border-border px-1.5 py-px text-10 font-semibold text-muted-foreground">
            BETA
          </span>
          <Badge variant="muted" data-testid="board-role">
            {role}
          </Badge>
          {/* 竖分隔线（prototype：1×22 #e0e0e0） */}
          <span aria-hidden className="mx-0.5 h-5 w-px bg-border" />
          {/* 撤销/重做（reskin：从画布顶部工具条迁到 header，经 ref 句柄调 BoardCanvas；
              testid 保活，键盘 mod+Z 仍在画布组件内） */}
          {canEdit && (
            <>
              <Button
                data-testid="undo"
                size="icon"
                variant="ghost"
                title="撤销"
                aria-label="撤销"
                disabled={!hist.canUndo}
                onClick={() => canvasRef.current?.undo()}
                className="h-7.5 w-7.5 rounded-md text-muted-foreground"
              >
                <Undo2 className="h-4 w-4" />
              </Button>
              <Button
                data-testid="redo"
                size="icon"
                variant="ghost"
                title="重做"
                aria-label="重做"
                disabled={!hist.canRedo}
                onClick={() => canvasRef.current?.redo()}
                className="h-7.5 w-7.5 rounded-md text-muted-foreground"
              >
                <Redo2 className="h-4 w-4" />
              </Button>
            </>
          )}
          {/* 实时协作（uc-canvas-005）：在线成员头像 + 真实同步状态。
              内含 BoardSyncStatus（受控），并每 ~1.5s 心跳/拉取在线成员。 */}
          <BoardPresence boardId={String(boardId)} />
        </div>
        <div className="flex items-center gap-2">
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
          {/* 分享（prototype：黑底白字 Share，hover #282828） */}
          <Button
            data-testid="board-share"
            size="sm"
            variant="default"
            aria-expanded={sharing}
            onClick={() => setSharing((v) => !v)}
            className="relative z-40 rounded-lg px-3.5"
          >
            分享
          </Button>
          {/* 协作计时器 / 幻灯片：prototype 保留为一级图标入口 */}
          <BoardTimer />
          <SlidesPanel boardId={String(boardId)} />
          {/* ⋯ More（reskin，设计评审 P0-3 最终清单）：次要功能收纳 + 全局导航逃生口 +
              危险操作隔离。面板内直接渲染既有自包含组件（触发按钮成为菜单项，testid 全保活，
              相关 spec 打开路径只需加"先点 board-more-menu"一步）。 */}
          <div className="relative">
            <Button
              data-testid="board-more-menu"
              size="icon"
              variant="ghost"
              title="更多"
              aria-label="更多"
              aria-expanded={moreOpen}
              onClick={() => {
                setMoreOpen((v) => !v);
                setMoreDeleteArmed(false);
              }}
              className="h-8 w-8 rounded-lg text-muted-foreground"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
            {moreOpen && (
              <>
                {/* 点击外部关闭（仿右键菜单遮罩模式） */}
                <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
                <div
                  data-testid="board-more-panel"
                  role="menu"
                  className="absolute right-0 top-10 z-50 flex w-56 flex-col gap-0.5 rounded-xl border bg-popover p-1.5 shadow-xl"
                >
                  {/* 组1 · 白板功能（自包含组件原样渲染，按钮即菜单项） */}
                  <BoardStatistics boardId={String(boardId)} />
                  <BoardShortcutsHelp />
                  <Button
                    data-testid="welcome-reopen"
                    size="sm"
                    variant="ghost"
                    className="justify-start"
                    onClick={() => {
                      setWelcomeTick((t) => t + 1);
                      setMoreOpen(false);
                    }}
                  >
                    欢迎引导
                  </Button>
                  <LocalWorkspace boardId={String(boardId)} canEdit={canEdit} />
                  {canManage && (
                    <Button
                      data-testid="board-meta-edit"
                      size="sm"
                      variant="ghost"
                      className="justify-start"
                      onClick={() => {
                        setEditing((v) => !v);
                        setMoreOpen(false);
                      }}
                    >
                      {editing ? "关闭信息编辑" : "Board settings"}
                    </Button>
                  )}
                  {canManage && (
                    <Button
                      data-testid="board-backup"
                      size="sm"
                      variant="ghost"
                      className="justify-start"
                      aria-expanded={backupOpen}
                      onClick={() => {
                        toggleBackupPanel();
                        setMoreOpen(false);
                      }}
                    >
                      {backupOpen ? "关闭备份" : "Backup & restore"}
                    </Button>
                  )}
                  <div aria-hidden className="mx-1.5 my-1 h-px bg-border" />
                  {/* 组2 · 全局导航逃生口（设计评审 P0-1：全屏无 rail 后不能只有单向返回） */}
                  <Button
                    data-testid="more-nav-home"
                    size="sm"
                    variant="ghost"
                    className="justify-start"
                    onClick={() => router.push("/")}
                  >
                    Home
                  </Button>
                  <Button
                    data-testid="more-nav-rooms"
                    size="sm"
                    variant="ghost"
                    className="justify-start"
                    onClick={() => router.push("/rooms")}
                  >
                    Rooms
                  </Button>
                  {/* 组3 · 危险操作（隔离 + 两步确认，误触不可逆） */}
                  {canManage && (
                    <>
                      <div aria-hidden className="mx-1.5 my-1 h-px bg-border" />
                      {!moreDeleteArmed ? (
                        <Button
                          data-testid="more-delete-board"
                          size="sm"
                          variant="ghost"
                          className="justify-start text-destructive hover:text-destructive"
                          onClick={() => setMoreDeleteArmed(true)}
                        >
                          Delete board
                        </Button>
                      ) : (
                        <Button
                          data-testid="more-delete-board-confirm"
                          size="sm"
                          variant="ghost"
                          className="justify-start font-semibold text-destructive hover:text-destructive"
                          onClick={() => void remove()}
                        >
                          确认删除？不可恢复
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
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

          {/* p7:F03（uc-board-header-003 主流程 2-4）：访问范围下拉框，Room Owner/Admin
              可切换，其他用户禁用但仍能看到当前范围（disabled 的 select 依然渲染选中值，
              不需要额外的只读文案分支）。 */}
          <div className="mt-2 flex flex-col gap-1">
            <Label htmlFor="share-visibility">访问范围</Label>
            <Select
              id="share-visibility"
              data-testid="share-visibility"
              aria-label="访问范围"
              disabled={!canSetVisibility}
              value={board?.visibility ?? "room"}
              onChange={(e) => void changeVisibility(e.target.value)}
            >
              <option value="room">房间成员可访问</option>
              <option value="team">团队成员可访问</option>
              <option value="public">公开（任何持链接者可访问）</option>
            </Select>
          </div>

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

          {/* 二维码（uc-board-header-003 主流程 6：展开时绘制，再次点击收起） */}
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
                {qrDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- data: URL，next/image 不适用
                  <img data-testid="share-qr" src={qrDataUrl} alt="分享二维码" className="size-28 rounded-md border" />
                ) : (
                  <div data-testid="share-qr" aria-label="二维码生成中" className="size-28 animate-pulse rounded-md border bg-muted" />
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* p7:F08 白板备份面板（管理者）：创建备份 + 历史列表 + 行内二次确认恢复 */}
      {backupOpen && canManage && (
        <div
          data-testid="backup-panel"
          role="dialog"
          aria-label="白板备份"
          className="absolute right-4 top-20 z-30 w-96 rounded-xl border bg-popover p-4 text-popover-foreground shadow-xl"
        >
          <h2 className="text-sm font-semibold text-foreground">白板备份</h2>

          {/* 创建备份 */}
          <form onSubmit={createBackupNow} className="mt-2 flex gap-2">
            <Input
              data-testid="backup-label"
              placeholder="备份名称"
              value={backupLabel}
              disabled={backupBusy}
              onChange={(e) => setBackupLabel(e.target.value)}
              className="flex-1"
            />
            <Button
              type="submit"
              data-testid="backup-create"
              size="sm"
              disabled={backupBusy || !backupLabel.trim()}
            >
              {backupBusy ? "处理中…" : "备份当前状态"}
            </Button>
          </form>

          {/* 操作反馈（uc-board-header-007 业务规则 3：动作必须有明确反馈） */}
          {backupMsg && (
            <p
              data-testid="backup-msg"
              role={backupMsg.kind === "err" ? "alert" : "status"}
              className={`mt-2 text-xs ${backupMsg.kind === "err" ? "text-destructive" : "text-muted-foreground"}`}
            >
              {backupMsg.text}
            </p>
          )}

          {/* 历史备份列表 */}
          <div data-testid="backup-list" className="mt-3 flex max-h-64 flex-col gap-2 overflow-y-auto border-t pt-3">
            {backups.length === 0 ? (
              <p data-testid="backup-empty" className="text-xs text-muted-foreground">
                未找到白板备份
              </p>
            ) : (
              backups.map((b) => (
                <div
                  key={String(b.id)}
                  data-testid={`backup-row-${b.id}`}
                  className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-foreground">{b.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(b.created_at).toLocaleString()}
                    </p>
                  </div>
                  {confirmingRestore === String(b.id) ? (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span data-testid="restore-confirm-text" className="text-xs text-destructive">
                        用该备份覆盖当前白板？
                      </span>
                      <Button
                        type="button"
                        data-testid={`backup-restore-confirm-${b.id}`}
                        size="sm"
                        variant="destructive"
                        disabled={backupBusy}
                        onClick={() => void restoreFromBackup(String(b.id))}
                      >
                        确认恢复
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirmingRestore(null)}
                      >
                        取消
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      data-testid={`backup-restore-${b.id}`}
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      disabled={backupBusy}
                      onClick={() => {
                        setBackupMsg(null);
                        setConfirmingRestore(String(b.id));
                      }}
                    >
                      恢复
                    </Button>
                  )}
                </div>
              ))
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
      <BoardCanvas ref={canvasRef} boardId={String(boardId)} canEdit={canEdit} onHistoryChange={setHist} />
    </div>
  );
}
