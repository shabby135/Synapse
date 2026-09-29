"use client";

import {
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  usePathname,
} from "next/navigation";
import {
  ChevronDown,
  FileText,
  GitBranch,
  LayoutGrid,
  LayoutTemplate,
  Mail,
  MessageSquare,
  Plus,
  TicketCheck,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  managementNavigation,
  navigation,
} from "@/constants/navigations";

type TemplateLogoProps = {
  first: ReactNode;
  second: ReactNode;
  firstClassName: string;
  secondClassName: string;
};

type TemplateNavigationItem = {
  title: string;
  href: string;
  logos: ReactNode;
};

function TemplateLogos({
  first,
  second,
  firstClassName,
  secondClassName,
}: TemplateLogoProps) {
  return (
    <span className="flex w-8 shrink-0 items-center">
      <span
        className={`relative z-10 flex size-5 items-center justify-center rounded border border-sidebar ${firstClassName}`}
      >
        {first}
      </span>

      <span
        className={`-ml-1.5 flex size-5 items-center justify-center rounded border border-sidebar ${secondClassName}`}
      >
        {second}
      </span>
    </span>
  );
}

const templateNavigation:
  readonly TemplateNavigationItem[] = [
  {
    title:
      "Form response triage",
    href:
      "/templates#form-response-triage",
    logos: (
      <TemplateLogos
        first={
          <FileText className="size-3" />
        }
        second={
          <MessageSquare className="size-3" />
        }
        firstClassName="bg-violet-500 text-white"
        secondClassName="bg-fuchsia-500 text-white"
      />
    ),
  },
  {
    title: "Email to task",
    href:
      "/templates#email-to-task",
    logos: (
      <TemplateLogos
        first={
          <Mail className="size-3" />
        }
        second={
          <LayoutGrid className="size-3" />
        }
        firstClassName="bg-red-500 text-white"
        secondClassName="bg-blue-500 text-white"
      />
    ),
  },
  {
    title: "Issue escalation",
    href:
      "/templates#issue-escalation",
    logos: (
      <TemplateLogos
        first={
          <GitBranch className="size-3" />
        }
        second={
          <TicketCheck className="size-3" />
        }
        firstClassName="bg-zinc-900 text-white"
        secondClassName="bg-blue-600 text-white"
      />
    ),
  },
];

export function AppSidebar() {
  const pathname = usePathname();

  const [
    templatesOpen,
    setTemplatesOpen,
  ] = useState(
    pathname === "/templates"
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="Synapse home"
              render={
                <Link href="/dashboard" />
              }
              className="h-11"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-foreground text-sm font-bold text-background">
                S
              </span>

              <span className="truncate text-base font-semibold tracking-tight">
                Synapse
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <SidebarMenu className="mt-1">
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="Create workflow"
              render={
                <Link href="/workspaces" />
              }
              className="h-10 bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"
            >
              <Plus className="size-4" />

              <span>
                Create workflow
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="gap-1 px-2 py-3">
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map(
                (item) => {
                  const Icon =
                    item.icon;

                  const isActive =
                    pathname ===
                      item.href ||
                    (
                      item.href !==
                        "/dashboard" &&
                      pathname.startsWith(
                        `${item.href}/`
                      )
                    );

                  return (
                    <SidebarMenuItem
                      key={item.href}
                    >
                      <SidebarMenuButton
                        isActive={
                          isActive
                        }
                        tooltip={
                          item.title
                        }
                        render={
                          <Link
                            href={
                              item.href
                            }
                          />
                        }
                      >
                        <Icon className="size-4" />

                        <span>
                          {item.title}
                        </span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                }
              )}

              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={
                    pathname ===
                    "/templates"
                  }
                  tooltip="Templates"
                  render={
                    <Link href="/templates" />
                  }
                >
                  <LayoutTemplate className="size-4" />

                  <span>
                    Templates
                  </span>
                </SidebarMenuButton>

                <SidebarMenuAction
                  type="button"
                  aria-label={
                    templatesOpen
                      ? "Collapse templates"
                      : "Expand templates"
                  }
                  aria-expanded={
                    templatesOpen
                  }
                  title={
                    templatesOpen
                      ? "Collapse templates"
                      : "Expand templates"
                  }
                  onClick={() => {
                    setTemplatesOpen(
                      (current) =>
                        !current
                    );
                  }}
                >
                  <ChevronDown
                    className={`size-4 transition-transform duration-200 ${
                      templatesOpen
                        ? "rotate-180"
                        : ""
                    }`}
                  />
                </SidebarMenuAction>

                {templatesOpen && (
                  <SidebarMenuSub>
                    {templateNavigation.map(
                      (template) => (
                        <SidebarMenuSubItem
                          key={
                            template.href
                          }
                        >
                          <SidebarMenuSubButton
                            render={
                              <Link
                                href={
                                  template.href
                                }
                              />
                            }
                          >
                            {
                              template.logos
                            }

                            <span>
                              {
                                template.title
                              }
                            </span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      )
                    )}
                  </SidebarMenuSub>
                )}
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-2 border-t p-0 pt-3">
          <SidebarGroupLabel>
            Manage
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              {managementNavigation.map(
                (item) => {
                  const Icon =
                    item.icon;

                  return (
                    <SidebarMenuItem
                      key={item.title}
                    >
                      <SidebarMenuButton
                        tooltip={
                          item.title
                        }
                        render={
                          <Link
                            href={
                              item.href
                            }
                          />
                        }
                      >
                        <Icon className="size-4" />

                        <span>
                          {item.title}
                        </span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                }
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t p-3">
        <div className="space-y-2 group-data-[collapsible=icon]:hidden">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">
              Current plan
            </span>

            <span className="text-muted-foreground">
              Free
            </span>
          </div>

          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-1/4 rounded-full bg-primary" />
          </div>

          <Link
            href="/workspaces?section=billing"
            className="block text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            View billing and usage
          </Link>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}