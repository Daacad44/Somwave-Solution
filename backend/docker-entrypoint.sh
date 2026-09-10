#!/bin/sh
# Runtime entrypoint. Migrations need a live DATABASE_URL, so they run here
# (not during the image build). `prisma migrate deploy` is idempotent.
set -eu

npm run prisma:migrate
exec npm start
