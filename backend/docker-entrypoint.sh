#!/bin/sh
# Runtime entrypoint. Migrations need a live DATABASE_URL, so they run here
# (not during the image build). `prisma migrate deploy` is idempotent.
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "[entrypoint] DATABASE_URL is required at runtime" >&2
  exit 1
fi

npm run prisma:migrate
exec npm start
