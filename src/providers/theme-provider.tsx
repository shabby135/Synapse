"use client";

import {
  ThemeProvider as NextThemeProvider,
} from "next-themes";
import type {
  ReactNode,
} from "react";

type ThemeProviderProps = {
  children: ReactNode;
};

export function ThemeProvider({
  children,
}: ThemeProviderProps) {
  return (
    <NextThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="synapse-theme"
    >
      {children}
    </NextThemeProvider>
  );
}