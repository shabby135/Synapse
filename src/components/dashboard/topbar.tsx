"use client";

import {
  usePathname,
} from "next/navigation";

import {
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  getPageTitle,
} from "@/lib/get-page-title";

import {
  UserMenu,
} from "./user-menu";

export function Topbar() {
  const pathname = usePathname();

  const pageTitle =
    getPageTitle(pathname);

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-background/90 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/75 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <SidebarTrigger />

        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold sm:text-lg">
            {pageTitle}
          </h1>
        </div>
      </div>

      <UserMenu />
    </header>
  );
}