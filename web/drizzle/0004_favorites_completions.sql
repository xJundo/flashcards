CREATE TABLE "course_completions" (
	"user_id" text NOT NULL,
	"course_id" uuid NOT NULL,
	"completed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "course_completions_user_id_course_id_pk" PRIMARY KEY("user_id","course_id")
);
--> statement-breakpoint
CREATE TABLE "course_favorites" (
	"user_id" text NOT NULL,
	"course_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "course_favorites_user_id_course_id_pk" PRIMARY KEY("user_id","course_id")
);
--> statement-breakpoint
ALTER TABLE "course_completions" ADD CONSTRAINT "course_completions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_completions" ADD CONSTRAINT "course_completions_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_favorites" ADD CONSTRAINT "course_favorites_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_favorites" ADD CONSTRAINT "course_favorites_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "course_completions_course_idx" ON "course_completions" USING btree ("course_id","completed_at");--> statement-breakpoint
CREATE INDEX "course_favorites_user_idx" ON "course_favorites" USING btree ("user_id","created_at");--> statement-breakpoint
-- Engrave the lessons already fully acquired, so nobody has to earn again what
-- they had before the table existed. The date is unknowable — `now()` is the
-- honest approximation. `3` is KNOWN_STREAK; the two must be changed together.
INSERT INTO "course_completions" ("user_id", "course_id")
SELECT wp."user_id", wp."course_id"
FROM "word_progress" wp
GROUP BY wp."user_id", wp."course_id"
HAVING count(*) FILTER (WHERE wp."streak" >= 3) = (
  SELECT count(*) FROM "words" w WHERE w."course_id" = wp."course_id"
)
ON CONFLICT DO NOTHING;