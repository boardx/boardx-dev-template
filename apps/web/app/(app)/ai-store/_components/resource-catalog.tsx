"use client";

import { Bot, FileText, Heart, Play, Sparkles, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { StoreItem } from "./store-types";

interface Props {
  items: StoreItem[];
  loading: boolean;
  error: string;
  total: number;
  page: number;
  totalPages: number;
  filtersActive: boolean;
  subscribedIds: Set<number>;
  subscribing: number | null;
  onRetry: () => void;
  onClear: () => void;
  onOpen: (id: number) => void;
  onFavorite: (id: number) => void;
  onSubscribe: (item: StoreItem) => void;
  onUse: (item: StoreItem) => void;
  onPage: (page: number) => void;
}

function typeIcon(type: StoreItem["type"]) {
  if (type === "agent") return Bot;
  if (type === "skill") return Sparkles;
  return FileText;
}

function subscriptionLabel(item: StoreItem, subscribed: boolean) {
  if (item.subscriptionScopes?.includes("personal") && item.subscriptionScopes.includes("team")) return "Me + Team";
  if (item.subscriptionScopes?.includes("team")) return "Team";
  if (item.subscriptionScopes?.includes("personal") || subscribed) return "For me";
  return "Not subscribed";
}

export function ResourceCatalog({
  items,
  loading,
  error,
  total,
  page,
  totalPages,
  filtersActive,
  subscribedIds,
  subscribing,
  onRetry,
  onClear,
  onOpen,
  onFavorite,
  onSubscribe,
  onUse,
  onPage,
}: Props) {
  return (
    <div data-testid="resource-catalog" className="min-w-0">
      {loading ? (
        <div data-testid="loading" className="animate-pulse border-y border-border">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="grid h-18 grid-cols-[minmax(0,1fr)_6rem] items-center gap-4 border-b border-border px-3">
              <div className="h-4 w-2/3 rounded bg-muted" />
              <div className="h-8 rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div data-testid="error" role="alert" className="flex min-h-40 flex-col items-center justify-center gap-3 border-y border-border text-center">
          <p className="text-13 text-destructive">{error}</p>
          <Button size="sm" variant="outline" data-testid="retry" onClick={onRetry}>Retry</Button>
        </div>
      ) : items.length === 0 ? (
        <div data-testid="empty" className="flex min-h-48 flex-col items-center justify-center gap-2 border-y border-border text-center">
          <FileText className="h-6 w-6 text-placeholder" />
          <p className="text-13 font-semibold text-foreground">No resources found</p>
          <p className="max-w-sm text-12 text-muted-foreground">Try another search or adjust the active filters.</p>
          {filtersActive && <Button size="sm" variant="outline" data-testid="empty-clear" onClick={onClear}>Clear filters</Button>}
        </div>
      ) : (
        <>
          <div data-testid="item-grid" role="table" aria-label="AI resources" className="min-w-0 border-y border-border">
            <div data-testid="resource-table" role="row" className="hidden grid-cols-[minmax(12rem,2fr)_5rem_minmax(6rem,1fr)_7rem] gap-3 px-3 py-2.5 text-10 font-semibold uppercase text-placeholder md:grid 2xl:grid-cols-[minmax(15rem,2fr)_7rem_minmax(8rem,1fr)_5rem_8rem_6rem_7rem]">
              <span>Resource</span><span>Type</span><span>Source</span><span className="hidden 2xl:block">Version</span><span className="hidden 2xl:block">Subscription</span><span className="hidden 2xl:block">Updated</span><span className="text-right">Actions</span>
            </div>
            <div data-testid="resource-mobile-list" className="h-px md:hidden" />
            {items.map((item) => {
              const Icon = typeIcon(item.type);
              const subscribed = subscribedIds.has(Number(item.id));
              return (
                <article
                  key={item.id}
                  role="row"
                  tabIndex={0}
                  data-testid={`item-${item.id}`}
                  onClick={() => onOpen(Number(item.id))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onOpen(Number(item.id));
                    }
                  }}
                  className="grid cursor-pointer grid-cols-1 gap-3 border-b border-border px-3 py-3 transition-colors hover:bg-surface-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:grid-cols-[minmax(12rem,2fr)_5rem_minmax(6rem,1fr)_7rem] md:items-center 2xl:grid-cols-[minmax(15rem,2fr)_7rem_minmax(8rem,1fr)_5rem_8rem_6rem_7rem]"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        {item.featured && <Star data-testid={`item-featured-badge-${item.id}`} className="h-3.5 w-3.5 shrink-0 text-foreground" aria-label="Featured" />}
                        <p className="truncate text-13 font-semibold text-foreground">{item.name}</p>
                      </div>
                      <p className="mt-1 line-clamp-2 text-11 leading-relaxed text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                  <div className="flex min-w-0 items-center justify-between gap-2 md:contents">
                    <Badge variant="outline" className="shrink-0 capitalize md:hidden">{item.type}</Badge>
                    <span className="hidden items-center gap-1.5 text-12 capitalize text-foreground md:flex"><Icon className="h-3.5 w-3.5" />{item.type}</span>
                    <span className="hidden min-w-0 md:block"><span data-testid={`item-source-team-${item.id}`} className="block truncate text-12 font-medium text-foreground">{item.origin_team_name ?? `Team ${item.origin_team_id}`}</span><span className="block truncate text-10 text-placeholder">By {item.author}</span></span>
                    <span className="hidden text-12 text-foreground 2xl:block">v{item.version}</span>
                    <span className="hidden text-11 text-muted-foreground 2xl:block">{subscriptionLabel(item, subscribed)}</span>
                    <span className="hidden text-11 text-placeholder 2xl:block">{item.updated_at ? new Date(item.updated_at).toLocaleDateString() : "Latest"}</span>
                    <div className="flex shrink-0 items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                      <Button
                        type="button"
                        size="sm"
                        variant={subscribed ? "secondary" : "outline"}
                        disabled={item.unavailable || subscribing === Number(item.id)}
                        data-testid={`item-subscribe-${item.id}`}
                        onClick={() => subscribed ? onOpen(Number(item.id)) : onSubscribe(item)}
                        className="h-7 px-2 text-11"
                      >
                        {subscribed ? "Open" : "Subscribe"}
                      </Button>
                      {subscribed && (
                        <Button type="button" size="icon" variant="ghost" data-testid={`item-use-${item.id}`} aria-label={`Use ${item.name}`} onClick={() => onUse(item)} className="h-7 w-7">
                          <Play className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        data-testid={`favorite-${item.id}`}
                        aria-label={item.liked ? "Unlike" : "Like"}
                        aria-pressed={item.liked ?? false}
                        onClick={() => onFavorite(Number(item.id))}
                        className={cn("h-7 w-7", item.liked ? "text-destructive" : "text-muted-foreground")}
                      >
                        <Heart className="h-3.5 w-3.5" fill={item.liked ? "currentColor" : "none"} />
                        <span data-testid={`likes-${item.id}`} className="sr-only">{item.likes}</span>
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-4">
            <p className="text-11 text-placeholder">Showing {items.length} of {total}</p>
            {totalPages > 1 && (
              <div data-testid="pagination" className="flex items-center gap-2">
                <Button size="sm" variant="outline" data-testid="page-prev" disabled={page <= 1} onClick={() => onPage(page - 1)}>Prev</Button>
                <span data-testid="page-indicator" className="text-11 text-placeholder">Page {page} / {totalPages}</span>
                <Button size="sm" variant="outline" data-testid="page-next" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Next</Button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
