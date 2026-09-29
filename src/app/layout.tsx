import type {
  Metadata,
} from "next";
import {
  GeistSans,
} from "geist/font/sans";
import {
  GeistMono,
} from "geist/font/mono";

import {
  Toaster,
} from "@/components/ui/sonner";
import {
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  ThemeProvider,
} from "@/providers/theme-provider";
import {
  Providers,
} from "@/providers/trpc-provider";

import "./globals.css";

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
        className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}
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