import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { Db } from "@/lib/db/repo";
import * as schema from "@/lib/db/schema";

// A real Postgres (PGlite, in-process) with every migration in drizzle/ applied. Each call gives a fresh database.
export async function testDb(): Promise<Db> {
  const client = new PGlite();
  const instance = drizzle(client, { schema });
  await migrate(instance, { migrationsFolder: "./drizzle" });
  // PGlite and postgres-js share the query API; the cast only bridges their driver types.
  return instance as unknown as Db;
}
