"use client";

import {
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  FileText,
  GitBranch,
  LayoutGrid,
  LayoutTemplate,
  Mail,
  MessageSquare,
  TicketCheck,
} from "lucide-react";

import { navigation } from "@/constants/navigations";

import {
  Sidebar,
  SidebarContent,
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
} from "@/components/ui/sidebar";

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
        className={`relative z-10 flex size-5 items-center justify-center rounded-md border border-background ${firstClassName}`}
      >
        {first}
      </span>

      <span
        className={`-ml-1.5 flex size-5 items-center justify-center rounded-md border border-background ${secondClassName}`}
      >
        {second}
      </span>
    </span>
  );
}

const templateNavigation:
  readonly TemplateNavigationItem[] = [
  {
    title: "Form response triage",
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
    href: "/templates#email-to-task",
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
  ] = useState(true);

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-6 py-4">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-xl font-bold tracking-tight"
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            S
          </span>

          <span>Synapse</span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="gap-2 px-2 py-3">
        <SidebarGroup className="p-0">
          <SidebarGroupLabel>
            Workspace
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map(
                (item) => {
                  const Icon =
                    item.icon;

                  const isActive =
                    pathname ===
                      item.href ||
                    pathname.startsWith(
                      `${item.href}/`
                    );

                  return (
                    <SidebarMenuItem
                      key={item.href}
                    >
                      <SidebarMenuButton
                        isActive={
                          isActive
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

        <SidebarGroup className="p-0">
          <SidebarGroupLabel>
            Templates
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={
                    pathname ===
                    "/templates"
                  }
                  render={
                    <Link href="/templates" />
                  }
                >
                  <LayoutTemplate className="size-4" />

                  <span>
                    Browse templates
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
                  onClick={() =>
                    setTemplatesOpen(
                      (current) =>
                        !current
                    )
                  }
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
      </SidebarContent>
    </Sidebar>
  );
}