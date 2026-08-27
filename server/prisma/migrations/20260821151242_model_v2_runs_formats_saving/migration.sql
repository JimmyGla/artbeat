-- CreateEnum
CREATE TYPE "VenueKind" AS ENUM ('MUSEUM', 'GALLERY', 'HOUSE_MUSEUM', 'ARTIST_RESIDENCY', 'CHURCH', 'HISTORIC_BUILDING', 'FOUNDATION', 'THEATER', 'OTHER');

-- CreateEnum
CREATE TYPE "RunKind" AS ENUM ('PERMANENT', 'TEMPORARY');

-- CreateEnum
CREATE TYPE "EventFormat" AS ENUM ('EXHIBITION', 'OPENING', 'PERFORMANCE', 'WORKSHOP', 'TALK', 'SCREENING');

-- CreateEnum
CREATE TYPE "Admission" AS ENUM ('FREE', 'PAID', 'UNKNOWN');

-- DropForeignKey
ALTER TABLE "Event" DROP CONSTRAINT "Event_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "Favorite" DROP CONSTRAINT "Favorite_eventId_fkey";

-- DropForeignKey
ALTER TABLE "Favorite" DROP CONSTRAINT "Favorite_userId_fkey";

-- AlterTable
ALTER TABLE "City" ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Europe/Rome';

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "admission" "Admission" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "format" "EventFormat" NOT NULL DEFAULT 'EXHIBITION',
ADD COLUMN     "lastSeenAt" TIMESTAMP(3),
ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "priceCents" INTEGER,
ADD COLUMN     "run" "RunKind" NOT NULL DEFAULT 'TEMPORARY',
ADD COLUMN     "sourceName" TEXT,
ADD COLUMN     "sourceUrl" TEXT,
ALTER COLUMN "description" SET DEFAULT '',
ALTER COLUMN "startDate" DROP NOT NULL,
ALTER COLUMN "startDate" SET DATA TYPE DATE,
ALTER COLUMN "endDate" SET DATA TYPE DATE,
ALTER COLUMN "categoryId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Favorite" ADD COLUMN     "venueId" TEXT,
ALTER COLUMN "eventId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Venue" ADD COLUMN     "kind" "VenueKind" NOT NULL DEFAULT 'OTHER';

-- CreateTable
CREATE TABLE "ArtForm" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "color" TEXT NOT NULL,

    CONSTRAINT "ArtForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventArtForm" (
    "eventId" TEXT NOT NULL,
    "artFormId" TEXT NOT NULL,

    CONSTRAINT "EventArtForm_pkey" PRIMARY KEY ("eventId","artFormId")
);

-- CreateTable
CREATE TABLE "Bookmark" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "remindAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bookmark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ArtForm_slug_key" ON "ArtForm"("slug");

-- CreateIndex
CREATE INDEX "EventArtForm_artFormId_idx" ON "EventArtForm"("artFormId");

