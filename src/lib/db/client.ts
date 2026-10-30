import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import type { Db } from "./repo";

// Creates a connection to the Postgres database in DATABASE_URL (Neon in production).
// Called once per process so serverless warm starts reuse the connection.
export function createDb(url: string): Db {
  return drizzle(postgres(url, { max: 1 }), { schema });
}
