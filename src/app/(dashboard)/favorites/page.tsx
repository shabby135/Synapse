import {
  Star,
} from "lucide-react";

import {
  GlobalWorkflowList,
} from "@/features/workflow/components/global-workflow-list";

export default function FavoritesPage() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header>
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg border bg-card">
            <Star className="size-5 fill-amber-400 text-amber-500" />
          </span>

          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Favorites
            </h1>

            <p className="mt-1 text-sm text-muted-foreground">
              Quickly access the
              automations you use most.
            </p>
          </div>
        </div>
      </header>

      <GlobalWorkflowList
        favoritesOnly
      />
    </div>
  );
}