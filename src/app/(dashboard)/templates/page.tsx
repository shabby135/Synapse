import {
  LayoutTemplate,
} from "lucide-react";

import { TemplateGallery } from "@/features/workflow/components/template-gallery";

export default function TemplatesPage() {
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted/50 text-muted-foreground">
            <LayoutTemplate className="size-5" />
          </div>

          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Workflow templates
            </h1>

            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              Create a workflow from a
              reusable starting point,
              then configure its
              integrations and actions.
            </p>
          </div>
        </div>
      </header>

      <TemplateGallery />
    </div>
  );
}