# Somwave System Audit Report

| | |
|---|---|
| Date | 2026-10-17 |
| Repository state | `main` at `4323f55` ("fix: repair shared storage, secure onboarding and finance diagnostics (#86)") |
| Production hosts | `https://somwave.botandev.com` (web), `https://app.somwave.botandev.com` (React app), `https://api.somwave.botandev.com` (API) |
| Method | Nine specialist audits (frontend, API, database, security, projects/engineering, finance, CMS/web, infrastructure, QA), consolidated into one deduplicated register |
| Companion documents | [Bug register](BUG_REGISTER.md) · [Acceptance matrix](ACCEPTANCE_MATRIX.md) · [Remediation roadmap](REMEDIATION_ROADMAP.md) · [Index](README.md) |

## A. Executive summary

Somwave is a large, mostly well-structured monorepo: a public Astro website, a React internal/portal/CMS app, an Express + Prisma API and a shared Zod package. The code compiles, lints, formats and builds cleanly, all 55 migrations apply to an empty database, and the 601-test unit/API suite passes. Several controls are strong: the double-entry ledger is enforced by database triggers, payments lock the invoice row and use a unique idempotency key, refresh tokens rotate with reuse detection, CORS is an exact allow-list, the API sends full helmet headers, and `/health` really pings Postgres and Redis.

The audit nonetheless found **144 unique findings** (175 raw findings before merging duplicates): **0 P0, 13 P1, 61 P2 and 70 P3**. 136 are CONFIRMED and 8 are SUSPECTED. The P1 items cluster in five areas:

