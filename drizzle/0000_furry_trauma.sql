CREATE TABLE "specs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"title" text NOT NULL,
	"raw_request" text NOT NULL,
	"questions" jsonb,
	"answers" jsonb,
	"spec" jsonb,
	"status" text NOT NULL,
	"error_message" text,
	"provider" text,
	"model" text,
	"prompt_version" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage" (
	"owner_id" uuid NOT NULL,
	"day" date NOT NULL,
	"llm_runs" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "usage_owner_id_day_pk" PRIMARY KEY("owner_id","day")
);
--> statement-breakpoint
CREATE INDEX "specs_owner_id_idx" ON "specs" USING btree ("owner_id");