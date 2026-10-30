import { sql } from "drizzle-orm";
import { date, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

// SPEC §5: saved specs and daily counts of new specs. Every query filters by owner_id.

export const specs = pgTable(
  "specs",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    ownerId: uuid("owner_id").notNull(),
    title: text("title").notNull(),
    rawRequest: text("raw_request").notNull(),
    // The adaptive interview (SPEC §6). Null for legacy specs.
    interview: jsonb("interview"),
    // Legacy only: the v1 question flow (SPEC §10). Read-only.
    questions: jsonb("questions"),
    answers: jsonb("answers"),
    spec: jsonb("spec"),
    status: text("status", {
      enum: [
        "draft",
        "interviewing",
        "interview_done",
        "generating",
        "done",
        "failed",
        // Legacy values from the v1 question flow.
        "questions_ready",
        "answered",
      ],
    }).notNull(),
    // AI requests made for this spec, checked against MAX_LLM_CALLS_PER_SPEC (SPEC §10).
    llmCalls: integer("llm_calls").notNull().default(0),
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
    // New specs started on this day (SPEC §10, DAILY_SPEC_LIMIT).
    specsStarted: integer("specs_started").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.ownerId, table.day] })],
);

export type SpecRow = typeof specs.$inferSelect;
export type NewSpecRow = typeof specs.$inferInsert;
