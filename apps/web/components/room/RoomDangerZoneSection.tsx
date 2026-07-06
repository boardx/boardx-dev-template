"use client";
// p20/F06（uc-rr-005）DANGER ZONE — 删除房间的级联契约。
// 独立组件，边界清晰：只处理"owner 打开确认弹窗 → 看真实级联数量 → 输入房间名确认 → DELETE"。
// 与 F11 的 "About & AI" 区块分属不同组件，方便后续合并冲突时轻松拼接——不要把两者的 JSX
// 揉进同一个块里。
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, AlertTriangle, X } from "lucide-react";

interface CascadeSummary {
  roomName: string;
  boards: number;
  chats: number;
  files: number;
  surveys: number;
}

export function RoomDangerZoneSection({ roomId, roomName }: { roomId: string; roomName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [summary, setSummary] = useState<CascadeSummary | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function openConfirm() {
    setError("");
    setConfirmText("");
    setOpen(true);
    setLoadingPreview(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}/delete-preview`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "加载级联数量失败");
        setSummary(null);
        return;
      }
      const d = (await res.json()) as CascadeSummary;
      setSummary(d);
    } catch {
      setError("加载级联数量失败，请重试");
    } finally {
      setLoadingPreview(false);
    }
  }

  function closeConfirm() {
    if (deleting) return;
    setOpen(false);
    setSummary(null);
    setConfirmText("");
    setError("");
  }

  const nameMatches = confirmText.trim() === roomName;

  async function confirmDelete() {
    if (!nameMatches || deleting) return;
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/rooms/${roomId}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "删除失败，请重试");
        setDeleting(false);
        return;
      }
      router.push(`/rooms?deleted=${encodeURIComponent(roomName)}`);
    } catch {
      setError("删除失败，请重试");
      setDeleting(false);
    }
  }

  return (
    <>
      {/* ─── DANGER ZONE 区块 start ─────────────────────────────────────── */}
      <section
        data-testid="room-danger-zone"
        className="flex flex-col gap-3 rounded-12 border border-destructive/30 bg-surface-1 p-4"
      >
        <div className="flex flex-col gap-0.5">
          <h2 className="flex items-center gap-1.5 text-15 font-semibold text-destructive">
            <AlertTriangle className="h-4 w-4" />
            Danger Zone
          </h2>
          <p className="text-11 text-muted-foreground">
            Delete room — Permanently remove this room and its boards, chats, files and surveys.
          </p>
        </div>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          data-testid="room-delete-open"
          className="self-start"
          onClick={() => void openConfirm()}
        >
          Delete room
        </Button>
      </section>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-surface-dark-2/40 p-6"
          onClick={closeConfirm}
        >
          <div
            data-testid="room-delete-confirm"
            className="flex w-full max-w-md flex-col gap-4 rounded-16 border border-border bg-card p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-15 font-semibold text-destructive">Permanently delete this room?</h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="关闭"
                className="h-7 w-7"
                onClick={closeConfirm}
                disabled={deleting}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <p className="text-13 text-muted-foreground">
              This will permanently delete <span className="font-semibold text-foreground">{roomName}</span> and
              everything in it. This cannot be undone.
            </p>

            {loadingPreview ? (
              <div data-testid="room-delete-cascade-loading" className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : summary ? (
              <ul
                data-testid="room-delete-cascade-summary"
                className="flex flex-col gap-1 rounded-10 border border-border bg-surface-1 px-3.5 py-3 text-13 text-foreground"
              >
                <li data-testid="room-delete-cascade-boards">{summary.boards} boards</li>
                <li data-testid="room-delete-cascade-chats">{summary.chats} chats</li>
                <li data-testid="room-delete-cascade-files">{summary.files} files</li>
                <li data-testid="room-delete-cascade-surveys">{summary.surveys} surveys</li>
              </ul>
            ) : null}

            {error && (
              <p role="alert" data-testid="room-delete-err" className="text-13 text-destructive">
                {error}
              </p>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="room-delete-confirm-name">
                Type <span className="font-semibold text-foreground">{roomName}</span> to confirm
              </Label>
              <Input
                id="room-delete-confirm-name"
                data-testid="room-delete-confirm-name"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                disabled={deleting}
                autoComplete="off"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={closeConfirm} disabled={deleting}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                data-testid="room-delete-confirm-submit"
                disabled={!nameMatches || deleting || loadingPreview}
                onClick={() => void confirmDelete()}
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete room"}
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* ─── DANGER ZONE 区块 end ───────────────────────────────────────── */}
    </>
  );
}
