"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// uc-credits-002-purchase-credits —— Buy Credits 弹窗（用户菜单 / Team Credits 页 Buy credits 触发）。
// 套餐列表（GET /api/payment/catalog?kind=credit_purchase）→ 选套餐 → 选支付方式 → 下单
// （POST /api/payment/orders，走 F05 支付引擎，只传 sku，金额/发放数量服务端定）→ 展示二维码 →
// 轮询订单状态（GET /api/payment/orders/:id）→ 成功后刷新余额 + 最近交易记录。
// 取消/关闭弹窗不影响订单最终状态（后端仍以支付系统回调为准，见 uc-credits-002 备选流程 A1）。
// scope="team" 且当前用户无团队管理权限时，调用方应已回退传 scope="personal"（回退逻辑在
// 打开弹窗前由父组件决定，本组件只按传入的 scope 决定订单归属，不做权限判断）。

interface CreditPack {
  sku: string;
  amountCents: number;
  credits: number;
  label: string;
}

interface OrderState {
  id: string;
  status: "pending" | "paid" | "failed" | "expired";
  amount_cents: number;
  currency: string;
}

interface RecentRecord {
  id: string;
  kind: "usage" | "purchase";
  when: string;
  label: string;
  description: string;
  amount: number;
  balance: number;
}

const fmtMoney = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const fmtCredits = (n: number) => n.toLocaleString("en-US");

type PayMethod = "wechat" | "alipay";

