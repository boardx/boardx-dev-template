"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

// uc-billing-002-scan-payment — CAP-PAYMENT 最小测试台。
// 本页不是 F02/F04 的最终购买/升级 UI（那两个 feature 各自会有自己的弹窗），
// 而是驱动"下单 → 展示二维码 → 轮询状态"这条 F05 引擎链路端到端可见的最小界面，
// 供人工/e2e 验证支付引擎本身。真实回调由外部支付网关触发；此页只负责下单与轮询，
// 不代替用户"扫码"（webhook 回调由 e2e 测试直接 POST 模拟，符合本仓库 stub 网关约定）。

interface OrderState {
  id: string;
  status: "pending" | "paid" | "failed" | "expired";
  amount_cents: number;
  currency: string;
}

export default function PaymentTestPage() {
  const router = useRouter();
  const [order, setOrder] = useState<OrderState | null>(null);
  const [qrDataUri, setQrDataUri] = useState<string>("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  // 未登录访客不应停留在测试台：与 /credits、/billing 一致，未登录跳 /login。
  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await fetch("/api/auth/session");
      const data = (await res.json()) as { user: unknown };
      if (!alive) return;
      if (!data.user) {
        router.replace("/login");
        return;
      }
      setCheckingAuth(false);
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  const createOrder = useCallback(async () => {
    setCreating(true);
    setError("");
    stopPolling();
    const res = await fetch("/api/payment/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fulfillmentKind: "credit_purchase",
        amountCents: 999,
        currency: "USD",
        fulfillmentPayload: { credits: 5000 },
      }),
    });
    if (res.status === 401) {
      router.replace("/login");
      return;
    }
    if (!res.ok) {
      setError("下单失败，请稍后重试");
      setCreating(false);
      return;
    }
    const data = (await res.json()) as { order: OrderState; qrDataUri: string };
    setOrder(data.order);
    setQrDataUri(data.qrDataUri);
    setCreating(false);

    // 轮询订单状态，直到终态（paid/failed/expired）。
    pollRef.current = setInterval(async () => {
      const pollRes = await fetch(`/api/payment/orders/${data.order.id}`);
      if (!pollRes.ok) return;
      const pollData = (await pollRes.json()) as { order: OrderState };
      setOrder(pollData.order);
      if (pollData.order.status !== "pending") stopPolling();
    }, 1000);
  }, [router, stopPolling]);

  if (checkingAuth) {
    return <div data-testid="loading" className="mx-auto max-w-content px-9 pb-14 pt-7" />;
  }

  return (
    <div className="mx-auto max-w-content px-9 pb-14 pt-7">
      <h1 data-testid="payment-test-title" className="text-22 font-bold tracking-tight text-foreground">
        Scan to pay
      </h1>
      <p className="mt-1 text-13 text-muted-foreground">
        CAP-PAYMENT 测试台：下单 → 展示二维码 → 轮询订单状态。
      </p>

      <div className="mt-5">
        <Button data-testid="create-order" onClick={createOrder} disabled={creating}>
          {creating ? "Creating…" : "Create order"}
        </Button>
      </div>

      {error && (
        <p role="alert" data-testid="error" className="mt-4 text-13 text-destructive">
          {error}
        </p>
      )}

      {order && (
        <div data-testid="order-panel" className="mt-6 rounded-12 border border-border p-5">
          <div data-testid="order-id" className="text-13 text-muted-foreground">
            Order: {order.id}
          </div>
          <div className="mt-1 text-13 text-muted-foreground">
            Amount: {(order.amount_cents / 100).toFixed(2)} {order.currency}
          </div>
          <div data-testid="order-status" className="mt-2 text-15 font-semibold text-foreground">
            Status: {order.status}
          </div>
          {order.status === "pending" && qrDataUri && (
            // eslint-disable-next-line @next/next/no-img-element
            <img data-testid="payment-qr" src={qrDataUri} alt="支付二维码" className="mt-4 h-42 w-42" />
          )}
          {order.status === "paid" && (
            <p data-testid="payment-success" className="mt-4 text-13 text-emerald-600">
              Payment succeeded — fulfillment triggered.
            </p>
          )}
          {order.status === "failed" && (
            <p data-testid="payment-failed" className="mt-4 text-13 text-destructive">
              Payment failed.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
