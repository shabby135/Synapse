"use client";

import { useState } from "react";

import { QueryClientProvider } from "@tanstack/react-query";

import { TRPCProvider } from "@/trpc/react";
import { trpcClient } from "@/trpc/client";
import { makeQueryClient } from "@/trpc/query-client";

export function Providers({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = useState(makeQueryClient);

  return (
    <TRPCProvider
      trpcClient={trpcClient}
      queryClient={queryClient}
    >
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </TRPCProvider>
  );
}