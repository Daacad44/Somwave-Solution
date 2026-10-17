# Infrastructure and DevOps Audit

| | |
|---|---|
| Date | 2026-10-17 |
| Repository state | `main` at `4323f55` (PR #86) |
| Scope | Dockerfiles, entrypoint, nginx, Astro server, CI workflow, background jobs, health checks, environment variables, rate limiting, dependencies; Coolify checklist for blocked items. |
| Method | Read-only code inspection with file:line evidence; targeted local test runs; unauthenticated, low-volume GET/HEAD/OPTIONS probes of production. No production credentials, Coolify, Resend, S3 or GitHub App access. |
| Source | Infrastructure agent report (08), prefix INF- |
| Related | [System audit report](SYSTEM_AUDIT_REPORT.md) · [Bug register](BUG_REGISTER.md) · [Acceptance matrix](ACCEPTANCE_MATRIX.md) · [Remediation roadmap](REMEDIATION_ROADMAP.md) |

Each finding keeps the specialist agent's original ID; the consolidated `SW-` ID from the [bug register](BUG_REGISTER.md) is shown next to it. Severity in the index is the consolidated severity; where duplicates were merged the higher severity was kept, so it can differ from the severity line inside the original finding text.

## Finding index

| Original ID | SW ID | Severity (consolidated) | Confidence | Consolidated title |
|---|---|---|---|---|
| INF-001 | [SW-004](BUG_REGISTER.md#sw-004) | P1 | CONFIRMED | App nginx proxy has no client_max_body_size: uploads over ~750 KB through app.* get HTTP 413 |
| INF-002 | [SW-006](BUG_REGISTER.md#sw-006) | P1 | CONFIRMED | API is reached through public-hostname hairpins, so all app users (and all SSR page views) share one rate-limit bucket, including the login limiter |
| INF-003 | [SW-056](BUG_REGISTER.md#sw-056) | P2 | CONFIRMED | Runtime is Node 20, which reached end-of-life in April 2026; local dev uses Node 22 |
| INF-004 | [SW-057](BUG_REGISTER.md#sw-057) | P2 | CONFIRMED | Migrations run on every container start with no backup, no deploy ordering and no separation from the app |
| INF-005 | [SW-053](BUG_REGISTER.md#sw-053) | P2 | CONFIRMED | Background jobs are in-process setInterval timers (no BullMQ) running on every API replica; the documented dedicated worker cannot be started from the image |
| INF-006 | [SW-055](BUG_REGISTER.md#sw-055) | P2 | CONFIRMED | A Redis outage takes the whole API down through the healthcheck, although Redis is only a cache |
| INF-007 | [SW-014](BUG_REGISTER.md#sw-014) | P2 | CONFIRMED | Public website and React app send no security headers (no CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy) |
| INF-008 | [SW-115](BUG_REGISTER.md#sw-115) | P3 | CONFIRMED | API runs TypeScript through tsx in production with no compiled build |
| INF-009 | [SW-116](BUG_REGISTER.md#sw-116) | P3 | CONFIRMED | Graceful shutdown has no timeout and does not wait for in-flight jobs |
| INF-010 | [SW-076](BUG_REGISTER.md#sw-076) | P3 | CONFIRMED | Rate limiters use the in-memory store: counters reset on restart, are per replica, and anyone can lock an account out |
| INF-011 | [SW-054](BUG_REGISTER.md#sw-054) | P2 | SUSPECTED | Filesystem storage durability depends on an unverified Coolify volume; storageStatus() reports durable regardless |
| INF-012 | [SW-058](BUG_REGISTER.md#sw-058) | P2 | CONFIRMED | No backup, restore or monitoring artifacts in the repository |
| INF-013 | [SW-059](BUG_REGISTER.md#sw-059) | P2 | CONFIRMED | CI does not gate deploys, run e2e, build the Docker images or audit dependencies |
| INF-014 | [SW-023](BUG_REGISTER.md#sw-023) | P2 | CONFIRMED | Production dependency vulnerabilities: 3 critical, 18 high, 10 moderate |
| INF-015 | [SW-114](BUG_REGISTER.md#sw-114) | P3 | CONFIRMED | GitHub (and other) configuration not validated by the Zod env schema; .env.example incomplete |
| INF-016 | [SW-006](BUG_REGISTER.md#sw-006) | P1 | CONFIRMED | API is reached through public-hostname hairpins, so all app users (and all SSR page views) share one rate-limit bucket, including the login limiter |
| INF-017 | [SW-117](BUG_REGISTER.md#sw-117) | P3 | CONFIRMED | index.html has no Cache-Control: a stale shell after deploy can white-screen |
| INF-018 | [SW-118](BUG_REGISTER.md#sw-118) | P3 | CONFIRMED | Healthcheck and documentation inconsistencies; one-level log redaction |

## 1. Scope

**Inspected (code):** `Dockerfile` (API), `backend/docker-entrypoint.sh`, `frontend/Dockerfile`, `frontend/nginx.conf`, `web/Dockerfile`, `web/astro.config.*`, `docker-compose.yml`, `.dockerignore`, `.nvmrc`, root/backend `package.json`, `.github/workflows/ci.yml` (the only workflow), `backend/src/{server,index,worker,background-jobs,app}.ts`, `backend/src/lib/{env,redis,redisAuth,logger,prisma,storage}.ts`, `backend/src/middleware/rateLimit.ts`, `backend/src/routes/health.routes.ts`, `backend/src/services/{notification-delivery,sla-escalation,system-health,engineering-reminders}.service.ts`, Redis consumers (`team/post/job/portfolio/service/inquiry/faq.service.ts`), `backend/.env.example`, docs `SUPER_ADMIN_SETUP.md`, `GLOBAL_IMAGE_STORAGE.md`, `RESEND_EMAIL.md`, `FINANCE_PRODUCTION_REPAIR.md`, `README.md`, worker notes in `COMPLETION_AUDIT.md`/`ENGINEERING_PLATFORM.md`.

**Production probes (unauthenticated GET/HEAD/OPTIONS only, ~20 requests):** `/health`, `/`, `/healthz`, 404 paths, `/api/v1/auth/me` (401) direct and through the app proxy, a CORS preflight with a foreign Origin, HTTP→HTTPS, and the production JS bundle (to check the API base URL).

**Local:** `npm audit --omit=dev` (counts only).

**BLOCKED:**
- **Real TLS certificate details (issuer, expiry).** The sandbox egress gateway re-signs TLS. `openssl s_client` shows an "Anthropic Egress Gateway" issuer for all three hosts, so the real chain and expiry cannot be seen. I was refused permission to inspect the proxy configuration. **The user must check this from an unproxied machine.**
- **HTTP→HTTPS redirect.** The 307 responses seen may come from the egress proxy itself, so the origin's redirect behaviour is unverified.
- **Coolify panel:** volumes, env values and types, deploy settings, logs, resources, backups, replica count. No credentials. See §5 for the checklist.
- **Upload size limits.** These cannot be reproduced live because POST is forbidden.

## 2. Inventory

| Component | Image / runtime | Port | Healthcheck | User | Notes |
|---|---|---|---|---|---|
| API (`/Dockerfile`) | node:20-bookworm → node:20-bookworm-slim, multi-stage; devDeps pruned; **runs `tsx src/server.ts`** (no compiled JS) | 4000 | `node fetch /health` 30s/5s/45s start/3 retries | `node` (non-root) | Entrypoint runs `prisma migrate deploy` then `exec npm start` |
| Frontend (`frontend/Dockerfile`) | node:20 build → nginx:1.27-alpine | 80 | `wget /healthz` | nginx default (root master) | nginx proxies `/api/` → `https://api.somwave.botandev.com/api/` over the public internet |
| Web (`web/Dockerfile`) | node:20 build → node:20-slim, Astro node standalone | 4321 | `fetch /` | `node` | No security headers |
| Worker (`backend/src/worker.ts`) | `npm run worker` (tsx) | — | none | — | **No image/entrypoint path to run it** (INF-005) |
| Postgres/Redis | Coolify services (prod); `docker-compose.yml` is dev only | — | compose pg_isready / redis ping | — | Redis is only an optional cache (all calls try/catch) |
| Jobs | **Custom `setInterval` timers + a PostgreSQL lease queue — no BullMQ** (no `bullmq` dependency anywhere) | — | — | — | email 30s, SLA 15m, health probe 5m, reminders 60m |
| CI | GitHub Actions `ci.yml`: install → migrate → seed → typecheck → lint → format → vitest coverage → build | — | — | — | No e2e, no docker build, no audit, no deploy gate |

**Env var inventory** (names only; `backend/src/lib/env.ts:7-39`, plus direct `process.env` reads):

| Name | Required | Validation / default |
|---|---|---|
| NODE_ENV | opt | enum development/test/production, default development |
| PORT | opt | int>0, default 4000 |
| DATABASE_URL | **req** | url |
| REDIS_URL | **req** | url |
| REDIS_PASSWORD, REDIS_USERNAME | opt | string |
| JWT_SECRET | **req** | min 32 chars |
| CORS_ORIGINS | **req** | non-empty, comma list |
| RESEND_API_KEY | opt | min 1 |
| EMAIL_FROM | opt | email or `Name <email>` (superRefine) |
| EMAIL_NOTIFY_TO, EMAIL_SUPPORT | opt | email |
| PROJECT_INQUIRY_CODE_TTL_MINUTES | opt | int 2–30, default 10 |
| PAYMENT_EVC_API_URL / _API_KEY / _MERCHANT_ID / _WEBHOOK_SECRET | opt, all-or-none | url / min8 / min1 / min16 |
| STORAGE_PROVIDER | opt | enum s3/filesystem |
| STORAGE_LOCAL_PATH | opt | must start with `/` |
| S3_FORCE_PATH_STYLE | opt | 'true'/'false', default 'false' |
| S3_BUCKET, S3_REGION, S3_ACCESS_KEY, S3_SECRET_KEY | opt | min1 (region falls back to us-east-1 in storage.ts:120) |
| S3_ENDPOINT | opt | url |
| APP_PUBLIC_URL | opt | url |
| HEALTH_PROBE_HOSTS | opt | string (empty = probes disabled) |
| BACKGROUND_WORKERS_ENABLED | opt | 'true'/'false', **default 'true'** |
| GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY (`services/github.client.ts:32-33`), GITHUB_WEBHOOK_SECRET (`controllers/github.controller.ts:165`) | opt | **not validated by Zod** |
| SEED_SUPER_ADMIN_EMAIL/PASSWORD, legacy SEED_ADMIN_* (`prisma/seed.ts:454-456`) | seed only | not validated |
| Frontend: VITE_API_URL (forced to `/api/v1` in Dockerfile:51-52). Web: PUBLIC_SITE_URL, PUBLIC_API_URL (build ARGs with defaults) | build | — |

## 3. Findings

### INF-001 (SW-004) — App nginx proxy has no `client_max_body_size`, so uploads over 1 MB through app.* get HTTP 413
- Severity: P1 · Confidence: CONFIRMED (config + production bundle; live POST not attempted) · Module: Frontend infra / all uploads
- Description: The production SPA calls same-origin `/api/v1`. The live bundle `/assets/index-MnjbBilE.js` contains `fetch(\`/api/v1${e}\`)` and an XHR `POST /api/v1…`. Every request therefore goes through `frontend/nginx.conf`, which never sets `client_max_body_size`. nginx's built-in default is 1m. The backend accepts base64 JSON up to 35 MB for media, documents, documentation and attachments, and 8 MB for CMS images and inquiry attachments (`backend/src/app.ts:75-82`). Base64 adds about 33%, so any file over about 750 KB is rejected by nginx before it reaches Express.
- Evidence: `frontend/nginx.conf:30-41` (`location /api/ { proxy_pass https://api.somwave.botandev.com/api/; …}`) with no body-size directive (`grep -c client_max_body_size` = 0); `frontend/Dockerfile:51-52` forces `VITE_API_URL=/api/v1`.
- Expected / Actual: uploads up to the documented 5 MB/25 MB limits should succeed. With this config, nginx returns 413 (HTML, not the API envelope), so the client sees a generic failure.
- Affected users: CMS editors (article, portfolio and hero images), staff (Media Library, documents, engineering attachments), portal clients (documents, inquiry attachments).
- Business impact: image and document storage appears broken in production. This may be the real cause behind the "Image storage is unavailable" investigation in `docs/GLOBAL_IMAGE_STORAGE.md`.
- Fix: add `client_max_body_size 36m;` (server or `/api/` block), plus `proxy_read_timeout`/`proxy_send_timeout` sized for 35 MB uploads. Map 413 to a JSON envelope or handle 413 in `apiClient`. · Complexity: S · Verify: upload 4 MB JPEG and 20 MB PDF through app.* on staging; confirm 201.

### INF-002 (SW-006) — Every request from the app comes through one hairpinned proxy, so API rate limits (including login) are shared by all app users
- Severity: P1 · Confidence: CONFIRMED (probe) for the shared bucket; root-cause hop chain SUSPECTED · Module: Auth / rate limiting
- Description: nginx forwards `/api/` to the **public** API hostname, so requests leave the VPS and come back in through Traefik. The API uses `trust proxy 1` (`app.ts:58`) and express-rate-limit keyed by `req.ip` (`middleware/rateLimit.ts:25-38`). It therefore sees the last hop, which is the nginx egress address, not the end user. Every app.* user shares one 100/min global bucket and one **20-per-15-min login IP bucket** (`rateLimit.ts:38`).
- Evidence (production): through the app proxy `/api/v1/auth/me` returned `ratelimit: limit=100, remaining=92`, then 87 and 86 a few seconds later. My own requests account for only 1 per step, so others are consuming the same key. The same call direct to api.* from the same client returned `remaining=99`, then 99 and 98: a different, mostly unused key.
- Impact: at roughly 100 API calls per minute across all portal and internal users combined, everyone gets 429. One attacker can send 20 bad logins through app.* and lock **all** users out of login for 15 minutes (DoS). Per-IP brute-force protection is also meaningless. Counts are in-process MemoryStore (no Redis store), so they reset on restart and are per replica.
- Fix: route `/api/` to the API container over the Coolify internal network (e.g. `proxy_pass http://<api-service>:4000/api/;`). Alternatively, configure Traefik `forwardedHeaders.trustedIPs` and set `trust proxy` to the exact hop count or subnet. Use a Redis store for limits. · Complexity: M · Verify: two clients from different IPs through app.* should see independent `ratelimit remaining` values. A login lockout of one IP must not affect another.

### INF-003 (SW-056) — Runtime is Node 20, which reached end-of-life in April 2026
- Severity: P2 · Confidence: CONFIRMED · Module: All images / CI
- Evidence: `Dockerfile:28,58`, `frontend/Dockerfile:31`, `web/Dockerfile` builder/runner `node:20-bookworm(-slim)`, `.nvmrc` = `20`, CI `node-version: 20` (`ci.yml:53`), engines `>=20`. Local dev runs v22.22.0, a version mismatch with production. `RESEND_EMAIL.md:11` pins resend v5 "because the production Docker image runs Node 20".
- Impact: no security patches for the runtime; local and production behaviour differ.
- Fix: move images, CI and `.nvmrc` to Node 22 LTS together and set `engines` to `>=22 <23`. · S · Verify: CI plus image build on 22.

### INF-004 (SW-057) — Migrations run on every container start, with no backup, no lock on deploy ordering, and no separation from the app
- Severity: P2 · Confidence: CONFIRMED (code) · Module: Deploy
- Evidence: `backend/docker-entrypoint.sh:11` runs `npm run prisma:migrate` (`prisma migrate deploy`) and then `exec npm start`. The Dockerfile comment at line 26 says the same.
- Description: Prisma takes a Postgres advisory lock, so two replicas will not apply the same migration at once. However:
  - during a Coolify rolling deploy the new container migrates while the **old** container is still serving, so destructive or renaming migrations break the old version mid-deploy;
  - no backup is taken (the docs say "back up first", but nothing enforces it);
  - a failed migration crash-loops the container;
  - a long migration can outlast the 45 s healthcheck start period (`Dockerfile:83`);
  - any future worker container built from this image would also migrate.
- Fix: run migrations as a separate Coolify pre-deploy command or one-shot job after an automated `pg_dump`. Enforce expand/contract-only migrations. · M · Verify: deploy a staging migration with two replicas; confirm a backup artifact exists before migration.

### INF-005 (SW-053) — Background jobs run on every API replica by default, and the documented dedicated worker cannot be started from the image
- Severity: P2 · Confidence: CONFIRMED · Module: Jobs / notifications
- Evidence: `lib/env.ts:38` `BACKGROUND_WORKERS_ENABLED … default('true')`; `server.ts:17-18` starts the timers in every API process. `docker-entrypoint.sh:12` `exec npm start` ignores `"$@"`, so a Coolify start-command override cannot run `npm run worker` without replacing ENTRYPOINT. The docs (`COMPLETION_AUDIT.md:52`, `ENGINEERING_PLATFORM.md:32`) tell operators to run a separate worker and disable jobs on the API.
- What is safe: the email queue claims rows atomically with compare-and-set (`notification-delivery.service.ts:159-167`). `dedupeKey` is `@unique` (`schema.prisma:239`), and Resend idempotency keys are stable. SLA and reminder dedupe keys are deterministic. Duplicate *emails* are therefore unlikely.
- What is not safe: `system-health.service.ts:106-144`. Each process inserts its own `SystemHealthCheck` row, and the alert dedupe key includes `check.id` (`:143`). With N processes the probe runs N times, and a status flip sends N duplicate alerts.
- Other gaps: the 120 s email lease (`:166`) is shorter than a worst-case Resend call plus retry. There is no BullMQ, contrary to CLAUDE.md §4/§11, and timers have no deterministic job IDs or scheduling guarantees. If the API is scaled to 0 or crash-loops, no jobs run, and there is no alerting.
- Fix: make the entrypoint `exec "$@"` with default CMD `npm start`; ship worker deployment instructions. Default `BACKGROUND_WORKERS_ENABLED=false` in the API once a worker exists. Key health alerts on `systemId+status+time bucket`. Consider BullMQ repeatable jobs per CLAUDE.md. · M · Verify: run 2 API processes with health probes; confirm a single alert per transition.

### INF-006 (SW-055) — Redis outage takes the whole API down through the healthcheck, even though Redis is only a cache
- Severity: P2 · Confidence: CONFIRMED (code) · Module: Health
- Evidence: `routes/health.routes.ts:15-18` returns 503 if Redis ping fails. `Dockerfile:83-84` HEALTHCHECK fails on non-2xx. All Redis consumers are best-effort cache wrappers with try/catch (e.g. `team.service.ts:124-138`, `post.service.ts:288-297`).
- Impact: a Redis restart marks the API unhealthy, and Coolify/Traefik may stop routing to it. A cache blip becomes a full outage of login, portal and finance.
- Fix: split `/health/live` (process, used by HEALTHCHECK) from `/health/ready` (Postgres required, Redis reported as degraded). · S · Verify: stop Redis on staging; API keeps serving.

### INF-007 (SW-014) — Public site and app send no security headers (no HSTS, CSP, X-Frame-Options or nosniff)
- Severity: P2 · Confidence: CONFIRMED (probe) · Module: Web/Frontend infra
- Evidence: `GET https://app.somwave.botandev.com/` returned only `content-type, etag, last-modified, server: nginx, alt-svc`. `GET https://somwave.botandev.com/` and `/blog` returned only `cache-control: public, max-age=0, must-revalidate, content-type`. `frontend/nginx.conf` has no `add_header` for security (only Cache-Control at line 23). Astro has no middleware (`web/src` has no middleware file and no header code). The API itself has full helmet headers including `strict-transport-security: max-age=31536000; includeSubDomains`.
- Impact: the app login and the internal/finance UI can be framed (clickjacking). There is no HSTS on the two user-facing hosts, so first-visit SSL-strip is possible. There is no CSP defence-in-depth on the SPA that holds the session.
- Fix: in nginx, `add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always; X-Frame-Options DENY; X-Content-Type-Options nosniff; Referrer-Policy; a CSP allowing fonts.googleapis.com`. Add an Astro middleware or Traefik headers middleware for the web host. · S · Verify: re-probe headers.

### INF-008 (SW-115) — API runs TypeScript through `tsx` in production, with no compiled build
- Severity: P3 · Confidence: CONFIRMED · Module: API image
- Evidence: `backend/package.json` `"build": "tsc --noEmit"`, `"start": "tsx src/server.ts"`; `tsx` and `prisma` CLI are runtime `dependencies`. `Dockerfile:25`.
- Impact: slower cold start and higher memory, and the esbuild binary ships in the production image. The process tree is npm → sh → tsx → node: signals pass through three layers and `npm` is PID 1. Type errors are only caught because the build step typechecks.
- Fix: compile to `dist/` (tsc or esbuild) and run `node dist/server.js` with `tini` or `--init`. · M

### INF-009 (SW-116) — Graceful shutdown has no timeout and does not wait for in-flight jobs
- Severity: P3 · Confidence: CONFIRMED · Module: API/worker
- Evidence: `server.ts:20-26`: `server.close(cb)` with no forced-exit timer, while `stopBackgroundJobs()` only clears intervals (`background-jobs.ts:67`). In-flight email sends are cut by `process.exit(0)`. `worker.ts:9-13` exits immediately after `prisma.$disconnect()` without awaiting running iterations.
- Mitigation present: the lease plus Resend idempotency make an interrupted send retry safely. A long request can still hang shutdown until Docker sends SIGKILL.
- Fix: add a 10–25 s forced-exit timer, track in-flight job promises, and await them. · S

### INF-010 (SW-076) — In-memory rate limiter: limits reset on restart and are per replica
- Severity: P3 · Confidence: CONFIRMED · Module: Rate limiting
- Evidence: `middleware/rateLimit.ts:25-51` sets no `store`, so express-rate-limit uses its default MemoryStore. Redis exists but is not used for limits.
- Impact: every deploy resets login lockouts; with more than one replica, limits multiply. This compounds INF-002.
- Fix: use `rate-limit-redis` with ioredis. · S

### INF-011 (SW-054) — Filesystem storage durability depends on an unverified Coolify volume; `storageStatus()` reports it durable regardless
- Severity: P2 · Confidence: SUSPECTED (Coolify volume unverifiable) · Module: Storage
- Evidence: `lib/storage.ts:35-45` returns `durable: true` whenever `STORAGE_PROVIDER=filesystem` and the path is absolute. It never checks that the path is a mount. `Dockerfile:75` creates `/data/uploads` inside the image layer. `storage.ts:52-55` uses `mkdir(…0o700)`. A root-owned named volume would cause EACCES under `USER node`, which surfaces as 503 "File storage is unavailable". Without a volume, every redeploy silently deletes all uploaded files while the DB still references them.
- Fix: at boot, refuse `filesystem` in production unless a marker file written to the volume exists, or check `stat` device vs `/`. Document the volume as mandatory. Prefer S3. · S · Verify (user): Coolify → API service → Storages shows a persistent volume mounted at `/data/uploads`; upload, redeploy, retrieve.

### INF-012 (SW-058) — No backup, restore or monitoring artifacts in the repository
- Severity: P2 · Confidence: CONFIRMED (absence) · Module: Ops
- Evidence: no `pg_dump`/backup scripts, no cron, no restore runbook (grep for `pg_dump|backup` finds only 2FA backup codes in `auth.*`). The docs (`SUPER_ADMIN_SETUP.md:51`, `FINANCE_PRODUCTION_REPAIR.md:53`, `RESEND_EMAIL.md:37`) only say "back up first". There is no uptime monitoring or alerting config, no error tracker (no Sentry or similar), and logs only go to stdout.
- Impact: financial and HR records have no evidenced recovery point objective. An outage is noticed only by users.
- Fix: enable Coolify scheduled Postgres backups to off-site S3, run a quarterly restore test, add an external uptime monitor on `/health` for the 3 hosts, and add an error tracker. · M

### INF-013 (SW-059) — CI does not gate deploys, run e2e, build the Docker images, or audit dependencies
- Severity: P2 · Confidence: CONFIRMED (CI file); auto-deploy SUSPECTED · Module: CI/CD
- Evidence: `.github/workflows/ci.yml` (only workflow) runs on push to `main` with no deploy job and no Playwright step, although `npm run test:e2e` exists in the root package.json. It runs no `docker build` for any of the 3 Dockerfiles and no `npm audit`. Coolify's Dockerfile build pack normally auto-deploys on its own webhook in parallel with CI, so a red build can still ship. Image build failures, such as the nested `send`/`cookie` issue noted in `web/Dockerfile`, are only found during Coolify deploys.
- Fix: disable Coolify auto-deploy and trigger the Coolify deploy webhook from a CI job that needs `build`. Add docker build jobs and Playwright e2e against compose services. · M

### INF-014 (SW-023) — 31 vulnerable production dependency entries, including 3 critical
- Severity: P2 · Confidence: CONFIRMED (`npm audit --omit=dev`) · Module: Dependencies
- Result: `{critical: 3, high: 18, moderate: 10, low: 0}`.
  - Critical: `astro` 5.18.2 (direct; define:vars XSS, server-island replay; `web/src` uses neither `define:vars` nor `server:defer`, which lowers exposure); `tar` (via bcrypt → node-pre-gyp, install-time); `proxy-addr` 2.0.7 (IPv4-mapped IPv6 trust-subnet spoofing; the app uses numeric `trust proxy 1`, so it is likely not exploitable).
  - Notable high: `@astrojs/node` (request body DoS, cache poisoning), `undici`, `http-cache-semantics`, `prisma` (via deepmerge-ts), `sharp`/libvips.
- Fix: upgrade astro/@astrojs/node, express (qs), and prisma. Replace bcrypt with the already-present argon2, or bump it. Add `npm audit --omit=dev --audit-level=high` to CI. · M

### INF-015 (SW-114) — Worker and GitHub configuration are not validated
- Severity: P3 · Confidence: CONFIRMED · Module: Config
- Evidence: `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY` and `GITHUB_WEBHOOK_SECRET` are read directly from `process.env` (`services/github.client.ts:32-33`, `controllers/github.controller.ts:165`), bypassing the boot-time Zod validation required by CLAUDE.md §13. `worker.ts:1` imports the full env, so the worker needs `JWT_SECRET` and `CORS_ORIGINS` to start even though it does not use them. `backend/.env.example` lists only NODE_ENV, PORT, DATABASE_URL, REDIS_URL, JWT_SECRET and CORS_ORIGINS. Resend, S3/STORAGE, BACKGROUND_WORKERS_ENABLED, HEALTH_PROBE_HOSTS, PAYMENT_EVC_* and GITHUB_* are undocumented there.
- Fix: add the missing variables to the env schema (all-or-none for GitHub) and complete `.env.example`. · S

### INF-016 (SW-006) — The app→API proxy depends on public DNS and TLS hairpin, with DNS resolved only at nginx start
- Severity: P3 · Confidence: CONFIRMED (config) · Module: Frontend infra
- Evidence: `frontend/nginx.conf:31` `proxy_pass https://api.somwave.botandev.com/api/;` with no `resolver`. nginx resolves the name once at startup; if DNS is unavailable then, the container fails to start. Every API call pays an extra TLS handshake and leaves the internal network, contrary to CLAUDE.md §14, which requires an internal hostname. `RESEND_EMAIL.md:24` still says "The frontend must call `https://api.somwave.botandev.com`", which contradicts `frontend/Dockerfile:20-26`.
- Fix: same as INF-002 (internal upstream); fix the doc. · S

### INF-017 (SW-117) — `index.html` has no Cache-Control, so a stale shell after deploy can white-screen
- Severity: P3 · Confidence: CONFIRMED (probe) · Module: Frontend infra
- Evidence: `GET app.somwave.botandev.com/` returned `etag`/`last-modified: Sat, 17 Oct 2026 13:12:57 GMT` and no `cache-control`. `nginx.conf:43-45` `location /` has no header. Browsers apply heuristic caching, so after a deploy a cached `index.html` can point at deleted hashed `/assets/*` files, which return 404 (`nginx.conf:22`).
- Fix: `add_header Cache-Control "no-cache"` on `location /`. · S

### INF-018 (SW-118) — Healthcheck and documentation inconsistencies (minor)
- Severity: P3 · Confidence: CONFIRMED · Module: Ops docs
- `web/Dockerfile:104` claims "Static homepage is prerendered", but `web/astro.config` says "The homepage is SSR". The web healthcheck on `/` therefore depends on SSR and maybe the API.
- `/health` is unauthenticated and placed before the rate limiter (`app.ts:87-89`). Every hit runs `SELECT 1` and a Redis PING. That is cheap, but it is an unthrottled path. The response reveals only `{"data":{"status":"ok","checks":{"redis":true,"postgres":true}}}`: no versions or secrets.
- `logger.ts:13-15` redacts only one level (`*.password`), so nested `a.b.password` is not covered. pino-http does not log bodies, so exposure today is low.

## 4. Acceptance rows

| Feature | Status | Evidence |
|---|---|---|
| API /health pings Postgres + Redis | VERIFIED | Prod `GET /health` returned 200 `{"data":{"status":"ok","checks":{"redis":true,"postgres":true}}}`; code at `health.routes.ts:11-19` |
| /health leaks no secrets | VERIFIED | Response shape above |
| API security headers (helmet, HSTS) | VERIFIED | Prod headers: HSTS 1y includeSubDomains, CSP, XFO SAMEORIGIN, nosniff, no x-powered-by |
| CORS locked (no wildcard) | VERIFIED | Preflight from `https://evil.example` → 200 with no `Access-Control-Allow-*` headers |
| API error envelope on 404 | VERIFIED | `GET /nope` → 404 `{"error":{"code":"NOT_FOUND",…}}` |
| Web/app security headers / HSTS | FAILED | INF-007 |
| Server banner minimised | PARTIAL | app: `server: nginx` (no version, `server_tokens off`); web/api: no server header |
| Prod frontend uses same-origin API | VERIFIED | Bundle contains `/api/v1` fetches |
| Uploads >1 MB via app | FAILED (config) / NOT TESTED live | INF-001 |
| Per-client IP rate limiting / login lockout isolation | FAILED | INF-002 probe |
| Non-root containers | PARTIAL | API and web `USER node`; frontend nginx master runs as root (stock image) |
| Multi-stage, devDeps pruned | VERIFIED (code) | `Dockerfile:54-56`, `web/Dockerfile` prune step |
| Compiled production build | NOT IMPLEMENTED | INF-008 |
| Graceful shutdown | PARTIAL | INF-009 |
| Single background-job owner / worker deploy path | FAILED | INF-005 |
| BullMQ job queue (CLAUDE.md §4) | NOT IMPLEMENTED | No dependency; custom timers |
| Persistent uploads volume | BLOCKED | INF-011 |
| DB backups / restore | NOT IMPLEMENTED in repo / BLOCKED in Coolify | INF-012 |
| Monitoring / alerting | NOT IMPLEMENTED | INF-012 |
| CI gates deploy | FAILED / BLOCKED (Coolify setting) | INF-013 |
| CI runs e2e | NOT IMPLEMENTED | `ci.yml` |
| Node version supported and consistent | FAILED | INF-003 |
| Env validated at boot | PARTIAL | INF-015 |
| TLS certificate validity/expiry | BLOCKED | Egress gateway re-signs TLS |
| HTTP→HTTPS redirect | BLOCKED | 307 seen, origin unverifiable through the proxy |
| Prod dependency vulnerabilities | FAILED | INF-014 (3 critical / 18 high / 10 moderate) |

## 5. What the user must check in Coolify (BLOCKED items, by name)

1. **API service → Storages:** a persistent volume mounted at `/data/uploads`, writable by UID 1000, *if* `STORAGE_PROVIDER=filesystem`. Otherwise confirm `S3_BUCKET`, `S3_ACCESS_KEY` and `S3_SECRET_KEY` are set (and optionally `S3_ENDPOINT`/`S3_REGION`/`S3_FORCE_PATH_STYLE`).
2. **API service → Environment:** these are **Runtime**, not Buildtime: `DATABASE_URL`, `REDIS_URL`, `REDIS_PASSWORD`, `JWT_SECRET`, `CORS_ORIGINS` (must include `https://app.somwave.botandev.com` and `https://somwave.botandev.com`), `RESEND_API_KEY`, `EMAIL_FROM`, `APP_PUBLIC_URL`, `BACKGROUND_WORKERS_ENABLED`, `HEALTH_PROBE_HOSTS`, `PAYMENT_EVC_*`, `GITHUB_*`. Also check whether `SEED_SUPER_ADMIN_PASSWORD` is still lingering in runtime env (remove it after seeding).
3. **Frontend service:** Buildtime `VITE_API_URL` (the image overrides it to `/api/v1`). **Web service:** Buildtime `PUBLIC_SITE_URL` and `PUBLIC_API_URL`.
4. **Replica count** of the API, and whether any separate worker service exists. If there are more than 1 API replica, or a worker exists, set `BACKGROUND_WORKERS_ENABLED=false` on all but one owner.
5. **Auto-deploy on push** (Webhooks/Git source) for all 3 apps. Is it gated on CI?
6. **Postgres service → Backups:** schedule, retention, off-site S3 destination, last successful backup, and a restore test.
7. **Redis service:** persistence (AOF/RDB) and password set.
8. **Deploy logs** for the last API deploy: `prisma migrate deploy` output, and whether all 56 migrations in `backend/prisma/migrations` are applied (`_prisma_migrations`).
9. **Runtime logs:** look for `Redis connection error`, `storage operation failed`, `Notification queue iteration failed`, and 413 responses in the frontend nginx access log.
10. **Proxy (Traefik or Caddy):** the TLS certificate issuer and expiry for the 3 hosts (check from an unproxied machine: `openssl s_client -connect <host>:443 -servername <host> | openssl x509 -noout -dates -issuer`), the HTTP→HTTPS redirect, and `forwardedHeaders.trustedIPs`.
11. **Server resources:** CPU, RAM and disk of the VPS, and whether disk alerts exist.

## Note on the migration count

The infrastructure checklist above (item 8) says "all 56 migrations". The repository at `4323f55` contains **55** migration directories (`backend/prisma/migrations`), which is also the number the database and QA agents applied. Use 55 when checking `_prisma_migrations` in production.
