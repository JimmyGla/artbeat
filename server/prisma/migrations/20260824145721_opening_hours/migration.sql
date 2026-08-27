-- Opening hours, plus the exceptions that override them.
--
-- Hand-written rather than generated: this adds tables and constraints only,
-- but the CHECKs below are the point of the migration and Prisma cannot express
-- them in the schema.

ALTER TABLE "Venue" ADD COLUMN "hoursSourceUrl" TEXT;
ALTER TABLE "Venue" ADD COLUMN "hoursCheckedAt" TIMESTAMP(3);

CREATE TABLE "OpeningHours" (
  "id"       TEXT    NOT NULL,
  "venueId"  TEXT    NOT NULL,
  "weekday"  INTEGER NOT NULL,
  "opensAt"  INTEGER NOT NULL,
  "closesAt" INTEGER NOT NULL,
  CONSTRAINT "OpeningHours_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OpeningHours_venueId_weekday_idx" ON "OpeningHours"("venueId", "weekday");

ALTER TABLE "OpeningHours"
  ADD CONSTRAINT "OpeningHours_venueId_fkey"
  FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 0 = Sunday .. 6 = Saturday, matching JS getDay().
ALTER TABLE "OpeningHours"
  ADD CONSTRAINT "OpeningHours_weekday_range"
  CHECK ("weekday" >= 0 AND "weekday" <= 6);

-- Minutes from local midnight. 1440 is allowed as a closing time so a venue
-- shutting exactly at midnight is representable.
ALTER TABLE "OpeningHours"
  ADD CONSTRAINT "OpeningHours_minutes_range"
  CHECK ("opensAt" >= 0 AND "opensAt" < 1440 AND "closesAt" > 0 AND "closesAt" <= 1440);

-- A range that ends before it starts would read as "open" for the whole day
-- under a naive comparison, which is the worst possible failure for this field.
ALTER TABLE "OpeningHours"
  ADD CONSTRAINT "OpeningHours_opens_before_closes"
  CHECK ("closesAt" > "opensAt");

CREATE TABLE "VenueClosure" (
  "id"      TEXT NOT NULL,
  "venueId" TEXT NOT NULL,
  "date"    DATE NOT NULL,
  "note"    TEXT,
  CONSTRAINT "VenueClosure_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VenueClosure_venueId_date_key" ON "VenueClosure"("venueId", "date");

ALTER TABLE "VenueClosure"
  ADD CONSTRAINT "VenueClosure_venueId_fkey"
  FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
