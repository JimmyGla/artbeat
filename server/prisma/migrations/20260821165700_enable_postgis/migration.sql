-- Enable PostGIS.
--
-- lib/geo.ts has always used ST_DWithin and the `geography` type, but the
-- extension was never installed, so GET /api/cities/:slug/exhibitions/nearby
-- returned 500 from the day it was written. Nothing in the app calls it yet,
-- which is why nobody noticed.
--
-- In a migration rather than run by hand so a fresh database gets it too.
CREATE EXTENSION IF NOT EXISTS postgis;
