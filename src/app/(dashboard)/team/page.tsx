import { GlobalTeamMembers } from "@/features/workspace/components/global-team-members";

export default function TeamPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Team
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          View and manage members across every workspace you can access.
        </p>
      </div>

      <GlobalTeamMembers />
    </div>
  );
}
