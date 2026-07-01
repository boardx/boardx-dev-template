"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// uc-credits-003-view-credit-records —— 个人 Credit Records 弹窗（用户菜单 > Credit 余额区域触发）。
// 展示个人钱包摘要（剩余 Credit + 累计消耗）+ 消费记录列表；支持滚动到底加载更多（分页）。
// 数据来自 GET /api/credits/wallet?scope=personal（摘要）+ GET /api/credits/transactions?scope=personal（流水）。

interface CreditRecord {
  id: string;
  kind: "usage" | "purchase";
  when: string;
  label: string;
  description: string;
  amount: number;
  balance: number;
}

interface TransactionsResponse {
  records: CreditRecord[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

interface WalletSummary {
  balance: number;
  totalConsumed: number;
}

const fmt = (n: number) => n.toLocaleString("en-US");
const signed = (n: number) => (n > 0 ? `+${fmt(n)}` : fmt(n));
const PAGE_SIZE = 20;

export function CreditRecordsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [summary, setSummary] = useState<WalletSummary | null>(null);
  const [records, setRecords] = useState<CreditRecord[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    setError("");
    setRecords([]);
    setPage(1);
    (async () => {
      try {
        const [walletRes, txRes] = await Promise.all([
          fetch("/api/credits/wallet?scope=personal"),
          fetch(`/api/credits/transactions?scope=personal&page=1&pageSize=${PAGE_SIZE}`),
        ]);
        if (!alive) return;
        if (!walletRes.ok || !txRes.ok) {
          setError("加载记录失败，请稍后重试");
          setLoading(false);
          return;
        }
        const walletData = (await walletRes.json()) as { wallet: { balance: number; totalConsumed: number } };
        const txData = (await txRes.json()) as TransactionsResponse;
        if (!alive) return;
        setSummary({ balance: walletData.wallet.balance, totalConsumed: walletData.wallet.totalConsumed });
        setRecords(txData.records);
        setHasMore(txData.hasMore);
        setLoading(false);
      } catch {
        if (alive) {
          setError("加载记录失败，请稍后重试");
          setLoading(false);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [open]);

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const res = await fetch(`/api/credits/transactions?scope=personal&page=${nextPage}&pageSize=${PAGE_SIZE}`);
      if (!res.ok) return;
      const data = (await res.json()) as TransactionsResponse;
      setRecords((prev) => [...prev, ...data.records]);
      setPage(nextPage);
      setHasMore(data.hasMore);
    } finally {
      setLoadingMore(false);
    }
  }

  function onScroll() {
    const el = listRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
      void loadMore();
    }
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="credit-records-title"
      data-testid="credit-records-dialog"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
    >
      <div className="flex max-h-[80vh] w-full max-w-md flex-col rounded-12 border border-border bg-popover p-4 shadow-lg">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id="credit-records-title" className="text-lg font-semibold text-foreground">
            Credit Records
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="关闭 Credit Records"
            onClick={onClose}
            className="shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {error && (
          <p role="alert" data-testid="credit-records-error" className="mb-3 text-13 text-destructive">
            {error}
          </p>
        )}

        {loading ? (
          <div data-testid="credit-records-loading" className="animate-pulse">
            <div className="grid grid-cols-2 gap-3">
              <div className="h-16 rounded-9 bg-muted" />
              <div className="h-16 rounded-9 bg-muted" />
            </div>
            <div className="mt-4 h-40 rounded-9 bg-muted" />
          </div>
        ) : (
          <>
            {summary && (
              <div data-testid="credit-records-summary" className="grid grid-cols-2 gap-3">
                <div className="rounded-9 border border-border p-3">
                  <div className="text-20 font-bold text-foreground">{fmt(summary.balance)}</div>
                  <div className="mt-0.5 text-11 text-muted-foreground">Remaining credits</div>
                </div>
                <div className="rounded-9 border border-border p-3">
                  <div className="text-20 font-bold text-foreground">{fmt(summary.totalConsumed)}</div>
                  <div className="mt-0.5 text-11 text-muted-foreground">Total consumed</div>
                </div>
              </div>
            )}

            <div
              ref={listRef}
              onScroll={onScroll}
              className="mt-4 flex-1 overflow-y-auto rounded-9 border border-border"
            >
              {records.length === 0 ? (
                <div data-testid="credit-records-empty" className="px-4 py-10 text-center text-13 text-muted-foreground">
                  暂无消费记录
                </div>
              ) : (
                <div data-testid="credit-records-list">
                  {records.map((r) => (
                    <div
                      key={r.id}
                      data-testid={`credit-record-${r.id}`}
                      className="flex items-center justify-between gap-3 border-b border-border px-3 py-2.5 text-13 last:border-b-0"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium text-foreground">{r.label || r.description}</div>
                        <div className="truncate text-11 text-muted-foreground">{r.when}</div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div
                          className={cn(
                            "font-semibold",
                            r.amount > 0 ? "text-foreground" : "text-muted-foreground"
                          )}
                        >
                          {signed(r.amount)}
                        </div>
                        <div className="text-11 text-muted-foreground">{fmt(r.balance)}</div>
                      </div>
                    </div>
                  ))}
                  {loadingMore && (
                    <div data-testid="credit-records-loading-more" className="flex justify-center py-3">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
