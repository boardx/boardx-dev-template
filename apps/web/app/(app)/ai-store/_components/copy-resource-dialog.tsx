"use client";

import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { StoreItem } from "./store-types";

export function CopyResourceDialog({
  item,
  targetTeamName,
  busy,
  onClose,
  onConfirm,
}: {
  item: StoreItem | null;
  targetTeamName: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open={item != null}
      onClose={onClose}
      title="Copy resource to Team"
      description="Create a separate private draft in the current Team."
      testId="copy-resource-dialog"
      closeTestId="close-copy-resource"
      className="max-w-[28rem] rounded-8"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy} data-testid="cancel-copy-resource">
            Cancel
          </Button>
          <Button type="button" onClick={onConfirm} disabled={busy} data-testid="confirm-copy-resource">
            <Copy className="h-4 w-4" />
            {busy ? "Copying..." : "Create independent draft"}
          </Button>
        </>
      }
    >
      <div className="border-y border-border py-3">
        <p className="text-11 text-placeholder">Resource</p>
        <p className="mt-1 truncate text-13 font-semibold text-foreground">{item?.name}</p>
        <p className="mt-3 text-11 text-placeholder">Target Team</p>
        <p data-testid="copy-target-team" className="mt-1 text-13 font-semibold text-foreground">{targetTeamName}</p>
      </div>
      <p data-testid="copy-independence-note" className="text-12 leading-relaxed text-muted-foreground">
        The new draft will not follow future updates from the source. Subscriptions, favorites, reviews, sharing links,
        and usage statistics are not copied.
      </p>
    </Dialog>
  );
}

