"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Plan {
  id: string;
  name: string;
  price: string;
  description: string;
  features: string[];
  cta?: string;
}

interface BillingData {
  currentPlanId: string;
  plans: Plan[];
  checkoutUrl: string;
  manageUrl: string;
}

function BillingSkeleton() {
  return (
    <div data-testid="loading" className="mt-8 grid animate-pulse grid-cols-1 gap-4 md:grid-cols-2">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="h-72 rounded-12 bg-muted" />
      ))}
    </div>
  );
}

export default function BillingPage() {
  const router = useRouter();
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/billing");
        if (!alive) return;
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        if (!res.ok) {
          setError("加载计划失败，请稍后重试");
          setLoading(false);
          return;
        }
        setData(await res.json());
        setLoading(false);
      } catch {
        if (!alive) return;
        setError("加载计划失败，请稍后重试");
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  const current = data?.plans.find((p) => p.id === data.currentPlanId) ?? null;

  function upgrade(plan: Plan) {
    if (!data) return;
    // STUB：引导到占位外部支付/购买入口；支付完成前不改写计划。
    const url = plan.id === data.currentPlanId ? data.manageUrl : data.checkoutUrl;
    window.location.href = url;
  }

  return (
    <div className="mx-auto max-w-content px-9 pb-14 pt-7">
      <div className="flex items-center gap-3">
        <h1 className="text-26 font-bold tracking-tight text-foreground">Plans &amp; Billing</h1>
      </div>
      <p className="mt-1 text-13 text-muted-foreground">管理你的订阅计划，升级以解锁更多能力。</p>

      {error && (
        <p role="alert" data-testid="error" className="mt-6 text-13 text-destructive">
          {error}
        </p>
      )}

      {loading ? (
        <BillingSkeleton />
      ) : !data ? null : data.plans.length === 0 ? (
        <p data-testid="empty" className="mt-8 text-13 text-muted-foreground">
          暂无可用计划。
        </p>
      ) : (
        <>
          {/* 当前计划 */}
          <div
            data-testid="current-plan"
            className="mt-6 flex flex-col gap-1 rounded-12 border border-border bg-surface-1 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <span className="text-13 text-muted-foreground">当前计划</span>
              <div className="mt-0.5 flex items-center gap-2">
                <span className="text-base font-semibold text-foreground">{current?.name ?? data.currentPlanId}</span>
                <Badge variant="muted">{current?.price ?? ""}</Badge>
              </div>
            </div>
          </div>

          {/* 可选计划 */}
          <div data-testid="plan-list" className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            {data.plans.map((plan) => {
              const isCurrent = plan.id === data.currentPlanId;
              return (
                <div
                  key={plan.id}
                  data-testid={`plan-${plan.id}`}
                  className="flex flex-col gap-4 rounded-12 border border-border bg-surface-1 p-5 transition-colors hover:border-border-strong"
                >
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

                  <ul className="flex flex-col gap-2">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-13 text-foreground">
                        <Check className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto">
                    {isCurrent ? (
                      <Button
                        data-testid={`manage-${plan.id}`}
                        variant="secondary"
                        className="w-full"
                        onClick={() => upgrade(plan)}
                      >
                        Manage subscription
                      </Button>
                    ) : (
                      <Button
                        data-testid={`upgrade-${plan.id}`}
                        className="w-full"
                        onClick={() => upgrade(plan)}
                      >
                        {plan.cta ?? `Upgrade to ${plan.name}`}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mt-5 text-xs text-muted-foreground">
            占位：升级与管理订阅将引导到外部支付页面，暂未接入真实支付。
          </p>
        </>
      )}
    </div>
  );
}
