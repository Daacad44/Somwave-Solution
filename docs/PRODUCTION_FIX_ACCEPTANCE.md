# Production bug fixes — acceptance report

17 October 2026 (Africa/Mogadishu). Existing records and previous implementation
were preserved. No staging environment, production deployment, production
migration or production data reset was performed. The user will configure
production secrets and storage separately.

## Task status and causes

| Task | Status | Confirmed cause and resulting behavior |
| --- | --- | --- |
| 1. Global image storage | PARTIAL | The reported CMS message maps to shared storage HTTP 503. Previously production required usable S3 configuration; development fallback was memory. Actual Coolify configuration/provider failure cannot be distinguished without runtime access. Shared S3 remains supported; explicit filesystem storage now supports a persistent VPS volume, rejects unsafe paths/symlinks and production memory storage, and logs safe provider diagnostics. Cross-module image-reference protection prevents deleting assets still used outside Articles. |
| 2. Invitation, activation and recovery | PARTIAL | Admin user creation previously accepted a password, and recovery used reset links. It now creates only a pending role-bound invitation; the recipient chooses the password. Recovery uses expiring hashed email OTP then a single-use reset proof. Concurrency, refresh/access/challenge revocation and last-Super-Admin guards are tested. Actual Resend sender approval/mailbox receipt remains unverified. |
| 3. Finance | PARTIAL | The UI hid all API error details; local tests reproduce 403 when an MFA-enrolled session lacks challenge proof, while valid authorized sessions return 200. Finance dates previously used UTC midnight instead of Mogadishu. These defects are fixed without weakening MFA, rewriting history or adding a duplicate ledger. The specific deployed exception remains unknown. Missing AP/payroll/recurrence and other accounting workflows remain implementation gaps. |

Detailed module audits: [image storage](GLOBAL_IMAGE_STORAGE.md),
[finance repair](FINANCE_PRODUCTION_REPAIR.md),
[full finance gaps](FINANCE_ACCOUNTING_STATUS.md).

## Implementation

Storage uses one shared abstraction for upload/read/delete. Existing S3 keys
are preserved; the optional filesystem provider requires an explicit durable
mount. JPEG, PNG, WebP and existing PDF attachment use signature and size checks.
Team/testimonial forms now reuse server-confirmed uploads, preview and progress;
an upload failure prevents content save. CMS reference checks include live and
draft website content, portfolio/gallery, team, testimonials and posts. The
module matrix distinguishes image-enabled modules from services/icons and
profiles without an avatar field.

Users management sends invitations using name/email/roles, displays pending,
expired and cancelled invitations, and supports resend/cancel. Existing active
user role/status management remains. Activation provisions the intended roles
transactionally; existing Engineer and Client activation routes remain.
Passwords use the existing Argon2id hashing and bcrypt compatibility, 12–128
character guidance, confirmation, show/hide, strength and offline common-password
checks. No external breached-password database was queried.

Reset codes use cryptographic generation, HMAC verification, a ten-minute TTL,
five attempts, cooldown and generic request responses. Password reset revokes
refresh tokens, old access JWTs and pending 2FA challenges. Credential issuance
and refresh rotation serialize with reset; invitation claims bind the exact
token hash. Backup codes consume atomically. Last-active-Super-Admin role removal,
suspension and deletion serialize on the system role row.

Finance keeps Decimal arithmetic and per-currency finalized journal totals.
The dashboard adds real monthly trends, pending approvals and cumulative
asset/liability balances. These are not mislabeled cash/bank or AR/AP totals
when the schema cannot establish those classifications. Dates use Mogadishu
midnight with inclusive From and exclusive To. Errors display safe API messages,
MFA guidance and Retry. Generic malformed/oversized JSON returns 400/413; central
server diagnostics omit raw provider/database payloads.

## Database and API

Additive migration: `20261017090000_secure_user_invitations_reset_otp` adds
`user_invitations`, reset-code verification fields and `users.sessions_revoked_at`.
All 55 migrations applied locally and to a fresh disposable PostgreSQL database.
No earlier applied migration was edited. There is no new finance ledger or
destructive migration.

Changed/new APIs:

