"use client";

import { Bot, FileText, Image, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SkillKind, StoreStatus, StoreType } from "./store-types";

const RESOURCE_TYPES: Array<{
  key: StoreType;
  name: string;
  help: string;
  icon: typeof Bot;
}> = [
  { key: "agent", name: "Agent", help: "AI teammate for AVA and board workflows.", icon: Bot },
  { key: "skill", name: "Skill", help: "Focused text, workflow, or image capability.", icon: Sparkles },
  { key: "template", name: "Template", help: "Reusable board and workspace structure.", icon: FileText },
];

export function ResourceTypeSelector({
  type,
  skillKind,
  locked,
  onTypeChange,
  onSkillKindChange,
}: {
  type: StoreType;
  skillKind: SkillKind;
  locked: boolean;
  onTypeChange: (type: StoreType) => void;
  onSkillKindChange: (kind: SkillKind) => void;
}) {
  return (
    <div>
      <div data-testid="creator-types" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {RESOURCE_TYPES.map(({ key, name, help, icon: Icon }) => (
          <Button
            key={key}
            type="button"
            variant={type === key ? "secondary" : "outline"}
            data-testid={`creator-type-${key}`}
            aria-pressed={type === key}
            onClick={() => onTypeChange(key)}
            disabled={locked}
            className="h-auto min-h-20 justify-start gap-3 rounded-8 p-3 text-left"
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="min-w-0">
              <span className="block text-13 font-semibold">{name}</span>
              <span className="mt-0.5 block whitespace-normal text-11 font-normal text-muted-foreground">
                {help}
              </span>
            </span>
          </Button>
        ))}
      </div>

      {type === "skill" && (
        <div data-testid="skill-kind-selector" className="mt-3 flex w-fit rounded-8 border border-border p-1">
          {(["text", "image"] as const).map((kind) => (
            <Button
              key={kind}
              type="button"
              size="sm"
              variant={skillKind === kind ? "secondary" : "ghost"}
              data-testid={`skill-kind-${kind}`}
              aria-pressed={skillKind === kind}
              onClick={() => onSkillKindChange(kind)}
              disabled={locked}
              className="h-7 gap-1.5"
            >
              {kind === "image" ? <Image className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
              {kind === "text" ? "Text" : "Image"}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ResourcePreview({
  currentTeamName,
  name,
  description,
  type,
  skillKind,
  cover,
  status,
  fillClass,
}: {
  currentTeamName: string;
  name: string;
  description: string;
  type: StoreType;
  skillKind: SkillKind;
  cover: string;
  status: StoreStatus | null;
  fillClass: string | undefined;
}) {
  const typeLabel =
    type === "skill" ? `${skillKind === "image" ? "Image" : "Text"} Skill` : type === "agent" ? "Agent" : "Template";

  return (
    <section data-testid="creator-preview" aria-label="Live resource preview" className="border-b border-border pb-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-10 font-semibold uppercase text-placeholder">Live preview</p>
          <p data-testid="editor-current-team" className="mt-1 text-12 font-medium text-foreground">
            {currentTeamName}
          </p>
        </div>
        <span className="text-10 font-semibold uppercase text-placeholder">{status ?? "New draft"}</span>
      </div>
      <div className="mt-4 flex items-start gap-3">
        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-8 text-15 font-bold text-foreground/60", fillClass)}>
          {(cover || name.charAt(0) || type.charAt(0)).slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p data-testid="preview-name" className="truncate text-13 font-semibold text-foreground">
            {name || "Untitled resource"}
          </p>
          <p data-testid="preview-type" className="mt-0.5 text-11 text-placeholder">{typeLabel}</p>
        </div>
      </div>
      <p data-testid="preview-description" className="mt-3 text-12 leading-relaxed text-muted-foreground">
        {description || "Add a description to preview how this resource will appear."}
      </p>
    </section>
  );
}
