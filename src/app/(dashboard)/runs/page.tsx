import {
  History,
} from "lucide-react";

import {
  GlobalRunHistory,
} from "@/features/workflow/components/global-run-history";

export default function RunsPage() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header>
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg border bg-card">
            <History className="size-5" />
          </span>

          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Run history
            </h1>

            <p className="mt-1 text-sm text-muted-foreground">
              Inspect workflow executions
              across all accessible
              workspaces.
            </p>
          </div>
        </div>
      </header>

      <GlobalRunHistory />
    </div>
  );
}