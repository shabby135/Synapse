import {
  WorkspaceUsageCard,
} from "@/features/billing/components/workspace-usage-card";
import {
  WorkspaceIntegrations,
} from "@/features/integration/components/workspace-integrations";
import {
  CreateWorkflowForm,
} from "@/features/workflow/components/create-workflow-form";
import {
  WorkflowList,
} from "@/features/workflow/components/workflow-list";
import {
  AddWorkspaceMemberForm,
} from "@/features/workspace/components/add-workspace-member-form";
import {
  WorkspaceDetails,
} from "@/features/workspace/components/workspace-details";
import {
  WorkspaceMembers,
} from "@/features/workspace/components/workspace-members";
import {
  WorkspaceMonitoringCard,
} from "@/features/workflow/components/workspace-monitoring-card";

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

      <WorkspaceUsageCard
        workspaceId={workspaceId}
      />
      <WorkspaceMonitoringCard
  workspaceId={workspaceId}
/>

      <CreateWorkflowForm
        workspaceId={workspaceId}
      />

      <WorkflowList
        workspaceId={workspaceId}
      />

      <WorkspaceIntegrations
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