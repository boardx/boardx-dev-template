"use client";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface RoomHit {
  id: number;
  public_id: string;
  name: string;
  visibility: string;
  team_id: number | null;
  created_at: string;
}
interface BoardHit {
  id: number;
  public_id: string;
  name: string;
  room_id: number;
  room_name: string | null;
  team_id: number | null;
  owner_user_id: number;
  created_at: string;
}
interface TeamHit {
  id: number;
  name: string;
  role: string;
  created_at: string;
}
interface Results {
  boards: BoardHit[];
  rooms: RoomHit[];
  teams: TeamHit[];
}

const EMPTY: Results = { boards: [], rooms: [], teams: [] };

function fmtDate(s: string) {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString();
}

function Skeleton() {
  return (
    <div data-testid="loading" className="mt-6 animate-pulse space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-14 rounded-12 bg-muted" />
      ))}
    </div>
  );
}

function ResultRow({
  href,
  testid,
  title,
  meta,
  badge,
}: {
  href: string;
  testid: string;
  title: string;
  meta: string;
  badge?: string;
}) {
  return (
    <a
      href={href}
      data-testid={testid}
      className="flex items-center justify-between gap-3 rounded-12 border border-border bg-surface-1 px-4 py-3 transition-colors hover:border-border-strong hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="min-w-0">
        <span className="block truncate text-sm font-semibold text-foreground">{title}</span>
        {meta && <span className="block truncate text-xs text-muted-foreground">{meta}</span>}
      </div>
      {badge && <Badge variant="muted">{badge}</Badge>}
    </a>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchInner />
    </Suspense>
  );
}

function SearchInner() {
  const router = useRouter();
  const params = useSearchParams();
  const initialQ = params.get("q") ?? "";

  const [input, setInput] = useState(initialQ);
  const [q, setQ] = useState(initialQ);
  const [results, setResults] = useState<Results>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const run = useCallback(
    async (term: string) => {
      const trimmed = term.trim();
      // 同步到 URL，使 /search?q= 可分享、可刷新。
      const sp = new URLSearchParams();
      if (trimmed) sp.set("q", trimmed);
      router.replace(`/search${sp.toString() ? `?${sp.toString()}` : ""}`);

      if (!trimmed) {
        setResults(EMPTY);
        setError("");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
        if (res.status === 401) {
          // 未登录：跳登录页（UC 权限分支）。
          router.push("/login");
          return;
        }
        if (!res.ok) {
          setError("搜索失败，请重试");
          setLoading(false);
          return;
        }
        const data = (await res.json()) as Results;
        setResults({
          boards: data.boards ?? [],
          rooms: data.rooms ?? [],
          teams: data.teams ?? [],
        });
      } catch {
        setError("搜索失败，请重试");
      } finally {
        setLoading(false);
      }
    },
    [router],
  );

  // 防抖：输入变化后短暂延迟再触发搜索。
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setQ(input);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [input]);

  useEffect(() => {
    void run(q);
  }, [q, run]);

  function submitNow() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setQ(input);
    void run(input);
  }

  const total = results.boards.length + results.rooms.length + results.teams.length;
  const hasQuery = q.trim().length > 0;

  return (
    <div className="mx-auto max-w-content px-9 pb-14 pt-7">
      <h1 className="text-26 font-bold tracking-tight text-foreground">Search</h1>

      {/* 搜索输入 */}
      <div className="mt-5 flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-placeholder" />
          <Input
            data-testid="search"
            aria-label="Search resources"
            placeholder="Search boards, rooms, teams…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitNow()}
            className="pl-9"
            autoFocus
          />
        </div>
        <Button data-testid="search-btn" variant="secondary" onClick={submitNow}>
          Search
        </Button>
      </div>

      {/* 内容区 */}
      <div className="mt-2">
        {error ? (
          <div data-testid="error" role="alert" className="mt-6 flex items-center justify-between gap-3 rounded-12 border border-border bg-surface-1 px-4 py-3">
            <span className="text-sm text-destructive">{error}</span>
            <Button data-testid="retry" size="sm" variant="outline" onClick={submitNow}>
              Retry
            </Button>
          </div>
        ) : !hasQuery ? (
          <p data-testid="hint" className="mt-8 text-center text-sm text-muted-foreground">
            输入关键词搜索你有权限访问的 Boards、Rooms 和 Teams。
          </p>
        ) : loading ? (
          <Skeleton />
        ) : total === 0 ? (
          <p data-testid="empty" className="mt-8 text-center text-sm text-muted-foreground">
            没有找到与 “{q.trim()}” 匹配的结果。
          </p>
        ) : (
          <div data-testid="results" className="mt-6 space-y-8">
            {results.boards.length > 0 && (
              <section data-testid="group-boards">
                <h2 className="mb-2 text-13 font-semibold uppercase tracking-wide text-muted-foreground">
                  Boards
                </h2>
                <div className="space-y-2">
                  {results.boards.map((b) => (
                    <ResultRow
                      key={`b-${b.id}`}
                      testid={`board-${b.id}`}
                      href={`/boards/${b.public_id}`}
                      title={b.name}
                      meta={[b.room_name, fmtDate(b.created_at)].filter(Boolean).join(" · ")}
                      badge="Board"
                    />
                  ))}
                </div>
              </section>
            )}

            {results.rooms.length > 0 && (
              <section data-testid="group-rooms">
                <h2 className="mb-2 text-13 font-semibold uppercase tracking-wide text-muted-foreground">
                  Rooms
                </h2>
                <div className="space-y-2">
                  {results.rooms.map((r) => (
                    <ResultRow
                      key={`r-${r.id}`}
                      testid={`room-${r.id}`}
                      href={`/rooms/${r.public_id}/boards`}
                      title={r.name}
                      meta={fmtDate(r.created_at)}
                      badge={r.visibility}
                    />
                  ))}
                </div>
              </section>
            )}

            {results.teams.length > 0 && (
              <section data-testid="group-teams">
                <h2 className="mb-2 text-13 font-semibold uppercase tracking-wide text-muted-foreground">
                  Teams
                </h2>
                <div className="space-y-2">
                  {results.teams.map((t) => (
                    <ResultRow
                      key={`t-${t.id}`}
                      testid={`team-${t.id}`}
                      href="/teams"
                      title={t.name}
                      meta={fmtDate(t.created_at)}
                      badge={t.role}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
