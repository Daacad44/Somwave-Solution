# Somwave Acceptance Matrix

| | |
|---|---|
| Date | 2026-10-17 |
| Repository state | `main` at `4323f55` (PR #86) |
| Related | [System audit report](SYSTEM_AUDIT_REPORT.md) · [Bug register](BUG_REGISTER.md) · [Remediation roadmap](REMEDIATION_ROADMAP.md) |

## Status definitions

| Status | Meaning in this matrix |
|---|---|
| VERIFIED | A test, script or probe run during this audit actually exercised the feature and it behaved as required. The evidence column says what ran (unit tests are noted as mocked where Prisma was mocked; "local" means a local database and server, not production). |
| PARTIAL | Implemented, but either a confirmed gap exists or only part of the behaviour was exercised (for example, code review only, or unit tests without an end-to-end run). |
| FAILED | A test, probe or confirmed code path shows the requirement is not met. |
| BLOCKED | Could not be checked; the missing access is named. |
| NOT IMPLEMENTED | No implementation exists (or no UI exists for a backend-only capability, where stated). |
| NOT TESTED | Implementation exists but nothing exercised it, and no confirmed defect was found. |

Statuses reported by agents as "VERIFIED (code)" (code reading only) are shown here as PARTIAL, because no test or probe exercised them. Static checks done by script (for example, a grep proving no `fetch` outside `lib/apiClient.ts`) are shown as VERIFIED, because the script fully checks the static requirement.

## 1. Public website

| Feature | Status | Evidence |
|---|---|---|
| Public pages render (homepage, 12 navigation/footer pages, 4 detail pages) | VERIFIED | Production GETs all 200; one h1 each; title, description, canonical, og and twitter tags present (CMS & Web audit) |
| No broken internal links or assets | VERIFIED | 27 production HEAD requests all 200 |
| Real 404 for an unknown slug | VERIFIED | `/blog/does-not-exist-audit` returned 404 |
| Public read API returns the envelope | VERIFIED | Production `/public/services`, `/faqs`, `/posts`, `/careers`, `/site-content` 200 `{data}`; unknown slug 404 envelope |
| Public API rate limiting present | VERIFIED | Production header `ratelimit-policy: 60;w=60` |
| Pagination capped at MAX_PAGE_SIZE (public posts) | VERIFIED | Production `pageSize=1000` returned `meta.pageSize: 100` |
| Sitemap and robots | PARTIAL | Index and robots work; CMS detail URLs missing; trailing-slash canonical mismatch (SW-062) |
| CMS-driven homepage sections | PARTIAL | Services, portfolio, testimonials, posts, faqs, hero, cta, contact, trusted come from `/public/homepage`; why, process, stats and examples are hardcoded (SW-127) |
| Published content is real business content | FAILED | Seeded testimonials, team, posts, careers and portfolio served in production (SW-037) |
| Contact and project-request forms | PARTIAL | `web/e2e/homepage.spec.ts` 9/9 passed locally with a mocked API; real submissions not tested (forbidden in production) |
| Form spam protection | PARTIAL | IP rate limit only; no honeypot or captcha (SW-126) |
| Careers applications reviewable with CV | FAILED | `resumeUrl` never shown to staff; `javascript:` accepted (SW-064) |
| JSON-LD safe against stored XSS | FAILED | Confirmed code path (SW-017) |
| Security headers on the web host | FAILED | Production probe: no CSP, HSTS, XFO, nosniff (SW-014) |
| SSR resilient to API rate limiting | NOT TESTED | Shared SSR bucket SUSPECTED (SW-006); a load test is needed |
| i18n: Somali default, translated body, hreflang, RTL | FAILED | English default, chrome-only switcher, no hreflang (SW-063) |
| Dark mode on web | NOT IMPLEMENTED | No `prefers-color-scheme` |
| Image optimisation and page weight | PARTIAL | 1.6-2.0 MB PNGs, 105 KB shared JS chunk (SW-128) |

## 2. CMS

| Feature | Status | Evidence |
|---|---|---|
| CMS CRUD and publish per module (services, posts, portfolio, careers, testimonials, team, FAQs) | PARTIAL | Service unit tests pass in the full suite (mocked); routes and services exist; no browser or API run |
| CMS image upload in production | BLOCKED | Needs Coolify env and an authenticated session; no stored image URLs in live content suggests failure (SW-005) |
| Upload failure path shows an error | VERIFIED | `e2e/storage-upload.spec.ts` passed locally (mocked API) |
| Storage readiness check | NOT IMPLEMENTED | `/health` covers only Postgres and Redis (SW-005) |
| Public image serving | PARTIAL | Stable public route; limited to 60/min per IP (SW-060); absolute host-derived URLs (SW-061) |
| Old images released on update and delete | PARTIAL | Articles only (SW-124) |
| Cache invalidation on publish | PARTIAL | Code review: Redis invalidation in most services; site content uncached |
| CMS lists searchable and paginated | FAILED | 0 search and 0 pagination controls; unbounded backend lists (SW-027) |
| Homepage publish workflow | PARTIAL | Requires two different administrators; undocumented (SW-129) |
| Newsletter consent, unsubscribe, export | NOT IMPLEMENTED | Collection only (SW-130) |
| CMS URL fields restricted to https | FAILED | Zod `url()` accepts `javascript:` (local check, SW-018) |
| CMS frontend tests | NOT TESTED | 0% line coverage for `features/cms` |

## 3. Authentication, users and roles

| Feature | Status | Evidence |
|---|---|---|
| Password login (real API) | VERIFIED | `e2e/auth.setup.ts` passed locally against a real API with a local non-2FA test user |
| 2FA preserved across refresh | VERIFIED | `finance.integration.test.ts` "2FA across refresh" on a disposable DB |
| Mandatory 2FA for privileged roles enforced server-side | FAILED | Confirmed code path; only the SPA redirects (SW-001) |
| 2FA attempt limits per account/challenge | FAILED | Confirmed code path; IP-only limiter (SW-015) |
| TOTP secret encrypted at rest | FAILED | Plaintext column (SW-016) |
| JWT access 15 min / refresh 30 days | PARTIAL | `tokens.ts:7-10`; `cookies.test` passes; production cookie not observed (BLOCKED: no credentials) |
| Cookies httpOnly + Secure + SameSite | FAILED | SameSite=None in production (SW-002) |
| Refresh rotation; reuse revokes all sessions | VERIFIED | `auth.service.test` (mocked unit) |
| Refresh tolerant of parallel tabs | NOT TESTED | No grace window; SUSPECTED forced logouts (SW-022) |
| Session invalidation on password reset and suspension | VERIFIED | `auth.service.test`; `user-onboarding.integration.test.ts` (reset revokes sessions) |
| Logout invalidates the session | PARTIAL | Refresh revoked; access token valid up to 15 min (SW-077) |
| Password reset OTP (crypto RNG, 6 digits, 10 min, 5 attempts, HMAC at rest) | VERIFIED | Unit tests and `user-onboarding.integration.test.ts` |
| Invitation single use; invitee sets own password | VERIFIED | `user-onboarding.integration.test.ts` "consumes an invitation once" (disposable DB; skipped in CI) |
| Invitation UI (create, failure, resend, cancel) | VERIFIED | `UserInvitations.test.tsx` |
| No account enumeration (login, forgot password) | FAILED | Login timing measured 281 ms vs 42 ms (SW-021); forgot-password timing (SW-075) |
| Password hashing | PARTIAL | Argon2id for new hashes, bcrypt legacy verify; timing leak (SW-021) |
| Login rate limit by IP and by account | PARTIAL | Both limiters exist; in-memory store (SW-076); shared IP through the proxy (SW-006) |
| Role set defined and seeded (13 roles, 70 permissions) | VERIFIED | Seed run twice on `somwave_dbaudit` with identical counts |
| RBAC created by migrations alone | FAILED | 15/70 permissions, 3/13 roles (SW-011) |
| Seed preserves admin role customisations and password | FAILED | Confirmed code path (SW-038) |
| Privilege-escalation guards around SUPER_ADMIN | PARTIAL | Code review only (`user.service.ts:107-145`, `role.service.ts:53-60`) |
| Case-insensitive unique email | FAILED | SQL insert of `Case@x.com` and `case@x.com` both succeeded (SW-039) |
| Re-invite a soft-deleted user's email | FAILED | Confirmed code path (SW-099) |
| Change password while signed in; admin 2FA reset | NOT IMPLEMENTED | SW-078 |
| Live invitation, activation and reset email delivery | BLOCKED | No Resend access |
| Role-by-role production walkthrough | BLOCKED | No production credentials with TOTP |

## 4. Projects

| Feature | Status | Evidence |
|---|---|---|
| Project service rules | VERIFIED | `project.service.test` 26 tests pass (mocked) |
| Create, edit and archive project | PARTIAL | Unit tests pass; invalid clientId gives 500, no date ordering (SW-102) |
| Project creation in the browser | FAILED | `projects.spec.ts:288` failed locally: two "New project" buttons (test locator defect, SW-071) |
| Restore an archived project | NOT IMPLEMENTED | No restore path |
| Status, priority, health | PARTIAL | List and detail health differ (SW-100) |
| PM assignment | PARTIAL | Not audited or notified (SW-102) |
| Engineer assignment during creation | PARTIAL | Non-atomic wizard (SW-103); `projects.spec.ts:51` failed locally |
| Engineer assignment on an existing project | PARTIAL | `projects.spec.ts:176` passed (mocked API); `assignment.test.ts` passes |
| "Unassigned" KPI and filter | PARTIAL | Includes completed/cancelled projects (SW-046) |
| Project dashboard tabs (real API) | FAILED | `projects.spec.ts:3` failed on an empty DB (needs fixture data, SW-071) |
| Progress calculation | FAILED | Cancelled tasks counted; five formulas (SW-045) |
| Dashboards refresh after assignment | PARTIAL | Dashboard query never invalidated (SW-104) |
| Project names hidden from non-members in search | FAILED | Confirmed code path (SW-024) |
| Project activity feed | PARTIAL | Omissions; finance events visible to all viewers (SW-112) |

## 5. Engineering

| Feature | Status | Evidence |
|---|---|---|
| Engineering service rules (submit, review, worklog, accounts) | VERIFIED | `engineering.service` 24, worklog 6, engineer-account 8 tests pass (mocked) |
| Engineering workspace loads from the real API | FAILED | `internal.spec.ts:4` failed: no h1 in the empty state (SW-143, SW-071) |
| Engineer registration, verification, activation | PARTIAL | `engineer-activation.spec` passed (mocked); cancelled invitation blocks the email (SW-051); admin e2e skipped (BLOCKED: admin TOTP) |
| Engineer account provisioning restricted to admins | PARTIAL | PMs can provision through project invites (SW-028, SUSPECTED impact) |
| Accept or decline project invitation | PARTIAL | Unit tests; email BLOCKED; 503-then-409 retry trap (SW-106) |
| Engineers see only accepted projects | PARTIAL | Legacy `/tasks` exposes draft proposals (SW-091) |
| Milestones and dependency cycle detection | PARTIAL | Transactional check; `milestone.service` 19 tests pass |
| Task dependencies and cycle detection | PARTIAL | Non-atomic check (SW-107, SUSPECTED) |
| Phases, epics, subtasks, checklists | NOT TESTED | Code present; not exercised end to end |
| Task lifecycle rules for every task | FAILED | Legacy tasks bypass transitions, dependencies and QA; `completedAt` never set (SW-047) |
| Independent code review step | FAILED | Assignee can move IN_REVIEW to TESTING (SW-048) |
| QA verification by QA engineers | FAILED | QA_ENGINEER lacks `engineering.tasks.review` (SW-012) |
| Task Planning date editing | FAILED | Reproduced 3-hour drift per save in Africa/Mogadishu (SW-065) |
| Kanban, Gantt, capacity calendar, workload | PARTIAL | Real API data; Gantt uses createdAt as start (SW-105) |
| Single active timer | PARTIAL | Partial unique index + P2002 to 409; schema drift risk (SW-108) |
| Manual hours validation | FAILED | Future dates and unlimited daily totals accepted (SW-109) |
| Time-entry correction and revision history in the UI | NOT IMPLEMENTED | Backend routes have no frontend caller (SW-090) |
| Daily and weekly progress reports | NOT TESTED | Code present |
| Reassignment and handover | PARTIAL | Serializable handover code; not exercised |
| Suspension revokes access | PARTIAL | Code review and unit tests |
| Timesheet approval | FAILED | Self-approval, no scope (SW-044) |
| Engineering analytics | PARTIAL | Formula variant (SW-045); 0.7% coverage |
| Project documentation permissions | FAILED | `project-documentation.*` never checked (SW-084) |
| Documentation file download with Arabic names | FAILED | Local Node reproduction returns 500 (SW-025) |
| Documentation-to-plan activation in the UI | NOT IMPLEMENTED | 5 plan routes have no frontend caller (SW-090) |

## 6. Bugs, maintenance and releases

| Feature | Status | Evidence |
|---|---|---|
| Bug lifecycle | PARTIAL | Reopen keeps the old SLA; no optimistic lock (SW-110) |
| SLA escalation reaches every breached record | FAILED | Fixed oldest-100 window (SW-049) |
| Critical bug alert reaches the PM | FAILED | `project.managerId` skipped (SW-050) |
| Maintenance recurrence | NOT TESTED | Next occurrence created in the same transaction (code) |
| Health checks SSRF-safe | VERIFIED | `system-health.service` 3 tests pass (mocked); live probe BLOCKED |
| Health alerts deduplicated across replicas | FAILED | One alert per process (SW-053) |
| Releases, deployments, approvals | PARTIAL | DEPLOYED without a deployment record; self-approval (SW-111) |
| Engineering operations service tests | NOT TESTED | 5.6% coverage (SW-074) |

## 7. GitHub

| Feature | Status | Evidence |
|---|---|---|
| Protected GitHub endpoints require auth | VERIFIED | Production unauthenticated GET `/github/repositories` 401 |
| Webhook HMAC (timing-safe, raw body) | VERIFIED | `github.service.test` signature tests pass (2) |
| Delivery deduplication | NOT TESTED | Unique deliveryId code path; no tests; stuck RECEIVED deliveries (SW-113) |
| Large webhook deliveries accepted | NOT TESTED | 256 KB limit; SUSPECTED rejection (SW-052) |
| GitHub env validated at boot | FAILED | Read from `process.env` directly (SW-114) |
| Install, connect, disconnect | BLOCKED | No GitHub App credentials |
| PR, issue, CI and task links; CI-to-QA | BLOCKED | No GitHub App; code review found gaps (SW-113) |
| Task links in the UI | NOT IMPLEMENTED | `/github/tasks/:taskId/links` has no frontend caller (SW-090) |

## 8. Client portal

| Feature | Status | Evidence |
|---|---|---|
| Portal API requires auth | VERIFIED | Production `/portal/projects` 401 |
| Portal projects and milestones pages | NOT TESTED | No frontend or e2e test; `portal.service` unit tests only; frontend 0% |
| Cross-tenant 404 for invoices, documents, tickets, portal | PARTIAL | Mocked unit tests; `portal.service.test.ts:70` is tautological (SW-073); no HTTP proof (SW-013) |
| Clients cannot see draft invoices | FAILED | Confirmed code path (SW-019) |
| Self-registration cannot attach to an existing client | FAILED | Auto-link by email (SW-020) |
| Progress consistent between portal pages | FAILED | Different formulas (SW-045) |
| Portal dashboard counts only client-visible milestones | FAILED | Confirmed code path (SW-101) |
| Portal language | PARTIAL | Mixed English/Somali (SW-132) |
| Client reports | NOT IMPLEMENTED | Backend reports exist; UI guard excludes clients (SW-141) |
| Inquiry attachments after sign-up | NOT IMPLEMENTED | Routes have no frontend caller (SW-090) |
| Ticket codes unique under concurrency | FAILED | `count()+1` without a lock (SW-040) |
| EVC Plus payment from the portal | BLOCKED | No provider sandbox; failure handling FAILED (SW-008) |

## 9. Finance

| Feature | Status | Evidence |
|---|---|---|
| Finance dashboard loads for a privileged user with MFA proof | VERIFIED | `finance.integration.test.ts` 200 and empty-data case (local) |
| Finance dashboard after 2FA enrolment without re-login | FAILED | Session gets no MFA proof (SW-007) |
| Finance dashboard in production | BLOCKED | No credentials; unauthenticated probe 401; deployed UI is post-#86 |
| Dashboard error shows the real cause | VERIFIED | Production chunk `FinancePage-DaGwO4xf.js` contains the `error.message` branch |
| MFA gate (403 without proof) | VERIFIED | Integration test (local) |
| Finance role matrix (ADMIN, FINANCE_MANAGER, ACCOUNTANT, PM, ENGINEER, CLIENT) | VERIFIED | Integration test: PM, ENGINEER, CLIENT get 403 on 7 endpoints (local; hand-written fixtures, SW-013) |
| Income/expense create, submit, approve, post | VERIFIED | Integration test (local) |
| Self-approval prevented | VERIFIED | Integration test (local) |
| Journals balanced (service and DB trigger) | VERIFIED | Integration test and SQL trigger test |
| Journal immutability and reversal | VERIFIED | Integration test (local) |
| Period close | PARTIAL | Works; UTC period assignment (SW-030) |
| Trial balance and CSV | PARTIAL | Unit/integration; CSV only |
| Project profitability (ledger) | VERIFIED | Integration test (local) |
| Project budget and expenses | PARTIAL | Not linked to the ledger (SW-119) |
| Invoice numbering race-safe | VERIFIED | `payment.integration.test.ts` concurrent invoices (disposable DB) |
| Invoice totals equal the sum of items | FAILED | Rounding mismatch and overflow reproduced (SW-032) |
| Tax and discount | PARTIAL | Absolute amounts only; discount <= total enforced |
| Partial/full payment and overpayment block | VERIFIED | `payment.integration.test.ts` concurrent payments |
| Idempotency-Key on payments (server) | VERIFIED | `payment.service.test` replay/mismatch (mocked unit) |
| Idempotency-Key reused on client retry | FAILED | Key regenerated in the catch block (SW-009) |
| EVC Plus webhook signature | PARTIAL | HMAC unit test passes; provider contract unverified (SW-034) |
| EVC Plus failure handling | FAILED | Orphaned PENDING payment (SW-008) |
| Webhook overpayment handling | FAILED | 409 forever (SW-031) |
| Invoice and payment actions require MFA and are audited | FAILED | Confirmed code path (SW-029) |
| Invoice-to-ledger reconciliation | NOT IMPLEMENTED | SW-033 |
| AR aging | PARTIAL | Row-level; no currency |
| Accounts payable | NOT IMPLEMENTED | SW-035 |
| Payroll, salaries, bonuses, allowances | NOT IMPLEMENTED | SW-035 |
| Recurring expenses (scheduled jobs) | NOT IMPLEMENTED | No BullMQ (SW-035) |
| Multi-currency and FX (USD/SOS) | NOT IMPLEMENTED | Per-currency grouping only |
| Financial audit logs | PARTIAL | Ledger audited; invoices/payments not (SW-029) |
| Financial notifications | NOT IMPLEMENTED | Only the invoice-sent email |
| Soft-delete of financial records | PARTIAL | `deletedAt` on Invoice, Payment, ProjectExpense; Cascade FKs remain (SW-043) |

## 10. Reports and dashboard

| Feature | Status | Evidence |
|---|---|---|
| Reports catalog and CSV export | PARTIAL | Unit tests (`reports.service` 63%); CSV only |
| PDF/Excel exports | NOT IMPLEMENTED | No exceljs, react-pdf or puppeteer (SW-122) |
| Scheduled or emailed reports | NOT IMPLEMENTED | SW-122 |
| P&L, balance sheet, cash flow | NOT IMPLEMENTED | SW-122 |
| Consistent date-range semantics | FAILED | Inclusive vs exclusive `to` (SW-123) |
| Main dashboard revenue KPI | FAILED | Ignores range; always non-negative trend (SW-036) |
| Dashboard aggregates tested | NOT TESTED | `dashboard.service` 8.5% coverage (SW-074) |
| Dashboard excludes archived and deleted rows | FAILED | Archived project work and deleted leave counted (SW-091, SW-092) |

## 11. HR and notifications

| Feature | Status | Evidence |
|---|---|---|
| Attendance and leave scoped to the employee | FAILED | Confirmed code path (SW-003) |
| Leave self-approval prevented | FAILED | No guard (SW-003) |
| Employee edit from the UI | NOT IMPLEMENTED | `PATCH /employees/:id` has no caller (SW-090) |
| Employee creation transactional | FAILED | Two writes, no transaction; created on GET (SW-042) |
| HR service tests | NOT TESTED | `hr.service` 16.3% coverage |
| Notification queue claims and dedupe | PARTIAL | Unit tests (`notification-delivery` 73%) |
| Single background-job owner | FAILED | Timers on every replica; worker cannot start from the image (SW-053) |
| Live email delivery and retry | BLOCKED | No Resend access |

## 12. Database

| Feature | Status | Evidence |
|---|---|---|
| Migrations apply from scratch | VERIFIED | 55/55 in 2.29 s on `somwave_dbaudit`; 2.70 s on an isolated schema; also applied by QA |
| Schema and migrations in sync | FAILED | `migrate diff` returns 2 statements (SW-093) |
| Seed idempotent | PARTIAL | Identical row counts after two runs; side effects (SW-038) |
| Migrations alone produce a usable RBAC | FAILED | SW-011 |
| pgvector dependency | VERIFIED | Not required: 0 references; migrations apply without it |
| Money stored as Decimal | VERIFIED | Script check: 0 Float columns |
| Ledger journals must balance (DB-enforced) | VERIFIED | SQL test: unbalanced finalize rejected |
| Invoice and items atomic, numbered safely | PARTIAL | Transaction + advisory lock (code); rounding defect (SW-032) |
| Unique constraints (invoice number, idempotency key, webhook delivery id) | VERIFIED | Present in the migrated schema |
| Case-insensitive unique email | FAILED | SW-039 |
| HR records owner-scoped | FAILED | SW-003 |
| Financial/HR records never hard-deleted | PARTIAL | Soft delete in services; Cascade FKs remain (SW-043) |
| Soft-delete filtering consistent | PARTIAL | SW-091, SW-092 |
| Indexed foreign keys | FAILED | 37 unindexed FKs (SW-095) |
| Production DB state and migration history | BLOCKED | No database credentials |

## 13. API

| Feature | Status | Evidence |
|---|---|---|
| `/health` pings Postgres and Redis | VERIFIED | Production `GET /health` 200 with both checks true |
| Protected routes return the 401 envelope | VERIFIED | 13 production GETs returned 401 `UNAUTHORIZED` |
| Unknown route returns the 404 envelope | VERIFIED | Production `/api/v1/nope-xyz` 404 |
| CORS locked to known origins | VERIFIED | Production preflights: evil and `null` origins get no ACAO; app and web origins allowed |
| Every route authenticated or intentionally public | VERIFIED | Script over the route inventory: 34 unauthenticated routes, all intentional |
| Response envelope on every JSON endpoint | VERIFIED | Script check: no `res.json` outside `lib/http.ts` |
| Prisma only in services | VERIFIED | Script check of controllers, routes and middleware |
| Frontend calls all resolve to backend routes | VERIFIED | 299/299 matched by script |
| RBAC on every route, tested per role | FAILED | No route-level tests; 36 routes rely on service checks (SW-013) |
| Per-user scoping, 404 for others' rows | PARTIAL | Spot checks pass; HR (SW-003) and search (SW-024) fail |
| Pagination with `meta.total` on lists | FAILED | Unbounded and silently capped lists (SW-027) |
| `?sort=` contract | NOT IMPLEMENTED | SW-086 |
| Query and params validation from shared schemas | FAILED | Body only (SW-083); large page values likely 500 (SW-080) |
| Idempotency-Key on money and messaging endpoints | PARTIAL | Money yes; messaging largely missing (SW-081) |
| Error handler hides internals | PARTIAL | Code review: generic message; logs too thin (SW-010) |
| Known Prisma errors mapped to 4xx | FAILED | P2002/P2025/P2034 become 500 (SW-010) |
| Log redaction of cookies and authorization | PARTIAL | Code review (`lib/logger.ts:8-20`); one-level paths (SW-118) |
| Request id correlation | FAILED | X-Request-ID differs from the log id (SW-087) |
| API reference complete | FAILED | About 190 endpoints undocumented (SW-089) |
| Authenticated RBAC, 404 and idempotent replay in production | BLOCKED | No production credentials |

## 14. Security

| Feature | Status | Evidence |
|---|---|---|
| API security headers (helmet, HSTS) | VERIFIED | Production response headers |
| Web and app security headers | FAILED | Production probes (SW-014) |
| CSRF posture | FAILED | SW-002 |
| XSS in frontend markdown | PARTIAL | Code review: DOMPurify around every `marked` output |
| XSS on the public site | FAILED | SW-017, SW-018 |
| SSRF controls | VERIFIED | `system-health.service` tests (mocked); GitHub URL host check by code review |
| Upload magic bytes, size limits, safe keys, traversal protection | PARTIAL | Code review (`storage.ts`); storage unit tests pass |
| Presigned upload/download URLs (CLAUDE.md §13) | NOT IMPLEMENTED | Files streamed through the API |
| Payment and GitHub webhook signatures | VERIFIED | Unit tests (evcplus.client, github.service) |
| Secrets not committed | VERIFIED | `git ls-files` scan: only `.env.example` placeholders |
| Production dependencies free of critical/high advisories | FAILED | `npm audit --omit=dev`: 3 critical, 18 high (SW-023) |
| Large bodies rejected before auth | FAILED | Parsers before the limiter and auth (SW-026) |
| Sensitive columns encrypted at rest | FAILED | TOTP plaintext (SW-016) |
| Penetration test with sessions (role by role, cross-tenant) | BLOCKED | No production or staging credentials |

## 15. Infrastructure

| Feature | Status | Evidence |
|---|---|---|
| Production frontend uses the same-origin API | VERIFIED | Bundle contains `/api/v1` fetches |
| Deployed frontend matches HEAD `4323f55` | VERIFIED | Finance chunk size and CSS hash identical to the local build |
| Static asset caching | VERIFIED | `/assets/*` `Cache-Control: public, immutable`, 1 year |
| `index.html` revalidated after deploy | FAILED | No Cache-Control (SW-117) |
| Uploads over 1 MB through the app | FAILED | nginx default limit (config; live POST not run) (SW-004) |
| Per-client rate limiting and login lockout isolation | FAILED | Production probe of the shared bucket (SW-006) |
| Server banner minimised | PARTIAL | app: `server: nginx` (no version) |
| Non-root containers | PARTIAL | API and web `USER node`; nginx master runs as root |
| Multi-stage images with devDeps pruned | PARTIAL | Code review of the Dockerfiles |
| Compiled production build | NOT IMPLEMENTED | Runs `tsx` (SW-115) |
| Graceful shutdown | PARTIAL | No timeout (SW-116) |
| Single background-job owner / worker deploy path | FAILED | SW-053 |
| BullMQ job queue | NOT IMPLEMENTED | Custom timers |
| Health independent of Redis outages | FAILED | Redis failure returns 503 (SW-055) |
| Persistent uploads volume | BLOCKED | No Coolify access (SW-054) |
| Database backups and restore | BLOCKED | Nothing in the repository; Coolify not visible (SW-058) |
| Monitoring and alerting | NOT IMPLEMENTED | SW-058 |
| CI gates deploys | BLOCKED | Coolify auto-deploy setting not visible; CI has no deploy job (SW-059) |
| CI runs e2e, image builds and audit | NOT IMPLEMENTED | SW-059 |
| Supported and consistent Node version | FAILED | Node 20 EOL in production; 22 locally (SW-056) |
| Env validated at boot | PARTIAL | GitHub and worker gaps (SW-114) |
| TLS certificate validity and expiry | BLOCKED | The sandbox egress gateway re-signs TLS |
| HTTP to HTTPS redirect | BLOCKED | Origin behaviour not observable through the proxy |

## 16. UI and accessibility

| Feature | Status | Evidence |
|---|---|---|
| Frontend typecheck and lint | VERIFIED | `tsc --noEmit` and `eslint frontend/src` exit 0 |
| Frontend production build | VERIFIED | `vite build` succeeds |
| `fetch` only in `lib/apiClient.ts` | VERIFIED | Script check (grep) |
| No `any`, `ts-ignore` or `eslint-disable` | VERIFIED | Script check (grep) |
| No mock or hardcoded data in the app | VERIFIED | Script check (grep) |
| Lazy routes | PARTIAL | All feature routes lazy; heavy tabs imported statically (SW-140) |
| Route guards match nav permissions | PARTIAL | Consistent (`nav.test.ts`); SW-141, SW-084 |
| Unknown route handling | FAILED | Blank screen (SW-133) |
| Four states on data views | PARTIAL | Present on the pages checked (code review); not exercised in a browser |
| Content-shaped skeletons | PARTIAL | Generic rows |
| Forms use RHF + shared Zod | PARTIAL | 23 files yes; about 25 manual forms (SW-138) |
| Tables over 10 rows searchable and paginated | FAILED | At least 16 views (SW-027) |
| Confirm dialogs for destructive actions | PARTIAL | Main CRUD yes; gaps (SW-066) |
| Single shared date picker | FAILED | 33 raw date inputs (SW-067) |
| Palette on-system | PARTIAL | One default class, off-spec brand blue (SW-134) |
| Dark mode | PARTIAL | Implemented in the app; contrast and auth-page gaps (SW-134) |
| RTL logical properties and Arabic | NOT IMPLEMENTED | About 70 physical classes; no `dir` switch (SW-135) |
| Responsive at 375/768/1024/1440 | NOT TESTED | No signed-in device run (BLOCKED: no credentials) |
| Touch targets >= 44 px | PARTIAL | `Button sm` is 36 px (SW-137) |
| Keyboard, focus and ARIA | PARTIAL | Modal focus management missing (SW-136); empty-state h1 missing (SW-143) |
| Internal screens in English | PARTIAL | SW-131 |
| Dates in Africa/Mogadishu | PARTIAL | `lib/date.ts` tested; SW-065 (reproduced drift), SW-139 |
| Optimistic mutations with rollback | NOT IMPLEMENTED | SW-142 |

## 17. Tests and CI

| Feature | Status | Evidence |
|---|---|---|
| Migrations apply to an empty DB (CI step) | VERIFIED | `01_migrate.log`, exit 0 |
| Seed first run | VERIFIED | `02_seed.log`, exit 0 |
| Typecheck (all workspaces) | VERIFIED | `03_typecheck.log`, exit 0 |
| Lint | VERIFIED | `04_lint.log`, exit 0 |
| Format check | VERIFIED | `05_format.log`, exit 0 |
| Unit and API suite | VERIFIED | 597/601 passed, 4 skipped; 601/601 on a disposable DB |
| Suite re-runnable without state leakage | FAILED | `08_test_run2.log`: 1 failure (SW-070) |
| Build (all workspaces) | VERIFIED | `07_build.log`, exit 0 |
| Coverage >= 70% | FAILED | Lines 33.45% (SW-068) |
| Coverage threshold enforced | NOT IMPLEMENTED | `vitest.config.ts` has no thresholds (SW-068) |
| Real-DB integration tests in CI | FAILED | Skipped in CI (SW-069) |
| Root Playwright e2e | FAILED | 23 passed / 8 failed / 2 skipped (SW-071) |
| Web Playwright e2e | VERIFIED | 9/9 passed locally with a mocked API; not in CI (SW-072) |
| Per-role RBAC tests | PARTIAL | Finance only (SW-013) |
| Cross-tenant 404 tests | PARTIAL | Mocked unit only (SW-073) |
| E2E against production | BLOCKED | No credentials or TOTP |

## Reconciliation with docs/MASTER_ACCEPTANCE.md

`docs/MASTER_ACCEPTANCE.md` (snapshot of 14 October 2026) uses COMPLETE / PARTIAL / BLOCKED / FAILED. The table below proposes a status for each row based on this audit. The file itself has **not** been edited; apply these changes in a separate, reviewed change if accepted.

### Feature status rows

| Row in MASTER_ACCEPTANCE.md | Old status | Proposed status | Reason |
|---|---|---|---|
| Internal English copy | PARTIAL | PARTIAL | Somali strings remain on internal screens and in staff-facing backend messages (SW-131) |
| Engineer email registration and identity reuse | PARTIAL | PARTIAL | Unit tests pass; a cancelled invitation permanently blocks the email (SW-051); PMs can provision accounts (SW-028); live Resend BLOCKED |
| Email verification, token expiry, resend, activation | PARTIAL | PARTIAL | Unit tests and the mocked `engineer-activation.spec` pass; the admin e2e is skipped for lack of TOTP; live delivery BLOCKED |
| New and existing project assignments | PARTIAL | PARTIAL | "Unassigned" KPI wrong (SW-046); wizard non-atomic (SW-103); `projects.spec.ts:51` failed locally |
| Assignment email, in-app notice, accept/decline | PARTIAL | PARTIAL | 503-then-409 retry trap (SW-106); email BLOCKED |
| Engineer management dashboard and detail | PARTIAL | PARTIAL | Not exercised in a browser; admin e2e skipped (BLOCKED: TOTP) |
| Skills, availability and capacity | PARTIAL | PARTIAL | Not exercised; availability removal has no confirm dialog (SW-066) |
| Project roles and authorization | PARTIAL | FAILED | QA_ENGINEER cannot verify QA (SW-012); search leaks project names (SW-024); legacy `/tasks` exposes drafts (SW-091); documentation permissions never checked (SW-084); no route-level RBAC tests (SW-013) |
| Project documentation | COMPLETE | PARTIAL | `project-documentation.*` permissions never checked (SW-084); Arabic file names return 500 on download (SW-025); 11 documentation routes have no UI caller (SW-090); destructive actions without confirm (SW-066); service coverage 32.8% |
| Documentation-to-plan activation | PARTIAL | NOT IMPLEMENTED | The backend exists, but all 5 plan routes (list, create, get, activate, reject) have no frontend caller, so users cannot reach the feature (SW-090) |
| Scheduling, Kanban, calendar, Gantt | PARTIAL | PARTIAL | Date-time editor drifts 3 h per save (SW-065, reproduced); Gantt starts bars at createdAt (SW-105) |
| Engineer workspace and task creation | PARTIAL | PARTIAL | `internal.spec.ts:4` fails on an empty DB because the empty state has no h1 (SW-143) |
| Task review and QA | COMPLETE | FAILED | QA_ENGINEER cannot perform QA verification (SW-012); assignee can self-advance from review (SW-048); legacy tasks bypass every gate (SW-047); stale CI runs can satisfy QA (SW-113) |
| Daily/weekly progress reports | PARTIAL | NOT TESTED | Code present (`engineering-worklog.service.ts:230-353`); not exercised by any test or probe in this audit |
| Time tracking | PARTIAL | PARTIAL | Timer constraint is race-safe; future dates and unlimited daily totals accepted (SW-109); correction and revision history have no UI caller (SW-090); index not in schema.prisma (SW-108) |
| Updates, releases, bugs, maintenance | PARTIAL | PARTIAL | SLA scan starvation (SW-049); PM not alerted on critical bugs (SW-050); release gate bypass (SW-111); 5.6% coverage |
| Project and engineer analytics | PARTIAL | PARTIAL | Progress formulas inconsistent (SW-045); `completedAt` missing for legacy tasks (SW-047); 0.7% coverage |
| Notification preferences, retries, reminders | PARTIAL | PARTIAL | Duplicate health alerts per replica; worker cannot start from the image (SW-053); live Resend BLOCKED |
| Reassignment and handover | PARTIAL | PARTIAL | Code present; not exercised |
| Audit and request correlation | PARTIAL | PARTIAL | X-Request-ID differs from the log id (SW-087); invoices and payments not audited (SW-029); activity feed omissions (SW-112) |
| Backend security | PARTIAL | FAILED | Server-side 2FA not enforced (SW-001); CSRF exposure (SW-002); HR IDOR (SW-003); 2FA brute-force limits (SW-015) |
| Automated tests | COMPLETE | FAILED | The suite now has 601 tests in 102 files and passes once, but fails on re-run (SW-070); coverage 33.45% vs the 70% target (SW-068); CI skips all 13 real-DB tests (SW-069); no route-level RBAC tests (SW-013) |
| Browser end-to-end tests | PARTIAL | FAILED | Root suite 23 passed / 8 failed / 2 skipped on a fresh local DB; not run in CI (SW-071) |
| Existing feature regression | PARTIAL | PARTIAL | Web e2e 9/9 locally (mocked API); public pages verified in production; no staging regression run |

### Deployment gates and external blockers

| Gate in MASTER_ACCEPTANCE.md | Old status | Proposed status | Reason |
|---|---|---|---|
| 1. Resend live delivery | BLOCKED | BLOCKED | Still no Resend access; domain verification and mailbox tests outstanding |
| 2. Production storage | BLOCKED | BLOCKED | Storage env not visible (SW-005, SW-054); also fix the nginx body limit (SW-004); the ImageKit re-platforming (`feat/imagekit-media-storage`) changes the variables to configure |
| 3. Migrations and multi-role verification | BLOCKED | BLOCKED | Needs production backup and credentials; note that migrations alone do not create the RBAC (SW-011) and the schema has 2 drift statements (SW-093) |
| 4. Operations | PARTIAL | FAILED | Shared rate-limit bucket confirmed in production (SW-006); background jobs run on every replica by default (SW-053); a Redis outage fails the health check (SW-055); no backups or monitoring evidenced (SW-058) |
| 5. Review | PARTIAL | PARTIAL | This audit completes a legacy authorization and copy review; responsive and accessibility review in a browser is still outstanding |
