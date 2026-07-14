"use client";
// 04-F13（uc-team-009）：团队 Memory——owner/admin 维护团队 AI 协作可复用上下文。
// 列表按文本排序（服务端 ORDER BY content）；搜索为前端过滤，保留总数/过滤计数；
// Enter 新增、Shift+Enter 换行；重复内容 409 提示已存在；删除走确认弹窗；失败回退并提示。
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Memory {
  id: number;
  content: string;
}

export default function TeamMemoryPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const teamId = Number(params.id);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await fetch(`/api/teams/${teamId}/memories`);
      if (!alive) return;
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      if (res.status === 403) {
        setForbidden(true);
        setLoading(false);
        return;
      }
      const data = await res.json();
      setMemories(data.memories ?? []);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [router, teamId]);

  async function add() {
    const content = draft.trim();
    if (!content || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch(`/api/teams/${teamId}/memories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (res.status === 409) {
        setError("该 Memory 已存在");
        return;
      }
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMemories((prev) => [...prev, data.memory].sort((a, b) => a.content.localeCompare(b.content)));
      setDraft("");
      setNotice("已新增");
    } catch {
      setError("保存失败，请重试");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    setBusy(true);
    setError("");
    setNotice("");
    const prev = memories;
    setMemories((m) => m.filter((x) => x.id !== id));
    setConfirmId(null);
    try {
      const res = await fetch(`/api/teams/${teamId}/memories/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setNotice("已删除");
    } catch {
      setMemories(prev);
      setError("删除失败，请重试");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div data-testid="loading" className="mx-auto max-w-content animate-pulse px-9 py-10"><div className="h-24 rounded bg-muted" /></div>;
  }
  if (forbidden) {
    return (
      <div data-testid="team-memory-forbidden" className="mx-auto max-w-content px-9 py-10">
        <p className="text-sm text-muted-foreground">仅团队 owner/admin 可管理团队 Memory。</p>
      </div>
    );
  }

  const t = q.trim().toLowerCase();
  const visible = t ? memories.filter((m) => m.content.toLowerCase().includes(t)) : memories;

  return (
    <div data-testid="team-memory" className="mx-auto max-w-content px-9 pb-14 pt-10">
      <Link href={`/teams/${teamId}`} data-testid="memory-back" className="mb-4 inline-flex items-center gap-1 text-13 text-muted-foreground transition-colors duration-200 hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Team Home
      </Link>
      <h1 className="text-22 font-bold tracking-tight text-foreground">Team Memory</h1>
      <p className="mt-1 text-13 text-muted-foreground">团队在 AI 协作中可复用的上下文信息。</p>

      <Input
        data-testid="memory-search"
        placeholder="Search memories…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="mt-5"
      />
      <p data-testid="memory-count" className="mt-2 text-11 text-placeholder">
        {t ? `${visible.length} / ${memories.length}` : `${memories.length}`} memories
      </p>

      <div className="mt-4 flex items-start gap-2">
        <textarea
          ref={inputRef}
          data-testid="memory-input"
          placeholder="Add a memory… (Enter 保存，Shift+Enter 换行)"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void add();
            }
          }}
          rows={2}
          className="min-h-16 flex-1 rounded-11 border border-border bg-background px-3 py-2 text-13 text-foreground outline-none transition-colors duration-200 focus:border-border-strong focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button data-testid="memory-add" disabled={busy || !draft.trim()} onClick={() => void add()}>
          Add
        </Button>
      </div>
      {notice && <p data-testid="memory-notice" className="mt-2 text-13 text-muted-foreground">{notice}</p>}
      {error && <p data-testid="memory-error" role="alert" className="mt-2 text-13 text-destructive">{error}</p>}

      {visible.length === 0 ? (
        <div data-testid="memory-empty" className="mt-6 rounded-12 border border-dashed border-border p-6 text-13 text-muted-foreground">
          {t ? "No memories match your search." : "No memories yet — add the first one above."}
        </div>
      ) : (
        <ul data-testid="memory-list" className="mt-6 flex flex-col gap-2">
          {visible.map((m) => (
            <li key={m.id} data-testid={`memory-${m.id}`} className="flex items-start gap-3 rounded-11 border border-border px-4 py-3">
              <p className="flex-1 whitespace-pre-wrap text-13 text-foreground">{m.content}</p>
              <Button
                data-testid={`memory-delete-${m.id}`}
                size="icon"
                variant="ghost"
                aria-label="Delete memory"
                onClick={() => setConfirmId(m.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {confirmId !== null && (
        <div data-testid="memory-confirm" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-80 rounded-12 border border-border bg-background p-5">
            <p className="text-sm font-semibold text-foreground">删除这条 Memory？</p>
            <p className="mt-1 text-13 text-muted-foreground">删除后不可恢复。</p>
            <div className="mt-4 flex justify-end gap-2">
              <Button data-testid="memory-confirm-cancel" size="sm" variant="ghost" onClick={() => setConfirmId(null)}>
                Cancel
              </Button>
              <Button data-testid="memory-confirm-delete" size="sm" variant="destructive" onClick={() => void remove(confirmId)}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
