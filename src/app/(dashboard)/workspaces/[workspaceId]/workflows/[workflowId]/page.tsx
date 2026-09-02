import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { WorkflowDetails } from "@/features/workflow/components/workflow-details";

type WorkflowPageProps = {
  params: Promise<{
    workspaceId: string;
    workflowId: string;
  }>;
};

export default async function WorkflowPage({
  params,
}: WorkflowPageProps) {
  const {
    workspaceId,
    workflowId,
  } = await params;

  return (
    <div className="space-y-6">
      <Link
        href={`/workspaces/${workspaceId}`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to workspace
      </Link>

      <WorkflowDetails
        workspaceId={workspaceId}
        workflowId={workflowId}
      />
    </div>
  );
}