- `POST /api/v1/users` now sends an invitation; administrator passwords are not accepted.
- `GET /api/v1/users/invitations`; `POST /:id/resend` and `POST /:id/cancel` under that collection.
- `POST /api/v1/auth/user-invitations/verify` and `/activate`.
- `POST /api/v1/auth/forgot-password`; new `/password-reset/verify` returns a short-lived proof; `/reset-password` consumes that proof. Legacy unverified reset links are rejected.
- Existing CMS image/media routes use the repaired shared storage; no public private-file endpoint was introduced.
- Existing finance routes retain verified MFA and per-route RBAC, with consistent local-date validation and additional dashboard fields.

Frontend changes include invitation management, `/activate-account`, OTP recovery,
shared password guidance, permission-aware login destinations, team/testimonial
image uploads, finance errors/trends/balances and date-edit consistency.

## Executed checks

| Check | Result |
| --- | --- |
| Full ordinary Vitest suite | VERIFIED — 588 passed, 13 integration tests skipped in this run; 0 failed |
| Fresh disposable PostgreSQL integrations | VERIFIED — all 13 skipped tests executed separately: finance 9, onboarding 3, payment 1; 13 passed, 0 failed |
| New internal desktop/mobile Playwright checks | VERIFIED — activation/recovery 4, finance 6, storage 4; 14 passed, 0 failed; HTTP responses intercepted for UI tests |
| Public website Playwright regression | VERIFIED — 9 passed, 0 failed |
| Typecheck, ESLint, formatting, production build | VERIFIED — completed successfully; backend typecheck rerun after final credential fixes |
| Filesystem process persistence | VERIFIED locally — first Node process writes, second independent process reads/deletes the same bytes |
| API smoke | VERIFIED locally — health 200; unauthenticated finance/users/media 401; unknown-account recovery 200; oversized request 413 |
| Security review | VERIFIED for repaired findings — token claims, credential races, backup-code reuse, Super Admin guard, traversal, private resource checks and production memory rejection |
| Coolify production / real email / provider settlement | BLOCKED — no live access or credentials; user will configure separately |

## Production configuration and rollout

Keep existing database, Redis, users, buckets, volumes and secrets. Required email
runtime configuration is `RESEND_API_KEY`,
`EMAIL_FROM="Somwave Solution <noreply@botandev.com>"` and
`APP_PUBLIC_URL=https://app.somwave.botandev.com`. The sender domain must be
verified in Resend. Never put secrets in Vite/Astro build variables or chat.

