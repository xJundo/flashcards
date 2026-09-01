CREATE TABLE "course_sheets" (
	"course_id" uuid PRIMARY KEY NOT NULL,
	"filename" text NOT NULL,
	"data" "bytea" NOT NULL,
	"size" integer NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "course_sheets" ADD CONSTRAINT "course_sheets_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;