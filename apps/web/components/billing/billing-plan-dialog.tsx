"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BuyCreditsDialog } from "@/components/credits/buy-credits-dialog";
import { cn } from "@/lib/utils";

interface Plan {
  id: "free" | "pro";
  name: string;
  price: string;
  description: string;
  features: string[];
  cta?: string;
  sku?: string;
}

interface BillingData {
  billingMode: "subscription" | "credits";
  currentPlanId: "free" | "pro";
  plans: Plan[];
  checkoutSku: string;
  manageUrl: string;
}

interface PaymentOrder {
  id: string;
  status: "pending" | "paid" | "failed" | "expired";
}

export function BillingPlanDialog({
  open,
  initialMode = "subscription",
  onClose,
}: {
  open: boolean;
  initialMode?: "subscription" | "credits";
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"subscription" | "credits">(initialMode);
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [qrDataUri, setQrDataUri] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function refreshBilling() {
    const res = await fetch("/api/billing");
    if (!res.ok) throw new Error("billing failed");
    setData((await res.json()) as BillingData);
  }

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setMode(initialMode);
    setLoading(true);
    setOrder(null);
    setQrDataUri("");
    setMessage("");
    setError("");
    refreshBilling()
      .catch(() => {
        if (alive) setError("加载计划失败，请稍后重试");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, initialMode]);

  useEffect(() => {
    if (!open || !order || order.status !== "pending") return;
    let alive = true;
    const id = window.setInterval(async () => {
      const res = await fetch(`/api/payment/orders/${order.id}`).catch(() => null);
      if (!alive || !res?.ok) return;
      const next = ((await res.json()) as { order: PaymentOrder }).order;
      setOrder(next);
      if (next.status === "paid") {
        await refreshBilling().catch(() => {});
        setMessage("Your plan is now Pro.");
      }
    }, 1500);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [open, order]);

  async function createUpgradeOrder() {
    if (!data) return;
    setCreating(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/payment/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sku: data.checkoutSku }),
      });
      if (!res.ok) {
        setError("创建升级订单失败，请稍后重试");
        return;
      }
      const created = (await res.json()) as { order: PaymentOrder; qrDataUri: string };
      setOrder(created.order);
      setQrDataUri(created.qrDataUri);
    } finally {
      setCreating(false);
    }
  }

  if (!open) return null;
  if (mode === "credits") return <BuyCreditsDialog open={open} onClose={onClose} scope="personal" />;

  const currentPlanId = data?.currentPlanId ?? "free";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="billing-plan-title"
      data-testid="billing-plan-dialog"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
    >
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-y-auto rounded-12 border border-border bg-popover p-4 shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="billing-plan-title" className="text-lg font-semibold text-foreground">
              Plans &amp; Billing
            </h2>
            <p className="mt-1 text-13 text-muted-foreground">Upgrade your personal plan or buy credits.</p>
          </div>
          <Button type="button" variant="ghost" size="icon" aria-label="Close Plans & Billing" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div role="group" aria-label="Billing mode" className="mt-4 flex gap-1.5 rounded-9 bg-surface-1 p-1">
          {(["subscription", "credits"] as const).map((next) => (
            <button
              key={next}
              type="button"
              data-testid={`billing-mode-${next}`}
              aria-pressed={mode === next}
              onClick={() => setMode(next)}
              className={cn(
                "flex-1 rounded-7 px-3 py-1.5 text-13 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                mode === next ? "bg-popover text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {next === "subscription" ? "Subscription" : "Credits"}
            </button>
          ))}
        </div>

        {error && (
          <p role="alert" data-testid="billing-plan-error" className="mt-3 text-13 text-destructive">
            {error}
          </p>
        )}
        {message && (
          <p data-testid="billing-plan-success" className="mt-3 text-13 font-semibold text-foreground">
            {message}
          </p>
        )}

        {loading ? (
          <div data-testid="billing-plan-loading" className="mt-4 grid animate-pulse grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="h-56 rounded-9 bg-muted" />
            <div className="h-56 rounded-9 bg-muted" />
          </div>
        ) : data ? (
          <>
            <div data-testid="billing-dialog-current-plan" className="mt-4 rounded-9 border border-border bg-surface-1 p-3">
              <span className="text-12 text-muted-foreground">Current plan</span>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-base font-semibold text-foreground">
                  {data.plans.find((p) => p.id === currentPlanId)?.name ?? currentPlanId}
                </span>
                <Badge variant="muted">{currentPlanId === "pro" ? "Active" : "Free"}</Badge>
              </div>
            </div>

            <div data-testid="billing-dialog-plan-list" className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {data.plans.map((plan) => {
                const isCurrent = plan.id === currentPlanId;
                return (
                  <div key={plan.id} data-testid={`billing-dialog-plan-${plan.id}`} className="flex flex-col rounded-9 border border-border p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          {plan.id === "pro" && <Sparkles className="h-4 w-4 text-foreground" strokeWidth={1.5} />}
                          <span className="text-base font-semibold text-foreground">{plan.name}</span>
                        </div>
                        <p className="mt-1 text-13 text-muted-foreground">{plan.description}</p>
                      </div>
                      <span className="shrink-0 text-base font-bold text-foreground">{plan.price}</span>
                    </div>
                    <ul className="mt-4 flex flex-col gap-2">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-center gap-2 text-13 text-foreground">
                          <Check className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-auto pt-4">
                      {isCurrent ? (
                        <Button data-testid={`billing-dialog-manage-${plan.id}`} variant="secondary" className="w-full" onClick={() => setMessage("Subscription management is open for your current plan.")}>
                          Manage Subscription
                        </Button>
                      ) : (
                        <Button data-testid={`billing-dialog-upgrade-${plan.id}`} className="w-full" onClick={() => void createUpgradeOrder()} disabled={creating}>
                          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                          {plan.cta ?? `Upgrade to ${plan.name}`}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {order && (
              <div data-testid="billing-upgrade-order" className="mt-4 rounded-9 border border-border p-3">
                <div data-testid="billing-upgrade-order-id" className="text-11 text-muted-foreground">
                  Order: {order.id}
                </div>
                {order.status === "paid" ? (
                  <div data-testid="billing-upgrade-paid" className="mt-3 flex items-center gap-2 text-13 font-semibold text-foreground">
                    <Check className="h-4 w-4" /> Payment confirmed
                  </div>
                ) : (
                  <>
                    {qrDataUri && (
                      <img data-testid="billing-upgrade-qr" className="mt-3 h-32 w-32 rounded-9 border border-border" src={qrDataUri} alt="Plan upgrade payment QR code" />
                    )}
                    <div data-testid="billing-upgrade-status" className="mt-3 text-12 text-muted-foreground">
                      {order.status}
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
