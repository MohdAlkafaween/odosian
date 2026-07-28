#!/bin/sh
set -e

# Seed only on first start (when DB doesn't exist yet) — seeding again would
# duplicate demo data and could clobber admin credentials someone changed.
FIRST_START=0
if [ ! -f /data/odosian.db ]; then
  FIRST_START=1
fi

# Sync schema on every start, not just the first. The DB file persists
# across redeploys via the k8s volume, so without this, any schema change
# made after initial deploy (new columns, new tables) never reaches a
# long-lived production database — routes touching those fields fail with
# raw "no such column" errors from SQLite, masked by generic 500 handlers.
echo "Syncing database schema..."
npx prisma db push --schema=prisma/schema.prisma --accept-data-loss --skip-generate

if [ "$FIRST_START" = "1" ]; then
  echo "Seeding database..."
  npx prisma db seed
  echo "Database initialized."
fi

exec "$@"
