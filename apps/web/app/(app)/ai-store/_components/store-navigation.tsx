"use client";

import {
  Bookmark,
  Compass,
  FileCheck2,
  FolderPen,
  ShieldCheck,
  Sparkles,
  Star,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { StoreDestination } from "./store-types";

const GROUPS = [
  {
    label: "Discover",
    items: [
      { key: "explore", label: "Explore", icon: Compass },
      { key: "featured", label: "Featured", icon: Star },
    ],
  },
  {
    label: "Manage",
    items: [
      { key: "subscribe", label: "My subscriptions", icon: Bookmark, alias: "subscriptions" },
      { key: "create", label: "Created by me", icon: FolderPen, alias: "created" },
      { key: "authorized", label: "Authorized editing", icon: ShieldCheck },
      { key: "shared", label: "Shared with me", icon: UsersRound },
    ],
  },
] as const;

interface Props {
  active: StoreDestination;
  currentTeamName: string;
  canReviewTeam: boolean;
  isSysAdmin: boolean;
  onSelect: (destination: StoreDestination) => void;
}

function NavigationButton({
  destination,
  label,
  alias,
  icon: Icon,
  active,
  onSelect,
}: {
  destination: StoreDestination;
  label: string;
  alias?: string;
  icon: typeof Compass;
  active: boolean;
  onSelect: (destination: StoreDestination) => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      data-testid={`nav-${destination}`}
      aria-pressed={active}
      onClick={() => onSelect(destination)}
      className={cn(
        "h-9 w-auto shrink-0 justify-start gap-2 px-2.5 text-13 font-medium transition-colors lg:w-full",
        active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
      <span data-testid={alias ? `nav-${alias}` : undefined} className="whitespace-nowrap">
        {label}
      </span>
    </Button>
  );
}

export function StoreNavigation({ active, currentTeamName, canReviewTeam, isSysAdmin, onSelect }: Props) {
  const content = (
    <>
      {GROUPS.map((group) => (
        <div key={group.label} className="w-max shrink-0 lg:mb-4 lg:w-auto">
          <p className="hidden px-2.5 pb-1.5 text-10 font-semibold uppercase text-placeholder lg:block">
            {group.label}
          </p>
          <div className="flex gap-1 lg:flex-col">
            {group.items.map((item) => (
              <NavigationButton
                key={item.key}
                destination={item.key}
                label={item.label}
                alias={"alias" in item ? item.alias : undefined}
                icon={item.icon}
                active={active === item.key}
                onSelect={onSelect}
              />
            ))}
          </div>
        </div>
      ))}
      {canReviewTeam && (
        <div className="shrink-0 lg:mb-4">
          <p className="hidden px-2.5 pb-1.5 text-10 font-semibold uppercase text-placeholder lg:block">
            Review
          </p>
          <NavigationButton
            destination="team-review"
            label="Team review"
            icon={FileCheck2}
            active={active === "team-review"}
            onSelect={onSelect}
          />
        </div>
      )}
      {isSysAdmin && (
        <NavigationButton
          destination="boardx-review"
          label="BoardX review"
          icon={Sparkles}
          active={active === "boardx-review"}
          onSelect={onSelect}
        />
      )}
    </>
  );

  return (
    <aside data-testid="store-submenu" className="min-w-0 shrink-0 overflow-hidden border-b border-border px-3 py-2 lg:w-56 lg:border-b-0 lg:border-r lg:py-5">
      <div className="hidden lg:block">
        <div className="mb-1 px-2.5 text-15 font-bold text-foreground">AI Store</div>
        <p data-testid="resource-library-team" className="mb-5 truncate px-2.5 text-11 text-placeholder">
          {currentTeamName || "Current Team"}
        </p>
      </div>
      <nav aria-label="AI Store sections" className="flex min-w-0 gap-1 overflow-x-auto lg:block">
        {content}
      </nav>
    </aside>
  );
}
