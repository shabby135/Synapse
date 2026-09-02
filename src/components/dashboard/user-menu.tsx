"use client";

import { useRouter } from "next/navigation";

import {
  LogOut,
  Settings,
  User,
} from "lucide-react";

import { authClient } from "@/lib/auth-client";

import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";

import { Button } from "@/components/ui/button";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu() {
  const router = useRouter();

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
            className="h-10 w-10 rounded-full p-0"
            aria-label="Open user menu"
          >
            <Avatar>
              <AvatarFallback>
                SS
              </AvatarFallback>
            </Avatar>
          </Button>
        }
      />

      <DropdownMenuContent
        align="end"
        className="w-56"
      >
        <DropdownMenuItem>
          <User className="mr-2 size-4" />
          Profile
        </DropdownMenuItem>

        <DropdownMenuItem>
          <Settings className="mr-2 size-4" />
          Settings
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={handleLogout}
          className="text-red-600"
        >
          <LogOut className="mr-2 size-4" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}