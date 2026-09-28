"use client";

import {
  useState,
} from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Loader2,
  LockKeyhole,
  Mail,
  User,
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
  signUpSchema,
  type SignUpInput,
} from "../schema";
import {
  SocialAuthButtons,
} from "./social-auth-buttons";

function signUpErrorMessage(
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
      "USER_ALREADY_EXISTS"
    )
  ) {
    return "An account with this email address already exists.";
  }

  return (
    error.message ??
    "Unable to create the account. Please try again."
  );
}

export function SignUpForm() {
  const [
    serverError,
    setServerError,
  ] = useState<string | null>(
    null
  );

  const [
    submittedEmail,
    setSubmittedEmail,
  ] = useState<string | null>(
    null
  );

  const form = useForm<SignUpInput>({
    resolver: zodResolver(
      signUpSchema
    ),

    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const isSubmitting =
    form.formState.isSubmitting;

  async function onSubmit(
    values: SignUpInput
  ) {
    setServerError(null);

    try {
      const result =
        await authClient.signUp.email(
          {
            name: values.name,
            email: values.email,
            password:
              values.password,
            callbackURL:
              "/dashboard",
          }
        );

      if (result.error) {
        setServerError(
          signUpErrorMessage(
            result.error
          )
        );

        return;
      }

      setSubmittedEmail(
        values.email
      );
    } catch {
      setServerError(
        "Unable to create the account. Please try again."
      );
    }
  }

  if (submittedEmail) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center shadow-sm sm:p-8">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
          <CheckCircle2 className="size-6" />
        </div>

        <h1 className="mt-5 text-2xl font-semibold tracking-tight">
          Check your email
        </h1>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          We sent a verification
          link to{" "}
          <span className="font-medium text-foreground">
            {submittedEmail}
          </span>
          . Open that link to verify
          your account.
        </p>

        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          If the message does not
          arrive, check your spam
          folder and confirm that the
          email address is correct.
        </p>

        <Button
          className="mt-6 w-full"
          variant="outline"
          render={
            <Link href="/sign-in" />
          }
        >
          Return to sign in
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm sm:p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Create an account
        </h1>

        <p className="mt-2 text-sm text-muted-foreground">
          Start building workflows
          in your Synapse workspace.
        </p>
      </div>

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
            htmlFor="sign-up-name"
            className="text-sm font-medium"
          >
            Name
          </label>

          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

            <Input
              id="sign-up-name"
              autoComplete="name"
              disabled={isSubmitting}
              placeholder="Your name"
              className="pl-9"
              aria-invalid={
                Boolean(
                  form.formState
                    .errors.name
                )
              }
              {...form.register(
                "name"
              )}
            />
          </div>

          {form.formState.errors
            .name?.message && (
            <p className="text-xs font-medium text-destructive">
              {
                form.formState.errors
                  .name.message
              }
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label
            htmlFor="sign-up-email"
            className="text-sm font-medium"
          >
            Email
          </label>

          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

            <Input
              id="sign-up-email"
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
            htmlFor="sign-up-password"
            className="text-sm font-medium"
          >
            Password
          </label>

          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

            <Input
              id="sign-up-password"
              type="password"
              autoComplete="new-password"
              disabled={isSubmitting}
              placeholder="At least 8 characters"
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

        <div className="space-y-2">
          <label
            htmlFor="sign-up-confirm-password"
            className="text-sm font-medium"
          >
            Confirm password
          </label>

          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

            <Input
              id="sign-up-confirm-password"
              type="password"
              autoComplete="new-password"
              disabled={isSubmitting}
              placeholder="Enter the password again"
              className="pl-9"
              aria-invalid={
                Boolean(
                  form.formState
                    .errors
                    .confirmPassword
                )
              }
              {...form.register(
                "confirmPassword"
              )}
            />
          </div>

          {form.formState.errors
            .confirmPassword
            ?.message && (
            <p className="text-xs font-medium text-destructive">
              {
                form.formState.errors
                  .confirmPassword
                  .message
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

          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/sign-in"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}