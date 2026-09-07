-- Every course predating spaces belongs to Korean lessons. File them all
-- under one default space and turn on the pronunciation UI they already
-- relied on, so nothing changes from a learner's point of view.
WITH default_space AS (
	INSERT INTO "spaces" ("title", "slug")
	VALUES ('Coréen', 'coreen')
	RETURNING "id"
)
UPDATE "courses"
SET "space_id" = (SELECT "id" FROM default_space),
	"speech_locale" = 'ko-KR'
WHERE "space_id" IS NULL;
