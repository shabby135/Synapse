"use client";

import {
  type FormEvent,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Check,
  GitBranch,
  KeyRound,
  Laptop,
  Loader2,
  Mail,
  Moon,
  ShieldCheck,
  Sun,
  UserRound,
} from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/trpc/react";

const themes = [
  {
    value: "light",
    label: "Light",
    description:
      "Always use the light appearance.",
    icon: Sun,
  },
  {
    value: "dark",
    label: "Dark",
    description:
      "Always use the dark appearance.",
    icon: Moon,
  },
  {
    value: "system",
    label: "System",
    description:
      "Follow your device appearance.",
    icon: Laptop,
  },
] as const;

function getInitials(
  name: string | null | undefined
): string {
  if (!name) {
    return "U";
  }

  const parts = name
    .trim()
    .split(/\s+/u)
    .filter(Boolean);

  if (parts.length === 0) {
    return "U";
  }

  if (parts.length === 1) {
    return parts[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return `${parts[0][0]}${
    parts[parts.length - 1][0]
  }`.toUpperCase();
}

function providerDetails(
  providerId: string
) {
  switch (providerId.toLowerCase()) {
    case "google":
      return {
        label: "Google",
        icon: Mail,
      };

    case "github":
      return {
        label: "GitHub",
        icon: GitBranch,
      };

    case "credential":
      return {
        label: "Email and password",
        icon: KeyRound,
      };

    default:
      return {
        label: providerId,
        icon: ShieldCheck,
      };
  }
}

function validateImageUrl(
  value: string
): boolean {
  if (!value) {
    return true;
  }

  try {
    const url = new URL(value);

    return (
      url.protocol === "https:" ||
      url.protocol === "http:"
    );
  } catch {
    return false;
  }
}

export function AccountSettings() {
  const trpc = useTRPC();
  const router = useRouter();
  const session =
    authClient.useSession();

  const {
    theme,
    setTheme,
  } = useTheme();

  const [
    nameOverride,
    setName,
  ] = useState<string | null>(
    null
  );

  const [
    imageOverride,
    setImage,
  ] = useState<string | null>(
    null
  );

  const [
    isSaving,
    setIsSaving,
  ] = useState(false);

  const [
    isRevoking,
    setIsRevoking,
  ] = useState(false);

  const accounts = useQuery(
    trpc.user.listAccounts.queryOptions()
  );

  const name =
    nameOverride ??
    session.data?.user.name ??
    "";

  const image =
    imageOverride ??
    session.data?.user.image ??
    "";

  async function handleProfileSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const normalizedName =
      name.trim();

    const normalizedImage =
      image.trim();

    if (
      normalizedName.length < 2
    ) {
      toast.error(
        "Name must contain at least 2 characters."
      );

      return;
    }

    if (
      !validateImageUrl(
        normalizedImage
      )
    ) {
      toast.error(
        "Avatar must be a valid HTTP or HTTPS URL."
      );

      return;
    }

    setIsSaving(true);

    try {
      const result =
        await authClient.updateUser({
          name: normalizedName,
          image:
            normalizedImage ||
            null,
        });

      if (result.error) {
        toast.error(
          result.error.message ??
            "Unable to update profile."
        );

        return;
      }

      await session.refetch();
      router.refresh();

      toast.success(
        "Profile updated."
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to update profile."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function revokeOtherSessions() {
    if (isRevoking) {
      return;
    }

    setIsRevoking(true);

    try {
      const result =
        await authClient.revokeOtherSessions();

      if (result.error) {
        toast.error(
          result.error.message ??
            "Unable to revoke other sessions."
        );

        return;
      }

      toast.success(
        "Other signed-in sessions were revoked."
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to revoke other sessions."
      );
    } finally {
      setIsRevoking(false);
    }
  }

  if (session.isPending) {
    return (
      <div className="flex min-h-64 items-center justify-center rounded-xl border bg-card">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (
    session.error ||
    !session.data?.user
  ) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6">
        <p className="font-medium text-destructive">
          Unable to load account
          settings
        </p>

        <p className="mt-1 text-sm text-muted-foreground">
          {session.error?.message ??
            "Your session is unavailable."}
        </p>
      </div>
    );
  }

  const user =
    session.data.user;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.8fr)]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-lg bg-muted">
                <UserRound className="size-5" />
              </span>

              <div>
                <CardTitle>
                  Profile
                </CardTitle>

                <CardDescription>
                  Update how your
                  account appears in
                  Synapse.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <form
              onSubmit={
                handleProfileSubmit
              }
              className="space-y-5"
            >
              <div className="flex items-center gap-4 rounded-lg border p-4">
                <Avatar className="size-14">
                  {image.trim() &&
                    validateImageUrl(
                      image.trim()
                    ) && (
                      <AvatarImage
                        src={image.trim()}
                        alt=""
                      />
                    )}

                  <AvatarFallback>
                    {getInitials(name)}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {name ||
                      "Synapse user"}
                  </p>

                  <p className="truncate text-sm text-muted-foreground">
                    {user.email}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="settings-name"
                  className="text-sm font-medium"
                >
                  Display name
                </label>

                <Input
                  id="settings-name"
                  value={name}
                  onChange={(event) => {
                    setName(
                      event.target.value
                    );
                  }}
                  required
                  minLength={2}
                  maxLength={100}
                  disabled={isSaving}
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="settings-image"
                  className="text-sm font-medium"
                >
                  Avatar URL
                </label>

                <Input
                  id="settings-image"
                  type="url"
                  value={image}
                  onChange={(event) => {
                    setImage(
                      event.target.value
                    );
                  }}
                  placeholder="https://example.com/avatar.jpg"
                  maxLength={2_048}
                  disabled={isSaving}
                />

                <p className="text-xs text-muted-foreground">
                  Leave this blank to
                  use your initials.
                </p>
              </div>

              <Button
                type="submit"
                disabled={
                  isSaving ||
                  name.trim().length <
                    2
                }
              >
                {isSaving && (
                  <Loader2 className="size-4 animate-spin" />
                )}

                Save profile
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Appearance
            </CardTitle>

            <CardDescription>
              Choose how Synapse looks
              on this device.
            </CardDescription>
          </CardHeader>

          <CardContent className="grid gap-3 sm:grid-cols-3">
            {themes.map(
              (option) => {
                const Icon =
                  option.icon;

                const selected =
                  (theme ??
                    "system") ===
                  option.value;

                return (
                  <button
                    key={
                      option.value
                    }
                    type="button"
                    aria-pressed={
                      selected
                    }
                    onClick={() => {
                      setTheme(
                        option.value
                      );
                    }}
                    className={`relative rounded-lg border p-4 text-left transition-colors ${
                      selected
                        ? "border-foreground bg-muted/60"
                        : "hover:bg-muted/40"
                    }`}
                  >
                    {selected && (
                      <Check className="absolute right-3 top-3 size-4" />
                    )}

                    <Icon className="size-5" />

                    <p className="mt-3 text-sm font-medium">
                      {option.label}
                    </p>

                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {
                        option.description
                      }
                    </p>
                  </button>
                );
              }
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>
              Account
            </CardTitle>

            <CardDescription>
              Your primary identity and
              verification status.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Email
              </p>

              <p className="mt-1 break-all text-sm font-medium">
                {user.email}
              </p>
            </div>

            <div className="flex items-center justify-between gap-4 border-t pt-4">
              <div>
                <p className="text-sm font-medium">
                  Email verification
                </p>

                <p className="text-xs text-muted-foreground">
                  Required for
                  dashboard access.
                </p>
              </div>

              <span
                className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                  user.emailVerified
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                }`}
              >
                {user.emailVerified
                  ? "Verified"
                  : "Not verified"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Sign-in methods
            </CardTitle>

            <CardDescription>
              Providers currently
              connected to your account.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {accounts.isPending ? (
              <div className="flex min-h-20 items-center justify-center">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
            ) : accounts.isError ? (
              <p className="text-sm text-destructive">
                {
                  accounts.error
                    .message
                }
              </p>
            ) : accounts.data
                .length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No linked sign-in
                methods were found.
              </p>
            ) : (
              <div className="divide-y rounded-lg border">
                {accounts.data.map(
                  (account) => {
                    const provider =
                      providerDetails(
                        account.providerId
                      );

                    const Icon =
                      provider.icon;

                    return (
                      <div
                        key={
                          account.id
                        }
                        className="flex items-center gap-3 p-3"
                      >
                        <span className="flex size-9 items-center justify-center rounded-md bg-muted">
                          <Icon className="size-4" />
                        </span>

                        <div>
                          <p className="text-sm font-medium">
                            {
                              provider.label
                            }
                          </p>

                          <p className="text-xs text-muted-foreground">
                            Connected
                          </p>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Session security
            </CardTitle>

            <CardDescription>
              Sign out every other
              browser or device while
              keeping this session
              active.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <Button
              type="button"
              variant="outline"
              disabled={isRevoking}
              onClick={() => {
                void revokeOtherSessions();
              }}
            >
              {isRevoking ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ShieldCheck className="size-4" />
              )}

              Sign out other sessions
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}