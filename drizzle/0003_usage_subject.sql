-- Usage is keyed by subject (SPEC §5): `guest:<owner_id>` for guests, `user:<user_id>` for signed-in users.
-- Existing rows belong to guests, so they are rewritten before the old column goes.
ALTER TABLE "usage" ADD COLUMN "subject" text;--> statement-breakpoint
UPDATE "usage" SET "subject" = 'guest:' || "owner_id"::text;--> statement-breakpoint
ALTER TABLE "usage" DROP CONSTRAINT "usage_owner_id_day_pk";--> statement-breakpoint
ALTER TABLE "usage" DROP COLUMN "owner_id";--> statement-breakpoint
ALTER TABLE "usage" ALTER COLUMN "subject" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "usage" ADD CONSTRAINT "usage_subject_day_pk" PRIMARY KEY("subject","day");
