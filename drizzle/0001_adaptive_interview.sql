ALTER TABLE "specs" ADD COLUMN "interview" jsonb;--> statement-breakpoint
ALTER TABLE "specs" ADD COLUMN "llm_calls" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- usage.llm_runs counted provider runs. It becomes specs_started (new specs per day, SPEC §10).
-- The old counts mean something else, so they are reset rather than carried over.
ALTER TABLE "usage" RENAME COLUMN "llm_runs" TO "specs_started";--> statement-breakpoint
UPDATE "usage" SET "specs_started" = 0;
