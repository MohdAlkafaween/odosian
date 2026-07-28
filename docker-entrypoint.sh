#!/bin/sh
set -e

# Run migrations and seed on first start (when DB doesn't exist yet)
if [ ! -f /data/odosian.db ]; then
  echo "Initializing database..."
  npx prisma db push --schema=prisma/schema.prisma
  npx prisma db seed
  echo "Database initialized."
fi

exec "$@"
