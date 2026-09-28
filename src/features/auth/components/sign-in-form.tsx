"use client";

import {
  useState,
} from "react";
import Link from "next/link";
import {
  useRouter,
} from "next/navigation";
import {
  Loader2,
  LockKeyhole,
  Mail,
} from "lucide-react";
import {
  useForm,
} from "react-hook-form";
import {
  zodResolver,
} from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  authClient,
} from "@/lib/auth-client";

import {
  signInSchema,
  type SignInInput,
} from "../schema";
import {
  SocialAuthButtons,
} from "./social-auth-buttons";

type SignInFormProps = {
  reason?: string;
  switchingAccount?: boolean;
};

function reasonMessage(
  reason: string | undefined,
  switchingAccount: boolean
): string | null {
  if (switchingAccount) {
    return "Sign in with the account you want to use.";
  }

  switch (reason) {
    case "authentication-required":
      return "Sign in to continue to your dashboard.";

    case "email-verification-required":
      return "Verify your email address before accessing your dashboard.";

    case "oauth-error":
      return "Social sign-in was not completed. Please try again.";

    default:
      return null;
  }
}

function signInErrorMessage(
  error: {
    code?: string;
    message?: string;
  }
): string {
  const code =
    error.code?.toUpperCase() ??
    "";

  if (
    code.includes(
      "EMAIL_NOT_VERIFIED"
    )
  ) {
    return "Your email address has not been verified. Check your inbox for the verification email.";
  }

  if (
    code.includes(
      "INVALID_EMAIL_OR_PASSWORD"
    ) ||
    code.includes(
      "INVALID_CREDENTIALS"
    )
  ) {
    return "The email address or password is incorrect.";
  }

  return (
    error.message ??
    "Unable to sign in. Please try again."
  );
}

export function SignInForm({
  reason,
  switchingAccount = false,
}: SignInFormProps) {
  const router = useRouter();

  const [
    serverError,
    setServerError,
  ] = useState<string | null>(
    null
  );

  const form = useForm<SignInInput>({
    resolver: zodResolver(
      signInSchema
    ),

    defaultValues: {
      email: "",
      password: "",
    },
  });

  const initialMessage =
    reasonMessage(
      reason,
      switchingAccount
    );

  const isSubmitting =
    form.formState.isSubmitting;

  async function onSubmit(
    values: SignInInput
  ) {
    setServerError(null);

    try {
      const result =
        await authClient.signIn.email(
          {
            email: values.email,
            password:
              values.password,
            callbackURL:
              "/dashboard",
          }
        );

      if (result.error) {
        setServerError(
          signInErrorMessage(
            result.error
          )
        );

        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch {
      setServerError(
        "Unable to sign in. Please try again."
      );
    }
  }

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm sm:p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Sign in
        </h1>

        <p className="mt-2 text-sm text-muted-foreground">
          Access your workflows and
          workspace.
        </p>
      </div>

      {initialMessage && (
        <div className="mt-5 rounded-md border bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground">
          {initialMessage}
        </div>
      )}

      <div className="mt-6">
        <SocialAuthButtons
          disabled={isSubmitting}
          onError={setServerError}
        />
      </div>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />

        <span className="text-xs text-muted-foreground">
          or use email
        </span>

        <div className="h-px flex-1 bg-border" />
      </div>

      <form
        onSubmit={form.handleSubmit(
          onSubmit
        )}
        className="space-y-4"
      >
        <div className="space-y-2">
          <label
            htmlFor="sign-in-email"
            className="text-sm font-medium"
          >
            Email
          </label>

          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

            <Input
              id="sign-in-email"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              disabled={isSubmitting}
              placeholder="you@example.com"
              className="pl-9"
              aria-invalid={
                Boolean(
                  form.formState
                    .errors.email
                )
              }
              {...form.register(
                "email"
              )}
            />
          </div>

          {form.formState.errors
            .email?.message && (
            <p className="text-xs font-medium text-destructive">
              {
                form.formState.errors
                  .email.message
              }
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label
            htmlFor="sign-in-password"
            className="text-sm font-medium"
          >
            Password
          </label>

          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

            <Input
              id="sign-in-password"
              type="password"
              autoComplete="current-password"
              disabled={isSubmitting}
              placeholder="Your password"
              className="pl-9"
              aria-invalid={
                Boolean(
                  form.formState
                    .errors.password
                )
              }
              {...form.register(
                "password"
              )}
            />
          </div>

          {form.formState.errors
            .password?.message && (
            <p className="text-xs font-medium text-destructive">
              {
                form.formState.errors
                  .password.message
              }
            </p>
          )}
        </div>

        {serverError && (
          <div
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm font-medium text-destructive"
          >
            {serverError}
          </div>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={isSubmitting}
        >
          {isSubmitting && (
            <Loader2 className="size-4 animate-spin" />
          )}

          Sign in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Don&apos;t have an
        account?{" "}
        <Link
          href="/sign-up"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Create one
        </Link>
      </p>
    </div>
  );
}