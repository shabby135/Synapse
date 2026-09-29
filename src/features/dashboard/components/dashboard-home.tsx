"use client";

import {
  type FormEvent,
  useState,
} from "react";
import Link from "next/link";
import {
  useRouter,
} from "next/navigation";
import {
  ArrowUp,
  History,
  LayoutTemplate,
  PlugZap,
  Sparkles,
  Workflow,
} from "lucide-react";

import { Button } from "@/components/ui/button";

const promptSuggestions = [
  "Summarize workflow input with AI and send it to Slack",
  "Classify a support request and create a GitHub issue",
  "Extract important details from input and add them to Google Sheets",
] as const;

const quickActions = [
  {
    title: "Blank workflow",
    description:
      "Build an automation from an empty canvas.",
    href: "/workspaces",
    icon: Workflow,
  },
  {
    title: "Use a template",
    description:
      "Start with a ready-made workflow structure.",
    href: "/templates",
    icon: LayoutTemplate,
  },
  {
    title: "Connect an app",
    description:
      "Add Google, Slack and other integrations.",
    href:
      "/workspaces?section=connections",
    icon: PlugZap,
  },
  {
    title: "View run history",
    description:
      "Inspect recent executions and failures.",
    href:
      "/workspaces?section=runs",
    icon: History,
  },
] as const;

export function DashboardHome() {
  const router = useRouter();

  const [
    prompt,
    setPrompt,
  ] = useState("");

  function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const normalizedPrompt =
      prompt.trim();

    if (
      normalizedPrompt.length < 10
    ) {
      return;
    }

    window.sessionStorage.setItem(
      "synapse:workflow-intent",
      normalizedPrompt
    );

    router.push(
      "/workspaces?create=assistant"
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-12 py-4 sm:py-8">
      <section className="mx-auto max-w-4xl text-center">
        <div className="mx-auto flex size-10 items-center justify-center rounded-lg border bg-background shadow-sm">
          <Sparkles className="size-5" />
        </div>

        <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
          What would you like
          Synapse to automate?
        </h1>

        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
          Describe the result you want.
          Synapse will turn it into an
          editable workflow draft for
          you to review and configure.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-8 text-left"
        >
          <div className="overflow-hidden rounded-xl border bg-card shadow-sm focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
            <div className="flex items-center gap-2 border-b px-4 py-3 text-sm font-medium">
              <Sparkles className="size-4" />

              <span>Synapse AI</span>

              <span className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Beta
              </span>
            </div>

            <textarea
              value={prompt}
              rows={5}
              minLength={10}
              maxLength={2_000}
              aria-label="Describe the workflow you want to create"
              placeholder="For example: Summarize the provided workflow input with AI and send the result to Slack."
              onChange={(event) => {
                setPrompt(
                  event.target.value
                );
              }}
              className="block w-full resize-none bg-transparent px-4 py-4 text-sm leading-6 outline-none placeholder:text-muted-foreground"
            />

            <div className="flex items-center justify-between gap-4 border-t px-3 py-3">
              <div className="hidden items-center gap-3 text-xs text-muted-foreground sm:flex">
                <span>
                  Review the draft before
                  anything is created.
                </span>

                <span>
                  {prompt.length}/2000
                </span>
              </div>

              <Button
                type="submit"
                size="icon"
                disabled={
                  prompt.trim().length <
                  10
                }
                aria-label="Continue with this automation"
                className="ml-auto rounded-lg"
              >
                <ArrowUp className="size-4" />
              </Button>
            </div>
          </div>
        </form>

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {promptSuggestions.map(
            (suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => {
                  setPrompt(
                    suggestion
                  );
                }}
                className="rounded-full border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {suggestion}
              </button>
            )
          )}
        </div>
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold">
            Start another way
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Create manually, use a
            template, or manage your
            connected applications.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {quickActions.map(
            (action) => {
              const Icon =
                action.icon;

              return (
                <Link
                  key={action.title}
                  href={action.href}
                  className="group rounded-lg border bg-card p-4 transition-colors hover:border-foreground/20 hover:bg-muted/40"
                >
                  <div className="flex size-9 items-center justify-center rounded-md border bg-background">
                    <Icon className="size-4" />
                  </div>

                  <h3 className="mt-4 text-sm font-semibold">
                    {action.title}
                  </h3>

                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {
                      action.description
                    }
                  </p>
                </Link>
              );
            }
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-5">
          <h2 className="text-base font-semibold">
            Recent workflows
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Open your workspace to view
            and continue editing
            workflows.
          </p>

          <Button
            variant="outline"
            className="mt-5"
            nativeButton={false}
            render={
              <Link href="/workspaces" />
            }
          >
            <Workflow className="size-4" />
            View workflows
          </Button>
        </div>

        <div className="rounded-lg border bg-card p-5">
          <h2 className="text-base font-semibold">
            Recent activity
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Inspect successful and
            failed workflow executions.
          </p>

          <Button
            variant="outline"
            className="mt-5"
            nativeButton={false}
            render={
              <Link href="/workspaces?section=runs" />
            }
          >
            <History className="size-4" />
            View run history
          </Button>
        </div>
      </section>
    </div>
  );
}