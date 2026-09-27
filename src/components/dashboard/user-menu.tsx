"use client";

import {
  useRouter,
} from "next/navigation";
import {
  Laptop,
  LogOut,
  Moon,
  Palette,
  Sun,
} from "lucide-react";
import {
  useTheme,
} from "next-themes";

import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  authClient,
} from "@/lib/auth-client";

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

  return (
    parts[0].charAt(0) +
    parts[
      parts.length - 1
    ].charAt(0)
  ).toUpperCase();
}

export function UserMenu() {
  const router = useRouter();

  const {
    theme,
    setTheme,
  } = useTheme();

  const session =
    authClient.useSession();

  const userName =
    session.data?.user.name ??
    "Synapse user";

  const userEmail =
    session.data?.user.email ??
    "";

  async function handleLogout() {
    await authClient.signOut();

    router.replace("/sign-in");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            className="size-9 rounded-full p-0"
            aria-label="Open user menu"
          >
            <Avatar className="size-8">
              <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
                {getInitials(
                  userName
                )}
              </AvatarFallback>
            </Avatar>
          </Button>
        }
      />

      <DropdownMenuContent
        align="end"
        className="w-64"
      >
        <DropdownMenuLabel className="px-2 py-2">
          <span className="block truncate text-sm font-medium text-foreground">
            {userName}
          </span>

          {userEmail && (
            <span className="mt-0.5 block truncate text-xs font-normal text-muted-foreground">
              {userEmail}
            </span>
          )}
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Palette className="mr-1 size-4" />
            Appearance
          </DropdownMenuSubTrigger>

          <DropdownMenuSubContent className="w-40">
            <DropdownMenuRadioGroup
              value={
                theme ?? "system"
              }
              onValueChange={
                setTheme
              }
            >
              <DropdownMenuRadioItem value="light">
                <Sun className="mr-1 size-4" />
                Light
              </DropdownMenuRadioItem>

              <DropdownMenuRadioItem value="dark">
                <Moon className="mr-1 size-4" />
                Dark
              </DropdownMenuRadioItem>

              <DropdownMenuRadioItem value="system">
                <Laptop className="mr-1 size-4" />
                System
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          variant="destructive"
          onClick={() => {
            void handleLogout();
          }}
        >
          <LogOut className="mr-1 size-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}