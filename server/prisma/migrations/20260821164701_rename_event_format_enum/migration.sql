-- Rename the enum type EventFormat → ExhibitionFormat.
--
-- Hand-written for the same reason as the table rename: `migrate dev` models an
-- enum rename as DROP COLUMN + ADD COLUMN, which would silently reset every
-- exhibition's format to the default. RENAME TYPE is metadata-only.
ALTER TYPE "EventFormat" RENAME TO "ExhibitionFormat";
