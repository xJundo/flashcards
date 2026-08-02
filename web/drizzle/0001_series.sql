--> Old series only ever stored a score, so they cannot be given the recap the
--> UI now expects. They are dropped rather than shown as empty — which also
--> lets "size" be added as NOT NULL without a default.
DELETE FROM "runs";--> statement-breakpoint
CREATE TABLE "run_words" (
	"run_id" uuid NOT NULL,
	"word_id" uuid NOT NULL,
	"known" boolean NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "run_words_run_id_word_id_pk" PRIMARY KEY("run_id","word_id")
);
--> statement-breakpoint
CREATE TABLE "word_progress" (
	"user_id" text NOT NULL,
	"word_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"streak" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "word_progress_user_id_word_id_pk" PRIMARY KEY("user_id","word_id")
);
--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "size" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "completed" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "front_side" text DEFAULT 'korean' NOT NULL;--> statement-breakpoint
ALTER TABLE "run_words" ADD CONSTRAINT "run_words_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_words" ADD CONSTRAINT "run_words_word_id_words_id_fk" FOREIGN KEY ("word_id") REFERENCES "public"."words"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "word_progress" ADD CONSTRAINT "word_progress_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "word_progress" ADD CONSTRAINT "word_progress_word_id_words_id_fk" FOREIGN KEY ("word_id") REFERENCES "public"."words"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "word_progress" ADD CONSTRAINT "word_progress_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "word_progress_course_idx" ON "word_progress" USING btree ("user_id","course_id");--> statement-breakpoint
--> Words already flagged for review carry over with a streak of 0, which is
--> exactly what "due for review" means under the new rule.
INSERT INTO "word_progress" ("user_id", "word_id", "course_id", "streak", "updated_at")
SELECT "user_id", "word_id", "course_id", 0, "created_at" FROM "review_words"
ON CONFLICT DO NOTHING;