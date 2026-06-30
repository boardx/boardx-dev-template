"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

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
  balance: number;
  totalPurchased: number;
  totalGranted: number;
  totalConsumed: number;
  records: CreditRecord[];
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

export default function CreditsPage() {
  const router = useRouter();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"usage" | "purchase">("usage");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      const state =
        typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("state") : null;
      const res = await fetch(`/api/credits${state === "empty" ? "?state=empty" : ""}`);
      if (!alive) return;
      if (res.status === 401) {
        router.replace("/login");
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
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  const records = wallet?.records.filter((r) => r.kind === tab) ?? [];
  const amountHead = tab === "usage" ? "User" : "Type";
  const descHead = tab === "usage" ? "Reason" : "Description";

  return (
    <div className="mx-auto max-w-content px-9 pb-14 pt-7">
      {/* 标题 + 操作 */}
      <div className="flex items-center gap-3">
        <h1 data-testid="credits-title" className="text-22 font-bold tracking-tight text-foreground">
          Credits
        </h1>
        <span className="text-13 text-placeholder">Acme Inc</span>
        <div className="flex-1" />
        <Button data-testid="buy-credits" size="sm">
          Buy credits
        </Button>
      </div>

      {error && (
        <p role="alert" data-testid="error" className="mt-4 text-13 text-destructive">
          {error}
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
            {records.length === 0 ? (
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
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
