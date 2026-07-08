"use client";
// Coordination dashboard client shell — v1 scope per agent-lifecycle-management-proposal.md.
// This first slice wires only the Coordinators card (registry data); the remaining four
// cards (Active Claims, Review Queue, Stale Leases, Drift) and the Project Pulse /
// Currently Deciding / Priorities layer come in follow-up commits — see PR description.
import { useEffect, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

interface RegistryAgent {
  id: string;
  kind: string;
  model?: string;
  areas?: string[];
  reports_to?: string;
  active?: boolean;
}

interface RegistryResponse {
  agents: RegistryAgent[];
  grouped: Record<string, RegistryAgent[]>;
}

const KIND_LABEL: Record<string, string> = {
  coordinator: "Coordinator",
  "architecture-coordinator": "Architecture Coordinator",
  "module-coordinator": "Module Coordinator",
  worker: "Worker",
  reviewer: "Reviewer",
};

const KIND_ORDER = ["coordinator", "architecture-coordinator", "module-coordinator", "reviewer", "worker"];

function CoordinatorsCardSkeleton() {
  return (
    <div data-testid="loading" className="animate-pulse space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-9 rounded-8 bg-muted" />
      ))}
    </div>
  );
}

function CoordinatorsCard() {
  const [data, setData] = useState<RegistryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/admin/coordination/registry");
        if (!res.ok) {
          throw new Error(`status ${res.status}`);
        }
        const json = (await res.json()) as RegistryResponse;
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setError("registry_unavailable");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="rounded-12 border border-border bg-surface-1 p-5">
        <h2 className="text-15 font-semibold text-foreground">Coordinators</h2>
        <div className="mt-4">
          <CoordinatorsCardSkeleton />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-12 border border-border bg-surface-1 p-5">
        <h2 className="text-15 font-semibold text-foreground">Coordinators</h2>
        <div
          data-testid="err-coordinators"
          role="alert"
          className="mt-4 rounded-8 border border-destructive/30 bg-destructive/5 p-3 text-13 text-destructive"
        >
          Couldn&apos;t load registry.yaml. Try refreshing.
        </div>
      </div>
    );
  }

  const relevantKinds = KIND_ORDER.filter((k) => k !== "worker" && (data?.grouped[k]?.length ?? 0) > 0);

  if (!data || relevantKinds.length === 0) {
    return (
      <div className="rounded-12 border border-border bg-surface-1 p-5">
        <h2 className="text-15 font-semibold text-foreground">Coordinators</h2>
        <p data-testid="empty" className="mt-4 text-13 text-muted-foreground">
          No coordinator identities found in registry.yaml.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-12 border border-border bg-surface-1 p-5">
      <h2 className="text-15 font-semibold text-foreground">Coordinators</h2>
      <p className="mt-1 text-13 text-muted-foreground">
        {data.agents.length} identities in registry.yaml — {data.agents.filter((a) => a.active !== false).length} active
      </p>
      <div className="mt-4 space-y-4">
        {relevantKinds.map((kind) => (
          <div key={kind}>
            <div className="text-11 font-medium uppercase tracking-wide text-muted-foreground">
              {KIND_LABEL[kind] ?? kind}
            </div>
            <ul className="mt-1.5 space-y-1">
              {(data.grouped[kind] ?? []).map((agent) => (
                <li key={agent.id} className="flex items-center justify-between gap-2 rounded-8 px-2 py-1.5 transition-colors duration-200 hover:bg-muted">
                  <span className="text-13 text-foreground">{agent.id}</span>
                  <div className="flex items-center gap-1.5">
                    {agent.areas && agent.areas.length > 0 && (
                      <span className="text-11 text-muted-foreground">{agent.areas.join(", ")}</span>
                    )}
                    {agent.active === false && (
                      <Badge variant="outline" className="text-11">
                        inactive
                      </Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- coord-service /status cards (slices 2 & 3) ------------------------------
// ADR-009 之后 GitHub 上不再有协调评论可看，这两张卡是人类看"谁此刻持有什么租约、
// 协调层最近发生了什么"的唯一窗口。数据来自 /api/admin/coordination/status（服务端
// 代理 coord-service 的公开 GET /status），30s 轮询。

interface ActiveClaim {
  id: number;
  resource_id: string;
  resource_type: string;
  agent_id: string;
  claimed_at: string;
  last_heartbeat_at: string;
  ttl_seconds: number;
}

interface CoordEvent {
  id: number;
  type: string;
  resource_id: string;
  agent_id: string;
  payload: string | null;
  at: string;
}

interface StatusResponse {
  configured: boolean;
  active_claims?: ActiveClaim[];
  recent_events?: CoordEvent[];
  generated_at?: string;
}

const STATUS_POLL_MS = 30_000;

function minutesAgo(iso: string): string {
  const mins = (Date.now() - new Date(iso).getTime()) / 60000;
  if (mins < 1) return "<1 min ago";
  if (mins < 60) return `${Math.floor(mins)} min ago`;
  return `${(mins / 60).toFixed(1)} h ago`;
}

const EVENT_BADGE_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  claim: "default",
  release: "secondary",
  heartbeat: "outline",
  expire: "destructive",
  verdict: "secondary",
  merge: "secondary",
};

function useCoordStatus() {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load(initial: boolean) {
      if (initial) setLoading(true);
      try {
        const res = await fetch("/api/admin/coordination/status");
        if (!res.ok) throw new Error(`status ${res.status}`);
        const json = (await res.json()) as StatusResponse;
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      } catch {
        if (!cancelled) setError("coord_service_unavailable");
      } finally {
        if (!cancelled && initial) setLoading(false);
      }
    }
    void load(true);
    const timer = setInterval(() => void load(false), STATUS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return { data, error, loading };
}

function StatusCardFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-12 border border-border bg-surface-1 p-5">
      <h2 className="text-15 font-semibold text-foreground">{title}</h2>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function StatusCardBody({
  testidPrefix,
  loading,
  error,
  configured,
  empty,
  emptyText,
  children,
}: {
  testidPrefix: string;
  loading: boolean;
  error: string | null;
  configured: boolean;
  empty: boolean;
  emptyText: string;
  children: ReactNode;
}) {
  if (loading) {
    return (
      <div data-testid="loading" className="animate-pulse space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-9 rounded-8 bg-muted" />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <div
        data-testid={`err-${testidPrefix}`}
        role="alert"
        className="rounded-8 border border-destructive/30 bg-destructive/5 p-3 text-13 text-destructive"
      >
        Couldn&apos;t reach coord-service. Try refreshing.
      </div>
    );
  }
  if (!configured) {
    return (
      <p data-testid={`unconfigured-${testidPrefix}`} className="text-13 text-muted-foreground">
        COORD_SERVICE_URL is not configured on this deployment — live coordination data unavailable.
      </p>
    );
  }
  if (empty) {
    return (
      <p data-testid="empty" className="text-13 text-muted-foreground">
        {emptyText}
      </p>
    );
  }
  return <>{children}</>;
}

function ActiveClaimsCard({ status }: { status: ReturnType<typeof useCoordStatus> }) {
  const { data, error, loading } = status;
  const claims = data?.active_claims ?? [];
  return (
    <StatusCardFrame title="Active Claims">
      <StatusCardBody
        testidPrefix="claims"
        loading={loading}
        error={error}
        configured={data?.configured ?? false}
        empty={claims.length === 0}
        emptyText="No active claims — every coordination resource is currently free."
      >
        <ul className="space-y-1">
          {claims.map((claim) => (
            <li
              key={claim.id}
              className="flex items-center justify-between gap-2 rounded-8 px-2 py-1.5 transition-colors duration-200 hover:bg-muted"
            >
              <div className="min-w-0">
                <div className="truncate text-13 font-medium text-foreground">{claim.resource_id}</div>
                <div className="text-11 text-muted-foreground">
                  held by {claim.agent_id} · heartbeat {minutesAgo(claim.last_heartbeat_at)}
                </div>
              </div>
              <Badge variant="outline" className="shrink-0 text-11">
                ttl {Math.round(claim.ttl_seconds / 60)}m
              </Badge>
            </li>
          ))}
        </ul>
      </StatusCardBody>
    </StatusCardFrame>
  );
}

function RecentEventsCard({ status }: { status: ReturnType<typeof useCoordStatus> }) {
  const { data, error, loading } = status;
  const events = data?.recent_events ?? [];
  return (
    <StatusCardFrame title="Recent Events">
      <StatusCardBody
        testidPrefix="events"
        loading={loading}
        error={error}
        configured={data?.configured ?? false}
        empty={events.length === 0}
        emptyText="No coordination events recorded yet."
      >
        <ul className="max-h-80 space-y-1 overflow-y-auto">
          {events.map((event) => (
            <li
              key={event.id}
              className="flex items-center justify-between gap-2 rounded-8 px-2 py-1.5 transition-colors duration-200 hover:bg-muted"
            >
              <div className="min-w-0">
                <div className="truncate text-13 text-foreground">
                  {event.resource_id}
                  <span className="text-muted-foreground"> · {event.agent_id}</span>
                </div>
                <div className="text-11 text-muted-foreground">{minutesAgo(event.at)}</div>
              </div>
              <Badge variant={EVENT_BADGE_VARIANT[event.type] ?? "outline"} className="shrink-0 text-11">
                {event.type}
              </Badge>
            </li>
          ))}
        </ul>
      </StatusCardBody>
    </StatusCardFrame>
  );
}

function CoordServiceCards() {
  const status = useCoordStatus();
  return (
    <>
      <ActiveClaimsCard status={status} />
      <RecentEventsCard status={status} />
    </>
  );
}

export function CoordinationDashboard() {
  return (
    <div className="mx-auto max-w-content px-9 pb-14 pt-7">
      <h1 className="text-21 font-bold text-foreground">Coordination</h1>
      <p className="mt-1 text-13 text-muted-foreground">
        Live view of the harness coordination plane — registry, claims, recent events.
      </p>
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <CoordinatorsCard />
        <CoordServiceCards />
      </div>
    </div>
  );
}