export function BuyCreditsDialog({
  open,
  onClose,
  scope,
  onPurchased,
}: {
  open: boolean;
  onClose: () => void;
  /** "team"：Team Credits 页购买入队走团队钱包；"personal"：用户菜单/个人购买走个人钱包。 */
  scope: "personal" | "team";
  /** 支付成功（webhook 已确认发放）后回调，供父组件刷新余额/流水。 */
  onPurchased?: () => void;
}) {
  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [packsLoading, setPacksLoading] = useState(true);
  const [packsError, setPacksError] = useState("");
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const [method, setMethod] = useState<PayMethod>("wechat");

  const [order, setOrder] = useState<OrderState | null>(null);
  const [qrDataUri, setQrDataUri] = useState("");
  const [ordering, setOrdering] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const [recent, setRecent] = useState<RecentRecord[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const loadRecent = useCallback(async () => {
    setRecentLoading(true);
    try {
      const res = await fetch(`/api/credits/transactions?scope=${scope}&kind=purchase&page=1&pageSize=5`);
      if (!res.ok) return;
      const data = (await res.json()) as { records: RecentRecord[] };
      setRecent(data.records);
    } finally {
      setRecentLoading(false);
    }
  }, [scope]);

  // 弹窗打开：重置下单态、加载套餐 + 最近交易记录。
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setSelectedSku(null);
    setOrder(null);
    setQrDataUri("");
    setOrderError("");
    setPacksError("");
    setPacksLoading(true);
    (async () => {
      const res = await fetch("/api/payment/catalog?kind=credit_purchase");
      if (!alive) return;
      if (!res.ok) {
        setPacksError("加载套餐失败，请稍后重试");
        setPacksLoading(false);
        return;
      }
      const data = (await res.json()) as { packs: CreditPack[] };
      if (!alive) return;
      setPacks(data.packs);
      setPacksLoading(false);
    })();
    void loadRecent();
    return () => {
      alive = false;
      stopPolling();
    };
  }, [open, loadRecent, stopPolling]);

  useEffect(() => stopPolling, [stopPolling]);

  function selectPack(sku: string) {
    // 切换套餐清空旧订单二维码（uc-credits-002 主流程步骤 4）。
    setSelectedSku(sku);
    setOrder(null);
    setQrDataUri("");
    setOrderError("");
    stopPolling();
  }

  const createOrder = useCallback(async () => {
    if (!selectedSku) return;
    setOrdering(true);
    setOrderError("");
    stopPolling();
    try {
      const res = await fetch("/api/payment/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku: selectedSku,
          // 团队归属由服务端按当前团队 cookie + 角色解析（见 /api/payment/orders 路由），
          // 客户端只传购买意图，无权限时服务端自动回退到个人订单。
          scope,
        }),
      });
      if (res.status === 401) {
        setOrderError("请先登录");
        setOrdering(false);
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setOrderError(data.error ?? "下单失败，请稍后重试");
        setOrdering(false);
        return;
      }
      const data = (await res.json()) as { order: OrderState; qrDataUri: string };
      setOrder(data.order);
      setQrDataUri(data.qrDataUri);
      setOrdering(false);

      pollRef.current = setInterval(async () => {
        const pollRes = await fetch(`/api/payment/orders/${data.order.id}`);
        if (!pollRes.ok) return;
        const pollData = (await pollRes.json()) as { order: OrderState };
        setOrder(pollData.order);
        if (pollData.order.status !== "pending") {
          stopPolling();
          if (pollData.order.status === "paid") {
            void loadRecent();
            onPurchased?.();
          }
        }
      }, 1000);
    } catch {
      setOrderError("下单失败，请稍后重试");
      setOrdering(false);
    }
  }, [selectedSku, stopPolling, loadRecent, onPurchased]);

  const refreshStatus = useCallback(async () => {
    if (!order || refreshing) return;
    setRefreshing(true);
    try {
      const res = await fetch(`/api/payment/orders/${order.id}`);
      if (!res.ok) {
        setOrderError("查询状态失败，请稍后重试");
        return;
      }
      const data = (await res.json()) as { order: OrderState };
      setOrder(data.order);
      if (data.order.status !== "pending") {
        stopPolling();
        if (data.order.status === "paid") {
          void loadRecent();
          onPurchased?.();
        }
      }
    } finally {
      setRefreshing(false);
    }
  }, [order, refreshing, stopPolling, loadRecent, onPurchased]);

  function handleClose() {
    // 取消/关闭不改变订单结果，最终状态仍以支付系统回调为准（uc-credits-002 A1）。
    stopPolling();
    onClose();
  }

  if (!open) return null;

  const selectedPack = packs.find((p) => p.sku === selectedSku) ?? null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="buy-credits-title"
      data-testid="buy-credits-dialog"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
    >
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-12 border border-border bg-popover p-5 shadow-lg">
        <div className="mb-1 flex items-start justify-between gap-4">
          <div>
            <h2 id="buy-credits-title" className="text-lg font-semibold text-foreground">
              Buy Credits
            </h2>
            <p className="mt-0.5 text-13 text-muted-foreground">
              选择套餐，扫码完成支付即可到账{scope === "team" ? "团队" : "个人"} Credit。
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="关闭 Buy Credits"
            data-testid="buy-credits-close"
            onClick={handleClose}
            className="shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-3 flex-1 overflow-y-auto pr-1">
          {/* 套餐列表 */}
          {packsLoading ? (
            <div data-testid="packs-loading" className="animate-pulse">
              <div className="grid grid-cols-3 gap-2.5">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-20 rounded-9 bg-muted" />
                ))}
              </div>
            </div>
          ) : packsError ? (
            <p role="alert" data-testid="packs-error" className="text-13 text-destructive">
              {packsError}
            </p>
          ) : (
            <div data-testid="credit-packs" className="grid grid-cols-3 gap-2.5">
              {packs.map((p) => (
                <button
                  key={p.sku}
                  type="button"
                  data-testid={`pack-${p.sku}`}
                  aria-pressed={selectedSku === p.sku}
                  onClick={() => selectPack(p.sku)}
                  className={cn(
                    "rounded-9 border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selectedSku === p.sku
                      ? "border-foreground bg-surface-1"
                      : "border-border hover:border-border-strong hover:bg-surface-1"
                  )}
                >
                  <div className="text-16 font-bold text-foreground">{fmtCredits(p.credits)}</div>
                  <div className="text-11 text-muted-foreground">credits</div>
                  <div className="mt-1.5 text-13 font-semibold text-foreground">{fmtMoney(p.amountCents)}</div>
                </button>
              ))}
            </div>
          )}

          {/* 支付方式 + 下单区 */}
          {selectedPack && (
            <div className="mt-4 rounded-9 border border-border p-3.5">
              <div className="text-13 font-medium text-foreground">
                已选择：{fmtCredits(selectedPack.credits)} credits · {fmtMoney(selectedPack.amountCents)}
              </div>

              <div data-testid="payment-methods" className="mt-2.5 flex gap-2">
                <button
                  type="button"
                  data-testid="method-wechat"
                  aria-pressed={method === "wechat"}
                  onClick={() => setMethod("wechat")}
                  className={cn(
                    "flex-1 rounded-7 border px-3 py-2 text-13 font-medium transition-colors",
                    method === "wechat"
                      ? "border-foreground text-foreground"
                      : "border-border text-muted-foreground hover:border-border-strong"
                  )}
                >
                  WeChat Pay
                </button>
                <button
                  type="button"
                  data-testid="method-alipay"
                  disabled
                  aria-disabled="true"
                  title="支付宝暂未接入"
                  className="flex-1 cursor-not-allowed rounded-7 border border-border px-3 py-2 text-13 font-medium text-placeholder opacity-50"
                >
                  Alipay（暂不可用）
                </button>
              </div>

              {!order && (
                <Button
                  data-testid="generate-qr"
                  size="sm"
                  className="mt-3 w-full"
                  disabled={ordering}
                  onClick={() => void createOrder()}
                >
                  {ordering ? "Creating…" : "Generate QR Code"}
                </Button>
              )}

              {orderError && (
                <p role="alert" data-testid="order-error" className="mt-2.5 text-13 text-destructive">
                  {orderError}
                </p>
              )}

              {order && (
                <div data-testid="order-panel" className="mt-3.5 flex flex-col items-center gap-2.5 border-t border-border pt-3.5">
                  {order.status === "paid" ? (
                    <div data-testid="payment-success" className="flex flex-col items-center gap-2 py-4 text-center">
                      <CheckCircle2 className="h-9 w-9 text-foreground" />
                      <div className="text-14 font-semibold text-foreground">支付成功</div>
                      <div className="text-13 text-muted-foreground">
                        {fmtCredits(selectedPack.credits)} credits 已到账
                      </div>
                    </div>
                  ) : order.status === "failed" || order.status === "expired" ? (
                    <div data-testid="payment-failed" className="flex flex-col items-center gap-2 py-4 text-center">
                      <div className="text-14 font-semibold text-destructive">
                        {order.status === "failed" ? "支付失败" : "订单已超时"}
                      </div>
                      <Button size="sm" variant="outline" onClick={() => void createOrder()}>
                        重新生成二维码
                      </Button>
                    </div>
                  ) : (
                    <>
                      {qrDataUri && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={qrDataUri} alt="支付二维码"
                          data-testid="payment-qr"
                          className="h-36 w-36 rounded-9 border border-border bg-white p-1.5"
                        />
                      )}
                      <div data-testid="order-id" className="text-11 text-muted-foreground">
                        Order: {order.id}
                      </div>
                      <div data-testid="order-status" className="text-13 font-medium text-foreground">
                        {order.status === "pending" ? "等待支付…" : order.status}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        data-testid="refresh-status"
                        disabled={refreshing}
                        onClick={() => void refreshStatus()}
                      >
                        {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Refresh Status"}
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 最近交易记录 */}
          <div className="mt-5">
            <div className="mb-1.5 text-11 font-semibold uppercase text-placeholder">Recent purchases</div>
            {recentLoading ? (
              <div data-testid="recent-loading" className="h-16 animate-pulse rounded-9 bg-muted" />
            ) : recent.length === 0 ? (
              <div data-testid="recent-empty" className="rounded-9 border border-border px-3 py-4 text-center text-13 text-muted-foreground">
                暂无购买记录
              </div>
            ) : (
              <div data-testid="recent-list" className="overflow-hidden rounded-9 border border-border">
                {recent.map((r) => (
                  <div
                    key={r.id}
                    data-testid={`recent-${r.id}`}
                    className="flex items-center justify-between gap-3 border-b border-border px-3 py-2 text-13 last:border-b-0"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium text-foreground">{r.description || r.label}</div>
                      <div className="truncate text-11 text-muted-foreground">{r.when}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-semibold text-foreground">+{fmtCredits(r.amount)}</div>
                      <div className="text-11 text-muted-foreground">{fmtCredits(r.balance)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
