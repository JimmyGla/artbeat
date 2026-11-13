-- Close Supabase's auto-generated data API (PostgREST / GraphQL) over our tables.
--
-- Supabase exposes every table in `public` to the `anon` and `authenticated`
-- roles, and the anon key ships inside the app. With RLS off, anyone holding
-- that key could read "User" or delete "Exhibition" without touching our API.
--
-- The app never uses the data API: the client only calls supabase.auth, and
-- the server reads and writes through Prisma as the table owner, which RLS
-- does not restrict. So: RLS on with no policies (deny all), and the grants
-- removed as a second lock.
--
-- Every statement is safe to run twice; this was applied by hand to production
-- on 2026-11-13 before the deploy pipeline existed.

ALTER TABLE "_prisma_migrations"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "City"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Venue"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OpeningHours"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VenueClosure"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Category"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Exhibition"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ArtForm"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExhibitionArtForm"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Favorite"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Bookmark"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TelemetryEvent"      ENABLE ROW LEVEL SECURITY;

-- `anon` / `authenticated` exist only on Supabase, not in local or CI Postgres.
-- spatial_ref_sys belongs to PostGIS (owned by supabase_admin) and is public
-- reference data, so it is left alone.
DO $$
DECLARE
  r text;
  t text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      FOR t IN
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tableowner = current_user
      LOOP
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', t, r);
      END LOOP;
      -- Tables created by later migrations start without the grant too.
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', r);
    END IF;
  END LOOP;
END $$;
