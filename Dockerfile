# syntax=docker/dockerfile:1
#
# Alias for Coolify when Dockerfile Location is /Dockerfile (repository root).
# Keep in sync with backend/Dockerfile. Build context MUST be the monorepo root.
#
# Production image for @somwave/backend (Express + Prisma + tsx).
#
#   docker build -f Dockerfile -t somwave-api .
#   docker build -f backend/Dockerfile -t somwave-api .
#
# Coolify:
#   Build Pack: Dockerfile
#   Base Directory: /
#   Dockerfile Location: /Dockerfile   (this file)  OR  /backend/Dockerfile

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

HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
