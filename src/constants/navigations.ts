import {
  FolderKanban,
  LayoutDashboard,
} from "lucide-react";

export const navigation = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Workspaces",
    href: "/workspaces",
    icon: FolderKanban,
  },
] as const;