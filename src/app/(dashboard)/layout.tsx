import {
  headers,
} from "next/headers";
import {
  redirect,
} from "next/navigation";

import {
  AppSidebar,
} from "@/components/dashboard/sidebar";
import {
  Topbar,
} from "@/components/dashboard/topbar";
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { auth } from "@/lib/auth";

type DashboardLayoutProps = {
  children: React.ReactNode;
};

export default async function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const session =
    await auth.api.getSession({
      headers: await headers(),
    });

  if (!session) {
    redirect(
      "/sign-in?reason=authentication-required"
    );
  }

  if (!session.user.emailVerified) {
    redirect(
      "/sign-in?reason=email-verification-required"
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />

      <SidebarInset className="min-w-0">
        <Topbar />

        <main className="min-w-0 flex-1 overflow-x-hidden p-4 sm:p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}