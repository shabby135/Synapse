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
  SignUpForm,
} from "@/features/auth/components/sign-up-form";
import { auth } from "@/lib/auth";

export default async function SignUpPage() {
  const session =
    await auth.api.getSession({
      headers: await headers(),
    });

  if (
    session?.user.emailVerified
  ) {
    redirect("/dashboard");
  }

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

        <SignUpForm />

        <p className="mt-6 text-center text-xs leading-5 text-muted-foreground">
          Email accounts must be
          verified before dashboard
          access is granted.
        </p>
      </div>
    </main>
  );
}