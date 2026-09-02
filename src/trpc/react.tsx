"use client";

import { createTRPCContext } from "@trpc/tanstack-react-query";

import type { AppRouter } from "./routers";

export const { TRPCProvider, useTRPC } =
  createTRPCContext<AppRouter>();
  