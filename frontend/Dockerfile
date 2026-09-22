# syntax=docker/dockerfile:1
#
# Somwave dashboard — production image for Coolify (React + Vite SPA).
#
# Build context MUST be the monorepo root. @somwave/frontend depends on the
# workspace package @somwave/shared (packages/shared). Docker cannot COPY
# files outside the context, so Base Directory must NOT be /frontend.
#
#   docker build -f frontend/Dockerfile -t somwave-frontend .
#
# Coolify (this is the only supported path for the dashboard app):
#   Build Pack:           Dockerfile
#   Base Directory:       /          (repository root, empty/default)
#   Dockerfile Location:  /frontend/Dockerfile
#   Port:                 80
#   Domain:               https://app.somwave.botandev.com
#
# Do NOT set Dockerfile Location to /Dockerfile — that file is the API image.
#
# Auth cookies must be first-party. This image's nginx proxies /api/ to
# https://api.somwave.botandev.com, so the bundle MUST call /api/v1 (same origin).
# An absolute VITE_API_URL to api.* makes login look like it works, then /auth/me
# has no cookie and the SPA returns to /login.
#
# Coolify Buildtime: VITE_API_URL=/api/v1
# (If the old absolute API origin is still set, this Dockerfile overrides it.)
#
# Runtime env is unused except nginx's outbound proxy to the API hostname.
# Secrets must never be passed as VITE_*.

FROM node:20-bookworm AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/
COPY web/package.json ./web/

# DevDependencies (vite, typescript, tailwind) are required to produce dist/.
# Do not set NODE_ENV=production before npm ci — that would omit them.
RUN npm ci --workspace=@somwave/frontend --workspace=@somwave/shared --include-workspace-root

COPY packages/shared ./packages/shared
COPY frontend ./frontend

# Always same-origin in this image. Coolify ARG/Buildtime cannot override —
# an absolute api.* URL reintroduces the portal login cookie failure.
ARG VITE_API_URL=/api/v1
ENV VITE_API_URL=/api/v1

RUN if [ -z "$VITE_API_URL" ]; then \
      echo "[frontend] VITE_API_URL is required at image build time" >&2; \
      exit 1; \
    fi \
  && npm run build --workspace=@somwave/frontend \
  && npm run typecheck --workspace=@somwave/shared

FROM nginx:1.27-alpine AS runner

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/frontend/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz >/dev/null || exit 1
