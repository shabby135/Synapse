import {
  FolderKanban,
  Home,
  PlugZap,
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