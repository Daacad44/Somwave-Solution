# Somwave — Status report

**Date:** 22 September 2026.

Somwave is three systems on one backend: Public Site (Astro), Internal + CMS (React), Client Portal (React). Mobile remains out of scope until P1–P4 are stable.

The product feature catalog for those three audiences is **[SOMWAVE_FEATURES.md](./SOMWAVE_FEATURES.md)**.

## Snapshot

**P0 platform integration** is on branch `cursor/p0-platform-integration-ae9d` (I4.1 invoice builder, P2.3 portal milestones, P3 ticket detail/replies, 2FA, SMTP + CMS dashboard UX, I4.2 manual payments, plus sync from `origin/main` for Coolify/CORS/cookies/homepage).

For a full Somali implementation update vs the earlier ~55% project report, see **[SOMWAVE_IMPLEMENTATION_UPDATE.md](./SOMWAVE_IMPLEMENTATION_UPDATE.md)**.

## Verification (integration branch, 22 Sep 2026)

- `npm run typecheck` — pass  
- `npm test` — 232 tests pass  

## Still open

Gate 3 staging UAT and PM sign-off; P4.2 online gateways (EVC Plus); S3 uploads; HR/finance/CRM depth; Expo mobile.

Sources: repository, `CLAUDE.md`, `docs/WORKLOG.md`, `docs/SOMWAVE_PROJECT_REPORT.md`.
