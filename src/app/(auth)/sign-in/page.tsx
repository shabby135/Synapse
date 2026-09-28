import {
  headers,
} from "next/headers";
import Link from "next/link";
import {
  redirect,
} from "next/navigation";
import {
  Workflow,
} from "lucide-react";

import {
  SignInForm,
} from "@/features/auth/components/sign-in-form";
import { auth } from "@/lib/auth";

type SignInPageProps = {
  searchParams: Promise<{
    reason?: string | string[];
    switch?: string | string[];
  }>;
};

export default async function SignInPage({
  searchParams,
}: SignInPageProps) {
  const session =
    await auth.api.getSession({
      headers: await headers(),
    });

  if (
    session?.user.emailVerified
  ) {
    redirect("/dashboard");
  }

  const parameters =
    await searchParams;

  const reason =
    typeof parameters.reason ===
    "string"
      ? parameters.reason
      : undefined;

  const switchingAccount =
    parameters.switch === "true";

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 px-4 py-10">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="mx-auto mb-6 flex w-fit items-center gap-2 text-lg font-semibold tracking-tight"
        >
          <span className="flex size-9 items-center justify-center rounded-lg bg-foreground text-background">
            <Workflow className="size-4" />
          </span>

          Synapse
        </Link>

        <SignInForm
          reason={reason}
          switchingAccount={
            switchingAccount
          }
        />

        <p className="mt-6 text-center text-xs leading-5 text-muted-foreground">
          By continuing, you agree to
          use Synapse responsibly.
        </p>
      </div>
    </main>
  );
}