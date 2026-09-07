ALTER TABLE "words" RENAME TO "cards";--> statement-breakpoint
ALTER TABLE "cards" RENAME COLUMN "korean" TO "front";--> statement-breakpoint
ALTER TABLE "cards" RENAME COLUMN "romanization" TO "phonetic";--> statement-breakpoint
ALTER TABLE "cards" RENAME COLUMN "translation" TO "back";--> statement-breakpoint
ALTER TABLE "card_images" DROP CONSTRAINT "card_images_card_id_words_id_fk";
--> statement-breakpoint
ALTER TABLE "run_words" DROP CONSTRAINT "run_words_word_id_words_id_fk";
--> statement-breakpoint
ALTER TABLE "word_progress" DROP CONSTRAINT "word_progress_word_id_words_id_fk";
--> statement-breakpoint
ALTER TABLE "cards" DROP CONSTRAINT "words_course_id_courses_id_fk";
--> statement-breakpoint
DROP INDEX "words_course_idx";--> statement-breakpoint
ALTER TABLE "courses" ALTER COLUMN "space_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "runs" ALTER COLUMN "front_side" SET DEFAULT 'front';--> statement-breakpoint
ALTER TABLE "card_images" ADD CONSTRAINT "card_images_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_words" ADD CONSTRAINT "run_words_word_id_cards_id_fk" FOREIGN KEY ("word_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "word_progress" ADD CONSTRAINT "word_progress_word_id_cards_id_fk" FOREIGN KEY ("word_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cards_course_idx" ON "cards" USING btree ("course_id","position");