-- CreateIndex
CREATE UNIQUE INDEX "Bookmark_userId_eventId_key" ON "Bookmark"("userId", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "Event_sourceUrl_key" ON "Event"("sourceUrl");

-- CreateIndex
CREATE INDEX "Event_run_endDate_idx" ON "Event"("run", "endDate");

-- CreateIndex
CREATE INDEX "Event_venueId_idx" ON "Event"("venueId");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_venueId_key" ON "Favorite"("userId", "venueId");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventArtForm" ADD CONSTRAINT "EventArtForm_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventArtForm" ADD CONSTRAINT "EventArtForm_artFormId_fkey" FOREIGN KEY ("artFormId") REFERENCES "ArtForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ═══════════════════════════════════════════════════════════════════════════
-- Backfill. Order matters: every statement below depends on columns created
-- above, and the favourite split depends on `run` already being set.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Venue.kind ─────────────────────────────────────────────────────────────
-- Start from the old enum, then refine by name. A flat type→kind copy would
-- file every foundation and palazzo as OTHER, throwing away the distinction
-- the new enum exists to capture.
UPDATE "Venue" SET "kind" = CASE "type"
  WHEN 'MUSEUM'  THEN 'MUSEUM'::"VenueKind"
  WHEN 'GALLERY' THEN 'GALLERY'::"VenueKind"
  WHEN 'THEATER' THEN 'THEATER'::"VenueKind"
  ELSE 'OTHER'::"VenueKind"
END;

UPDATE "Venue" SET "kind" = 'FOUNDATION'::"VenueKind"        WHERE "name" ILIKE 'Fondazione%';
UPDATE "Venue" SET "kind" = 'HISTORIC_BUILDING'::"VenueKind" WHERE "name" ILIKE 'Palazzo%' OR "name" ILIKE 'Castello%' OR "name" ILIKE 'Rotonda%';
UPDATE "Venue" SET "kind" = 'HOUSE_MUSEUM'::"VenueKind"      WHERE "name" ILIKE '%Necchi%' OR "name" ILIKE '%Poldi Pezzoli%' OR "name" ILIKE '%Bagatti Valsecchi%' OR "name" ILIKE '%Morando%';
UPDATE "Venue" SET "kind" = 'THEATER'::"VenueKind"           WHERE "name" ILIKE '%Teatro%' OR "name" ILIKE '%Scala%';

-- ── Event.format from the old category ─────────────────────────────────────
-- The four existing slugs already are formats, which is why this split is cheap.
UPDATE "Event" e SET "format" = CASE c."slug"
  WHEN 'opening'     THEN 'OPENING'::"EventFormat"
  WHEN 'performance' THEN 'PERFORMANCE'::"EventFormat"
  WHEN 'workshop'    THEN 'WORKSHOP'::"EventFormat"
  ELSE 'EXHIBITION'::"EventFormat"
END
FROM "Category" c WHERE e."categoryId" = c."id";

-- ── Event.admission ────────────────────────────────────────────────────────
-- Deliberately NOT deriving free from a null price. `price = null` currently
-- means both "free" and "could not parse", so asserting FREE would invent
-- data. UNKNOWN is the honest value; the next scrape resolves it.
UPDATE "Event" SET "admission" = 'PAID'::"Admission",
                   "priceCents" = ROUND("price" * 100)::INTEGER
WHERE "price" IS NOT NULL AND "price" > 0;

UPDATE "Event" SET "admission" = 'FREE'::"Admission" WHERE "price" = 0;
-- everything else keeps the UNKNOWN default

-- ── Event provenance ───────────────────────────────────────────────────────
-- ticketUrl has always held the scraped detail URL, so it is the natural
-- stable identity. Verified free of duplicates before adding the constraint.
UPDATE "Event" SET "sourceUrl" = "ticketUrl" WHERE "ticketUrl" IS NOT NULL;
UPDATE "Event" SET "sourceName" = regexp_replace("ticketUrl", '^https?://(www\.)?([^/]+).*$', '\2')
  WHERE "ticketUrl" IS NOT NULL;
-- Best available proxy: we have never recorded when a row was last confirmed.
UPDATE "Event" SET "lastSeenAt" = "updatedAt" WHERE "lastSeenAt" IS NULL;

-- ── Seed art forms ─────────────────────────────────────────────────────────
-- Colours chosen to stay distinguishable as map pins.
INSERT INTO "ArtForm" ("id", "name", "slug", "color") VALUES
  (gen_random_uuid(), 'Photography',  'photography',  '#0EA5E9'),
  (gen_random_uuid(), 'Painting',     'painting',     '#7C3AED'),
  (gen_random_uuid(), 'Sculpture',    'sculpture',    '#D97706'),
  (gen_random_uuid(), 'Design',       'design',       '#059669'),
  (gen_random_uuid(), 'Performance',  'performance',  '#DB2777'),
  (gen_random_uuid(), 'Installation', 'installation', '#6366F1'),
  (gen_random_uuid(), 'Video',        'video',        '#0891B2'),
  (gen_random_uuid(), 'Drawing',      'drawing',      '#78716C'),
  (gen_random_uuid(), 'Architecture', 'architecture', '#B45309'),
  (gen_random_uuid(), 'Textile',      'textile',      '#C026D3')
ON CONFLICT ("slug") DO NOTHING;

-- ── Split existing favourites ──────────────────────────────────────────────
-- Hearts on TEMPORARY events become bookmarks; hearts on PERMANENT ones stay.
-- Fully determined by `run`, which the steps above have already set.
INSERT INTO "Bookmark" ("id", "userId", "eventId", "createdAt")
SELECT gen_random_uuid(), f."userId", f."eventId", f."createdAt"
FROM "Favorite" f
JOIN "Event" e ON e."id" = f."eventId"
WHERE f."eventId" IS NOT NULL AND e."run" = 'TEMPORARY'
ON CONFLICT ("userId", "eventId") DO NOTHING;

DELETE FROM "Favorite" f
USING "Event" e
WHERE f."eventId" = e."id" AND e."run" = 'TEMPORARY';

-- ═══════════════════════════════════════════════════════════════════════════
-- Invariants the application must not be able to forget.
-- ═══════════════════════════════════════════════════════════════════════════

-- A temporary run without a start date is meaningless.
ALTER TABLE "Event" ADD CONSTRAINT "Event_temporary_needs_start"
  CHECK ("run" = 'PERMANENT' OR "startDate" IS NOT NULL);

-- A permanent run has no dates to have.
ALTER TABLE "Event" ADD CONSTRAINT "Event_permanent_has_no_dates"
  CHECK ("run" = 'TEMPORARY' OR ("startDate" IS NULL AND "endDate" IS NULL));

-- Exclusive arc: a heart targets exactly one thing.
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_exactly_one_target"
  CHECK (("eventId" IS NOT NULL)::int + ("venueId" IS NOT NULL)::int = 1);
