import { sql } from "drizzle-orm";
import { date, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

// SPEC §5: saved specs and daily LLM run counts. Every query filters by owner_id.

export const specs = pgTable(
  "specs",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    ownerId: uuid("owner_id").notNull(),
    title: text("title").notNull(),
    rawRequest: text("raw_request").notNull(),
    questions: jsonb("questions"),
    answers: jsonb("answers"),
    spec: jsonb("spec"),
    status: text("status", {
      enum: ["draft", "questions_ready", "answered", "generating", "done", "failed"],
    }).notNull(),
    errorMessage: text("error_message"),
    provider: text("provider"),
    model: text("model"),
    promptVersion: text("prompt_version"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("specs_owner_id_idx").on(table.ownerId)],
);

export const usage = pgTable(
  "usage",
  {
    ownerId: uuid("owner_id").notNull(),
    day: date("day").notNull(),
    llmRuns: integer("llm_runs").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.ownerId, table.day] })],
);

export type SpecRow = typeof specs.$inferSelect;
export type NewSpecRow = typeof specs.$inferInsert;
