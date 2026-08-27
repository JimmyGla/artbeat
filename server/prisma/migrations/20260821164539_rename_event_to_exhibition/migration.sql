-- Rename Event → Exhibition throughout.
--
-- Every statement is ALTER ... RENAME: metadata-only in Postgres, instant, and
-- lossless. No table is rewritten and no row is touched. Written by hand
-- because `prisma migrate dev` models a rename as DROP + CREATE, which would
-- destroy the data.
--
-- Indexes and constraints are renamed too. Prisma matches those by name, so
-- leaving them as "Event_*" would make every future `migrate diff` non-empty.

-- ── Tables ─────────────────────────────────────────────────────────────────
ALTER TABLE "Event"        RENAME TO "Exhibition";
ALTER TABLE "EventArtForm" RENAME TO "ExhibitionArtForm";

-- ── Foreign-key columns ────────────────────────────────────────────────────
-- Postgres rewrites dependent CHECK expressions automatically (they reference
-- columns by number, not name), so Favorite_exactly_one_target still holds.
ALTER TABLE "ExhibitionArtForm" RENAME COLUMN "eventId" TO "exhibitionId";
ALTER TABLE "Favorite"          RENAME COLUMN "eventId" TO "exhibitionId";
ALTER TABLE "Bookmark"          RENAME COLUMN "eventId" TO "exhibitionId";

-- ── Constraints ────────────────────────────────────────────────────────────
ALTER TABLE "Exhibition" RENAME CONSTRAINT "Event_pkey"                   TO "Exhibition_pkey";
ALTER TABLE "Exhibition" RENAME CONSTRAINT "Event_categoryId_fkey"        TO "Exhibition_categoryId_fkey";
ALTER TABLE "Exhibition" RENAME CONSTRAINT "Event_parentId_fkey"          TO "Exhibition_parentId_fkey";
ALTER TABLE "Exhibition" RENAME CONSTRAINT "Event_venueId_fkey"           TO "Exhibition_venueId_fkey";
ALTER TABLE "Exhibition" RENAME CONSTRAINT "Event_temporary_needs_start"  TO "Exhibition_temporary_needs_start";
ALTER TABLE "Exhibition" RENAME CONSTRAINT "Event_permanent_has_no_dates" TO "Exhibition_permanent_has_no_dates";

ALTER TABLE "ExhibitionArtForm" RENAME CONSTRAINT "EventArtForm_pkey"           TO "ExhibitionArtForm_pkey";
ALTER TABLE "ExhibitionArtForm" RENAME CONSTRAINT "EventArtForm_artFormId_fkey" TO "ExhibitionArtForm_artFormId_fkey";
ALTER TABLE "ExhibitionArtForm" RENAME CONSTRAINT "EventArtForm_eventId_fkey"   TO "ExhibitionArtForm_exhibitionId_fkey";

ALTER TABLE "Favorite" RENAME CONSTRAINT "Favorite_eventId_fkey"       TO "Favorite_exhibitionId_fkey";

ALTER TABLE "Bookmark" RENAME CONSTRAINT "Bookmark_eventId_fkey"       TO "Bookmark_exhibitionId_fkey";

-- ── Indexes ────────────────────────────────────────────────────────────────
-- Including the unique ones: Prisma implements @unique and @@unique as unique
-- INDEXES rather than table constraints, so RENAME CONSTRAINT does not find
-- them.
ALTER INDEX "Event_sourceUrl_key"          RENAME TO "Exhibition_sourceUrl_key";
ALTER INDEX "Favorite_userId_eventId_key"  RENAME TO "Favorite_userId_exhibitionId_key";
ALTER INDEX "Bookmark_userId_eventId_key"  RENAME TO "Bookmark_userId_exhibitionId_key";
ALTER INDEX "Event_run_endDate_idx"        RENAME TO "Exhibition_run_endDate_idx";
ALTER INDEX "Event_venueId_idx"            RENAME TO "Exhibition_venueId_idx";
ALTER INDEX "EventArtForm_artFormId_idx"   RENAME TO "ExhibitionArtForm_artFormId_idx";
