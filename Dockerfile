# syntax=docker/dockerfile:1
#
# Somwave API — production image for Coolify (Dockerfile build pack).
#
# Build context MUST be the monorepo root. @somwave/backend depends on the
# workspace package @somwave/shared (packages/shared). Docker cannot COPY
# files outside the context, so Base Directory must NOT be /backend.
#
#   docker build -t somwave-api .
#
# Coolify (this is the only supported path):
#   Build Pack:           Dockerfile
#   Base Directory:       /          (repository root, empty/default)
#   Dockerfile Location:  /Dockerfile
#   Port:                 4000
#   Domain:               https://api.somwave.botandev.com
#
# Runtime env (Coolify Runtime — never baked in):
#   NODE_ENV, PORT, DATABASE_URL, REDIS_URL, REDIS_PASSWORD, JWT_SECRET, CORS_ORIGINS
#
# Coolify Redis requires AUTH. Host-only REDIS_URL → NOAUTH → /health 503.
# Set REDIS_PASSWORD (or REDIS_URL=redis://:PASSWORD@<redis-uuid>:6379).
#
# `npm run build` is `tsc --noEmit` (no dist/). Start is `tsx src/server.ts`.
# Prisma Client is generated at build; `prisma migrate deploy` runs at startup.

FROM node:20-bookworm AS builder

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
COPY web/package.json ./web/
COPY backend/prisma ./backend/prisma

# postinstall = prisma generate. Generate does not connect; this URL is only
# for the RUN layer and is not the runtime DATABASE_URL.
RUN DATABASE_URL="postgresql://127.0.0.1:5432/build" \
  npm ci --workspace=@somwave/backend --workspace=@somwave/shared --include-workspace-root

COPY packages/shared ./packages/shared
COPY backend/src ./backend/src
COPY backend/tsconfig.json ./backend/
COPY --chmod=755 backend/docker-entrypoint.sh ./backend/docker-entrypoint.sh

RUN npm run build --workspace=@somwave/backend \
  && npm run typecheck --workspace=@somwave/shared \
  && npm prune --omit=dev --workspace=@somwave/backend --workspace=@somwave/shared --include-workspace-root

FROM node:20-bookworm-slim AS runner

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=4000

COPY --from=builder --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/packages ./packages
COPY --from=builder --chown=node:node /app/backend ./backend
COPY --from=builder --chown=node:node /app/tsconfig.base.json ./

USER node
WORKDIR /app/backend

EXPOSE 4000

# Existing route: GET /health (pings Postgres + Redis).
HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
