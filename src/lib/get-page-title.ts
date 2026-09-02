export function getPageTitle(
  pathname: string
) {
  if (
    pathname === "/workspaces" ||
    pathname.startsWith("/workspaces/")
  ) {
    return "Workspaces";
  }

  if (
    pathname === "/documents" ||
    pathname.startsWith("/documents/")
  ) {
    return "Documents";
  }

  if (
    pathname === "/ai" ||
    pathname.startsWith("/ai/")
  ) {
    return "AI Assistant";
  }

  if (
    pathname === "/settings" ||
    pathname.startsWith("/settings/")
  ) {
    return "Settings";
  }

  if (pathname === "/dashboard") {
    return "Dashboard";
  }

  return "Synapse";
}