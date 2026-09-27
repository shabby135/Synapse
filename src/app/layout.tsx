import { Toaster } from "@/components/ui/sonner";
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
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ThemeProvider>
          <Providers>
            <TooltipProvider>
              {children}
              <Toaster />
            </TooltipProvider>
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}