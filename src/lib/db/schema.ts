import { sql } from "drizzle-orm";
import { boolean, date, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

// SPEC §5: saved specs, daily counts, budgets and rate limits. Every spec query is scoped by owner (guest) or user (SPEC §5, §17).

export const specs = pgTable(
  "specs",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    // Guest cookie that created the spec. Kept on claimed specs too (SPEC §5).
    ownerId: uuid("owner_id").notNull(),
    // Set for specs of a signed-in user (created while signed in, or claimed from the guest cookie). Better Auth ids are text.
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
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
  (table) => [index("specs_owner_id_idx").on(table.ownerId), index("specs_user_id_idx").on(table.userId)],
);

// Counts new specs per subject per UTC day. subject is `guest:<owner_id>` or `user:<user_id>` (SPEC §5).
export const usage = pgTable(
  "usage",
  {
    subject: text("subject").notNull(),
    day: date("day").notNull(),
    // New specs started on this day (SPEC §10, DAILY_SPEC_LIMIT and DAILY_SPEC_LIMIT_USER).
    specsStarted: integer("specs_started").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.subject, table.day] })],
);

// Provider requests across all owners per UTC day (SPEC §10, GLOBAL_DAILY_LLM_CALL_BUDGET).
export const llmBudget = pgTable("llm_budget", {
  day: date("day").primaryKey(),
  calls: integer("calls").notNull().default(0),
});

// Database-backed rate limit counters (SPEC §17). Works across serverless instances.
export const rateLimit = pgTable("rate_limit", {
  key: text("key").primaryKey(),
  failures: integer("failures").notNull().default(0),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
  blockedUntil: timestamp("blocked_until", { withTimezone: true }),
});

// Better Auth core tables (SPEC §17). Names and columns follow Better Auth's schema for the Drizzle adapter.
// `verification` is required by the library and never used, since email is not in use.
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  // Placeholder of the form <username>@users.invalid. The app never sends mail to it (SPEC §17).
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  // Username plugin: stored lower case, unique (SPEC §17).
  username: text("username").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    // The password hash, stored by Better Auth's credential provider.
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SpecRow = typeof specs.$inferSelect;
export type NewSpecRow = typeof specs.$inferInsert;
