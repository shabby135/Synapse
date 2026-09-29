import "server-only";

import {
  setDefaultResultOrder,
} from "node:dns";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/lib/db/schema";

setDefaultResultOrder("ipv4first");

const connectionString =
  process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not configured."
  );
}

const client = postgres(
  connectionString,
  {
    prepare: false,
    connect_timeout: 15,
    idle_timeout: 20,
    max_lifetime: 60 * 30,
  }
);

export const db = drizzle(
  client,
  {
    schema,
  }
);