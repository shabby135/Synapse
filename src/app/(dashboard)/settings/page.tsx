import { AccountSettings } from "@/features/auth/components/account-settings";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your profile, appearance, sign-in methods, and active sessions.
        </p>
      </div>

      <AccountSettings />
    </div>
  );
}
