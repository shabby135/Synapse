import "dotenv/config";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

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
    max: 1,
    prepare: false,
  }
);

const database = drizzle(client);

try {
  console.log("Applying migrations...");

  await migrate(database, {
    migrationsFolder: "./drizzle",
  });

  console.log(
    "Migrations applied successfully."
  );
} finally {
  await client.end();
}
