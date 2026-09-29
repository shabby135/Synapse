import {
  FolderKanban,
  History,
  Home,
  PlugZap,
  Star,
  Workflow,
} from "lucide-react";

export const navigation = [
  {
    title: "Home",
    href: "/dashboard",
    icon: Home,
  },
  {
    title: "Automations",
    href: "/automations",
    icon: Workflow,
  },
  {
    title: "Favorites",
    href: "/favorites",
    icon: Star,
  },
  {
    title: "Run history",
    href: "/runs",
    icon: History,
  },
  {
    title: "Workspaces",
    href: "/workspaces",
    icon: FolderKanban,
  },
  {
    title: "App connections",
    href: "/connections",
    icon: PlugZap,
  },
] as const;