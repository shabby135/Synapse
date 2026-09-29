import {
  CreditCard,
  History,
  Home,
  PlugZap,
  Settings,
  Users,
  Workflow,
} from "lucide-react";

export const navigation = [
  {
    title: "Home",
    href: "/dashboard",
    icon: Home,
  },
  {
    title: "Workflows",
    href: "/workspaces",
    icon: Workflow,
  },
] as const;

export const managementNavigation = [
  {
    title: "App connections",
    href:
      "/workspaces?section=connections",
    icon: PlugZap,
  },
  {
    title: "Run history",
    href:
      "/workspaces?section=runs",
    icon: History,
  },
  {
    title: "Team members",
    href:
      "/workspaces?section=members",
    icon: Users,
  },
  {
    title: "Billing & usage",
    href:
      "/workspaces?section=billing",
    icon: CreditCard,
  },
  {
    title: "Settings",
    href:
      "/workspaces?section=settings",
    icon: Settings,
  },
] as const;