Retain existing S3 configuration if files already live there:
`S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, plus provider-specific
`S3_ENDPOINT`, `S3_REGION`, `S3_FORCE_PATH_STYLE` as needed. Alternatively,
explicitly choose `STORAGE_PROVIDER=filesystem`,
`STORAGE_LOCAL_PATH=/data/uploads` with an existing API persistent volume mounted
there, writable by UID/GID 1000. Do not switch providers without separately
copying and verifying every historical object. A path alone is not persistence.

Production HTTP probes, including an escalated read-only retry, failed with
network proxy `CONNECT tunnel failed, response 403`; this does not establish
the production application's health or root exception. Existing Coolify service
logs, env/provider settings, persistent mount and deployed migration status must
be inspected by the operator. No further access question is pending because
the user elected to supply settings independently.

Before deploying: back up PostgreSQL and stored files, record the current image
digest/settings/mount, inspect the additive migration, deploy matching backend
and frontend code, run migration deploy, verify health and MFA, then controlled
upload/retrieve/restart/redeploy, invitation/mailbox activation/reset and finance
journeys. No staging is required. Roll back the application image on failure;
retain additive tables/columns and stored objects. Never delete posted journals,
drop new real records or reverse migrations to roll back application code.

## Final acceptance matrix

| Requirement | Status | Limit |
| --- | --- | --- |
| Shared upload, validation, replace/delete and references | VERIFIED locally | Provider credentials and Coolify runtime unverified |
| Existing image preservation | PARTIAL | Code preserves keys/references; live historical objects not inspected |
| Restart/redeployment persistence | PARTIAL | Independent process persistence passed; Coolify mount/redeploy not tested |
| Private file and image permissions | VERIFIED locally | Live production role journey untested |
| Admin creates users without passwords | VERIFIED locally | UI, service and concurrency regressions passed |
| Invitation through Resend | PARTIAL | Integration uses mail boundary mock; real delivery unverified |
| Activation, strong password and OTP reset | VERIFIED locally | Service/PG/browser evidence; mailbox delivery not verified |
| Existing users and Engineer/Client activation | PARTIAL | Existing regressions pass; deployed accounts not exercised |
| Role/workspace login and finance RBAC | VERIFIED locally | 7 role matrix and desktop/mobile behavior covered |
| Finance Dashboard root error | PARTIAL | Local MFA/date/error defects reproduced and fixed; deployed exception unknown |
| Existing finance workflow/calculations | VERIFIED locally | Balanced posting, reversals, dates and settlement tests; no live provider proof |
| Complete accounting scope | PARTIAL | AP, payroll, recurrence, authoritative invoice currency/ledger reconciliation and full statements remain |
| Production deployment and live acceptance | BLOCKED | User-managed configuration/access; no deployment performed |

## Modified files

Implementation, tests, deployment configuration and documentation:

- `Dockerfile`
- `backend/.env.example`
- `backend/prisma/migrations/20261017090000_secure_user_invitations_reset_otp/migration.sql`
- `backend/prisma/schema.prisma`
- `backend/src/lib/env.ts`
- `backend/src/lib/storage-process.test.ts`
- `backend/src/lib/storage.test.ts`
- `backend/src/lib/storage.ts`
- `backend/src/lib/tokens.ts`
- `backend/src/mail/templates.ts`
- `backend/src/middleware/auth.ts`
- `backend/src/middleware/errorHandler.test.ts`
- `backend/src/middleware/errorHandler.ts`
- `backend/src/routes/auth.routes.ts`
- `backend/src/routes/finance.routes.test.ts`
- `backend/src/routes/finance.routes.ts`
- `backend/src/routes/user.routes.ts`
- `backend/src/services/articleImage.service.test.ts`
- `backend/src/services/articleImage.service.ts`
- `backend/src/services/auth.service.test.ts`
- `backend/src/services/auth.service.ts`
- `backend/src/services/finance.integration.test.ts`
- `backend/src/services/finance.service.ts`
- `backend/src/services/media-references.test.ts`
- `backend/src/services/media-references.ts`
- `backend/src/services/media.service.test.ts`
- `backend/src/services/media.service.ts`
- `backend/src/services/user-invitation.service.test.ts`
- `backend/src/services/user-invitation.service.ts`
- `backend/src/services/user-onboarding.integration.test.ts`
- `backend/src/services/user.service.test.ts`
- `backend/src/services/user.service.ts`
- `docs/API_REFERENCE.md`
- `docs/FINANCE_PRODUCTION_REPAIR.md`
- `docs/GLOBAL_IMAGE_STORAGE.md`
- `docs/MASTER_IMPLEMENTATION_STATUS.md`
- `docs/PRODUCTION_FIX_ACCEPTANCE.md`
- `docs/RESEND_EMAIL.md`
- `e2e/auth-recovery.spec.ts`
- `e2e/finance-recovery.spec.ts`
- `e2e/storage-upload.spec.ts`
- `frontend/src/app/App.tsx`
- `frontend/src/features/auth/AccountActivationPage.tsx`
- `frontend/src/features/auth/ForgotPasswordPage.tsx`
- `frontend/src/features/auth/LoginPage.tsx`
- `frontend/src/features/auth/NewPasswordFields.tsx`
- `frontend/src/features/auth/ResetPasswordPage.tsx`
- `frontend/src/features/auth/SecureOnboarding.test.tsx`
- `frontend/src/features/auth/loginDestination.test.ts`
- `frontend/src/features/auth/loginDestination.ts`
- `frontend/src/features/cms/components/TeamMemberFormModal.tsx`
- `frontend/src/features/cms/components/TestimonialFormModal.tsx`
- `frontend/src/features/finance/FinancePage.tsx`
- `frontend/src/features/finance/api.ts`
- `frontend/src/features/users-roles/UserInvitations.test.tsx`
- `frontend/src/features/users-roles/UsersPage.tsx`
- `frontend/src/features/users-roles/api.ts`
- `frontend/src/features/users-roles/components/UserFormModal.tsx`
- `frontend/src/features/users-roles/hooks.ts`
- `packages/shared/src/schemas/auth.ts`
- `packages/shared/src/schemas/finance.test.ts`
- `packages/shared/src/schemas/finance.ts`
- `packages/shared/src/schemas/user.test.ts`
- `packages/shared/src/schemas/user.ts`
