-- `runs.front_side` used to store the Korean-specific vocabulary
-- ("korean"/"translation"); the app now speaks "front"/"back" everywhere.
UPDATE "runs" SET "front_side" = 'front' WHERE "front_side" = 'korean';
UPDATE "runs" SET "front_side" = 'back' WHERE "front_side" = 'translation';
