"use client";

import {
  Loader2,
  Rocket,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type PublishWorkflowDialogProps = {
  open: boolean;
  isPending: boolean;
  onOpenChange: (
    open: boolean
  ) => void;
  onConfirm: () => void;
};

export function PublishWorkflowDialog({
  open,
  isPending,
  onOpenChange,
  onConfirm,
}: PublishWorkflowDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isPending) {
          onOpenChange(nextOpen);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Rocket className="size-5" />
          </div>

          <DialogTitle>
            Publish workflow?
          </DialogTitle>

          <DialogDescription>
            The current draft will be
            validated and published as an
            immutable version. Future edits
            will be stored in a new draft
            version.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() =>
              onOpenChange(false)
            }
          >
            Cancel
          </Button>

          <Button
            type="button"
            disabled={isPending}
            onClick={onConfirm}
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Rocket className="size-4" />
            )}

            Publish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}