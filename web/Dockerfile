# syntax=docker/dockerfile:1
#
# Somwave public website — production image for Coolify (Astro + Node adapter).
#
# This app is hybrid static/SSR. CMS-backed pages set `prerender = false` and
# fetch @somwave/shared public API data on each request. Nginx-only would drop
# those routes. The Node standalone adapter serves prerendered HTML from
# dist/client and SSR from dist/server/entry.mjs.
#
# Build context MUST be the monorepo root. @somwave/web depends on
# packages/shared. Docker cannot COPY files outside the context, so Base
# Directory must NOT be /web.
#
#   docker build -f web/Dockerfile -t somwave-web .
#
# Coolify (this is the only supported path for the public site):
#   Build Pack:           Dockerfile
#   Base Directory:       /          (repository root, empty/default)
#   Dockerfile Location:  /web/Dockerfile
#   Port:                 4321
#   Domain:               https://somwave.botandev.com
#
# Do NOT set Dockerfile Location to /Dockerfile (API) or /frontend/Dockerfile.
#
# Buildtime env (Coolify Buildtime — Astro inlines PUBLIC_* at `astro build`):
#   PUBLIC_SITE_URL=https://somwave.botandev.com
#   PUBLIC_API_URL=https://api.somwave.botandev.com/api/v1
#
# Runtime env:
#   HOST=0.0.0.0  PORT=4321  NODE_ENV=production
# Secrets must never be passed as PUBLIC_*.

FROM node:20-bookworm AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY web/package.json ./web/
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/

# DevDependencies (@astrojs/check) are not required to produce dist/, but
# workspace install must not omit the packages Astro needs to compile.
RUN npm ci --workspace=@somwave/web --workspace=@somwave/shared --include-workspace-root

COPY packages/shared ./packages/shared
COPY web ./web

ARG PUBLIC_SITE_URL=https://somwave.botandev.com
ARG PUBLIC_API_URL=https://api.somwave.botandev.com/api/v1
ENV PUBLIC_SITE_URL=$PUBLIC_SITE_URL
ENV PUBLIC_API_URL=$PUBLIC_API_URL

RUN if [ -z "$PUBLIC_SITE_URL" ] || [ -z "$PUBLIC_API_URL" ]; then \
      echo "[web] PUBLIC_SITE_URL and PUBLIC_API_URL are required at image build time" >&2; \
      exit 1; \
    fi \
  && npm run build --workspace=@somwave/web \
  && npm run typecheck --workspace=@somwave/shared \
  && npm prune --omit=dev --workspace=@somwave/web --workspace=@somwave/shared --include-workspace-root \
  && test -d web/node_modules/send \
  && test -d web/node_modules/cookie

FROM node:20-bookworm-slim AS runner

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321

COPY --from=builder --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/packages ./packages
COPY --from=builder --chown=node:node /app/web/package.json ./web/
COPY --from=builder --chown=node:node /app/web/dist ./web/dist
# Nested workspace installs. The lockfile cannot hoist send@1.2.1 or
# cookie@1.1.1 to /app/node_modules because Express pins send@0.19 and
# cookie@0.7 at the repo root. Those packages therefore live under
# web/node_modules. Astro's SSR adapter emits bare `import 'send'` /
# `import 'cookie'` from dist/server/chunks — Node walks up from that
# file and never looks inside astro/node_modules or
# @astrojs/node/node_modules. Omitting this COPY is the Coolify
# ERR_MODULE_NOT_FOUND for `send`.
COPY --from=builder --chown=node:node /app/web/node_modules ./web/node_modules

# Resolve the adapter externals from the same directory as the generated
# chunk, so a missing runtime package fails `docker build` instead of the
# Coolify healthcheck.
WORKDIR /app/web/dist/server/chunks
RUN node --input-type=module -e "import 'send'; import 'cookie'; import 'server-destroy';"

USER node
WORKDIR /app/web

EXPOSE 4321

# Static homepage is prerendered, so / stays 200 even if the API is down.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4321)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "./dist/server/entry.mjs"]
