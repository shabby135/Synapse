import Link from "next/link";
import { Plus } from "lucide-react";

import { GlobalWorkflowList } from "@/features/workflow/components/global-workflow-list";

export default function AutomationsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Automations
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Organize workflows into folders and manage automations from every workspace you can access.
          </p>
        </div>

        <Link
          href="/workspaces?create=assistant"
          className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus className="size-4" />
          Create automation
        </Link>
      </div>

      <GlobalWorkflowList />
    </div>
  );
}
