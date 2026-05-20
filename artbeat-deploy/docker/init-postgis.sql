-- Enable PostGIS on the artbeat database.
-- This script runs automatically on first container start via
-- the docker-entrypoint-initdb.d mechanism.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
