ALTER TABLE "word_progress" ADD COLUMN "hits" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "word_progress" ADD COLUMN "misses" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Seed the tallies from the series still on record. It is the best that can be
-- reconstructed: history older than the cap, or erased by hand, is gone.
UPDATE "word_progress" AS wp
SET "hits" = tally.hits, "misses" = tally.misses
FROM (
  SELECT
    r."user_id" AS user_id,
    rw."word_id" AS word_id,
    count(*) FILTER (WHERE rw."known") AS hits,
    count(*) FILTER (WHERE NOT rw."known") AS misses
  FROM "run_words" rw
  JOIN "runs" r ON r."id" = rw."run_id"
  GROUP BY r."user_id", rw."word_id"
) AS tally
WHERE wp."user_id" = tally.user_id AND wp."word_id" = tally.word_id;
