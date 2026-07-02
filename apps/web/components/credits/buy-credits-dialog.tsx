"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CreditPack {
  sku: string;
  label: string;
  amountCents: number;
  credits: number;
}

interface PaymentOrder {
  id: string;
  status: "pending" | "paid" | "failed" | "expired";
}

const fallbackPacks: CreditPack[] = [
  { sku: "credits_1000", label: "1,000 credits", amountCents: 199, credits: 1000 },
  { sku: "credits_5000", label: "5,000 credits", amountCents: 899, credits: 5000 },
  { sku: "credits_12000", label: "12,000 credits", amountCents: 1999, credits: 12000 },
];

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export function BuyCreditsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [packs, setPacks] = useState<CreditPack[]>(fallbackPacks);
  const [selectedSku, setSelectedSku] = useState(fallbackPacks[1]!.sku);
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [qrDataUri, setQrDataUri] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    let alive = true;
    fetch("/api/billing")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { creditPacks?: CreditPack[] } | null) => {
        if (!alive || !data?.creditPacks?.length) return;
        setPacks(data.creditPacks);
        setSelectedSku((current) => (data.creditPacks!.some((p) => p.sku === current) ? current : data.creditPacks![0]!.sku));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !order || order.status !== "pending") return;
    let alive = true;
    const id = window.setInterval(async () => {
      const res = await fetch(`/api/payment/orders/${order.id}`).catch(() => null);
      if (!alive || !res?.ok) return;
      const data = (await res.json()) as { order: PaymentOrder };
      setOrder(data.order);
    }, 1500);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [open, order]);

  async function createOrder() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/payment/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sku: selectedSku }),
      });
      if (!res.ok) {
        setError("创建支付订单失败，请稍后重试");
        return;
      }
      const data = (await res.json()) as { order: PaymentOrder; qrDataUri: string };
      setOrder(data.order);
      setQrDataUri(data.qrDataUri);
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  const selected = packs.find((p) => p.sku === selectedSku) ?? packs[0]!;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="buy-credits-title"
      data-testid="buy-credits-dialog"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
    >
      <div className="flex max-h-[86vh] w-full max-w-lg flex-col rounded-12 border border-border bg-popover p-4 shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="buy-credits-title" className="text-lg font-semibold text-foreground">
              Buy Credits
            </h2>
            <p className="mt-1 text-13 text-muted-foreground">Choose a pack and scan to pay.</p>
          </div>
          <Button type="button" variant="ghost" size="icon" aria-label="Close Buy Credits" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {error && (
          <p role="alert" data-testid="buy-credits-error" className="mt-3 text-13 text-destructive">
            {error}
          </p>
        )}

        <div data-testid="credit-pack-list" className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {packs.map((pack) => {
            const active = pack.sku === selectedSku;
            return (
              <button
                key={pack.sku}
                type="button"
                data-testid={`credit-pack-${pack.sku}`}
                aria-pressed={active}
                onClick={() => {
                  setSelectedSku(pack.sku);
                  setOrder(null);
                  setQrDataUri("");
                }}
                className={cn(
                  "rounded-9 border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active ? "border-foreground bg-surface-1" : "border-border hover:border-border-strong hover:bg-surface-1"
                )}
              >
                <div className="text-13 font-semibold text-foreground">{pack.label}</div>
                <div className="mt-1 text-12 text-muted-foreground">{money(pack.amountCents)}</div>
              </button>
            );
          })}
        </div>

        {order ? (
          <div data-testid="buy-credits-order" className="mt-4 rounded-9 border border-border p-3">
            <div data-testid="buy-credits-order-id" className="text-11 text-muted-foreground">
              Order: {order.id}
            </div>
            {order.status === "paid" ? (
              <div data-testid="buy-credits-success" className="mt-3 flex items-center gap-2 text-13 font-semibold text-foreground">
                <Check className="h-4 w-4" /> Payment confirmed
              </div>
            ) : (
              <>
                {qrDataUri && (
                  <img data-testid="buy-credits-qr" className="mt-3 h-32 w-32 rounded-9 border border-border" src={qrDataUri} alt="Credit payment QR code" />
                )}
                <div data-testid="buy-credits-status" className="mt-3 text-12 text-muted-foreground">
                  {order.status}
                </div>
              </>
            )}
          </div>
        ) : (
          <Button data-testid="create-credit-order" className="mt-4 w-full" onClick={() => void createOrder()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Pay {money(selected.amountCents)}
          </Button>
        )}
      </div>
    </div>
  );
}
