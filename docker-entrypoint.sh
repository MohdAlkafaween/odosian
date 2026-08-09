#!/bin/sh
set -e

echo "Syncing database schema..."
npx prisma db push --schema=prisma/schema.prisma --accept-data-loss

# Checking file existence isn't enough — db push above always creates
# odosian.db the moment it runs, even on a schema with zero rows. If a pod
# gets killed (OOM, crash, restart) after db push but before db seed
# finishes, the file already exists on the next start and seeding would be
# skipped forever even though nothing was ever actually seeded. Check for
# real data instead.
USER_COUNT=$(node -e "
const Database = require('better-sqlite3');
try {
  const db = new Database('/data/odosian.db');
  console.log(db.prepare('SELECT COUNT(*) c FROM User').get().c);
} catch (e) {
  console.log(0);
}
" 2>/dev/null || echo 0)

if [ "$USER_COUNT" = "0" ]; then
  echo "No users found — seeding database..."
  npx prisma db seed
  echo "Database initialized."
fi

exec "$@"
