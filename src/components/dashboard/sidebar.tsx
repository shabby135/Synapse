"use client";

import {
  useEffect,
  useRef,
  useState,
  type FocusEvent,
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
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import {
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
  readonly TemplateNavigationItem[] =
    [
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
        title:
          "Issue escalation",

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

function isNavigationItemActive(
  pathname: string,
  href: string
): boolean {
  if (href === "/dashboard") {
    return pathname === href;
  }

  return (
    pathname === href ||
    pathname.startsWith(
      `${href}/`
    )
  );
}

export function AppSidebar() {
  const pathname = usePathname();

  const {
    isMobile,
    setOpen,
  } = useSidebar();

  const collapseTimer =
    useRef<
      ReturnType<
        typeof setTimeout
      > | null
    >(null);

  const [
    templatesOpen,
    setTemplatesOpen,
  ] = useState(
    pathname === "/templates"
  );

  function clearCollapseTimer() {
    if (!collapseTimer.current) {
      return;
    }

    clearTimeout(
      collapseTimer.current
    );

    collapseTimer.current =
      null;
  }

  function expandSidebar() {
    if (isMobile) {
      return;
    }

    clearCollapseTimer();
    setOpen(true);
  }

  function scheduleSidebarCollapse() {
    if (isMobile) {
      return;
    }

    clearCollapseTimer();

    collapseTimer.current =
      setTimeout(() => {
        setOpen(false);

        collapseTimer.current =
          null;
      }, 180);
  }

  function handleSidebarBlur(
    event: FocusEvent<HTMLElement>
  ) {
    const nextElement =
      event.relatedTarget;

    if (
      nextElement instanceof
        Node &&
      event.currentTarget.contains(
        nextElement
      )
    ) {
      return;
    }

    scheduleSidebarCollapse();
  }

  useEffect(() => {
    return () => {
      const timer =
        collapseTimer.current;

      if (timer) {
        clearTimeout(timer);
      }
    };
  }, []);

  return (
    <Sidebar
      collapsible="icon"
      onMouseEnter={
        expandSidebar
      }
      onMouseLeave={
        scheduleSidebarCollapse
      }
      onFocusCapture={
        expandSidebar
      }
      onBlurCapture={
        handleSidebarBlur
      }
    >
      <SidebarHeader className="border-b p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="Synapse home"
              render={
                <Link href="/dashboard" />
              }
              className="h-11 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-foreground text-sm font-bold text-background">
                S
              </span>

              <span className="truncate text-base font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
                Synapse
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <SidebarMenu className="mt-1">
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="Create automation"
              render={
                <Link href="/workspaces?create=assistant" />
              }
              className="h-10 bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
            >
              <Plus className="size-4 shrink-0" />

              <span className="truncate group-data-[collapsible=icon]:hidden">
                Create automation
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
                    isNavigationItemActive(
                      pathname,
                      item.href
                    );

                  return (
                    <SidebarMenuItem
                      key={
                        item.href
                      }
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
                        className="group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
                      >
                        <Icon className="size-4 shrink-0" />

                        <span className="truncate group-data-[collapsible=icon]:hidden">
                          {
                            item.title
                          }
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
                  className="group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
                >
                  <LayoutTemplate className="size-4 shrink-0" />

                  <span className="truncate group-data-[collapsible=icon]:hidden">
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
                  className="group-data-[collapsible=icon]:hidden"
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
                  <SidebarMenuSub className="group-data-[collapsible=icon]:hidden">
                    {templateNavigation.map(
                      (
                        template
                      ) => (
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

      <SidebarRail />
    </Sidebar>
  );
}