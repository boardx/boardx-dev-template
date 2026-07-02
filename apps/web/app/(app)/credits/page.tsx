"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BuyCreditsDialog } from "@/components/credits/buy-credits-dialog";

interface CreditRecord {
  id: string;
  kind: "usage" | "purchase";
  when: string;
  label: string;
  description: string;
  amount: number;
  balance: number;
}

interface Wallet {
  scope: "personal" | "team";
  balance: number;
  totalPurchased: number;
  totalGranted: number;
  totalConsumed: number;
  records: CreditRecord[];
}

interface TransactionsPage {
  records: CreditRecord[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

interface TeamWithRole {
  id: number | string;
  name: string;
  role: string;
}

const fmt = (n: number) => n.toLocaleString("en-US");
const signed = (n: number) => (n > 0 ? `+${fmt(n)}` : fmt(n));

function SummaryCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-12 border border-border p-4">
      <div className="text-26 font-bold text-foreground">{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function WalletSkeleton() {
  return (
    <div data-testid="loading" className="animate-pulse">
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[5.5rem] rounded-12 bg-muted" />
        ))}
      </div>
      <div className="mt-6 h-62 rounded-12 bg-muted" />
    </div>
  );
}

const PAGE_SIZE = 20;

export default function CreditsPage() {
  const router = useRouter();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [scope, setScope] = useState<"personal" | "team">("personal");
  const [teamName, setTeamName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [forbidden, setForbidden] = useState(false);
  const [tab, setTab] = useState<"usage" | "purchase">("usage");
  const [records, setRecords] = useState<CreditRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [stateQuery, setStateQuery] = useState("");
  const [buyOpen, setBuyOpen] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      setForbidden(false);
      const state =
        typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("state") : null;
      const query = state === "empty" ? "&state=empty" : "";
      setStateQuery(query);

      // 判断当前是否处在「团队管理角色」上下文：有当前团队且角色为 owner/admin → 走团队钱包；
      // 否则（无团队 / 普通 member）→ 走个人钱包。
      const [teamsRes, currentRes] = await Promise.all([
        fetch("/api/teams"),
        fetch("/api/teams/current"),
      ]);
      if (!alive) return;
      if (teamsRes.status === 401 || currentRes.status === 401) {
        router.replace("/login");
        return;
      }
      const teamsData = (await teamsRes.json().catch(() => ({ teams: [] }))) as { teams?: TeamWithRole[] };
      const currentData = (await currentRes.json().catch(() => ({ teamId: null }))) as { teamId: number | null };
      const teams = teamsData.teams ?? [];
      const activeTeam =
        currentData.teamId != null ? teams.find((t) => String(t.id) === String(currentData.teamId)) : undefined;
      const canManage = activeTeam != null && (activeTeam.role === "owner" || activeTeam.role === "admin");
      const resolvedScope = canManage ? "team" : "personal";

      const res = await fetch(`/api/credits/wallet?scope=${resolvedScope}${query}`);
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
      if (!res.ok) {
        setError("加载积分钱包失败，请稍后重试");
        setLoading(false);
        return;
      }
      const data = (await res.json()) as { wallet: Wallet };
      if (!alive) return;
      setWallet(data.wallet);
      setScope(resolvedScope);
      setTeamName(canManage ? activeTeam!.name : null);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [router, refreshTick]);

  // 流水表（F03 分页）：scope 就绪后按当前 tab 拉取第 1 页；切 tab 重新拉取；
  // 购买成功（refreshTick 变化）后也重新拉取，确保 Purchase 标签及时出现新记录。
  useEffect(() => {
    if (loading || forbidden || error) return;
    let alive = true;
    (async () => {
      setRecordsLoading(true);
      const res = await fetch(
        `/api/credits/transactions?scope=${scope}&kind=${tab}&page=1&pageSize=${PAGE_SIZE}${stateQuery}`
      );
      if (!alive) return;
      if (!res.ok) {
        setRecordsLoading(false);
        return;
      }
      const data = (await res.json()) as TransactionsPage;
      if (!alive) return;
      setRecords(data.records);
      setPage(1);
      setHasMore(data.hasMore);
      setRecordsLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [scope, tab, loading, forbidden, error, stateQuery, refreshTick]);

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const res = await fetch(
        `/api/credits/transactions?scope=${scope}&kind=${tab}&page=${nextPage}&pageSize=${PAGE_SIZE}${stateQuery}`
      );
      if (!res.ok) return;
      const data = (await res.json()) as TransactionsPage;
      setRecords((prev) => [...prev, ...data.records]);
      setPage(nextPage);
      setHasMore(data.hasMore);
    } finally {
      setLoadingMore(false);
    }
  }

  const amountHead = tab === "usage" ? "User" : "Type";
  const descHead = tab === "usage" ? "Reason" : "Description";

  return (
    <div className="mx-auto max-w-content px-9 pb-14 pt-7">
      {/* 标题 + 操作 */}
      <div className="flex items-center gap-3">
        <h1 data-testid="credits-title" className="text-22 font-bold tracking-tight text-foreground">
          Credits
        </h1>
        {teamName && (
          <span data-testid="scope-label" className="text-13 text-placeholder">
            {teamName}
          </span>
        )}
        <div className="flex-1" />
        <Button data-testid="buy-credits" size="sm" onClick={() => setBuyOpen(true)}>
          Buy credits
        </Button>
      </div>

      <BuyCreditsDialog
        open={buyOpen}
        onClose={() => setBuyOpen(false)}
        scope={scope}
        onPurchased={() => setRefreshTick((n) => n + 1)}
      />

      {error && (
        <p role="alert" data-testid="error" className="mt-4 text-13 text-destructive">
          {error}
        </p>
      )}

      {forbidden && (
        <p role="alert" data-testid="forbidden" className="mt-4 text-13 text-destructive">
          你没有权限查看团队 Credit 钱包
        </p>
      )}

      {loading ? (
        <div className="mt-5">
          <WalletSkeleton />
        </div>
      ) : wallet ? (
        <>
          {/* 摘要卡片 */}
          <div data-testid="wallet-summary" className="mt-5 grid grid-cols-2 gap-3.5 sm:grid-cols-4">
            <div data-testid="balance">
              <SummaryCard value={fmt(wallet.balance)} label="Current balance" />
            </div>
            <SummaryCard value={fmt(wallet.totalPurchased)} label="Total purchased" />
            <SummaryCard value={fmt(wallet.totalGranted)} label="Total granted" />
            <SummaryCard value={fmt(wallet.totalConsumed)} label="Total consumed" />
          </div>

          {/* 标签页 */}
          <div className="mt-6 flex gap-6 border-b border-border">
            {(["usage", "purchase"] as const).map((t) => (
              <Button
                key={t}
                variant="ghost"
                size="sm"
                data-testid={`tab-${t}`}
                onClick={() => setTab(t)}
                className={`-mb-px h-auto rounded-none border-b-2 px-0 pb-2.5 text-13 font-medium capitalize hover:bg-transparent ${
                  tab === t
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t}
              </Button>
            ))}
          </div>

          {/* 流水表 */}
          <div className="mt-4.5 overflow-hidden rounded-12 border border-border">
            <div className="flex bg-surface-1 px-4.5 py-2.75 text-11 font-semibold text-muted-foreground">
              <div className="flex-1">Time</div>
              <div className="flex-1">{amountHead}</div>
              <div className="flex-[1.6]">{descHead}</div>
              <div className="w-20 text-right">Amount</div>
              <div className="w-24 text-right">Balance</div>
            </div>
            {recordsLoading ? (
              <div data-testid="records-loading" className="animate-pulse px-4.5 py-6">
                <div className="h-40 rounded-9 bg-muted" />
              </div>
            ) : records.length === 0 ? (
              <div data-testid="empty" className="px-4.5 py-10 text-center text-13 text-muted-foreground">
                {tab === "usage" ? "暂无消耗记录" : "暂无购买记录"}
              </div>
            ) : (
              <div data-testid="records">
                {records.map((r) => (
                  <div
                    key={r.id}
                    data-testid={`record-${r.id}`}
                    className="flex items-center border-t border-border px-4.5 py-3 text-13 transition-colors duration-200 hover:bg-surface-1"
                  >
                    <div className="flex-1 text-muted-foreground">{r.when}</div>
                    <div className="flex-1 text-foreground">{r.label}</div>
                    <div className="flex-[1.6] text-foreground">{r.description}</div>
                    <div className="w-20 text-right font-semibold text-foreground">{signed(r.amount)}</div>
                    <div className="w-24 text-right text-muted-foreground">{fmt(r.balance)}</div>
                  </div>
                ))}
                {hasMore && (
                  <div className="border-t border-border px-4.5 py-3 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      data-testid="load-more"
                      onClick={() => void loadMore()}
                      disabled={loadingMore}
                    >
                      {loadingMore ? "Loading…" : "Load more"}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