1. **Authentication and session security.** Mandatory 2FA for privileged roles is enforced only by the frontend ([SW-001](BUG_REGISTER.md#sw-001)); production cookies are `SameSite=None` with no CSRF or Origin check ([SW-002](BUG_REGISTER.md#sw-002)).
2. **Authorization and data isolation.** Any STAFF user can record attendance or file leave for any employee and read everyone's HR records ([SW-003](BUG_REGISTER.md#sw-003)). No HTTP-level test proves the RBAC or cross-tenant 404 contract for any route ([SW-013](BUG_REGISTER.md#sw-013)).
3. **Uploads and storage.** The app's nginx proxy rejects bodies over 1 MB, so uploads over about 750 KB fail with 413 ([SW-004](BUG_REGISTER.md#sw-004)). Storage fails closed as "File storage is unavailable" with no readiness signal, and live content shows no successful upload ([SW-005](BUG_REGISTER.md#sw-005)).
4. **Finance and payments.** Privileged users get 403 on the finance dashboard right after 2FA enrolment because the session never gains MFA proof ([SW-007](BUG_REGISTER.md#sw-007)). Failed EVC Plus charges leave orphaned PENDING payments that block the invoice ([SW-008](BUG_REGISTER.md#sw-008)). The payment UI regenerates the Idempotency-Key on error ([SW-009](BUG_REGISTER.md#sw-009)).
5. **Operability.** All app users share one rate-limit bucket (including the login limiter) because the proxy hairpins through the public hostname; the probe confirmed it ([SW-006](BUG_REGISTER.md#sw-006)). The error handler logs no error detail, so production 500s cannot be diagnosed ([SW-010](BUG_REGISTER.md#sw-010)). Migrations alone create only 15 of 70 permissions, so every environment depends on the development seed ([SW-011](BUG_REGISTER.md#sw-011)). QA engineers cannot perform QA verification ([SW-012](BUG_REGISTER.md#sw-012)).

**Production readiness verdict: NOT READY** for full production use (section K). The platform can keep serving the public website and read-only content, but the P1 security, upload/storage and finance items must be fixed and verified with authenticated tests first.

## B. System inventory

### Applications

| App | Path | Runtime in production | Notes |
|---|---|---|---|
| Public website | `web/` | Astro with `@astrojs/node` standalone, Node 20, port 4321 | Hybrid static/SSR; 13 CMS pages are SSR (`prerender=false`) and call the public API over its public hostname |
| Internal app, client portal and CMS | `frontend/` | React 18 + Vite build served by nginx 1.27 (alpine), port 80 | nginx proxies `/api/` to `https://api.somwave.botandev.com/api/` over the public internet; `VITE_API_URL` forced to `/api/v1` |
| API | `backend/` | Express + Prisma run with `tsx src/server.ts` (no compiled build), Node 20, port 4000 | Entrypoint runs `prisma migrate deploy` then `npm start`; background timers start in every API process |
| Shared contract | `packages/shared/` | Library | Zod schemas, permission/role/error constants |

### Size of the system

| Item | Count | Source |
|---|---|---|
| Prisma models | 91 | `backend/prisma/schema.prisma` (2321 lines) |
| Prisma enums | 51 | same |
| Migrations | 55 | `backend/prisma/migrations/` |
| API endpoints | ~350 (349 route declarations; one loop declares two) across 20 route files | [API audit, section 6](API_AUDIT.md) |
| Frontend routes | 53 `path` declarations in `frontend/src/app/App.tsx` (52 rendered routes plus the `/settings/2fa` redirect); no catch-all route | [Frontend audit](FRONTEND_UI_AUDIT.md) |
| Frontend API calls | 299 (all resolve to a backend route) | API audit |
| Test files | 102 vitest files (601 tests); 7 root Playwright specs; 1 web Playwright spec (9 tests) | [Test report](TEST_COVERAGE_REPORT.md) |
| Roles | 13 seeded: SUPER_ADMIN, ADMIN, MANAGER, FINANCE_MANAGER, ACCOUNTANT, PROJECT_MANAGER, LEAD_ENGINEER, ENGINEER, QA_ENGINEER, STAFF, EDITOR, CLIENT, GUEST | `packages/shared/src/constants/roles.ts`, `seed.ts` |
| Permissions | 70 | `seed.ts` (only 15 created by migrations, SW-011) |

### Integrations

| Integration | Use | State observed |
|---|---|---|
| PostgreSQL 16 | Primary database (Coolify service) | `/health` reports `postgres: true`. pgvector is required by CLAUDE.md but no migration or model uses it |
| Redis | Optional cache; health check | `/health` reports `redis: true`; rate limiters do not use it (in-memory store) |
| Resend | Transactional email (invitations, activation, reset OTP, invoice sent) | Code exercised only through mocks; live delivery BLOCKED |
| Object storage | S3-compatible or local filesystem (`STORAGE_PROVIDER`) for CMS images, media, documents, attachments | Production uploads appear never to have succeeded (SW-005); being re-platformed to ImageKit in a separate change |
| EVC Plus | Mobile-money payments with HMAC webhook | Generic placeholder contract; likely unconfigured in production (SW-008, SW-034) |
| GitHub App | Installations, repositories, webhooks, PR/task links, CI to QA | Code present; 1.5% test coverage; live behaviour BLOCKED |

### Background jobs

There is no BullMQ, although CLAUDE.md §4 and §11 require it. Jobs are in-process `setInterval` timers plus a PostgreSQL lease queue: email delivery every 30 s, SLA scan every 15 min, health probes every 5 min, reminders every 60 min. They start in every API process by default (`BACKGROUND_WORKERS_ENABLED` defaults to true), and the documented dedicated worker cannot be started from the image (SW-053).

### Module inventory

| Module | Frontend routes | Backend endpoints (approx.) | Main models | Tests | Overall status | Key findings |
|---|---|---|---|---|---|---|
| Auth, 2FA, onboarding | `/login`, `/forgot-password`, `/reset-password`, `/activate-account`, `/activate-engineer`, `/profile` | 18 under `/auth` | User, RefreshToken, TwoFactorBackupCode, UserInvitation, PasswordResetToken | Unit (mocked); 1 integration file; e2e login passed locally | PARTIAL | SW-001, SW-002, SW-015, SW-016, SW-021, SW-022 |
| Users and roles | `/users`, `/roles` | 11 | User, Role, Permission, UserRole | Unit | PARTIAL | SW-011, SW-038, SW-013 |
| Projects | `/projects`, `/projects/:id` | 13 + finance sub-routes | Project, ProjectMember, ProjectExpense | Unit; e2e 2 pass / 6 fail locally | PARTIAL | SW-045, SW-046, SW-091, SW-102 |
| Tasks, milestones | `/tasks`, `/milestones` | 5 + 8 | Task, Milestone, MilestoneDependency | Unit | PARTIAL | SW-047, SW-048, SW-091 |
| Engineering workspace, planning, accounts, analytics | `/engineering/*` | 60 + 10 accounts | ProjectInvitation, ProjectPhase, TaskReview, TaskTimeEntry, EngineerProfile | Unit | PARTIAL | SW-012, SW-028, SW-051, SW-065 |
| Engineering operations (systems, bugs, maintenance, releases) | `/engineering/operations` | 33 | ManagedSystem, BugReport, MaintenanceRequest, Release, Deployment | No service test (5.6% coverage) | PARTIAL | SW-049, SW-050, SW-110, SW-111 |
| Project documentation | `/engineering/documentation` | 27 | ProjectDocumentation, DocumentPlan | Unit | PARTIAL | SW-084, SW-025 |
| GitHub | `/github` | 10 + webhook | GitHubInstallation, GitHubRepository, GitHubTaskLink, GitHubWebhookEvent | 2 signature tests | Code only; live BLOCKED | SW-052, SW-113, SW-114 |
| Timesheets | `/timesheets` | 3 | Timesheet | Unit | FAILED (approval) | SW-044, SW-042 |
| HR (employees, attendance, leave, applications) | `/employees`, `/attendance`, `/leave`, `/applications` | 13 + 2 | Employee, Attendance, LeaveRequest, JobApplication | Unit (hr 16% coverage) | FAILED (scoping) | SW-003, SW-042, SW-043 |
| CRM (leads, clients) | `/leads`, `/clients`, `/clients/:id` | 12 | Inquiry, ProjectInquiry, Client | Unit | PARTIAL | SW-027, SW-090 |
| Client portal | `/portal/*`, `/tickets`, `/invoices`, `/documents` | 12 under `/portal` + shared | Project, ClientDocument, SupportTicket | Unit only (one tautological, SW-073) | PARTIAL | SW-019, SW-020, SW-045, SW-132 |
| Support tickets | `/tickets`, `/tickets/:id` | 6 | SupportTicket, TicketReply | Unit | PARTIAL | SW-040, SW-027 |
| Invoices and payments | `/invoices*` | 8 + EVC webhook | Invoice, InvoiceItem, Payment | Unit + 1 integration file | PARTIAL | SW-008, SW-009, SW-029, SW-031, SW-032, SW-041 |
| Finance ledger | `/finance` | 18 | FinanceAccount, FinancePeriod, FinanceJournal(+Line), FinanceTransaction | Unit + integration (9 tests, CI-skipped) | PARTIAL (ledger strong) | SW-007, SW-030, SW-033 |
| Reports and dashboard | `/reports`, `/` | 4 + 1 | Read-only | Unit; dashboard 8.5% | PARTIAL | SW-036, SW-122, SW-123 |
| CMS | `/cms/*` (9 pages), `/media` | 38 under `/cms` + 4 media | Service, Post, PortfolioItem, JobOpening, Testimonial, TeamMember, Faq, Subscriber, MediaAsset | Unit; frontend 0% | PARTIAL | SW-005, SW-027, SW-124, SW-129 |
| Public website | Astro pages | 23 under `/public` | as CMS + Inquiry, JobApplication, ProjectInquiry | Web e2e 9/9 (mocked API, not in CI) | PARTIAL | SW-006, SW-017, SW-037, SW-062, SW-063 |
| Notifications | `/notifications` | 5 | Notification, NotificationDelivery | Unit | PARTIAL; Resend live BLOCKED | SW-053 |
| Audit log, search | `/audit`, header search | 1 + 1 | AuditLog | Unit | PARTIAL | SW-024, SW-027 |
| Infrastructure / CI | - | `/health` | - | CI: typecheck, lint, format, coverage, build | PARTIAL | SW-004, SW-006, SW-014, SW-056 to SW-059 |

## C. Audit coverage

### What was inspected

- **Code:** every route, controller and middleware file in the API; the services behind each module; the Prisma schema, all 55 migrations and the seed; all 169 files under `frontend/src`; every page, layout and component of the Astro site; the shared package; Dockerfiles, entrypoint, nginx config and the CI workflow.
- **Docs:** existing status documents in `docs/` were cross-checked against the code; their COMPLETE claims were not trusted without code evidence.

### What was tested

| Activity | Where | Result |
|---|---|---|
| Full CI pipeline replay (migrate, seed, typecheck, lint, format, coverage, build) | Local database `somwave_qa` | All steps exit 0 |
| Second test run for flakiness | Same database | 1 failure from leftover data (SW-070) |
| Integration tests on disposable databases | `somwave_qa_test`, `somwave_finaudit(_test)` (created and dropped) | 13/13 and 9 + 1 passed |
| Migration replay and drift check | `somwave_dbaudit` | 55/55 applied; drift of 2 statements (SW-093) |
| Seed idempotency, ledger triggers, case-variant emails, rounding arithmetic | `somwave_dbaudit` (SQL, rolled back or cleaned up) | See database audit |
| Root and web Playwright suites | Local API + Vite / Astro dev | 23/33 and 9/9 passed |
| Targeted unit files by area agents | Local | Projects/engineering 112/112, finance 73/73, security 31/31 |
| Production probes | All three hosts | Unauthenticated GET/HEAD/OPTIONS only, low volume (a few dozen per agent) |

### What was blocked

- **No production credentials**: no authenticated workflow, role-by-role RBAC, cross-tenant 404, idempotent replay, 2FA or cookie-flag check was run against production.
- **No Coolify access**: environment variable values and types, volumes, replica count, deploy and runtime logs, backups and auto-deploy settings were not visible.
- **No Resend, S3 or GitHub App access**: live email delivery, object storage and GitHub webhooks/installations could not be exercised; their code was tested only through mocks.
- **No EVC Plus provider sandbox.**
- **TLS details**: the sandbox egress gateway re-signs TLS, so certificate issuer and expiry, and the origin's HTTP-to-HTTPS redirect, could not be verified.
- **No forms were submitted and no POST/PUT/PATCH/DELETE was sent to production.**

## D. Findings summary

Counts after deduplication (175 raw findings merged into 144):

| Severity | Total | CONFIRMED | SUSPECTED |
|---|---|---|---|
| P0 | 0 | 0 | 0 |
| P1 | 13 | 13 | 0 |
| P2 | 61 | 56 | 5 |
| P3 | 70 | 67 | 3 |
| **Total** | **144** | **136** | **8** |

Raw findings per agent before merging: frontend 22, API 20, database 21, security 21, projects/engineering 27, finance 17, CMS/web 18, infrastructure 18, QA 11.

Main merges: security headers (SEC-008, FE-007, INF-007 into SW-014); the proxy and SSR hairpin (INF-002, FE-008, INF-016, WEB-001 into SW-006); JSON-LD XSS (WEB-005, SEC-006 into SW-017); seed demo data (WEB-002, DB-002 into SW-037); invoice rounding (FIN-006, DB-008 into SW-032); 2FA attempt limits (SEC-004, API-006 into SW-015); HR IDOR (DB-004, API-002 into SW-003); list pagination (FE-003, API-007, CMS-001 into SW-027); npm audit (SEC-011, INF-014 into SW-023); error handler (FIN-002, DB-006, API-011 into SW-010, raised to P1); in-memory rate limiter (API-010, SEC-014, INF-010 into SW-076); TOTP storage (DB-017, SEC-005 into SW-016); seed overwrites (DB-003, SEC-018 into SW-038); downloads (API-004, SEC-016 into SW-025); route tests (API-001, QA-007 into SW-013). The full list is in the [bug register](BUG_REGISTER.md#cross-reference-original-id-to-sw-id).

## E. Confirmed bugs (top list)

All 13 P1 items are CONFIRMED. The full register, with reproduction, evidence, fix and verification plan for each item, is in [BUG_REGISTER.md](BUG_REGISTER.md).

| ID | Module | Title |
|---|---|---|
| [SW-001](BUG_REGISTER.md#sw-001) | Auth / RBAC | Mandatory 2FA for privileged roles is enforced only in the frontend |
| [SW-002](BUG_REGISTER.md#sw-002) | Auth cookies | SameSite=None cookies and no CSRF/Origin check on mutating routes |
| [SW-003](BUG_REGISTER.md#sw-003) | HR | Attendance/leave trust `employeeId` from the body; all HR rows readable by STAFF |
| [SW-004](BUG_REGISTER.md#sw-004) | Frontend infra | nginx `client_max_body_size` missing: uploads over ~750 KB get 413 |
| [SW-005](BUG_REGISTER.md#sw-005) | Storage | "Image storage is unavailable": global fail-closed storage, no readiness signal |
| [SW-006](BUG_REGISTER.md#sw-006) | Deploy / rate limiting | Public-hostname hairpin: all users share one rate-limit bucket, including login |
| [SW-007](BUG_REGISTER.md#sw-007) | Finance | Finance dashboard 403 after 2FA enrolment (no MFA proof in session) |
| [SW-008](BUG_REGISTER.md#sw-008) | Payments | Failed EVC Plus charge leaves an orphaned PENDING payment |
| [SW-009](BUG_REGISTER.md#sw-009) | Payments UI | Idempotency-Key regenerated after a failed request |
| [SW-010](BUG_REGISTER.md#sw-010) | Platform | Error handler logs no error detail; Prisma errors become 500 |
| [SW-011](BUG_REGISTER.md#sw-011) | RBAC / deploy | Migrations create only 15/70 permissions and 3/13 roles |
| [SW-012](BUG_REGISTER.md#sw-012) | Engineering QA | QA_ENGINEER cannot perform QA verification |
| [SW-013](BUG_REGISTER.md#sw-013) | Tests | No HTTP-level test of auth, RBAC and cross-tenant 404 for any route |

Notable P2 items: wrong or inconsistent business figures (progress counting cancelled tasks SW-045, revenue KPI SW-036, invoice rounding SW-032, period assignment by UTC month SW-030); fabricated demo testimonials live on the public site (SW-037); task planning dates drifting 3 hours per save (SW-065); timesheet self-approval (SW-044).

## F. Security

Full detail: [SECURITY_AUDIT.md](SECURITY_AUDIT.md).

**Verified good:** access JWT 15 min and opaque refresh token 30 days, stored hashed; refresh rotation under a row lock with reuse detection that revokes all sessions; suspension takes effect on the next request; password reset revokes sessions; Argon2id for new hashes; `trust proxy 1`; exact CORS allow-list (an evil origin and `null` get no ACAO); full helmet headers on the API; Zod-validated env that prints only names; log redaction of cookies, authorization and secrets; no stack traces returned; SSRF allow-list for health probes; privilege-escalation guards around SUPER_ADMIN; CLIENT lookups for invoices, payments, tickets and documents return 404 for other tenants' rows; HMAC with `timingSafeEqual` on both webhooks; no committed secrets; DOMPurify around every `marked` output.

**Main gaps:**

| Area | Finding |
|---|---|
| 2FA enforcement | Backend never enforces mandatory 2FA (SW-001); 2FA step limited by IP only and codes replayable (SW-015); TOTP secrets in plaintext and weak backup codes (SW-016) |
| CSRF | SameSite=None and no Origin check (SW-002) |
| Authorization | HR IDOR (SW-003); search leaks all project/task names (SW-024); clients see draft invoices (SW-019); inquiry sign-up auto-links to an existing client by email (SW-020); PMs can provision accounts (SW-028, SUSPECTED); documentation permissions never checked (SW-084); timesheet self-approval (SW-044); invoice/payment routes bypass the finance MFA gate (SW-029) |
| XSS | JSON-LD stored XSS on the public site (SW-017); `javascript:` URLs accepted in CMS fields (SW-018) |
| Headers | No security headers on web or app hosts (SW-014) |
| Enumeration | Login timing (SW-021); forgot-password timing (SW-075) |
| Availability | Shared rate-limit bucket (SW-006); 35 MB bodies parsed before auth and rate limit (SW-026); in-memory limiter allows account lockout (SW-076) |
| Dependencies | `npm audit --omit=dev`: 3 critical, 18 high, 10 moderate (SW-023) |
| Sessions | No refresh grace window (SW-022, SUSPECTED); logout keeps the access token valid for up to 15 min (SW-077); no change-password or admin 2FA reset (SW-078) |

## G. Database

Full detail: [DATABASE_AUDIT.md](DATABASE_AUDIT.md).

- **Migrations:** all 55 apply to an empty database in about 2.3 s. `prisma migrate diff` is **not empty**: two statements on `engineer_progress_reports` (a column default and a truncated index name), SW-093. Four directories use impossible hours (24 to 27) but apply in the intended order; do not rename them (SW-094).
- **Reference data:** migrations alone create only 15 of 70 permissions and 3 of 13 roles (SW-011). The seed is idempotent by row count, but each run overwrites role grants and resets the super-admin password (SW-038), and it writes demo content that is now live (SW-037).
- **Integrity:** money is always Decimal (no Float). The ledger is strong: a deferred balanced-journal trigger, immutability triggers, a period-close guard and Restrict foreign keys. Gaps: email uniqueness is case-sensitive (SW-039); ticket codes can collide (SW-040); invoice rounding (SW-032); `sendInvoice` can resurrect a VOID invoice (SW-041, SUSPECTED); Cascade deletes on HR, financial and time records (SW-043); no CHECKs or FKs on AR tables and finance actor columns (SW-097); 37 unindexed foreign keys, including the column used by the ledger balance trigger (SW-095); TOTP secrets in plaintext (SW-016).
- **Risk assessment table:** in the database audit, section 4.

## H. Integration findings

| Integration | Finding | Status |
|---|---|---|
| Image and file storage | One global fail-closed path returns 503 "File storage is unavailable" for unconfigured S3, an incomplete provider, a bad filesystem path or any provider error, and there is no readiness signal (SW-005). Live content has no stored image URLs, only a hotlinked team photo. Filesystem durability depends on an unverified Coolify volume, and `storageStatus()` reports durable regardless (SW-054). Images are released only for Articles (SW-124); image URLs are absolute and take their host from the request (SW-061). **ImageKit gap:** image storage is being re-platformed onto ImageKit in a separate change (`feat/imagekit-media-storage`); that change was not part of this audit and resolves SW-005 and SW-054 only once configured. | Production cause SUSPECTED (env not visible) |
| nginx upload limit | No `client_max_body_size`, so uploads over ~750 KB through app.* get an HTML 413 (SW-004). This still applies after the ImageKit change, because uploads still pass through the app proxy. | CONFIRMED (config) |
| nginx proxy hairpin | `/api/` is proxied to the public API hostname, so the API sees one client IP for all app users. The probe showed the shared `ratelimit-remaining` dropping from 92 to 86 while direct calls stayed at 99 (SW-006). DNS is resolved only at nginx start. | CONFIRMED (probe) |
| Web SSR to API | Astro SSR calls the API through its public hostname: one 60/min public bucket for all visitors; on 429, detail pages return 404 and the homepage falls back to defaults; no fetch timeout (part of SW-006). | SUSPECTED (code CONFIRMED) |
| Resend | Email delivery is queued with atomic claims, a unique dedupe key and stable idempotency keys. Forgot-password timing leaks account existence (SW-075). The 120 s lease may be shorter than a worst-case send (SW-053). Domain verification (SPF/DKIM/DMARC) and live delivery were not checked. | BLOCKED (no Resend access) |
| EVC Plus | Placeholder contract with no timestamp or amount check (SW-034); orphaned PENDING payments on failure (SW-008); overpayment webhook returns 409 forever (SW-031); `isEvcPlusConfigured()` is not used to hide the button. | Code CONFIRMED; provider BLOCKED |
| GitHub App | Signature checking and delivery dedup are correct. Gaps: a 256 KB body limit (SW-052, SUSPECTED); deliveries stuck in RECEIVED; suspended installations reactivated by other events; a token minted per view; stale CI runs satisfying QA (SW-113); env not Zod-validated (SW-114); 1.5% coverage (SW-074). | Live BLOCKED |
| Redis | A cache only, yet a Redis outage fails `/health` and therefore the container (SW-055). Not used for rate limiting (SW-076). | CONFIRMED (code) |

## I. Test results

Full detail: [TEST_COVERAGE_REPORT.md](TEST_COVERAGE_REPORT.md). These figures were checked against the raw QA logs.

| Check | Result |
|---|---|
| Typecheck (shared, frontend, backend `tsc`; `astro check` 63 files) | Pass (0 errors) |
| Lint | Pass |
| Format check | Pass |
| Build (all workspaces) | Pass (Vite warns about a chunk over 500 kB) |
| Unit/API suite, run 1 | **601 tests: 597 passed, 0 failed, 4 skipped**; **102 files: 100 passed, 2 skipped** |
| Unit/API suite, run 2 (same DB) | **1 failure** (596 passed, 4 skipped), caused by leftover data from the finance integration test (QA-003 / SW-070) |
| Integration files on a disposable DB | 13/13 passed (these 13 are skipped in real CI, SW-069) |
| Full coverage run on a fresh DB | 601/601 passed |
| Coverage (full run) | **lines 33.45%, branches 67.6%, functions 45.08%** (backend lines 52.72%, frontend lines 9.1%, shared lines 96.2%); the 70% target is not met and no threshold is enforced (SW-068) |
| Root Playwright e2e | **33 tests: 23 passed, 8 failed, 2 skipped** (SW-071) |
| Web Playwright e2e | **9/9 passed** (mocked API; not run by CI, SW-072) |

The first coverage run (with integration files skipped) reported lines 33.32% and branches 67.03%; the figures above come from the full run. Of the 20 critical workflows, none is covered end to end against a real API and database in CI. The workflow map is in the test report, section 4.

## J. Acceptance matrix summary

The complete feature-by-feature matrix, with evidence for every row and a reconciliation against `docs/MASTER_ACCEPTANCE.md`, is in [ACCEPTANCE_MATRIX.md](ACCEPTANCE_MATRIX.md). Status is VERIFIED only where a test or probe actually exercised the feature. In summary:

- **VERIFIED** items are mostly build/CI gates, unauthenticated production behaviour (401 envelopes, CORS, API headers, `/health`, public pages and links) and locally tested finance ledger and payment flows.
- **FAILED** items include server-side 2FA enforcement, CSRF posture, cookie SameSite, HR scoping, progress calculation, timesheet approval, invoice totals, EVC failure handling, the revenue KPI, uploads over 1 MB, web/app security headers, per-client rate limiting, coverage of at least 70%, real-DB tests in CI and the root e2e suite.
- **BLOCKED** items need production credentials with TOTP, Coolify, Resend, S3/ImageKit, an EVC sandbox or the GitHub App.
- The `docs/MASTER_ACCEPTANCE.md` rows marked COMPLETE ("Project documentation", "Task review and QA", "Automated tests") should be downgraded to PARTIAL or FAILED, for the reasons given in the reconciliation section.

## K. Production readiness

**Verdict: NOT READY for full production use.**

| Gate | Evidence | Blocks readiness? |
|---|---|---|
| Privileged accounts protected by 2FA server-side | Not enforced (SW-001) | Yes |
| CSRF-safe session cookies | SameSite=None, no Origin check (SW-002) | Yes |
| Per-user scoping on HR data | STAFF can forge and read all HR records (SW-003) | Yes |
| Uploads work through the app | nginx 413 above ~750 KB (SW-004); storage returns 503 (SW-005) | Yes |
| Rate limiting isolates clients | Shared bucket; one attacker can lock every user out of login (SW-006) | Yes |
| Finance usable by privileged users | 403 after 2FA enrolment (SW-007) | Yes, for finance |
| Payments fail safely | Orphaned PENDING payments (SW-008); new key on retry (SW-009) | Yes, for EVC Plus |
| Incidents diagnosable | No error detail logged (SW-010) | Yes |
| A fresh environment is reproducible | RBAC needs the development seed (SW-011) | Yes, for new environments |
| Authorization regression-tested | No route-level RBAC/404 tests (SW-013); coverage 33% | Yes |
| Backups and monitoring evidenced | None in the repository; Coolify not visible (SW-058) | Yes, until the user confirms |
| CI gates deploys | No deploy gate, e2e, image build or audit (SW-059) | Strongly recommended |

What works today, based on probes and local tests: the public website renders (the homepage, 12 navigation/footer pages and 4 detail pages return 200, all 27 internal links are live, unknown slugs return a real 404); the API is up with correct 401/404 envelopes, CORS and headers; the deployed frontend matches HEAD `4323f55`; and the ledger, invoice numbering and payment concurrency controls pass their integration tests locally.

"Conditionally ready" was considered and rejected. Several P1 items are security defects whose fixes are small (S complexity: SW-001, SW-002, SW-004), but until they are fixed and verified with authenticated tests, the system should not be relied on for privileged administration, HR or finance operations, or file uploads.

## L. Remediation roadmap summary

Full plan: [REMEDIATION_ROADMAP.md](REMEDIATION_ROADMAP.md).

| Phase | Focus | Main items |
|---|---|---|
| A | Critical security and data integrity | SW-001, SW-002, SW-003, SW-010, SW-011, SW-014 to SW-020, SW-024, SW-032, SW-038 |
| B | Broken core features | Auth/finance MFA proof (SW-007), storage and uploads (SW-004, SW-005, SW-054), payments (SW-008, SW-009, SW-031), rate limiting (SW-006), engineer assignment and QA (SW-012, SW-051, SW-028), client tracking and progress (SW-045, SW-101) |
| C | Incomplete workflows | Task planning (SW-047, SW-048, SW-065), reports (SW-036, SW-122, SW-123), notifications and jobs (SW-053, SW-049, SW-050), GitHub (SW-052, SW-113), maintenance/releases (SW-110, SW-111), approvals (SW-044, SW-029, SW-120) |
| D | UI/UX and performance | Pagination (SW-027), confirm dialogs (SW-066), shared controls (SW-067), i18n/RTL (SW-063, SW-131, SW-132, SW-135), bundles (SW-140), SEO (SW-062) |
| E | Production hardening | Backups and monitoring (SW-058), CI gating and e2e (SW-059, SW-071, SW-072), real-DB tests in CI (SW-069), coverage thresholds (SW-068), RBAC test matrix (SW-013), Node 22 (SW-056), dependencies (SW-023) |

Image storage is being re-platformed onto ImageKit in a separate change (`feat/imagekit-media-storage`) at the user's request. Once configured, it addresses the "Image storage is unavailable" findings; the nginx `client_max_body_size` finding (SW-004) still applies.

## M. User action required

Only items that need the owner's access or decision are listed. Never paste secret values into tickets or chat. Verify names and types only.

1. **Coolify environment (API service, Runtime type):** `DATABASE_URL`, `REDIS_URL`, `REDIS_PASSWORD`, `JWT_SECRET`, `CORS_ORIGINS` (must include `https://app.somwave.botandev.com` and `https://somwave.botandev.com`), `RESEND_API_KEY`, `EMAIL_FROM`, `APP_PUBLIC_URL`, `BACKGROUND_WORKERS_ENABLED`, `HEALTH_PROBE_HOSTS`, `PAYMENT_EVC_API_URL`, `PAYMENT_EVC_API_KEY`, `PAYMENT_EVC_MERCHANT_ID`, `PAYMENT_EVC_WEBHOOK_SECRET`, `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET`, the storage variables (`STORAGE_PROVIDER`, `STORAGE_LOCAL_PATH` or `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_FORCE_PATH_STYLE`, or the ImageKit variables introduced by the separate change). Remove `SEED_SUPER_ADMIN_PASSWORD` from the runtime env if it is still set.
2. **Coolify environment (Buildtime type):** frontend `VITE_API_URL` (the image forces `/api/v1`); web `PUBLIC_SITE_URL` and `PUBLIC_API_URL`.
3. **Storage:** either configure object storage (ImageKit, or S3-compatible) or attach a persistent volume at `/data/uploads` writable by UID 1000; then upload, redeploy and re-fetch an image to prove durability.
4. **nginx body size:** approve the `client_max_body_size` change (SW-004) and redeploy the frontend.
5. **Resend:** verify the sending domain (SPF, DKIM, DMARC) and confirm live delivery of an invitation, an activation and a reset email to a real mailbox.
6. **Backups:** enable scheduled Postgres backups to off-site storage, record the last successful backup, run a restore test, and take a backup before the next migration.
7. **Auto-deploy gating:** check whether Coolify auto-deploys on push for the three apps; disable it and trigger deploys from CI after the build passes (SW-059).
8. **Replica and worker topology:** report the API replica count and whether a worker service exists, so exactly one process owns background jobs.
9. **Test accounts for authenticated verification:** provide staging (or production) accounts for SUPER_ADMIN/ADMIN, MANAGER, FINANCE_MANAGER, PROJECT_MANAGER, ENGINEER, QA_ENGINEER, STAFF, EDITOR and two CLIENT companies. Privileged accounts need their TOTP secrets (`E2E_ADMIN_TOTP_SECRET`) so the e2e suite and role matrix can run.
10. **Content and legal decisions:** replace or unpublish the seeded testimonials, team, posts, careers and portfolio, and confirm permission to show the client logos (SW-037).
11. **Product decisions:** default locale for web and portal (SW-063, SW-132); whether clients may have multiple logins (SW-020, CLAUDE.md §18); the HR permission model (SW-003); whether the two-administrator homepage publishing rule stays (SW-129); and the EVC Plus provider contract and sandbox access (SW-034).
12. **TLS:** from an unproxied machine, check the certificate issuer and expiry for the three hosts and the HTTP-to-HTTPS redirect.
13. **Approvals:** approve the remediation phases, the production migration windows and the Node 22 upgrade.

## N. Final audit declaration

**Verified** (a test, script or probe exercised it during this audit):

- Typecheck, lint, format and build pass for all workspaces; the unit/API suite passes (597/601 with 4 skipped; 601/601 on a disposable database); the second run fails once because of state leakage.
- All 55 migrations apply to an empty database; the schema-to-migration diff has two statements; the seed is idempotent by row count; the ledger balance trigger rejects unbalanced journals; case-variant duplicate emails insert; the invoice rounding mismatch and the Decimal overflow reproduce.
- Finance ledger flows, MFA gating (403 without proof, 200 with proof), the finance role matrix, invoice numbering under concurrency and concurrent overpayment protection pass locally.
- Production: `/health` checks Postgres and Redis; protected routes return the 401 envelope; unknown routes return the 404 envelope; CORS rejects foreign and `null` origins; the API sends helmet headers; web and app send no security headers; the app proxy shares a single rate-limit key; public pages and links resolve; the sitemap omits CMS detail pages; seeded demo content is served; and the deployed frontend matches HEAD.
- Local reproductions: the Task Planning date drift (TZ=Africa/Mogadishu), the 500 on non-Latin-1 download filenames, `javascript:` URLs passing Zod `url()`, and the login timing difference (281 ms vs 42 ms).

**Not verified** (code reading only, or blocked):

- Any authenticated production behaviour: RBAC per role, cross-tenant 404, 2FA, cookie flags, CSRF in a browser, idempotent replay, uploads, the finance dashboard error envelope.
- Coolify env values and types, volumes, replicas, logs, backups and auto-deploy; Resend delivery and domain records; S3/ImageKit; EVC Plus; GitHub App installations and webhooks; TLS certificates and redirects.
- The ImageKit re-platforming change (`feat/imagekit-media-storage`), which is outside this audit.
- Responsive layout at 375/768/1024/1440, Lighthouse/axe accessibility and RTL rendering (no signed-in browser walkthrough).

Every finding in the register cites file:line evidence or a probe result. SUSPECTED items are labelled as such. Nothing in the repository was modified by the audit agents; this documentation set is the only change.
