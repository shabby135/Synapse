import type { Metadata } from "next";
import {
  Geist,
  Geist_Mono,
} from "next/font/google";

import { ThemeProvider } from "@/providers/theme-provider";
import { Providers } from "@/providers/trpc-provider";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Synapse",
    template: "%s | Synapse",
  },
  description:
    "Build and run reliable automated workflows.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
    >
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-svh bg-background font-sans text-foreground antialiased`}
      >
        <ThemeProvider>
          <Providers>
            <TooltipProvider>
              {children}

              <Toaster
                position="bottom-right"
                richColors
                closeButton
              />
            </TooltipProvider>
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}