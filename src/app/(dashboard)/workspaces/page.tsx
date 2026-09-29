import {
  AssistantWorkflowCreator,
} from "@/features/workspace/components/assistant-workflow-creator";
import {
  CreateWorkspaceForm,
} from "@/features/workspace/components/create-workspace-form";
import {
  WorkspaceList,
} from "@/features/workspace/components/workspace-list";

type WorkspacesPageProps = {
  searchParams: Promise<{
    create?:
      | string
      | string[];
  }>;
};

export default async function WorkspacesPage({
  searchParams,
}: WorkspacesPageProps) {
  const parameters =
    await searchParams;

  const createMode =
    Array.isArray(
      parameters.create
    )
      ? parameters.create[0]
      : parameters.create;

  const showAssistant =
    createMode === "assistant";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">
          Workspaces
        </h2>

        <p className="mt-2 text-muted-foreground">
          Create and manage the spaces
          that contain your Synapse
          projects.
        </p>
      </div>

      {showAssistant && (
        <AssistantWorkflowCreator />
      )}

      <CreateWorkspaceForm />

      <section>
        <div className="mb-4">
          <h3 className="text-xl font-semibold">
            Your workspaces
          </h3>

          <p className="text-sm text-muted-foreground">
            Workspaces contain
            workflows, integrations and
            members.
          </p>
        </div>

        <WorkspaceList />
      </section>
    </div>
  );
}