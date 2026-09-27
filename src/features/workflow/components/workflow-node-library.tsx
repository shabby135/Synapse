"use client";

import {
  useMemo,
  useState,
} from "react";
import {
  Bot,
  CalendarPlus,
  FlaskConical,
  GitBranch,
  Globe2,
  LayoutList,
  Mail,
  MessageCircle,
  Plus,
  Search,
  Sheet,
  TicketCheck,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  workflowActionCatalog,
  type WorkflowActionCategory,
  type WorkflowActionType,
} from "@/features/workflow/workflow-node-catalog";
import type {
  WorkflowTemplateId,
} from "@/features/workflow/workflow-templates";

type WorkflowNodeLibraryProps = {
  canEdit: boolean;
  onAddAction: (
    actionType: WorkflowActionType
  ) => void;

  // Remove this after the dormant
  // template dialog is removed from
  // WorkflowBuilder.
  onApplyTemplate?: (
    templateId: WorkflowTemplateId
  ) => void;
};

const categories: readonly WorkflowActionCategory[] =
  [
    "AI",
    "Communication",
    "Productivity",
    "Development",
    "Utilities",
  ];

function ActionIcon({
  actionType,
}: {
  actionType: WorkflowActionType;
}) {
  const className = "size-4";

  switch (actionType) {
    case "AI_PROMPT":
      return (
        <Bot className={className} />
      );

    case "SLACK_MESSAGE":
    case "DISCORD_MESSAGE":
      return (
        <MessageCircle
          className={className}
        />
      );

    case "GMAIL_SEND_EMAIL":
      return (
        <Mail className={className} />
      );

    case "GOOGLE_CALENDAR_CREATE_EVENT":
      return (
        <CalendarPlus
          className={className}
        />
      );

    case "GOOGLE_SHEETS_APPEND_ROW":
      return (
        <Sheet className={className} />
      );

    case "TRELLO_CREATE_CARD":
      return (
        <LayoutList
          className={className}
        />
      );

    case "GITHUB_CREATE_ISSUE":
      return (
        <GitBranch
          className={className}
        />
      );

    case "JIRA_CREATE_ISSUE":
      return (
        <TicketCheck
          className={className}
        />
      );

    case "HTTP_REQUEST":
      return (
        <Globe2 className={className} />
      );

    case "NO_OP":
      return (
        <FlaskConical
          className={className}
        />
      );
  }
}

export function WorkflowNodeLibrary({
  canEdit,
  onAddAction,
}: WorkflowNodeLibraryProps) {
  const [search, setSearch] =
    useState("");

  const normalizedSearch = search
    .trim()
    .toLowerCase();

  const visibleActions = useMemo(
    () =>
      workflowActionCatalog.filter(
        (action) =>
          !normalizedSearch ||
          action.label
            .toLowerCase()
            .includes(
              normalizedSearch
            ) ||
          action.description
            .toLowerCase()
            .includes(
              normalizedSearch
            ) ||
          action.category
            .toLowerCase()
            .includes(
              normalizedSearch
            )
      ),
    [normalizedSearch]
  );

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r bg-background lg:flex xl:w-64">
      <div className="border-b px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">
              Add a step
            </h3>

            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {visibleActions.length}{" "}
              available actions
            </p>
          </div>

          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Plus className="size-4" />
          </span>
        </div>

        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />

          <Input
            aria-label="Search workflow steps"
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Search steps..."
            className="h-9 pl-8 text-xs"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        <div className="space-y-4">
          {categories.map(
            (category) => {
              const actions =
                visibleActions.filter(
                  (action) =>
                    action.category ===
                    category
                );

              if (
                actions.length === 0
              ) {
                return null;
              }

              return (
                <section
                  key={category}
                >
                  <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {category}
                  </p>

                  <div className="space-y-1">
                    {actions.map(
                      (action) => (
                        <button
                          key={
                            action.actionType
                          }
                          type="button"
                          title={
                            action.description
                          }
                          disabled={
                            !canEdit
                          }
                          onClick={() =>
                            onAddAction(
                              action.actionType
                            )
                          }
                          className="group flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background text-muted-foreground transition-colors group-hover:border-primary/30 group-hover:bg-primary/10 group-hover:text-primary">
                            <ActionIcon
                              actionType={
                                action.actionType
                              }
                            />
                          </span>

                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-medium">
                              {
                                action.label
                              }
                            </span>

                            <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                              {
                                action.description
                              }
                            </span>
                          </span>

                          <Plus className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                        </button>
                      )
                    )}
                  </div>
                </section>
              );
            }
          )}

          {visibleActions.length ===
            0 && (
            <div className="rounded-lg border border-dashed px-3 py-6 text-center">
              <p className="text-xs font-medium">
                No matching steps
              </p>

              <p className="mt-1 text-[11px] text-muted-foreground">
                Try another search.
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}