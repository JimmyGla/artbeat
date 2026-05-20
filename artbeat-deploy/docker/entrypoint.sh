#!/bin/sh
# ─── ArtBeat Server — Docker entrypoint ──────────────────────────────────────
# Runs database migrations (and optionally seeds) before starting the server.
# Executed inside the container by docker-compose.yml.

set -e

echo "⏳  Waiting for Postgres to be ready..."
# Give the db service time to finish initialising (health-check should handle
# this, but a short explicit pause helps on slow machines).
sleep 2

echo "🗄  Running Prisma migrations..."
npx prisma migrate deploy

# Seed the database only on first boot (flag file prevents re-seeding).
SEED_FLAG="/app/.seeded"

if [ "${SEED_DB:-false}" = "true" ] && [ ! -f "$SEED_FLAG" ]; then
  echo "🌱  Seeding database..."
  npx prisma db seed
  touch "$SEED_FLAG"
  echo "✅  Seed complete."
fi

echo "🚀  Starting ArtBeat server..."
exec node dist/index.js
