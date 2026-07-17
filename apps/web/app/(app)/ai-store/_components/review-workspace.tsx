"use client";

import type { ReactNode } from "react";
import { ArrowLeft, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ReviewWorkspace({
  scope,
  title,
  description,
  onBack,
  children,
  className = "",
}: {
  scope: "Team review" | "BoardX review";
  title: string;
  description: string;
  onBack: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <main data-testid="review-workspace" className={`mx-auto w-full max-w-content px-4 pb-14 pt-5 sm:px-6 lg:px-9 lg:pt-7 ${className}`}>
      <header className="flex flex-wrap items-start gap-3 border-b border-border pb-5">
        <Button type="button" size="icon" variant="ghost" aria-label="Back to AI Store" onClick={onBack} className="h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="flex h-8 w-8 items-center justify-center rounded-8 bg-muted text-muted-foreground">
          <ClipboardCheck className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p data-testid="review-scope" className="text-10 font-semibold uppercase text-placeholder">{scope}</p>
          <h1 className="mt-1 text-22 font-bold text-foreground">{title}</h1>
          <p className="mt-1 text-12 text-muted-foreground">{description}</p>
        </div>
      </header>
      {children}
    </main>
  );
}
