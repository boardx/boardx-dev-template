"use client";
// Coordination dashboard client shell — v1 scope per agent-lifecycle-management-proposal.md.
// This first slice wires only the Coordinators card (registry data); the remaining four
// cards (Active Claims, Review Queue, Stale Leases, Drift) and the Project Pulse /
// Currently Deciding / Priorities layer come in follow-up commits — see PR description.
import { useEffect, useState } from "react";
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

export function CoordinationDashboard() {
  return (
    <div className="mx-auto max-w-content px-9 pb-14 pt-7">
      <h1 className="text-21 font-bold text-foreground">Coordination</h1>
      <p className="mt-1 text-13 text-muted-foreground">
        Live view of the harness coordination plane — registry, claims, review queue.
      </p>
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <CoordinatorsCard />
      </div>
    </div>
  );
}
