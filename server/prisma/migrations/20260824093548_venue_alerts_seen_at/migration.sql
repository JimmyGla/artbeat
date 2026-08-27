-- Marks how far the user has read the "new at your places" list.
--
-- Nullable with no backfill and no default: NULL means "never looked", which
-- the API reads as "since you signed up". Defaulting to now() would instead
-- silently mark every existing user as caught up, and defaulting to the epoch
-- would greet them with every exhibition ever scraped.
ALTER TABLE "User" ADD COLUMN "venueAlertsSeenAt" TIMESTAMP(3);
