#!/bin/sh
set -e

FIRST_START=0
if [ ! -f /data/odosian.db ]; then
  FIRST_START=1
fi

echo "Syncing database schema..."
npx prisma db push --schema=prisma/schema.prisma --accept-data-loss

if [ "$FIRST_START" = "1" ]; then
  echo "Seeding database..."
  npx prisma db seed
  echo "Database initialized."
fi

exec "$@"
