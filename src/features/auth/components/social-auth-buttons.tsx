"use client";

import {
  useState,
} from "react";
import {
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  authClient,
} from "@/lib/auth-client";

type SocialProvider =
  | "google"
  | "github";

type SocialAuthButtonsProps = {
  disabled?: boolean;
  onError: (
    message: string | null
  ) => void;
};

function GoogleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-4"
    >
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.91h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.4Z"
      />

      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.97-.9 6.63-2.43l-3.24-2.54c-.9.6-2.05.97-3.39.97-2.6 0-4.81-1.76-5.6-4.13H3.05v2.62A10 10 0 0 0 12 22Z"
      />

      <path
        fill="#FBBC05"
        d="M6.4 13.87A6 6 0 0 1 6.08 12c0-.65.11-1.28.32-1.87V7.51H3.05A10 10 0 0 0 2 12c0 1.61.38 3.14 1.05 4.49l3.35-2.62Z"
      />

      <path
        fill="#EA4335"
        d="M12 6c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.95 5.51l3.35 2.62C7.19 7.76 9.4 6 12 6Z"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-4 fill-current"
    >
      <path d="M12 2C6.48 2 2 6.58 2 12.23c0 4.52 2.87 8.35 6.84 9.71.5.1.68-.22.68-.49 0-.24-.01-1.05-.01-1.91-2.78.62-3.37-1.21-3.37-1.21-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.63.07-.63 1 .08 1.53 1.06 1.53 1.06.89 1.57 2.34 1.12 2.91.85.09-.67.35-1.12.63-1.38-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.04 1.03-2.76-.1-.26-.45-1.31.1-2.72 0 0 .84-.28 2.75 1.05A9.3 9.3 0 0 1 12 6.9a9.2 9.2 0 0 1 2.5.35c1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.46.1 2.72.64.72 1.03 1.64 1.03 2.76 0 3.94-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.81 0 .27.18.59.69.49A10.25 10.25 0 0 0 22 12.23C22 6.58 17.52 2 12 2Z" />
    </svg>
  );
}

function providerLabel(
  provider: SocialProvider
): string {
  return provider === "google"
    ? "Google"
    : "GitHub";
}

export function SocialAuthButtons({
  disabled = false,
  onError,
}: SocialAuthButtonsProps) {
  const [
    pendingProvider,
    setPendingProvider,
  ] =
    useState<SocialProvider | null>(
      null
    );

  async function signInWithProvider(
    provider: SocialProvider
  ) {
    if (
      disabled ||
      pendingProvider !== null
    ) {
      return;
    }

    onError(null);
    setPendingProvider(provider);

    try {
      const result =
        await authClient.signIn.social({
          provider,
          callbackURL:
            "/dashboard",
        });

      if (result.error) {
        onError(
          result.error.message ??
            `Unable to continue with ${providerLabel(
              provider
            )}.`
        );

        setPendingProvider(null);
      }
    } catch {
      onError(
        `Unable to continue with ${providerLabel(
          provider
        )}. Please try again.`
      );

      setPendingProvider(null);
    }
  }

  const isPending =
    pendingProvider !== null;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Button
        type="button"
        variant="outline"
        disabled={
          disabled || isPending
        }
        onClick={() => {
          void signInWithProvider(
            "google"
          );
        }}
      >
        {pendingProvider ===
        "google" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <GoogleIcon />
        )}

        Google
      </Button>

      <Button
        type="button"
        variant="outline"
        disabled={
          disabled || isPending
        }
        onClick={() => {
          void signInWithProvider(
            "github"
          );
        }}
      >
        {pendingProvider ===
        "github" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <GitHubIcon />
        )}

        GitHub
      </Button>
    </div>
  );
}