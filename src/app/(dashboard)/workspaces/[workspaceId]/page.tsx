import { AddWorkspaceMemberForm } from "@/features/workspace/components/add-workspace-member-form";
import { WorkspaceDetails } from "@/features/workspace/components/workspace-details";
import { WorkspaceMembers } from "@/features/workspace/components/workspace-members";

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
      <WorkspaceDetails workspaceId={workspaceId} />

      <AddWorkspaceMemberForm workspaceId={workspaceId} />

      <WorkspaceMembers workspaceId={workspaceId} />
    </div>
  );
}