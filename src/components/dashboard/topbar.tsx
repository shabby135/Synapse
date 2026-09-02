"use client";

import { usePathname } from "next/navigation";
import {
  Bell,
  Search,
} from "lucide-react";

import { getPageTitle } from "@/lib/get-page-title";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { UserMenu } from "./user-menu";

export function Topbar() {
  const pathname = usePathname();

  const pageTitle =
    getPageTitle(pathname);

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-background px-6">
      <div className="flex items-center gap-4">
        <SidebarTrigger />

        <h1 className="text-lg font-semibold">
          {pageTitle}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

          <Input
            placeholder="Search..."
            className="w-72 pl-9"
          />
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Notifications"
        >
          <Bell className="size-5" />
        </Button>

        <UserMenu />
      </div>
    </header>
  );
}