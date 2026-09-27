import {
  LayoutTemplate,
  Sparkles,
} from "lucide-react";

import {
  TemplateGallery,
} from "@/features/workflow/components/template-gallery";

export default function TemplatesPage() {
  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl border bg-card px-6 py-10 sm:px-10">
        <div className="pointer-events-none absolute -right-24 -top-32 size-80 rounded-full bg-violet-500/10 blur-3xl" />

        <div className="relative max-w-3xl">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-600">
            <LayoutTemplate className="size-6" />
          </div>

          <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-violet-600">
            <Sparkles className="size-4" />
            Ready-to-configure workflows
          </div>

          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Workflow templates
          </h1>

          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
            Start with a practical workflow
            structure instead of an empty
            canvas. Select your workspace,
            create the workflow, and then
            connect your own integrations.
          </p>
        </div>
      </section>

      <TemplateGallery />
    </div>
  );
}