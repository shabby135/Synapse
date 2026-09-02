import { AddWorkspaceMemberForm } from "@/features/workspace/components/add-workspace-member-form";
import { WorkspaceDetails } from "@/features/workspace/components/workspace-details";
import { WorkspaceMembers } from "@/features/workspace/components/workspace-members";

import { CreateWorkflowForm } from "@/features/workflow/components/create-workflow-form";
import { WorkflowList } from "@/features/workflow/components/workflow-list";

type WorkspacePageProps = {
  params: Promise<{
    workspaceId: string;
  }>;
};

export default async function WorkspacePage({
  params,
}: WorkspacePageProps) {
  const { workspaceId } = await params;

  return (
    <div className="space-y-6">
      <WorkspaceDetails
        workspaceId={workspaceId}
      />

      <CreateWorkflowForm
        workspaceId={workspaceId}
      />

      <WorkflowList
        workspaceId={workspaceId}
      />

      <AddWorkspaceMemberForm
        workspaceId={workspaceId}
      />

      <WorkspaceMembers
        workspaceId={workspaceId}
      />
    </div>
  );
}