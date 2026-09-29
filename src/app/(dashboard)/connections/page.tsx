import { PlugZap } from "lucide-react";

import { GlobalConnectionsList } from "@/features/integration/components/global-connections-list";

export default function ConnectionsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-card">
          <PlugZap className="size-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            App connections
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review connections from every workspace you can access.
          </p>
        </div>
      </div>

      <GlobalConnectionsList />
    </div>
  );
}
