# Somwave Bug Register (consolidated)

| | |
|---|---|
| Date | 2026-10-17 |
| Repository state | `main` at `4323f55` (PR #86) |
| Sources | Nine specialist audit reports (frontend, API, database, security, projects/engineering, finance, CMS/web, infrastructure, QA) |
| Related | [System audit report](SYSTEM_AUDIT_REPORT.md) · [Remediation roadmap](REMEDIATION_ROADMAP.md) · [Acceptance matrix](ACCEPTANCE_MATRIX.md) |

## How to read this register

- 175 findings were raised by the nine agents. After merging duplicates, **144 unique findings** remain.
- IDs `SW-001`... are ordered by severity (P0, then P1, P2, P3). The original agent IDs are kept under **Sources** so each item can be traced to the area reports.
- **Severity** follows the audit brief: P0 = data loss, account takeover, unauthorized financial access, outage; P1 = broken essential workflow, major permission error or failing critical integration; P2 = incomplete functionality, non-critical failure, wrong calculation or significant UX issue; P3 = minor UI, accessibility or documentation.
- **Confidence**: CONFIRMED means an agent saw the code path or reproduced it; SUSPECTED means the mechanism is plausible but was not proven. Where a merged entry contains both, the entry is CONFIRMED and the suspected part is called out in its text.
- When merged findings disagreed in severity, the higher severity was kept; the reason is given in the **Merge note**.
- No agent raised a P0. No finding below was reproduced against production with credentials; production probes were unauthenticated GET/HEAD/OPTIONS only.

## Counts

| Severity | Total | CONFIRMED | SUSPECTED |
|---|---|---|---|
| P0 | 0 | 0 | 0 |
| P1 | 13 | 13 | 0 |
| P2 | 61 | 56 | 5 |
| P3 | 70 | 67 | 3 |
| **All** | **144** | **136** | **8** |

## Summary table

| ID | Sev | Conf | Module | Title | Sources |
|---|---|---|---|---|---|
| [SW-001](#sw-001) | P1 | CONFIRMED | Auth / RBAC | Mandatory 2FA for privileged roles is enforced only in the frontend | SEC-001 |
| [SW-002](#sw-002) | P1 | CONFIRMED | Auth cookies / all mutating routes | CSRF exposure: production cookies are SameSite=None and nothing checks Origin or a CSRF token | SEC-002 |
| [SW-003](#sw-003) | P1 | CONFIRMED | HR (attendance, leave) | HR endpoints trust employeeId from the request body (IDOR): any STAFF can check in/out or file leave for any employee and read everyone's HR records | API-002, DB-004 |
| [SW-004](#sw-004) | P1 | CONFIRMED | Frontend infra / all uploads | App nginx proxy has no client_max_body_size: uploads over ~750 KB through app.* get HTTP 413 | INF-001 |
| [SW-005](#sw-005) | P1 | CONFIRMED | Storage (all upload modules) | "Image storage is unavailable": storage is one global fail-closed condition with no readiness signal (production trigger unverified) | STO-001 |
| [SW-006](#sw-006) | P1 | CONFIRMED | Deploy / rate limiting (app proxy and web SSR) | API is reached through public-hostname hairpins, so all app users (and all SSR page views) share one rate-limit bucket, including the login limiter | INF-002, FE-008, INF-016, WEB-001 |
| [SW-007](#sw-007) | P1 | CONFIRMED | Finance dashboard / auth | "Could not load finance dashboard": the session never gains MFA proof after 2FA enrolment, so privileged users get 403 (old bundle masked the real error) | FIN-001, FE-021 |
| [SW-008](#sw-008) | P1 | CONFIRMED | Payments (EVC Plus) | EVC Plus charge leaves an orphaned PENDING payment whenever the provider call fails (always, while EVC is unconfigured) | FIN-004 |
| [SW-009](#sw-009) | P1 | CONFIRMED | Portal payments / manual payments (frontend) | Payment Idempotency-Key is regenerated after a failed or ambiguous request (duplicate-charge risk) | FE-001 |
| [SW-010](#sw-010) | P1 | CONFIRMED | Backend platform / diagnostics | Central error handler discards the error; Prisma known errors (P2002/P2025/P2034) become HTTP 500 | FIN-002, DB-006, API-011 |
| [SW-011](#sw-011) | P1 | CONFIRMED | Core / RBAC / deployment | A fresh production DB is unusable without the dev seed: migrations create only 15 of 70 permissions and 3 of 13 roles | DB-001 |
| [SW-012](#sw-012) | P1 | CONFIRMED | Engineering QA | QA_ENGINEER role cannot perform QA verification (or comment, log progress or hours) | ENG-001 |
| [SW-013](#sw-013) | P1 | CONFIRMED | All routes / authorization tests | No HTTP-level test proves the auth, RBAC and cross-tenant 404 contract for any route | API-001, QA-007 |
| [SW-014](#sw-014) | P2 | CONFIRMED | Web / frontend deploy | Public website and React app send no security headers (no CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy) | SEC-008, FE-007, INF-007 |
| [SW-015](#sw-015) | P2 | CONFIRMED | Auth / 2FA | 2FA login step has no per-account or per-challenge attempt limit; challenge token reusable for 5 minutes; TOTP codes replayable | SEC-004, API-006 |
| [SW-016](#sw-016) | P2 | CONFIRMED | Auth / 2FA storage | TOTP secrets stored in plaintext; backup codes are unsalted SHA-256 over 32 bits | DB-017, SEC-005 |
| [SW-017](#sw-017) | P2 | CONFIRMED | Public website (Astro) / CMS | Stored XSS on the public site through JSON-LD `set:html={JSON.stringify(...)}` | WEB-005, SEC-006 |
| [SW-018](#sw-018) | P2 | CONFIRMED | Shared schemas / CMS / web | `javascript:` and arbitrary/plain-http URLs accepted for CMS URL fields and rendered on the public site | SEC-007, CMS-004 |
| [SW-019](#sw-019) | P2 | CONFIRMED | Invoices / Portal | Client portal users can read their DRAFT (and VOID) invoices | SEC-009 |
| [SW-020](#sw-020) | P2 | CONFIRMED | Project inquiry / Portal onboarding | Public project-inquiry sign-up auto-links a new portal login to an existing Client with a matching email | SEC-010 |
| [SW-021](#sw-021) | P2 | CONFIRMED | Auth login | Login timing reveals which emails have accounts (Argon2 users ~7x faster than unknown emails) | SEC-003 |
| [SW-022](#sw-022) | P2 | SUSPECTED | Auth refresh | Strict refresh rotation has no grace window: parallel tabs or a lost response trigger "reuse" and log out every device | SEC-012 |
| [SW-023](#sw-023) | P2 | CONFIRMED | Dependencies | Production dependency vulnerabilities: 3 critical, 18 high, 10 moderate | SEC-011, INF-014 |
| [SW-024](#sw-024) | P2 | CONFIRMED | Search | Global search ignores project membership and leaks names of all projects and tasks | API-003 |
| [SW-025](#sw-025) | P2 | CONFIRMED | Documents / Portal / Engineering attachments / Project documentation | File downloads return 500 for non-Latin-1 filenames; Content-Disposition built from raw names | API-004, SEC-016 |
| [SW-026](#sw-026) | P2 | CONFIRMED | app.ts | Large JSON bodies (up to 35 MB) are parsed before authentication and before the rate limiter | API-005 |
| [SW-027](#sw-027) | P2 | CONFIRMED | CRM, HR, Finance, Tickets, CMS, Audit, Notifications | Large lists lack search/filter/pagination; backend list endpoints are unbounded or silently capped at 100 with no meta.total | FE-003, API-007, CMS-001 |
| [SW-028](#sw-028) | P2 | SUSPECTED | Engineer registration | Project managers can provision new user accounts and grant the ENGINEER role via project invite (bypassing admin-only onboarding) | ENG-007, SEC-017 |
| [SW-029](#sw-029) | P2 | CONFIRMED | Invoices / Payments RBAC | Invoice and payment endpoints bypass finance hardening: no MFA proof, no approval, no audit log; MANAGER can record payments | FIN-008 |
| [SW-030](#sw-030) | P2 | CONFIRMED | General ledger / period close | Accounting-period assignment uses the UTC month while dates are Mogadishu midnight: first-of-month transactions land in the previous period | FIN-003 |
| [SW-031](#sw-031) | P2 | CONFIRMED | Payments / webhook | Webhook overpayment path rolls back and returns 409 forever; captured money is never recorded | FIN-005 |
| [SW-032](#sw-032) | P2 | CONFIRMED | Finance / Invoices | Invoice line totals are not rounded before summing (subtotal can disagree with stored lines); large values overflow to 500 | DB-008, FIN-006 |
| [SW-033](#sw-033) | P2 | CONFIRMED | AR / ledger | Invoices and payments are outside the ledger: revenue exists in two unreconciled systems; invoices have no currency | FIN-007 |
| [SW-034](#sw-034) | P2 | CONFIRMED | Payments (EVC Plus) | EVC Plus client is a generic placeholder contract; webhook has no replay window and no amount reconciliation | FIN-013, SEC-021 |
| [SW-035](#sw-035) | P2 | CONFIRMED | HR / Finance scope | Payroll, salaries, bonuses, allowances, AP, recurring expenses, bank reconciliation and FX are not implemented | FIN-009 |
| [SW-036](#sw-036) | P2 | CONFIRMED | Dashboard | Main dashboard "Revenue collected" KPI ignores the selected range; trend is misleading; USD assumed | RPT-001 |
| [SW-037](#sw-037) | P2 | CONFIRMED | Website / CMS data | Seeded demo content is live in production as real testimonials, team, portfolio, careers and posts | WEB-002, DB-002 |
| [SW-038](#sw-038) | P2 | CONFIRMED | Core / RBAC / seed | Re-running the seed overwrites admin-edited role permissions and resets the super-admin password | DB-003, SEC-018 |
| [SW-039](#sw-039) | P2 | CONFIRMED | Core / auth / portal onboarding | Email uniqueness is case-sensitive at the DB level; app-level case-insensitive checks are racy | DB-005 |
| [SW-040](#sw-040) | P2 | CONFIRMED | Portal tickets | Support-ticket codes come from count()+1 without a lock; concurrent creates collide (500) | DB-007 |
| [SW-041](#sw-041) | P2 | SUSPECTED | Finance / Invoices | `sendInvoice` is not locked or status-guarded and can resurrect a VOID invoice | DB-009 |
| [SW-042](#sw-042) | P2 | CONFIRMED | HR / Timesheets | Employee records are created non-transactionally and implicitly (including on GET /timesheets) and break for soft-deleted employees | DB-010 |
| [SW-043](#sw-043) | P2 | CONFIRMED | HR, Finance, PM schema | Cascading deletes on HR, financial and time records (latent data-loss risk) | DB-011 |
| [SW-044](#sw-044) | P2 | CONFIRMED | Timesheets | Timesheet approval is unscoped and effectively self-approval | ENG-006 |
| [SW-045](#sw-045) | P2 | CONFIRMED | Projects / Dashboard / Portal | Progress counts cancelled tasks; five inconsistent progress formulas across surfaces | PRJ-001 |
| [SW-046](#sw-046) | P2 | CONFIRMED | Projects portfolio | "Unassigned projects" KPI and filter include COMPLETED/CANCELLED projects and projects with pending invitations | PRJ-002 |
| [SW-047](#sw-047) | P2 | CONFIRMED | Tasks | Legacy task path has no lifecycle rules; completedAt never set; assignee can mark DONE directly | PRJ-003 |
| [SW-048](#sw-048) | P2 | CONFIRMED | Engineering task workflow | Assignee can self-advance IN_REVIEW -> TESTING (code review step not independent) | ENG-002 |
| [SW-049](#sw-049) | P2 | CONFIRMED | Bugs / maintenance SLA | SLA escalation scan starves: always the same oldest 100 breached records | ENG-003 |
| [SW-050](#sw-050) | P2 | CONFIRMED | Bugs | Critical-bug alert skips the project's primary manager (project.managerId) | ENG-004 |
| [SW-051](#sw-051) | P2 | CONFIRMED | Engineer registration | Cancelled engineer account invitation permanently blocks that email | ENG-005 |
| [SW-052](#sw-052) | P2 | SUSPECTED | GitHub | GitHub webhook body limit of 256 KB will reject legitimate large deliveries | ENG-008 |
| [SW-053](#sw-053) | P2 | CONFIRMED | Jobs / notifications | Background jobs are in-process setInterval timers (no BullMQ) running on every API replica; the documented dedicated worker cannot be started from the image | INF-005, ENG-017 |
| [SW-054](#sw-054) | P2 | SUSPECTED | Storage | Filesystem storage durability depends on an unverified Coolify volume; storageStatus() reports durable regardless | INF-011 |
| [SW-055](#sw-055) | P2 | CONFIRMED | Health | A Redis outage takes the whole API down through the healthcheck, although Redis is only a cache | INF-006 |
| [SW-056](#sw-056) | P2 | CONFIRMED | All images / CI | Runtime is Node 20, which reached end-of-life in April 2026; local dev uses Node 22 | INF-003 |
| [SW-057](#sw-057) | P2 | CONFIRMED | Deploy | Migrations run on every container start with no backup, no deploy ordering and no separation from the app | INF-004 |
| [SW-058](#sw-058) | P2 | CONFIRMED | Ops | No backup, restore or monitoring artifacts in the repository | INF-012 |
| [SW-059](#sw-059) | P2 | CONFIRMED | CI/CD | CI does not gate deploys, run e2e, build the Docker images or audit dependencies | INF-013 |
| [SW-060](#sw-060) | P2 | CONFIRMED | Storage / public site | Public image route shares the 60 requests/minute public rate limit | STO-002 |
| [SW-061](#sw-061) | P2 | CONFIRMED | CMS images | Image URLs are absolute, take their host from the request, and only the id is validated | STO-003 |
| [SW-062](#sw-062) | P2 | CONFIRMED | SEO | Sitemap omits every CMS detail page; canonical URLs differ by trailing slash | WEB-003 |
| [SW-063](#sw-063) | P2 | CONFIRMED | Public website i18n | Locale and i18n contradict the requirements: English default, chrome-only translation, no hreflang | WEB-004 |
| [SW-064](#sw-064) | P2 | CONFIRMED | Careers / Recruitment | Careers applicants' resume URL is stored but never shown to staff; `javascript:` URLs accepted | WEB-007 |
| [SW-065](#sw-065) | P2 | CONFIRMED | Engineering -> Task Planning | Task Planning date-time editor shifts saved dates by the UTC offset on every save | FE-002 |
| [SW-066](#sw-066) | P2 | CONFIRMED | Projects, Engineering, Finance UI | Destructive actions without a confirm dialog | FE-004 |
| [SW-067](#sw-067) | P2 | CONFIRMED | UI kit compliance | Duplicate form controls: raw date inputs, selects, textareas and tables bypass the shared kit | FE-010 |
| [SW-068](#sw-068) | P2 | CONFIRMED | Test infrastructure | Coverage far below the 70% Definition of Done and no threshold enforced; frontend business screens untested | QA-001, FE-022 |
| [SW-069](#sw-069) | P2 | CONFIRMED | CI / backend tests | CI runs zero real-database tests; 48 of 51 backend service test files mock Prisma | QA-002 |
| [SW-070](#sw-070) | P2 | CONFIRMED | Finance tests | `finance.integration.test.ts` is not re-runnable and writes to any localhost DB, including the dev `somwave` DB | QA-003 |
| [SW-071](#sw-071) | P2 | CONFIRMED | E2E | Root Playwright suite: 8 of 33 fail on an empty local DB, no webServer, not in CI | QA-004 |
| [SW-072](#sw-072) | P2 | CONFIRMED | Web / CI | Web unit test and web e2e are not run by CI | QA-006 |
| [SW-073](#sw-073) | P2 | CONFIRMED | Portal / finance tests | Cross-tenant 404 proofs are mock-only; one is tautological; no HTTP-level proof | QA-008 |
| [SW-074](#sw-074) | P2 | CONFIRMED | GitHub / dashboard / ops tests | Critical integrations effectively untested (GitHub, dashboard, SLA, engineering operations) | QA-009 |
| [SW-075](#sw-075) | P3 | CONFIRMED | Password reset | Forgot-password response timing reveals existing accounts | SEC-013 |
| [SW-076](#sw-076) | P3 | CONFIRMED | Rate limiting | Rate limiters use the in-memory store: counters reset on restart, are per replica, and anyone can lock an account out | API-010, SEC-014, INF-010 |
| [SW-077](#sw-077) | P3 | CONFIRMED | Auth | Logout does not invalidate the current access token; no "log out all devices" | SEC-015 |
| [SW-078](#sw-078) | P3 | CONFIRMED | Auth | No authenticated "change password" and no admin 2FA reset/recovery path | SEC-019 |
| [SW-079](#sw-079) | P3 | CONFIRMED | Migration 20261017090000 | UserInvitation model departs from data-model rules | SEC-020 |
| [SW-080](#sw-080) | P3 | SUSPECTED | Users, projects, tasks, milestones | Large `page` values likely become 500s; query validation is hand-rolled | API-008 |
| [SW-081](#sw-081) | P3 | CONFIRMED | Users, engineering accounts, tickets, public forms | Idempotency-Key missing on message-sending endpoints; public enforcement only checks presence; public form keys regenerate per submit | API-009 |
| [SW-082](#sw-082) | P3 | CONFIRMED | app.ts | Webhooks bypass access logging and rate limiting | API-012 |
| [SW-083](#sw-083) | P3 | CONFIRMED | middleware/validate.ts | `validate()` covers only the request body; query and params have no shared schema | API-013 |
| [SW-084](#sw-084) | P3 | CONFIRMED | Project documentation / RBAC | Project documentation routes and screens ignore the project-documentation.* permissions | API-014, FE-019 |
| [SW-085](#sw-085) | P3 | CONFIRMED | finance.routes.ts, reports.routes.ts | Finance and Reports skip the controller layer | API-015 |
| [SW-086](#sw-086) | P3 | CONFIRMED | Projects / API contract | The `?sort=` contract is not implemented; project portfolio sorts and paginates in memory | API-016 |
| [SW-087](#sw-087) | P3 | CONFIRMED | Logging | X-Request-ID header and the access-log request id differ | API-017 |
| [SW-088](#sw-088) | P3 | CONFIRMED | Engineering | Task review route grants engineering.read as an alternative to engineering.tasks.review | API-018 |
| [SW-089](#sw-089) | P3 | CONFIRMED | Docs | API reference covers less than half the surface | API-019 |
| [SW-090](#sw-090) | P3 | CONFIRMED | Clients, Employees, Leads, Portal, worklog, GitHub, documentation | 29 UI-unreachable endpoints and incomplete CRUD | API-020 |
| [SW-091](#sw-091) | P3 | CONFIRMED | Tasks visibility / PM | Archived projects' tasks/milestones appear for admins; legacy /tasks exposes other engineers' unapproved proposals | DB-012, PRJ-004 |
| [SW-092](#sw-092) | P3 | CONFIRMED | Dashboard / HR | Dashboard "upcoming leave" includes soft-deleted leave requests and deleted employees | DB-013 |
| [SW-093](#sw-093) | P3 | CONFIRMED | Engineering schema | Schema/migration drift on engineer_progress_reports | DB-014 |
| [SW-094](#sw-094) | P3 | CONFIRMED | Migrations | Migration directories with impossible hours (24-27) | DB-015 |
| [SW-095](#sw-095) | P3 | CONFIRMED | Finance, all schema | Unindexed foreign keys, including finance_journal_lines.journal_id; audit_logs has no created_at index | DB-016 |
| [SW-096](#sw-096) | P3 | CONFIRMED | Finance / Invoices | Invoice OVERDUE status is written on every GET (write-on-read); PARTIAL invoices never become OVERDUE | DB-018, FIN-010 |
| [SW-097](#sw-097) | P3 | CONFIRMED | Finance schema | Missing DB-level guards on AR tables and finance actor columns | DB-019 |
| [SW-098](#sw-098) | P3 | CONFIRMED | Schema conventions | Convention deviations (informational) | DB-020 |
| [SW-099](#sw-099) | P3 | CONFIRMED | Core / users | A soft-deleted user's email can never be invited again | DB-021 |
| [SW-100](#sw-100) | P3 | CONFIRMED | Projects | Portfolio list health differs from project detail health | PRJ-005 |
| [SW-101](#sw-101) | P3 | CONFIRMED | Portal dashboard | Portal dashboard counts milestones the client cannot see | PRJ-006 |
| [SW-102](#sw-102) | P3 | CONFIRMED | Projects | Project create/update: invalid clientId -> 500; deleted client accepted; PM change not audited or notified; no date ordering | PRJ-007 |
| [SW-103](#sw-103) | P3 | CONFIRMED | Projects | Project creation wizard is non-atomic | PRJ-008 |
| [SW-104](#sw-104) | P3 | CONFIRMED | Frontend data layer | Cache invalidation gaps: dashboard never invalidated; accept-invitation does not refresh /projects | PRJ-009 |
| [SW-105](#sw-105) | P3 | CONFIRMED | Projects | Minor project UI/data issues: Gantt uses createdAt as start; workspace caps tasks at 100 and milestones at 50; portfolio filters in memory | PRJ-010 |
| [SW-106](#sw-106) | P3 | CONFIRMED | Assignment invitations | Invitation email failure returns 503 but the invitation is saved; retrying returns 409 | ENG-009 |
| [SW-107](#sw-107) | P3 | SUSPECTED | Dependencies | Task dependency cycle check is not atomic | ENG-010 |
| [SW-108](#sw-108) | P3 | SUSPECTED | Time tracking | Single-active-timer constraint exists only in raw SQL (not representable in schema.prisma) | ENG-011 |
| [SW-109](#sw-109) | P3 | CONFIRMED | Time tracking | Manual task hours: future dates and unlimited daily totals accepted; two time systems unreconciled | ENG-012 |
| [SW-110](#sw-110) | P3 | CONFIRMED | Bugs | Bug lifecycle gaps: reopen keeps original SLA, severity immutable, no optimistic lock, lists unpaginated | ENG-013 |
| [SW-111](#sw-111) | P3 | CONFIRMED | Releases | Release gates: PM can mark APPROVED -> DEPLOYED without a deployment record; admin may approve own release | ENG-014 |
| [SW-112](#sw-112) | P3 | CONFIRMED | Project activity | Activity feed omits member/handover/phase/release/deployment audits and shows finance expense events to every project viewer | ENG-015 |
| [SW-113](#sw-113) | P3 | CONFIRMED | GitHub | GitHub integration robustness gaps (stuck RECEIVED deliveries, reactivation of suspended installs, token per view, stale CI run) | ENG-016 |
| [SW-114](#sw-114) | P3 | CONFIRMED | Config | GitHub (and other) configuration not validated by the Zod env schema; .env.example incomplete | INF-015 |
| [SW-115](#sw-115) | P3 | CONFIRMED | API image | API runs TypeScript through tsx in production with no compiled build | INF-008 |
| [SW-116](#sw-116) | P3 | CONFIRMED | API / worker | Graceful shutdown has no timeout and does not wait for in-flight jobs | INF-009 |
| [SW-117](#sw-117) | P3 | CONFIRMED | Frontend infra | index.html has no Cache-Control: a stale shell after deploy can white-screen | INF-017 |
| [SW-118](#sw-118) | P3 | CONFIRMED | Ops docs | Healthcheck and documentation inconsistencies; one-level log redaction | INF-018 |
| [SW-119](#sw-119) | P3 | CONFIRMED | Project finance | Project expenses/budgets are a parallel unapproved cost ledger gated by invoice permissions | FIN-011 |
| [SW-120](#sw-120) | P3 | CONFIRMED | Approvals | Segregation of duties is two-person only; the approver may also post | FIN-012 |
| [SW-121](#sw-121) | P3 | CONFIRMED | Invoices | Invoice number year uses UTC | FIN-014 |
| [SW-122](#sw-122) | P3 | CONFIRMED | Reports | Reports export CSV only; no PDF/Excel, scheduled/emailed reports or full financial statements | RPT-002 |
| [SW-123](#sw-123) | P3 | CONFIRMED | Reports | Inconsistent date-range semantics (/reports inclusive `to`, /finance exclusive); AR "settled as-of" uses payments.updated_at | RPT-003 |
| [SW-124](#sw-124) | P3 | CONFIRMED | Storage / CMS | Old images are released only for Articles; other modules leave orphans | STO-004 |
| [SW-125](#sw-125) | P3 | CONFIRMED | CMS image field | Preview shows while the upload fails; Portfolio partial failures not reported per file | STO-005 |
| [SW-126](#sw-126) | P3 | CONFIRMED | Public forms | Public forms have no honeypot or captcha; the idempotency key only blocks double-submits | WEB-006 |
| [SW-127](#sw-127) | P3 | CONFIRMED | Public website | Hardcoded app domain, hardcoded marketing sections, off-palette brand colour and no dark mode on web | WEB-008 |
| [SW-128](#sw-128) | P3 | CONFIRMED | Web performance | Page weight and image optimisation | WEB-009 |
| [SW-129](#sw-129) | P3 | CONFIRMED | Website content | Homepage publishing needs two separate administrators (undocumented in the UI) | CMS-002 |
| [SW-130](#sw-130) | P3 | CONFIRMED | Newsletter | Newsletter is collection-only (no double opt-in, unsubscribe, export or sending) | CMS-003 |
| [SW-131](#sw-131) | P3 | CONFIRMED | Internal UI i18n | Somali text in internal/admin screens and staff-facing system messages | FE-005 |
| [SW-132](#sw-132) | P3 | CONFIRMED | Portal | Portal language is mixed English/Somali; no i18n framework | FE-006 |
| [SW-133](#sw-133) | P3 | CONFIRMED | Router | No catch-all route: unknown URLs render a blank screen | FE-009 |
| [SW-134](#sw-134) | P3 | CONFIRMED | Design system | Palette and dark-mode deviations | FE-011 |
| [SW-135](#sw-135) | P3 | CONFIRMED | i18n / RTL | RTL: ~70 physical-direction utilities; Arabic/RTL not wired | FE-012 |
| [SW-136](#sw-136) | P3 | CONFIRMED | UI kit a11y | Modal lacks focus management; user menu lacks arrow-key handling | FE-013 |
| [SW-137](#sw-137) | P3 | CONFIRMED | UI kit | Small touch targets: Button size="sm" is 36 px (149 usages) | FE-014 |
| [SW-138](#sw-138) | P3 | CONFIRMED | Forms | Many forms bypass React Hook Form + shared Zod resolver | FE-015 |
| [SW-139](#sw-139) | P3 | CONFIRMED | Dates | Dates displayed with browser locale/timezone instead of the Africa/Mogadishu helper | FE-016 |
| [SW-140](#sw-140) | P3 | CONFIRMED | Performance | Large frontend bundles; heavy editor chunk loaded on every project detail view | FE-017, QA-010 |
| [SW-141](#sw-141) | P3 | CONFIRMED | Reports / Portal | Client reports unreachable from the UI | FE-018 |
| [SW-142](#sw-142) | P3 | CONFIRMED | Data layer | No optimistic updates with rollback anywhere | FE-020 |
| [SW-143](#sw-143) | P3 | CONFIRMED | Engineering frontend | Engineering Workspace renders no page h1 in its empty state | QA-005 |
| [SW-144](#sw-144) | P3 | CONFIRMED | Test infrastructure | Test config silently overrides DATABASE_URL | QA-011 |

## Findings

### SW-001

**Mandatory 2FA for privileged roles is enforced only in the frontend**

| Field | Value |
|---|---|
| ID | SW-001 |
| Module | Auth / RBAC |
| Severity | P1 |
| Confidence | CONFIRMED |
| Sources | SEC-001 |

- **Description:** CLAUDE.md §13 makes 2FA mandatory for SUPER_ADMIN, ADMIN and MANAGER (the code extends this to FINANCE_MANAGER, ACCOUNTANT and PROJECT_MANAGER). `twoFactorRequired` is computed but only the SPA redirect consumes it. `requireAuth` and `rbac` never check it; only `/api/v1/finance/*` and the finance reports check MFA.
- **Reproduction:** A SUPER_ADMIN/ADMIN/MANAGER with `twoFactorEnabled=false` (the seeded super-admin starts this way, `seed.ts:478-482`) logs in with a password only and gets a full session (`auth.service.ts:146-156`), then calls `/users`, `/roles`, `/invoices/:id/void`, `/employees` directly.
- **Expected:** The server refuses privileged API access until 2FA is enrolled and verified for the session.
- **Actual:** Full API access with password only, except finance routes.
- **Evidence:** `backend/src/services/auth.service.ts:66` (computed), `frontend/src/features/auth/loginDestination.ts:4` (only consumer), `backend/src/middleware/auth.ts:10-40`, `middleware/rbac.ts`; finance-only gate at `routes/finance.routes.ts:53-68`, `routes/reports.routes.ts:137-178`. `grep twoFactorRequired backend/src` finds only types, the controller response and `toAuthUser`.
- **Root cause:** The policy is computed but never applied on the server.
- **Affected users:** Every privileged account.
- **Business impact:** A phished or reused admin password gives full control of users, invoices and HR data.
- **Recommended fix:** Add a `requireMfaForPrivilegedRoles` middleware after `requireAuth`: when `isTwoFactorRequired(roles)` and the token has no `mfaVerifiedAt`, return 403 `MFA_REQUIRED` everywhere except `/auth/me`, `/auth/2fa/*` and `/auth/logout`. Add a test per required role.
- **Dependencies:** None.
- **Complexity:** S
- **Verification plan:** API test: ADMIN without 2FA gets 403 on `GET /users` and 200 on `/auth/2fa/setup`.

### SW-002

**CSRF exposure: production cookies are SameSite=None and nothing checks Origin or a CSRF token**

| Field | Value |
|---|---|
| ID | SW-002 |
| Module | Auth cookies / all mutating routes |
| Severity | P1 |
| Confidence | CONFIRMED |
| Sources | SEC-002 |

- **Description:** `cookies.ts:21` sets `sameSite: isProd ? "none" : "lax"` on the assumption that app.* and api.* are cross-site; they share the registrable domain botandev.com and are same-site. With SameSite=None any third-party page can submit a cross-site `<form method=POST>` with the victim's cookies (no preflight). Body-less endpoints are CSRF-able: `POST /invoices/:id/void`, `POST /finance/transactions/:id/{submit,post,cancel}` (the MFA gate passes because the victim cookie carries `mfaVerifiedAt`), `POST /engineering/accounts/:userId/{suspend,reactivate,cancel,resend}`, `POST /users/invitations/:id/cancel`, `POST /auth/logout`, `POST /auth/2fa/setup`.
- **Reproduction:** Code path; not reproduced in a browser because no session was available. An insider who knows a target cuid (e.g. a CLIENT knowing their invoice id) lures a finance user to a page that auto-posts to `/invoices/:id/void`.
- **Expected:** SameSite=Lax/Strict plus Origin/Referer check or double-submit token on unsafe methods.
- **Actual:** Neither exists.
- **Evidence:** `backend/src/lib/cookies.ts:3-8,21`; `routes/platform.routes.ts:126`; `controllers/invoice.controller.ts:77-85`; `routes/finance.routes.ts:246-280`; `routes/engineer-account.routes.ts:20-23`; `routes/user.routes.ts:37-48`; no Origin/CSRF check in `app.ts:53-130`.
- **Root cause:** Wrong same-site assumption in the cookie configuration.
- **Affected users:** All staff with mutating permissions.
- **Business impact:** Unauthorized voiding of invoices and posting of finance transactions.
- **Recommended fix:** Set `sameSite: "lax"` (or `strict`) in production; add an Origin allow-list middleware for POST/PUT/PATCH/DELETE (reject foreign Origin, and no-Origin requests with `Sec-Fetch-Site: cross-site`); optionally require `Content-Type: application/json` on mutations.
- **Dependencies:** None.
- **Complexity:** S
- **Verification plan:** Supertest: POST with `Origin: https://evil.example` gets 403; manual staging login confirms cookies still work with Lax.

### SW-003

**HR endpoints trust employeeId from the request body (IDOR): any STAFF can check in/out or file leave for any employee and read everyone's HR records**

| Field | Value |
|---|---|
| ID | SW-003 |
| Module | HR (attendance, leave) |
| Severity | P1 |
| Confidence | CONFIRMED |
| Sources | API-002, DB-004 |

- **Description:** `POST /attendance/check-in`, `/check-out` and `POST /leave-requests` take `employeeId` from the body and pass it straight to the service, which only checks the employee exists. `GET /leave-requests` (including free-text, possibly medical `reason`) and `GET /attendance` return all rows. `PATCH /leave-requests/:id` does not prevent approving one's own request. The seed grants `attendance.create`, `leave.read` and `leave.create` to STAFF; the UI offers a free employee picker.
- **Reproduction:** (Needs a STAFF login; not run in production.) Sign in as STAFF A; `POST /api/v1/attendance/check-in {"employeeId":"<B>"}` returns 201; `POST /api/v1/leave-requests {"employeeId":"<B>","type":"SICK",...}` returns 201.
- **Expected:** STAFF act only on their own Employee; only HR/MANAGER see everyone.
- **Actual:** Unrestricted.
- **Evidence:** `backend/src/controllers/ops-extra.controller.ts:114-142`; `backend/src/services/hr.service.ts:110-115,129-146,186-222,246-256`; `routes/ops-extra.routes.ts:38-66`; `backend/prisma/seed.ts:180-184`; `frontend/src/features/ops/LeavePage.tsx:161`, `AttendancePage.tsx:18`; shared `schemas/attendance.ts`, `createLeaveRequestSchema`.
- **Root cause:** Ownership taken from client input instead of the session (§11 "per-user scoping has no exceptions").
- **Affected users:** All employees.
- **Business impact:** Falsified attendance/leave records that feed payroll; disclosure of medical leave reasons.
- **Recommended fix:** Derive `employeeId` from the session for self-service unless the actor holds a dedicated `attendance.manage` / `leave.manage` (or `leave.approve`) permission; scope list endpoints to the caller's own rows otherwise; return 404 for other employees' rows; forbid approving one's own leave.
- **Dependencies:** Decision on the HR permission model.
- **Complexity:** S-M
- **Verification plan:** API tests as STAFF A against B's employee id expect 404; A's lists contain only A's rows.
- **Merge note:** API-002 and DB-004 describe the same defect; both rated P1.

### SW-004

**App nginx proxy has no client_max_body_size: uploads over ~750 KB through app.* get HTTP 413**

| Field | Value |
|---|---|
| ID | SW-004 |
| Module | Frontend infra / all uploads |
| Severity | P1 |
| Confidence | CONFIRMED |
| Sources | INF-001 |

- **Description:** The production SPA calls same-origin `/api/v1`, so every request passes through `frontend/nginx.conf`, which never sets `client_max_body_size` (nginx default 1 MB). The backend accepts base64 JSON up to 35 MB (media, documents, documentation, attachments) and 8 MB (CMS images, inquiry attachments); base64 adds ~33%, so any file over ~750 KB is rejected by nginx with an HTML 413 before reaching Express.
- **Reproduction:** Config + production bundle; live POST not attempted (forbidden by audit rules).
- **Expected:** Uploads up to the documented 5 MB / 25 MB limits succeed.
- **Actual:** nginx returns 413 (HTML), client shows a generic failure.
- **Evidence:** `frontend/nginx.conf:30-41` (`location /api/ { proxy_pass https://api.somwave.botandev.com/api/; ...}`), `grep -c client_max_body_size` = 0; `frontend/Dockerfile:51-52` forces `VITE_API_URL=/api/v1`; live bundle `/assets/index-MnjbBilE.js` contains `fetch(`/api/v1${e}`)`; `backend/src/app.ts:75-82`.
- **Root cause:** Missing nginx body-size directive on the same-origin proxy.
- **Affected users:** CMS editors, staff (Media Library, documents, engineering attachments), portal clients.
- **Business impact:** Image and document storage appears broken in production; may be part of the "Image storage is unavailable" reports.
- **Recommended fix:** Add `client_max_body_size 36m;` (server or `/api/` block) and size `proxy_read_timeout`/`proxy_send_timeout` for 35 MB uploads; map 413 to the JSON envelope or handle 413 in `apiClient`.
- **Dependencies:** None. Still applies after the ImageKit re-platforming because uploads still pass through the app proxy.
- **Complexity:** S
- **Verification plan:** Upload a 4 MB JPEG and a 20 MB PDF through app.* on staging; expect 201.

### SW-005

**"Image storage is unavailable": storage is one global fail-closed condition with no readiness signal (production trigger unverified)**

| Field | Value |
|---|---|
| ID | SW-005 |
| Module | Storage (all upload modules) |
| Severity | P1 |
| Confidence | CONFIRMED |
| Sources | STO-001 |

- **Description:** The backend throws `AppError("INTERNAL_ERROR", 503, "File storage is unavailable")` when S3 is unconfigured in production (`STORAGE_PROVIDER` unset and any of `S3_BUCKET`/`S3_ACCESS_KEY`/`S3_SECRET_KEY` missing), when `STORAGE_PROVIDER=s3` is incomplete, when `filesystem` has a missing/relative `STORAGE_LOCAL_PATH`, and on any provider exception (bad credentials, wrong region/endpoint, missing bucket, network, filesystem `EACCES` on a root-owned Coolify volume, symlinked directory). Only the Articles modal maps the message to "Image storage is unavailable."; other modals show the raw text. Reads use the same path, so a misconfiguration also breaks existing public images (503). `storageStatus()` is never called outside storage.ts and `/health` checks only Postgres and Redis.
- **Reproduction:** Code path confirmed. Which trigger applies in production is SUSPECTED: Coolify env and API logs were not visible.
- **Expected:** CMS image upload works and readiness is observable.
- **Actual:** Uploads fail with 503 "File storage is unavailable"; no stored image URLs exist in live content.
- **Evidence:** `backend/src/lib/storage.ts:35-47,51,58,64-104`; `frontend/src/features/cms/components/PostFormModal.tsx:65`; `PortfolioFormModal.tsx:136`, `TeamMemberFormModal.tsx:111`, `SiteContentAdminPage.tsx:658`; `Dockerfile:75`; `routes/health.routes.ts:11-19`. Production: `/public/homepage` and `/public/team` contain zero `/public/article-images/` URLs; the one team photo hotlinks `imgs.search.brave.com`.
- **Root cause:** Most likely missing S3 variables or a non-writable filesystem volume (SUSPECTED; env not visible).
- **Affected users:** CMS editors (articles, portfolio, team, testimonials, hero), public project-request attachments, documents.
- **Business impact:** No images can be added to the public site.
- **Recommended fix:** (1) Configure runtime storage (S3 bucket/key/secret/region/endpoint, or `STORAGE_PROVIDER=filesystem` + `STORAGE_LOCAL_PATH=/data/uploads` + a persistent volume writable by UID 1000) - superseded by the ImageKit re-platforming (`feat/imagekit-media-storage`) once configured; (2) report storage readiness in `/health` or an authenticated `/system/health` with a write/read/delete probe; (3) check API logs for the storage `errorCategory`; (4) one shared upload-error mapper in all modals.
- **Dependencies:** Coolify access (user action); SW-004 (INF-001) (nginx body size) must also be fixed.
- **Complexity:** S
- **Verification plan:** Upload a CMS image, restart, redeploy, and fetch the public URL each time.

### SW-006

**API is reached through public-hostname hairpins, so all app users (and all SSR page views) share one rate-limit bucket, including the login limiter**

| Field | Value |
|---|---|
| ID | SW-006 |
| Module | Deploy / rate limiting (app proxy and web SSR) |
| Severity | P1 |
| Confidence | CONFIRMED |
| Sources | INF-002, FE-008, INF-016, WEB-001 |

- **Description:** App: nginx forwards `/api/` to the public API hostname; requests leave the VPS and re-enter through Traefik. With `trust proxy 1` and express-rate-limit keyed on `req.ip`, the API sees the nginx egress address, so every app.* user shares one 100/min global bucket and one 20-per-15-min login IP bucket. nginx also resolves the hostname only at start (no `resolver`) and pays an extra TLS handshake per call, contrary to CLAUDE.md §14. Web: Astro SSR calls `https://api.somwave.botandev.com/api/v1` for every page view, so all visitors share the 60/min public bucket; past ~60 page views/min the API returns 429, the homepage silently falls back to defaults and detail pages return 404 (errors are swallowed to null), and `getEnvelope` has no timeout.
- **Reproduction:** Probe two clients through app.* and compare `ratelimit-remaining`; for web, load-test more than 60 requests/minute to `/blog/<slug>` on staging.
- **Expected:** Per-client rate limits; login lockout of one IP does not affect others; SSR traffic does not exhaust the public limiter.
- **Actual:** Shared buckets: ~100 API calls/min across all users causes 429 for everyone; 20 bad logins through app.* lock all users out of login for 15 minutes.
- **Evidence:** App (CONFIRMED by probe): through the app proxy `/api/v1/auth/me` returned `ratelimit: limit=100, remaining=92`, then 87 and 86 seconds later, while the same call direct to api.* returned `remaining=99`, 99, 98. `frontend/nginx.conf:30-41` (`proxy_pass https://api.somwave.botandev.com/api/;`, `X-Forwarded-For $proxy_add_x_forwarded_for`); `backend/src/app.ts:58`; `middleware/rateLimit.ts:25-38`. Web (SUSPECTED, code CONFIRMED): `web/Dockerfile:52`; `web/src/lib/api.ts:23-36,56-62,70-75,118-124`; `web/src/pages/blog/[slug].astro:17-19`; `index.astro:25-29`.
- **Root cause:** Same-origin proxy and SSR use the public hostname instead of the internal Docker network.
- **Affected users:** All app users; all public website visitors; search engines.
- **Business impact:** Login DoS, site-wide 429s, real pages served as 404 and possibly de-indexed.
- **Recommended fix:** Proxy `/api/` to the API container over the Coolify internal network (e.g. `http://<api-service>:4000/api/`); give Astro a runtime-only `API_INTERNAL_URL`; or configure Traefik `forwardedHeaders.trustedIPs` and an exact `trust proxy` hop count/subnet; exempt or authenticate the SSR caller; return 503 rather than 404 on non-404 errors; add `AbortSignal.timeout`; use a Redis rate-limit store.
- **Dependencies:** Coolify internal service name; SW-076 (API-010) (Redis rate-limit store).
- **Complexity:** M
- **Verification plan:** Two clients from different IPs through app.* see independent `ratelimit remaining`; staging load test of web SSR shows no 429/404.
- **Merge note:** INF-002 (P1, CONFIRMED), FE-008 (P2, SUSPECTED), INF-016 (P3) and WEB-001 (P1, SUSPECTED) share one root cause (public-hostname hairpin). Highest severity P1 taken; INF-002 confirmed the shared bucket by probe. The web SSR part remains SUSPECTED.

### SW-007

**"Could not load finance dashboard": the session never gains MFA proof after 2FA enrolment, so privileged users get 403 (old bundle masked the real error)**

| Field | Value |
|---|---|
| ID | SW-007 |
| Module | Finance dashboard / auth |
| Severity | P1 |
| Confidence | CONFIRMED |
| Sources | FIN-001, FE-021 |

- **Description:** Before PR #86 the Finance page showed "Could not load finance dashboard." for every error; #86 (deployed) now shows the server message, and the literal fallback only appears when `isError=false && !data`. The most probable masked error is 403 from `requireFinanceTwoFactor`: (a) `confirmTwoFactorEnrolment` sets `twoFactorEnabled` but does not re-issue the session, so tokens keep `mfaVerifiedAt = null` and the first `/finance` visit after the forced enrolment always gets 403 until logout/login; (b) sessions created before migration `20261016130000_finance_mfa_session_proof` copy a null `mfa_verified_at` forward on every refresh for 30 days; (c) users without 2FA get 403 (low likelihood). Lower-probability causes (403 permission, 500 missing tables, CORS/`VITE_API_URL`) were examined and ranked low; Decimal/empty-ledger was ruled out. The ErrorState title is generic and the cause/request id is not surfaced.
- **Reproduction:** Enrol 2FA in the current session (forced redirect after login), then open `/finance`: 403 "Sign out and sign in with your two-factor code".
- **Expected:** Finance dashboard loads for a privileged user who has just verified TOTP.
- **Actual:** 403 until the user signs out and back in; old bundle displayed a generic message.
- **Evidence:** `frontend/src/features/finance/FinancePage.tsx:195-205`; `features/finance/api.ts:97-98`; `backend/src/routes/finance.routes.ts:52-68,338-346`; `backend/src/services/auth.service.ts:222-244,327`; `frontend/src/features/auth/ProtectedRoute.tsx:17`; `packages/shared/src/constants/roles.ts:22-29`; `git log -L` (#84 `99dcb08` -> #86 `4323f55`); production chunk `FinancePage-DaGwO4xf.js` contains the new ternary; index `last-modified: Sat, 17 Oct 2026 13:12:57 GMT`. Integration test reproduces 403 without proof and 200 with proof (9/9 pass locally).
- **Root cause:** CONFIRMED mechanism (MFA proof not granted on enrolment/refresh); which branch hit production is SUSPECTED (no authenticated access or logs).
- **Affected users:** SUPER_ADMIN, ADMIN, FINANCE_MANAGER, ACCOUNTANT.
- **Business impact:** Finance module unusable after onboarding; incident undiagnosable.
- **Recommended fix:** Re-issue session cookies with `mfaVerifiedAt = now` in `confirmTwoFactorEnrolment` and after any successful TOTP re-verification; add `POST /auth/2fa/step-up`; in FinancePage, pre-check `user.twoFactorEnabled`, branch on `error.code === "FORBIDDEN"` with a dedicated CTA, distinguish `!data` from `isError`, and show the error code and request id; obtain an authenticated production envelope + request id to close the incident.
- **Dependencies:** Auth service; SW-010 (FIN-002) error-handler logging.
- **Complexity:** S-M
- **Verification plan:** Integration test "enrol 2FA then GET /finance/dashboard -> 200 without re-login"; authenticated production probe with request-id correlation.
- **Merge note:** FE-021 (P3) traced the same UI string and conditions; FIN-001 (P1) gives the root cause. P1 kept.

### SW-008

**EVC Plus charge leaves an orphaned PENDING payment whenever the provider call fails (always, while EVC is unconfigured)**

| Field | Value |
|---|---|
| ID | SW-008 |
| Module | Payments (EVC Plus) |
| Severity | P1 |
| Confidence | CONFIRMED |
| Sources | FIN-004 |

- **Description:** The EVC gateway commits a PENDING payment, then calls `initiateEvcCharge`, which throws `PAYMENT_FAILED 502 "EVC Plus is not configured"` when env is missing, or on any provider error. Nothing marks the payment FAILED and no cleanup job exists. `isEvcPlusConfigured()` is never used to hide the EVC button. The pending amount is reserved forever, so staff cannot record the real bank payment ("Payment exceeds the outstanding balance") and the invoice cannot be voided. If the provider succeeded but the `gatewayRef` update failed, the webhook returns 404 and collected money is never applied.
- **Reproduction:** Code path. Production EVC configuration is SUSPECTED unconfigured (not observable).
- **Expected:** A failed charge frees the balance and is visible as FAILED.
- **Actual:** Balance stays reserved; invoice can be neither paid manually nor voided.
- **Evidence:** `backend/src/services/payments/gateways/evcplus.gateway.ts:52-83`; `payments/evcplus.client.ts:24,29-33,56-62`; `paymentCore.ts`; `manualBank.gateway.ts:36-40`; `invoice.service.ts:228-232`.
- **Root cause:** No failure handling after the PENDING row is committed.
- **Affected users:** Portal clients paying by EVC; finance staff.
- **Business impact:** Invoices blocked; possible collected-but-unapplied money.
- **Recommended fix:** Wrap the provider call; on failure mark the payment FAILED in a transaction; expose EVC availability to the UI; add a scheduled job (deterministic id) that expires stale PENDING payments without `gatewayRef`; make `gatewayRef` unique.
- **Dependencies:** SW-034 (FIN-013) EVC provider contract.
- **Complexity:** M
- **Verification plan:** Unit test with a throwing provider: payment FAILED and balance free.

### SW-009

**Payment Idempotency-Key is regenerated after a failed or ambiguous request (duplicate-charge risk)**

| Field | Value |
|---|---|
| ID | SW-009 |
| Module | Portal payments / manual payments (frontend) |
| Severity | P1 |
| Confidence | CONFIRMED |
| Sources | FE-001 |

- **Description:** The key is held in `useRef` and replaced with a fresh UUID in the `catch` block of the EVC and manual payment mutations (and send-invoice). A request that reached the server but failed on the way back (timeout, proxy 502, network drop, INTERNAL_ERROR) is retried with a new key, so the server cannot recognise it as the same charge. Frontend behaviour CONFIRMED; the duplicate-charge outcome is SUSPECTED because it depends on backend dedupe.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** Retries reuse the key.
- **Actual:** Every retry after an error uses a new key.
- **Evidence:** `frontend/src/features/ops/InvoiceDetailPage.tsx:65` (`useRef(crypto.randomUUID())`), `:244-245` (EVC catch), `:295-296` (manual payment catch), `:86` (send invoice).
- **Root cause:** Key reset in error handler.
- **Affected users:** CLIENT paying with EVC Plus; finance staff recording payments.
- **Business impact:** Possible double EVC push / duplicate Payment rows.
- **Recommended fix:** Keep the same key until a definitive success or a definitive non-retryable 4xx; regenerate only on success or when amount/phone/invoice changes.
- **Dependencies:** Backend dedupe by (invoiceId, key) - confirmed present for payments (API-009).
- **Complexity:** S
- **Verification plan:** Unit test that a rejected mutation reuses the key.

### SW-010

**Central error handler discards the error; Prisma known errors (P2002/P2025/P2034) become HTTP 500**

| Field | Value |
|---|---|
| ID | SW-010 |
| Module | Backend platform / diagnostics |
| Severity | P1 |
| Confidence | CONFIRMED |
| Sources | FIN-002, DB-006, API-011 |

- **Description:** For non-AppError errors the handler logs only `{requestId, errorCategory, httpStatus}` and "Unhandled request failure": no `err.name`, Prisma code, table/column or stack, so a production 500 cannot be root-caused from logs (why FIN-001 could not be closed; contradicts CLAUDE.md §5). P2002 (unique), P2025 (not found), P2003 and P2034 (serialization) are not mapped and become 500; six Serializable finance transactions have no retry. Only a few services catch P2002 locally. `JSON.parse` in the EVC webhook is unguarded, so malformed JSON with a valid signature returns 500.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** Full detail logged server-side, safe message returned; known DB errors map to 4xx.
- **Actual:** No diagnostic detail; races and FK errors return 500.
- **Evidence:** `backend/src/middleware/errorHandler.ts:26-38`; `routes/finance.routes.ts:26-50`; `grep -rn P2034` = 0; `finance.service.ts` Serializable transactions (~`:520`, `reverseJournal`, `closePeriod`); `controllers/payment.webhook.controller.ts:22`.
- **Root cause:** Deliberately minimal logging for privacy; no Prisma error mapping.
- **Affected users:** All users and operators.
- **Business impact:** Production incidents cannot be diagnosed; concurrent actions fail with 500.
- **Recommended fix:** Log `err.name`, Prisma `code`, `meta.table/column` and a redacted stack server-side; map P2002->409 CONFLICT, P2025->404, P2003->400/404, P2034->retry (3 attempts) or 409; guard webhook JSON parsing.
- **Dependencies:** None.
- **Complexity:** S
- **Verification plan:** Unit test that a Prisma P2021 produces a log with `prismaCode`; error-handler tests for P2002/P2025; concurrent ticket-create test.
- **Merge note:** FIN-002 rated P1 (blocks diagnosis of a live finance incident), DB-006 P2, API-011 P3; the higher rating is kept because the defect blocked closing FIN-001.

### SW-011

**A fresh production DB is unusable without the dev seed: migrations create only 15 of 70 permissions and 3 of 13 roles**

| Field | Value |
|---|---|
| ID | SW-011 |
| Module | Core / RBAC / deployment |
| Severity | P1 |
| Confidence | CONFIRMED |
| Sources | DB-001 |

- **Description:** `docker-entrypoint.sh` runs only `prisma migrate deploy`. Migrations insert just the finance and engineer permissions and the ENGINEER/FINANCE_MANAGER/ACCOUNTANT roles. SUPER_ADMIN, ADMIN, MANAGER, STAFF, EDITOR, CLIENT, GUEST and 55 permissions exist only if `seed.ts` runs, so production must run the dev seed, which also writes demo data and resets roles. Every later permission needs a hand-written migration or a seed re-run.
- **Reproduction:** `prisma migrate deploy` into an empty schema (`?schema=migonly`) gives 15 permissions; roles with grants: ACCOUNTANT=3, ENGINEER=9, FINANCE_MANAGER=4. Missing keys include `users.read`, `roles.manage`, `invoices.create`, `portal.read`, `content.create`.
- **Expected:** Migrations alone produce a usable RBAC.
- **Actual:** 15/70 permissions, 3/13 roles.
- **Evidence:** `backend/docker-entrypoint.sh:11`; `migrations/20261014020000_ensure_engineer_system_role/migration.sql` ("Production may have run migrations without the development seed"); `20261016120000_finance_ledger_foundation/migration.sql`; `docs/SUPER_ADMIN_SETUP.md:55-68`.
- **Root cause:** Reference/RBAC data is created by the seed script rather than by versioned migrations.
- **Affected users:** Every new environment; every release adding a permission.
- **Business impact:** Fresh deploy has no admin role; new features return 403 until someone runs the seed.
- **Recommended fix:** Add a migration (or an idempotent `rbac-sync` script with no demo data) that upserts all PERMISSIONS/ROLES and default grants with `ON CONFLICT DO NOTHING`; move demo content to a separate `seed-demo.ts` for local/CI only.
- **Dependencies:** SW-038 (DB-003) seed split.
- **Complexity:** M
- **Verification plan:** Migrate-only into an empty schema and assert 70 permissions and 13 roles.

### SW-012

**QA_ENGINEER role cannot perform QA verification (or comment, log progress or hours)**

| Field | Value |
|---|---|
| ID | SW-012 |
| Module | Engineering QA |
| Severity | P1 |
| Confidence | CONFIRMED |
| Sources | ENG-001 |

- **Description:** `POST /engineering/tasks/:taskId/verify-qa` requires `engineering.tasks.review`, which the seeded QA_ENGINEER role lacks; the service explicitly allows project role QA_ENGINEER. QA_ENGINEER also lacks `engineering.tasks.create`, so comment/progress/checklist/hours routes return 403. Project-invite activation always grants system role ENGINEER, which also lacks `engineering.tasks.review`. TESTING->DONE requires `qaVerifiedAt`, so tasks stall unless a manager performs QA.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** QA engineers verify QA.
- **Actual:** Only managers/admins or system LEAD_ENGINEER can.
- **Evidence:** `backend/src/routes/engineering.routes.ts:301-305`; `backend/prisma/seed.ts:146-155`; `engineering.service.ts:2003-2006`; `engineer-account.service.ts:561-589`; `task.service.ts:245`.
- **Root cause:** Seed role map omits the permissions; activation grants only ENGINEER.
- **Affected users:** QA engineers; delivery throughput.
- **Business impact:** The independent QA gate is effectively performed by managers.
- **Recommended fix:** Add `engineering.tasks.review` (+ `engineering.tasks.create`) to QA_ENGINEER in the seed and a backfill migration, or add a dedicated `engineering.qa.verify` permission.
- **Dependencies:** SW-011 (DB-001) RBAC migration.
- **Complexity:** S
- **Verification plan:** Route test as QA_ENGINEER -> 200; ENGINEER -> 403.

### SW-013

**No HTTP-level test proves the auth, RBAC and cross-tenant 404 contract for any route**

| Field | Value |
|---|---|
| ID | SW-013 |
| Module | All routes / authorization tests |
| Severity | P1 |
| Confidence | CONFIRMED |
| Sources | API-001, QA-007 |

- **Description:** CLAUDE.md §15 requires a test proving another user gets 404 and RBAC tests for every role. The only backend test that builds the Express app is `app.cors.test.ts`; `rbac.test.ts` uses fake requests; finance/reports route tests cover only query parsers. Route test files exist for 2 of 20 route modules. The single HTTP role matrix (`finance.integration.test.ts:345-420`, 6 roles) is skipped in CI and uses hand-written permission fixtures that cannot detect seed drift. 258 `rbac(` occurrences across auth, cms, engineering, github, milestone, ops-extra, portal, project, documentation, task, user and dashboard routes have no allowed/403 test.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** Every route has proven auth/RBAC/404 behaviour.
- **Actual:** No route-level proof.
- **Evidence:** `grep -rl "supertest\|request(app\|createApp" backend/src --include=*.test.ts` -> `src/app.cors.test.ts` only; `ls backend/src/routes` (only `finance.routes.test.ts`, `reports.routes.test.ts`); `finance.integration.test.ts:346` comment "Permission fixtures mirror the existing seed policy".
- **Root cause:** Test strategy relies on mocked service tests.
- **Affected users:** All users.
- **Business impact:** Permission regressions ship silently.
- **Recommended fix:** A table-driven supertest suite generated from the route inventory: unauthenticated -> 401, role lacking permission -> 403, other tenant's row -> 404; seed roles from the real `seed.ts` policy so a new unclassified route fails CI.
- **Dependencies:** SW-069 (QA-002) test DB in CI.
- **Complexity:** M
- **Verification plan:** CI run; remove one `rbac()` and watch the suite fail.
- **Merge note:** API-001 (P1) and QA-007 (P2) are the same gap; P1 kept.

### SW-014

**Public website and React app send no security headers (no CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy)**

| Field | Value |
|---|---|
| ID | SW-014 |
| Module | Web / frontend deploy |
| Severity | P2 |
| Confidence | CONFIRMED |
| Sources | SEC-008, FE-007, INF-007 |

- **Description:** Production probes of `https://somwave.botandev.com/` (and `/blog`) and `https://app.somwave.botandev.com/` (and `/login`) returned only content-type, cache-control/etag/last-modified, server and alt-svc. `frontend/nginx.conf` only adds Cache-Control; Astro has no middleware. The API itself sends full helmet headers.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** User-facing hosts send the same baseline headers as the API.
- **Actual:** None sent.
- **Evidence:** Production `curl -D -`/HEAD probes; `frontend/nginx.conf:1-47` (only `add_header Cache-Control` at :23); no middleware file in `web/src`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** All users of app.* and somwave.botandev.com.
- **Business impact:** Clickjacking of void/approve/suspend buttons; no CSP backstop for the SPA that renders CMS HTML; first-visit SSL-strip possible.
- **Recommended fix:** Add in nginx (`add_header ... always`): HSTS `max-age=31536000; includeSubDomains`, CSP with `frame-ancestors "none"`, `script-src "self"`, `connect-src` for the API and Google Fonts, X-Content-Type-Options nosniff, Referrer-Policy, X-Frame-Options DENY; add an Astro middleware or a Traefik headers middleware for the web host.
- **Dependencies:** None.
- **Complexity:** S
- **Verification plan:** Re-probe headers on both hosts.
- **Merge note:** Three agents reported the same probe result at P2.

### SW-015

**2FA login step has no per-account or per-challenge attempt limit; challenge token reusable for 5 minutes; TOTP codes replayable**

| Field | Value |
|---|---|
| ID | SW-015 |
| Module | Auth / 2FA |
| Severity | P2 |
| Confidence | CONFIRMED |
| Sources | SEC-004, API-006 |

- **Description:** `/auth/login/2fa` runs `loginAccountRateLimiter`, which keys on `req.body.email` and skips when absent; the 2FA body is `{challengeToken, code}`, so only the IP limiter (20 per 15 min) applies. The challenge JWT stays valid for 5 minutes, is not consumed on a wrong code and can be re-minted by logging in again; each guess also tries the 8 backup codes (32 bits each). `verifyTotp` accepts +/-30 s and does not store the last accepted step. `/auth/2fa/disable`, `/confirm`, `/backup-codes` have only the global 100/min limit.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** Login limited by IP and by account (§13).
- **Actual:** Second factor limited by IP only.
- **Evidence:** `backend/src/middleware/rateLimit.ts:44-51`; `packages/shared/src/schemas/auth.ts:14-17`; `services/auth.service.ts:159-188`; `lib/tokens.ts:23-24`; `lib/totp.ts:15`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** All 2FA users, especially privileged accounts.
- **Business impact:** An attacker with the password and distributed IPs can brute-force the second factor (practical within days per SEC-004).
- **Recommended fix:** Key the 2FA limiter (or a Redis counter) on the challenge `sub`, ~5 failures per challenge and per user per 15 minutes; revoke the challenge after N failures; store `lastTotpStep` and reject reuse; apply the limiter to `/auth/2fa/*`.
- **Dependencies:** Redis rate-limit store.
- **Complexity:** S-M
- **Verification plan:** Unit test: 6 wrong codes then 429 or revoked challenge.
- **Merge note:** Same defect; both P2.

### SW-016

**TOTP secrets stored in plaintext; backup codes are unsalted SHA-256 over 32 bits**

| Field | Value |
|---|---|
| ID | SW-016 |
| Module | Auth / 2FA storage |
| Severity | P2 |
| Confidence | CONFIRMED |
| Sources | DB-017, SEC-005 |

- **Description:** `users.two_factor_secret` is plain text and `startTwoFactorEnrolment` writes the raw base32 secret. Backup codes are `randomBytes(4).toString("hex")` hashed with plain SHA-256. There is no encryption helper in `backend/src/lib` (`grep createCipheriv` = 0). §13 requires sensitive columns encrypted at rest.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/prisma/schema.prisma:27`; `backend/src/services/auth.service.ts:199-214`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** All 2FA users.
- **Business impact:** A DB dump or read-only SQL leak defeats 2FA for every SUPER_ADMIN/ADMIN/MANAGER; 32-bit unsalted codes brute-forced offline in seconds.
- **Recommended fix:** AES-256-GCM envelope encryption for the secret with a key from env and a data migration re-encrypting existing secrets; 10+ character backup codes hashed with HMAC + server pepper or Argon2.
- **Dependencies:** Key management in Coolify.
- **Complexity:** M
- **Verification plan:** DB column contains ciphertext; login with existing 2FA still works after migration.
- **Merge note:** Same defect; both P2.

### SW-017

**Stored XSS on the public site through JSON-LD `set:html={JSON.stringify(...)}`**

| Field | Value |
|---|---|
| ID | SW-017 |
| Module | Public website (Astro) / CMS |
| Severity | P2 |
| Confidence | CONFIRMED |
| Sources | WEB-005, SEC-006 |

- **Description:** `BaseLayout.astro` injects JSON-LD with `set:html`, which disables escaping; `JSON.stringify` does not escape `<`. `articleSchema.headline` is the CMS post title, so a title containing `</script><script>...</script>` executes on the public site. Reachable by any user with CONTENT_UPDATE (or a compromised editor). Not exploited.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `web/src/layouts/BaseLayout.astro:48-56,100,103`; `web/src/pages/blog/[slug].astro:30-31`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** All public website visitors.
- **Business impact:** Defacement, phishing and redirects on somwave.botandev.com (auth cookies live on the API host, so not session theft).
- **Recommended fix:** `JSON.stringify(obj).replace(/</g, "\\u003c")`.
- **Dependencies:** None.
- **Complexity:** S
- **Verification plan:** Post titled `</script><script>alert(1)</script>` renders inert.
- **Merge note:** Same defect; both P2.

### SW-018

**`javascript:` and arbitrary/plain-http URLs accepted for CMS URL fields and rendered on the public site**

| Field | Value |
|---|---|
| ID | SW-018 |
| Module | Shared schemas / CMS / web |
| Severity | P2 |
| Confidence | CONFIRMED |
| Sources | SEC-007, CMS-004 |

- **Description:** `z.string().url()` accepts `javascript:alert(document.domain)//` (verified locally). Affected fields: team `linkedinUrl`/`photoUrl`, testimonial `avatarUrl`, portfolio `coverImage`, job `resumeUrl`; portfolio gallery allows `http:`. `TeamCard.astro` renders `href={linkedinUrl}`. Only `siteContent.ts:201` restricts the scheme. Production already hotlinks a Brave search-proxy image for a team photo; hotlinks break silently and leak visitor IPs.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `packages/shared/src/schemas/team.ts:29-30,42-43`, `portfolio.ts:6-11,88,120`, testimonial and job schemas; `web/src/components/TeamCard.astro:38`; production `/public/team` probe.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Public site visitors.
- **Business impact:** Stored script-URL links on the public site; broken/third-party images.
- **Recommended fix:** A shared `httpsUrl` schema that refines `new URL(v).protocol === "https:"` for every URL field; for image fields accept only stored image URLs (as Articles do) or HTTPS on an allowlist.
- **Dependencies:** None.
- **Complexity:** S
- **Verification plan:** Schema test rejects `javascript:` and `http:`; existing rows reviewed.
- **Merge note:** SEC-007 (P2) and CMS-004 (P3) need the same schema fix; P2 kept.

### SW-019

**Client portal users can read their DRAFT (and VOID) invoices**

| Field | Value |
|---|---|
| ID | SW-019 |
| Module | Invoices / Portal |
| Severity | P2 |
| Confidence | CONFIRMED |
| Sources | SEC-009 |

- **Description:** `listInvoices`/`getInvoice` filter CLIENT users only on `{deletedAt: null, clientId}`, so a client sees unsent drafts including amounts not yet approved.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/services/invoice.service.ts:89-118`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Clients; finance staff.
- **Business impact:** Unapproved amounts disclosed to clients.
- **Recommended fix:** For CLIENT scope add `status: { notIn: ["DRAFT"] }`; decide whether VOID should show.
- **Dependencies:** Product decision on VOID.
- **Complexity:** S
- **Verification plan:** Portal API test.

### SW-020

**Public project-inquiry sign-up auto-links a new portal login to an existing Client with a matching email**

| Field | Value |
|---|---|
| ID | SW-020 |
| Module | Project inquiry / Portal onboarding |
| Severity | P2 |
| Confidence | CONFIRMED |
| Sources | SEC-010 |

- **Description:** After OTP verification, if no User has the email, the service finds `client.findFirst({ email })` and creates a CLIENT user with that `clientId`, without staff approval. It also silently creates the 1:N client:user relation that CLAUDE.md §18 lists as an open decision.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/services/project-inquiry.service.ts:308-340`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Client companies.
- **Business impact:** Anyone controlling the client mailbox on file (shared info@, former employee alias) self-provisions full portal access to invoices, documents and projects.
- **Recommended fix:** Link to an existing Client only after staff approval, or always create a new Client.
- **Dependencies:** Decision on Client:User cardinality (§18).
- **Complexity:** M
- **Verification plan:** Inquiry with an existing client email creates a pending link that staff must approve.

### SW-021

**Login timing reveals which emails have accounts (Argon2 users ~7x faster than unknown emails)**

| Field | Value |
|---|---|
| ID | SW-021 |
| Module | Auth login |
| Severity | P2 |
| Confidence | CONFIRMED |
| Sources | SEC-003 |

- **Description:** Unknown/inactive emails verify against a dummy bcrypt cost-12 hash (281 ms measured); real users created after the Argon2 switch verify with Argon2id (42 ms). The dummy string is 59 characters, not a valid 60-character bcrypt hash.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/services/auth.service.ts:141`; `lib/password.ts:6-13`; scratchpad `hashtime.cjs` measurement.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** All users.
- **Business impact:** Reliable enumeration of active accounts despite identical messages.
- **Recommended fix:** Use an Argon2id dummy hash with the same parameters generated at boot; optionally rehash legacy bcrypt hashes on login.
- **Dependencies:** None.
- **Complexity:** S
- **Verification plan:** Micro-benchmark test comparing unknown vs existing user timings.

### SW-022

**Strict refresh rotation has no grace window: parallel tabs or a lost response trigger "reuse" and log out every device**

| Field | Value |
|---|---|
| ID | SW-022 |
| Module | Auth refresh |
| Severity | P2 |
| Confidence | SUSPECTED |
| Sources | SEC-012 |

- **Description:** `apiClient.ts` de-duplicates refresh only within one tab. Two tabs refreshing at once send the same cookie; the second finds `revokedAt` set and runs the reuse branch, revoking all sessions. Same if the refresh response is lost. Not reproduced.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `frontend/src/lib/apiClient.ts:31-54`; `backend/src/services/auth.service.ts:310-316`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** All users with multiple tabs/devices.
- **Business impact:** Random forced logouts; users learn to ignore the security response.
- **Recommended fix:** Allow a ~30 s grace window returning the already-issued successor (`replacedByTokenHash`), or a cross-tab lock (BroadcastChannel / Web Locks).
- **Dependencies:** None.
- **Complexity:** M
- **Verification plan:** Two-tab refresh test keeps both sessions.

### SW-023

**Production dependency vulnerabilities: 3 critical, 18 high, 10 moderate**

| Field | Value |
|---|---|
| ID | SW-023 |
| Module | Dependencies |
| Severity | P2 |
| Confidence | CONFIRMED |
| Sources | SEC-011, INF-014 |

- **Description:** `npm audit --omit=dev`: `{critical: 3, high: 18, moderate: 10, low: 0}`. Critical: astro 5.18.2 (RCE via AVIF image optimisation, Host-header SSRF, XSS issues; define:vars XSS; fixed in astro@7.4.0; the `/_image` endpoint is live, returned 400; `web/src` does not use `define:vars`/`server:defer` and no remote image domains are configured, which lowers exposure), `tar` via bcrypt -> node-pre-gyp (install-time), `proxy-addr` 2.0.7 (IPv4-mapped IPv6 trust bypass; likely not applicable with `trust proxy 1`). High: @astrojs/node 9.5.5, undici, http-cache-semantics, prisma (deepmerge-ts), sharp/libvips. Moderate: react-router 6.30.6 open redirect, express/qs, vite 5.4.21 (dev only). Exploitability SUSPECTED.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `npm audit --omit=dev --json` run by the security and infrastructure agents.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** All surfaces.
- **Business impact:** Known vulnerabilities in the public web server and API dependency tree.
- **Recommended fix:** Upgrade astro/@astrojs/node first (major version; test the web build), then bcrypt@6 or replace with the already-present argon2, prisma, express, react-router-dom within 6.x; add `npm audit --omit=dev --audit-level=high` to CI.
- **Dependencies:** Web build regression testing.
- **Complexity:** M
- **Verification plan:** `npm audit --omit=dev` shows no critical/high.
- **Merge note:** Same audit result; both P2.

### SW-024

**Global search ignores project membership and leaks names of all projects and tasks**

| Field | Value |
|---|---|
| ID | SW-024 |
| Module | Search |
| Severity | P2 |
| Confidence | CONFIRMED |
| Sources | API-003 |

- **Description:** `GET /api/v1/search` gates projects on `projects.read` and tasks on `tasks.read` only, then queries `project.findMany({ where: { deletedAt: null, name: contains } })` (and tasks, including parent project names) with no `projectScope(actor)`. List endpoints do apply membership scope. ENGINEER, QA_ENGINEER and STAFF can enumerate every project and task name with 2-letter searches.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** Search results equal what the user can open.
- **Actual:** All matching projects/tasks.
- **Evidence:** `backend/src/services/search.service.ts:32-40,73-82`; contrast `project.service.ts:96-101`, `task.service.ts` `project: projectScope(actor)`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Clients whose project names are confidential; all engineers including contractors.
- **Business impact:** Disclosure of confidential client project names.
- **Recommended fix:** Apply `projectScope(actor)` to both queries.
- **Dependencies:** None.
- **Complexity:** S
- **Verification plan:** Unit test: non-member searches a project name and gets 0 hits.

### SW-025

**File downloads return 500 for non-Latin-1 filenames; Content-Disposition built from raw names**

| Field | Value |
|---|---|
| ID | SW-025 |
| Module | Documents / Portal / Engineering attachments / Project documentation |
| Severity | P2 |
| Confidence | CONFIRMED |
| Sources | API-004, SEC-016 |

- **Description:** Several download handlers put the stored name into `Content-Disposition: attachment; filename="${name}"`. Node `setHeader` throws `ERR_INVALID_CHAR` for characters above U+00FF (reproduced locally: 500 for `filename="عقد.pdf"`); a `"` in a title produces a malformed header. Arabic is a supported locale (§17). Media (sanitised names) and inquiry attachments (`safeFileName`) are not affected.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/controllers/ops-extra.controller.ts:213,257`; `portal.controller.ts:71`; `engineering.controller.ts:349-352`; `project-documentation.controller.ts:157`; `project-inquiry.controller.ts:138`; schemas `document.ts:16`, `projectInquiry.ts:54`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Users with Arabic or emoji file names.
- **Business impact:** Documents cannot be downloaded (generic 500).
- **Recommended fix:** One shared helper using the `content-disposition` package or RFC 5987 (`filename="ascii-fallback"; filename*=UTF-8''<pct-encoded>`) in all download handlers.
- **Dependencies:** None.
- **Complexity:** S
- **Verification plan:** Unit test downloading an Arabic-named file expects 200 and a correct `filename*`.
- **Merge note:** API-004 (P2) and SEC-016 (P3); P2 kept because Arabic is a supported locale and downloads fail outright.

### SW-026

**Large JSON bodies (up to 35 MB) are parsed before authentication and before the rate limiter**

| Field | Value |
|---|---|
| ID | SW-026 |
| Module | app.ts |
| Severity | P2 |
| Confidence | CONFIRMED |
| Sources | API-005 |

- **Description:** `express.json({limit:"35mb"})` (media, documents, documentation, engineering attachments) and 8 MB parsers (inquiry attachments) run at `app.ts:75-82`; `apiRateLimiter` is applied later (`:89`) and `requireAuth` inside routers. An unauthenticated client can make the server buffer and parse 35 MB per request.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/app.ts:75-89`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** All users (availability).
- **Business impact:** Cheap denial of service on a single-VPS deployment.
- **Recommended fix:** Move `apiRateLimiter` ahead of the large parsers; mount the large parsers inside routers after `requireAuth`/`rbac`; ideally switch uploads to presigned direct uploads (§13).
- **Dependencies:** Upload re-platforming.
- **Complexity:** S (reorder) / L (presigned)
- **Verification plan:** Unauthenticated 30 MB POST to `/api/v1/documents` returns 401 before the body is consumed.

### SW-027

**Large lists lack search/filter/pagination; backend list endpoints are unbounded or silently capped at 100 with no meta.total**

| Field | Value |
|---|---|
| ID | SW-027 |
| Module | CRM, HR, Finance, Tickets, CMS, Audit, Notifications |
| Severity | P2 |
| Confidence | CONFIRMED |
| Sources | FE-003, API-007, CMS-001 |

- **Description:** Unbounded `findMany`: `GET /invoices`, `/support-tickets`, `/employees`, `/leave-requests`, `/media`, `/cms/subscribers`, `/timesheets`, CMS `listAllPosts`/`listAllPortfolio`. Hard `take: 100` (or 50) without `meta.total`: `/leads`, `/job-applications`, `/attendance`, `/audit-logs` (AuditPage paginates client-side over those 100 only), `/notifications` (50). Frontend views with no search/pagination: Invoices, Tickets, Leads, Applications, Leave, Timesheets, Attendance, Notifications, all CMS lists, PortalProjects, PortalMilestones, Roles. Violates §10 and §12.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** Every list >10 rows is searchable, filterable and paginated.
- **Actual:** Rows past 100 never appear (audit log loses entries in the UI); unbounded queries grow with data.
- **Evidence:** `backend/src/services/inquiry.service.ts:99`, `job.service.ts:241`, `hr.service.ts:36-42,113,186`, `system.service.ts:5-9`, `invoice.service.ts:100-108`, `ticket.service.ts:85-91`, `timesheet.service.ts:46`, `media.service.ts:19-22`, `subscriber.service.ts:35-40`; `frontend/src/features/ops/api.ts:33,103,147,160,204,274,286,312,324,327`; `features/cms/api.ts:66,90,144,171,195,222,246,264`; grep of `features/cms/*AdminPage.tsx`: 0 search/pagination controls.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Staff and clients.
- **Business impact:** Older audit entries unreachable; slow pages as data grows.
- **Recommended fix:** Server pagination with `meta.total` and shared `?page&pageSize&search&status` (copy the Clients/Documents pattern), then a shared paginator UI.
- **Dependencies:** SW-080 (API-008), SW-083 (API-013) shared query schemas.
- **Complexity:** M
- **Verification plan:** Seed 150 rows; `meta.total` = 150 and page 2 reachable in the UI.
- **Merge note:** Three agents, all P2.

### SW-028

**Project managers can provision new user accounts and grant the ENGINEER role via project invite (bypassing admin-only onboarding)**

| Field | Value |
|---|---|
| ID | SW-028 |
| Module | Engineer registration |
| Severity | P2 |
| Confidence | SUSPECTED |
| Sources | ENG-007, SEC-017 |

- **Description:** `createEngineerAccount` requires ADMIN/SUPER_ADMIN, but `inviteProjectEngineer` (project manager + `engineering.manage`) calls `ensureEngineerAccountForProjectInvite` -> `provisionAccount` for any email, including existing non-engineer users such as CLIENT accounts. On activation the user gains role ENGINEER, mixing client and internal roles in a way user invitations forbid. 409 messages reveal whether an email exists. Existing users must confirm with their password, so no takeover. Impact SUSPECTED (may be intended; the doc describes it).
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/services/engineer-account.service.ts:25-29,216-262,561-597`; `engineering.service.ts:510-522`; `user-invitation.service.ts:22-27`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Organisation account governance.
- **Business impact:** Account-creation and role-grant authority extends to every PM.
- **Recommended fix:** Restrict new-account provisioning to admins or require admin approval; refuse CLIENT-role emails; apply the same role-mixing checks as user invitations.
- **Dependencies:** Product decision.
- **Complexity:** S
- **Verification plan:** PM invites an unknown or CLIENT email -> 403 or pending admin approval.
- **Merge note:** ENG-007 (P2) and SEC-017 (P3); P2 kept.

### SW-029

**Invoice and payment endpoints bypass finance hardening: no MFA proof, no approval, no audit log; MANAGER can record payments**

| Field | Value |
|---|---|
| ID | SW-029 |
| Module | Invoices / Payments RBAC |
| Severity | P2 |
| Confidence | CONFIRMED |
| Sources | FIN-008 |

- **Description:** Invoice/payment routes use only `requireAuth` + `rbac(invoices.*|payments.*)`; MANAGER holds the `invoices.` and `payments.` prefixes. Manual payments are immediately COMPLETED with no second approver and no `auditLog`. No payment reversal/refund endpoint exists.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/routes/platform.routes.ts:115-126,200-213`; `seed.ts:78-104`; `payments/gateways/manualBank.gateway.ts:42-58`; no auditLog calls in `invoice.service.ts`/`payment.service.ts`/gateways.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Finance.
- **Business impact:** A single MANAGER can mark invoices paid without 2FA and without a trace beyond `recordedById`.
- **Recommended fix:** Require finance MFA proof on money-moving routes; audit-log create/send/void/payment; add a reversal workflow.
- **Dependencies:** SW-001 (SEC-001).
- **Complexity:** M
- **Verification plan:** MANAGER without MFA proof gets 403 on `POST /payments`; audit rows written.

### SW-030

**Accounting-period assignment uses the UTC month while dates are Mogadishu midnight: first-of-month transactions land in the previous period**

| Field | Value |
|---|---|
| ID | SW-030 |
| Module | General ledger / period close |
| Severity | P2 |
| Confidence | CONFIRMED |
| Sources | FIN-003 |

- **Description:** The frontend sends `parseFinanceBusinessDate(date).toISOString()` (00:00 +03:00 = previous day 21:00Z). `periodOf` uses `getUTCFullYear/getUTCMonth`; `closePeriod` counts pending by UTC month; the DB trigger `finance_open_period_guard` uses `EXTRACT(MONTH FROM occurred_on)` on UTC. Reproduced: `2026-11-01` -> `2026-10-31T21:00:00.000Z` -> period 10.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `frontend/src/features/finance/FinancePage.tsx:825-828`; `packages/shared/src/schemas/finance.ts` `parseFinanceBusinessDate`; `backend/src/services/finance.service.ts:55-57,597-604`; `migrations/20261016120000_finance_ledger_foundation/migration.sql:249-262`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Finance.
- **Business impact:** A 1 November entry is assigned to October: posting fails once October is closed; closing October is blocked; period totals disagree with the dashboard.
- **Recommended fix:** Compute the period from `financeBusinessDate(occurredOn)` in the service and the trigger (`occurred_on + interval "3 hours"`), and review existing first-day rows.
- **Dependencies:** Data review.
- **Complexity:** M
- **Verification plan:** Integration test posting a 1st-of-month entry after closing the previous month.

### SW-031

**Webhook overpayment path rolls back and returns 409 forever; captured money is never recorded**

| Field | Value |
|---|---|
| ID | SW-031 |
| Module | Payments / webhook |
| Severity | P2 |
| Confidence | CONFIRMED |
| Sources | FIN-005 |

- **Description:** `applyEvcWebhook` throws `PAYMENT_FAILED 409` inside the transaction when `paidAmount + payment.amount > total`. The payment stays PENDING, provider retries receive 409 and no alert is raised.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/services/payment.service.ts:103-104`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Clients and finance.
- **Business impact:** Settled money silently unrecorded.
- **Recommended fix:** Record the payment as COMPLETED with an overpaid/credit flag or a NEEDS_REVIEW status and alert finance; never discard a settled provider charge.
- **Dependencies:** SW-034 (FIN-013).
- **Complexity:** M
- **Verification plan:** Unit test of the overpayment branch.

### SW-032

**Invoice line totals are not rounded before summing (subtotal can disagree with stored lines); large values overflow to 500**

| Field | Value |
|---|---|
| ID | SW-032 |
| Module | Finance / Invoices |
| Severity | P2 |
| Confidence | CONFIRMED |
| Sources | DB-008, FIN-006 |

- **Description:** `lineTotal = quantity x unitPrice` (up to 4 dp) is stored into `Decimal(12,2)` (Postgres rounds each line) while `subtotal` sums unrounded values. Demonstrated: 3 lines of 1.5 x 0.33 store 0.50 each (sum 1.50) but subtotal 1.49; two lines 0.25 x 0.10 store 0.03 each (sum 0.06) but subtotal 0.05. Quantity and price may each reach 9,999,999,999.99, so the product overflows `Decimal(12,2)` (`numeric field overflow`) -> 500. No `dueDate >= issueDate` check.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** Invoice totals equal the sum of stored lines.
- **Actual:** Mismatch of 0.01 per rounding; overflow returns 500.
- **Evidence:** `backend/src/services/invoice.service.ts:137,140-143`; `packages/shared/src/schemas/invoice.ts:16` (`moneyString`); psql reproductions in DB-008 and FIN-006.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Clients and finance.
- **Business impact:** Printed invoice and payable balance do not reconcile.
- **Recommended fix:** `quantity.mul(unitPrice).toDecimalPlaces(2, ROUND_HALF_UP)` per line, sum the rounded lines, bound quantity x price and total server-side, add a date-ordering refine.
- **Dependencies:** None.
- **Complexity:** S
- **Verification plan:** Unit tests for the rounding examples and overflow -> 400.
- **Merge note:** Same defect; both P2.

### SW-033

**Invoices and payments are outside the ledger: revenue exists in two unreconciled systems; invoices have no currency**

| Field | Value |
|---|---|
| ID | SW-033 |
| Module | AR / ledger |
| Severity | P2 |
| Confidence | CONFIRMED |
| Sources | FIN-007 |

- **Description:** No invoice/payment service writes `financeJournal`; the main dashboard "Revenue collected" uses `invoice.paidAmount` while the finance dashboard uses posted journals. No double counting inside the ledger. Invoice has no `currency` column.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `finance.service.ts:727-731` (basis string); `dashboard.service.ts:404-413`; `schema.prisma:641-666`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Management and finance.
- **Business impact:** Two different revenue figures shown to users.
- **Recommended fix:** Post invoice issue (Dr AR / Cr Revenue) and payment (Dr Cash / Cr AR) journals; add `currency` to Invoice.
- **Dependencies:** Decision on system of record (§18).
- **Complexity:** L
- **Verification plan:** Invoice issue + payment produce balanced journals; dashboards agree.

### SW-034

**EVC Plus client is a generic placeholder contract; webhook has no replay window and no amount reconciliation**

| Field | Value |
|---|---|
| ID | SW-034 |
| Module | Payments (EVC Plus) |
| Severity | P2 |
| Confidence | CONFIRMED |
| Sources | FIN-013, SEC-021 |

- **Description:** The client posts to `${PAYMENT_EVC_API_URL}/charges` with a Bearer key and expects `{transactionId}`; the webhook expects `X-EVC-Signature` HMAC-SHA256 of the raw body with payload `{transactionId, status, reference}` - no timestamp or amount. `applyEvcWebhook` credits the locally stored `payment.amount` without checking what the gateway settled. The signature check itself is correct (timing-safe, raw body) and the non-PENDING guard makes replays harmless. CONFIRMED: missing amount/timestamp checks. SUSPECTED: that the contract does not match the real provider (Hormuud/WaafiPay); no provider credentials.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/services/payments/evcplus.client.ts:36-48,66-82`; `packages/shared/src/schemas/payment.ts:56-60`; `payment.service.ts:88,102-115`; `app.ts:66-67`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Clients paying by EVC.
- **Business impact:** Live payments may not work; settled amount not reconciled.
- **Recommended fix:** Implement against the provider's documented API in a sandbox; verify amount and currency and add a timestamp tolerance once the spec is known.
- **Dependencies:** Provider sandbox credentials (BLOCKED).
- **Complexity:** S-M
- **Verification plan:** Sandbox charge + webhook end to end.
- **Merge note:** FIN-013 (P2, SUSPECTED) and SEC-021 (P3, CONFIRMED) both concern the EVC contract; P2 kept.

### SW-035

**Payroll, salaries, bonuses, allowances, AP, recurring expenses, bank reconciliation and FX are not implemented**

| Field | Value |
|---|---|
| ID | SW-035 |
| Module | HR / Finance scope |
| Severity | P2 |
| Confidence | CONFIRMED |
| Sources | FIN-009 |

- **Description:** `Employee` has no salary/bank fields; `salary|payroll` appears only in a limitation string; no `bullmq` in any package.json and no `backend/src/jobs`; no vendor/bill/exchange-rate models. Existing docs correctly mark these PARTIAL/unimplemented.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/prisma/schema.prisma:537-555`; `finance.service.ts`; package.json files.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Finance and HR.
- **Business impact:** Features in the product requirements are absent.
- **Recommended fix:** Plan as separate sub-phases (I3.x payroll, I4.x AP/recurring/FX).
- **Dependencies:** Statutory format decision (§18).
- **Complexity:** L
- **Verification plan:** Per sub-phase acceptance.

### SW-036

**Main dashboard "Revenue collected" KPI ignores the selected range; trend is misleading; USD assumed**

| Field | Value |
|---|---|
| ID | SW-036 |
| Module | Dashboard |
| Severity | P2 |
| Confidence | CONFIRMED |
| Sources | RPT-001 |

- **Description:** Current value = all-time SUM(paidAmount) of non-void invoices; "previous" = same sum for invoices created before `from`, so current always includes previous, the trend is always >= 0 and is attributed by invoice creation date. Series use JS floats; the frontend formats every amount as USD with 0 decimals although invoices have no currency.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/services/dashboard.service.ts:404-411,449-450`; `frontend/src/features/dashboard/metrics.ts:45-53`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Management.
- **Business impact:** Wrong revenue figure on the home dashboard.
- **Recommended fix:** Sum COMPLETED `payments.amount` by date within range; serialise Decimal sums as strings; display currency from data.
- **Dependencies:** SW-033 (FIN-007) currency.
- **Complexity:** S
- **Verification plan:** Unit test with payments inside/outside the range.

### SW-037

**Seeded demo content is live in production as real testimonials, team, portfolio, careers and posts**

| Field | Value |
|---|---|
| ID | SW-037 |
| Module | Website / CMS data |
| Severity | P2 |
| Confidence | CONFIRMED |
| Sources | WEB-002, DB-002 |

- **Description:** `seed.ts` creates sample testimonials, team, FAQs, posts, job openings, portfolio, services, a sample client `client@example.com` ("Macmiil Tusaale") and two sample projects. Production serves the seeded testimonials ("Faadumo Cabdi", "Axmed Nuur", rating 5), team ("Cabdirisaaq Warsame", "Hodan Maxamed"), portfolio, posts and careers (`naqshadeeye-uiux`, `horumariye-frontend`). `web/src/lib/seedTranslations.ts` translates this seed content. Hardcoded "tusaale" example projects are published and in the sitemap; trusted-client logos (Hormuud, Somtel, Dahabshiil, TAAJ, Premier Bank, Amal Bank) are shown - whether these are real relationships is SUSPECTED/unverified. The sample client and projects most likely exist in the production internal DB (SUSPECTED).
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** Production probes of `/api/v1/public/testimonials`, `/team`, `/careers`, `/homepage`; `backend/prisma/seed.ts:222-225,269,302,339,348-406`; `web/src/lib/homeContent.ts:4-22,96-179`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Public visitors; the business.
- **Business impact:** Fabricated reviews presented as genuine: consumer-protection, legal and trademark risk.
- **Recommended fix:** Business replaces or unpublishes demo records through the CMS (after a backup), confirms logo permissions, drops the seedTranslations shim; split the seed (DB-001).
- **Dependencies:** Content owner decision (user action); SW-011 (DB-001) seed split.
- **Complexity:** S (content)
- **Verification plan:** Public endpoints return only real content.
- **Merge note:** Same observation; both P2.

### SW-038

**Re-running the seed overwrites admin-edited role permissions and resets the super-admin password**

| Field | Value |
|---|---|
| ID | SW-038 |
| Module | Core / RBAC / seed |
| Severity | P2 |
| Confidence | CONFIRMED |
| Sources | DB-003, SEC-018 |

- **Description:** Every seed run does `role.update({ permissions: { set: ... } })` for most roles, replacing what admins configured through `PUT /roles/:id/permissions`, and `user.upsert` sets `passwordHash` whenever `SEED_SUPER_ADMIN_PASSWORD` is set, without revoking sessions. In non-production NODE_ENV the password falls back to a hard-coded default, and `docs/SUPER_ADMIN_SETUP.md:44` lists the default super-admin email and password. DB-001 makes seed re-runs necessary in practice. The entrypoint does not run the seed.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/prisma/seed.ts:31-34,40-43,48-57,68-78,158-167,190-199,211-219` (`set:`), `:439,459,478-482`; `role.service.ts:46-76`; `docs/SUPER_ADMIN_SETUP.md:44,70`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Administrators.
- **Business impact:** Silent loss of RBAC customisations; reverted admin password.
- **Recommended fix:** Grant defaults additively only when a role is first created; use `update: {}` for the super admin unless an explicit `SEED_RESET_SUPER_ADMIN=true`/`--reset-password` is passed; refuse the default password outside development.
- **Dependencies:** SW-011 (DB-001).
- **Complexity:** S
- **Verification plan:** Customise a role, re-run the seed, assert grants unchanged.
- **Merge note:** DB-003 (P2) and SEC-018 (P3); P2 kept.

### SW-039

**Email uniqueness is case-sensitive at the DB level; app-level case-insensitive checks are racy**

| Field | Value |
|---|---|
| ID | SW-039 |
| Module | Core / auth / portal onboarding |
| Severity | P2 |
| Confidence | CONFIRMED |
| Sources | DB-005 |

- **Description:** `users.email` has a plain btree unique index; services look up with `mode: "insensitive"` and check-then-insert under READ COMMITTED. `Case@x.com` and `case@x.com` both insert (SQL test). `project-inquiry.service.ts` stores the email without lowercasing; `clients.email` is not unique. Race SUSPECTED.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/prisma/schema.prisma:20`; `auth.service.ts:102-108`; `user-invitation.service.ts:155-169`; `project-inquiry.service.ts:308-343`; `\d users`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** All users.
- **Business impact:** Duplicate accounts; login resolves to either.
- **Recommended fix:** Migration adding `UNIQUE (lower(email))` after deduplication, or `citext`; normalise to lowercase in the shared schema.
- **Dependencies:** SW-099 (DB-021) partial index.
- **Complexity:** S
- **Verification plan:** Duplicate insert fails; concurrent invite test gives one 201 and one 409.

### SW-040

**Support-ticket codes come from count()+1 without a lock; concurrent creates collide (500)**

| Field | Value |
|---|---|
| ID | SW-040 |
| Module | Portal tickets |
| Severity | P2 |
| Confidence | CONFIRMED |
| Sources | DB-007 |

- **Description:** `code = TKT-${year}-${count+1}` counts all tickets (every year) with no lock; two simultaneous creates collide on `support_tickets_code_key` -> 500. The year prefix never resets. Invoices use `pg_advisory_xact_lock` correctly.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/services/ticket.service.ts:115-117`; contrast `invoice.service.ts:149-155`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Clients.
- **Business impact:** Ticket creation fails intermittently.
- **Recommended fix:** Reuse the invoice pattern (advisory lock + MAX per year) or a Postgres sequence.
- **Dependencies:** None.
- **Complexity:** S
- **Verification plan:** Parallel create test produces unique codes.

### SW-041

**`sendInvoice` is not locked or status-guarded and can resurrect a VOID invoice**

| Field | Value |
|---|---|
| ID | SW-041 |
| Module | Finance / Invoices |
| Severity | P2 |
| Confidence | SUSPECTED |
| Sources | DB-009 |

- **Description:** `sendInvoice` reads the invoice then `update({ where: { id } })` with no `FOR UPDATE` and no status predicate; `voidInvoice` does lock. A void committed between read and update flips VOID->SENT and emails the client. Race SUSPECTED; code path confirmed.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/services/invoice.service.ts:179-199` (update at `:195-197`) vs `:220-243`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Clients and finance.
- **Business impact:** Void invoice emailed to client.
- **Recommended fix:** `updateMany({ where: { id, status: "DRAFT" } })` and treat count 0 as 409, or a transaction with `FOR UPDATE`.
- **Dependencies:** None.
- **Complexity:** S
- **Verification plan:** Concurrent send/void test.

### SW-042

**Employee records are created non-transactionally and implicitly (including on GET /timesheets) and break for soft-deleted employees**

| Field | Value |
|---|---|
| ID | SW-042 |
| Module | HR / Timesheets |
| Severity | P2 |
| Confidence | CONFIRMED |
| Sources | DB-010 |

- **Description:** (a) `createEmployee` does `employee.create` then a separate `user.update({employeeId})`; (b) `GET /timesheets` calls `ensureEmployee`, which creates an Employee on read for any user (no audit, `users.employee_id` not set); (c) `employees.user_id`/`employee_no` are globally unique, so a soft-deleted employee cannot be re-hired and their timesheet page fails with a unique violation -> 500 (also noted in PRJ-010 and API-007); (d) `users.employee_id` has no FK and duplicates `employees.user_id`.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/services/hr.service.ts:59-76`; `timesheet.service.ts:35-45,58`; `schema.prisma:30,539`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Staff and HR.
- **Business impact:** Orphan/duplicate employee rows; 500 for returning employees.
- **Recommended fix:** One transaction; drop `users.employee_id`; reactivate soft-deleted rows; remove creation from the GET path.
- **Dependencies:** None.
- **Complexity:** M
- **Verification plan:** Re-hire test; GET has no side effects.

### SW-043

**Cascading deletes on HR, financial and time records (latent data-loss risk)**

| Field | Value |
|---|---|
| ID | SW-043 |
| Module | HR, Finance, PM schema |
| Severity | P2 |
| Confidence | CONFIRMED |
| Sources | DB-011 |

- **Description:** Deleting a User cascades to Employee -> Attendance/LeaveRequest/Timesheet; deleting a Project cascades to ProjectExpense, ProjectBudgetRevision, Milestone, Task -> TaskTimeEntry/Revision. Attendance has no `deletedAt`. No service hard-deletes these today (exploit path SUSPECTED), but one manual DELETE or future refactor would silently wipe statutory history, contrary to §7.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/prisma/schema.prisma:549,566,599,624,1017,1032,1062,1187,1680,1718`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** HR and finance records.
- **Business impact:** Very high if triggered.
- **Recommended fix:** Change to `onDelete: Restrict`, add `deletedAt` to Attendance, keep Cascade only for pure join/child tables.
- **Dependencies:** Migration.
- **Complexity:** S
- **Verification plan:** `DELETE FROM users` on a user with an employee fails.

### SW-044

**Timesheet approval is unscoped and effectively self-approval**

| Field | Value |
|---|---|
| ID | SW-044 |
| Module | Timesheets |
| Severity | P2 |
| Confidence | CONFIRMED |
| Sources | ENG-006 |

- **Description:** `GET /timesheets` returns only the caller's rows and the page shows "Approve" on them for holders of `timesheets.update` (MANAGER), so managers approve their own hours. `updateTimesheetStatus` accepts any id with no ownership/team scope, self-approval check, state machine or audit log. `createTimesheet` accepts any existing projectId.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/services/timesheet.service.ts:44-52,58-63,77-87`; `frontend/src/features/ops/TimesheetsPage.tsx:86-92`; `seed.ts:84-90`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Payroll/billing.
- **Business impact:** Unverified hours approved.
- **Recommended fix:** Manager approval queue scoped to reports/projects, forbid self-approval, audit, restrict projectId to `projectScope`.
- **Dependencies:** HR permission model.
- **Complexity:** M
- **Verification plan:** Manager approving own row -> 403; other-project id -> 400/404.

### SW-045

**Progress counts cancelled tasks; five inconsistent progress formulas across surfaces**

| Field | Value |
|---|---|
| ID | SW-045 |
| Module | Projects / Dashboard / Portal |
| Severity | P2 |
| Confidence | CONFIRMED |
| Sources | PRJ-001 |

- **Description:** `deriveProgress(total, done)` includes CANCELLED tasks in total (9 DONE + 1 CANCELLED = 90%, never 100%); `taskCounts.open = total - done`. Formulas differ: portfolio/list and workspace (all approval states), portal project page (APPROVED only), portal dashboard (all states), milestone progress (APPROVED only), analytics (APPROVED only, 0 instead of null). A client sees different percentages on two portal pages.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/services/project.service.ts:291-297,333,735-757,886`; `dashboard.service.ts:545,674-675`; `milestone.service.ts:57-66`; `engineering-analytics.service.ts:52-55,115`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Managers and clients.
- **Business impact:** Wrong and inconsistent progress reporting.
- **Recommended fix:** One shared function: done / (total - cancelled) with a consistent approval filter, used everywhere.
- **Dependencies:** None.
- **Complexity:** S-M
- **Verification plan:** Unit test 9 DONE + 1 CANCELLED -> 100%; portal page equals portal dashboard.

### SW-046

**"Unassigned projects" KPI and filter include COMPLETED/CANCELLED projects and projects with pending invitations**

| Field | Value |
|---|---|
| ID | SW-046 |
| Module | Projects portfolio |
| Severity | P2 |
| Confidence | CONFIRMED |
| Sources | PRJ-002 |

- **Description:** KPI and `?assignment=unassigned` filter on `assignedEngineers === 0` with no status filter; the "Assign engineer" button is hidden for completed/cancelled projects and the backend rejects invites for them. Projects whose only engineers have pending invitations show PENDING but count as unassigned.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `frontend/src/features/projects/ProjectsPage.tsx:47-50,128-150`; `project.controller.ts:69-71`; `project.service.ts:353,405-406`; `engineering.service.ts:516-517`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Managers.
- **Business impact:** Inflated KPI and unactionable rows.
- **Recommended fix:** Restrict to status PLANNING/ACTIVE/ON_HOLD; decide whether PENDING counts.
- **Dependencies:** None.
- **Complexity:** S
- **Verification plan:** Completed project without engineers excluded from KPI.

### SW-047

**Legacy task path has no lifecycle rules; completedAt never set; assignee can mark DONE directly**

| Field | Value |
|---|---|
| ID | SW-047 |
| Module | Tasks |
| Severity | P2 |
| Confidence | CONFIRMED |
| Sources | PRJ-003 |

- **Description:** Tasks from `POST /tasks` get `reviewRequired: false`; `updateTask` then skips transitions, dependency, checklist and QA gates, never sets `completedAt` and writes no TaskTransition. An assignee may PATCH `{status:"DONE"}`. The project creation wizard creates its initial tasks through this path.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/services/task.service.ts:162-163,201-206,287-299`; `ProjectCreationWizard.tsx:155-161`; `engineering-analytics.service.ts:69`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Engineering managers.
- **Business impact:** Analytics under-report completion; prerequisites completed out of order; no audit trail.
- **Recommended fix:** Apply transition/dependency rules and `completedAt` for all tasks; record TaskTransition.
- **Dependencies:** None.
- **Complexity:** M
- **Verification plan:** PATCH DONE on a legacy task sets completedAt; dependency-blocked IN_PROGRESS -> 409.

### SW-048

**Assignee can self-advance IN_REVIEW -> TESTING (code review step not independent)**

| Field | Value |
|---|---|
| ID | SW-048 |
| Module | Engineering task workflow |
| Severity | P2 |
| Confidence | CONFIRMED |
| Sources | ENG-002 |

- **Description:** Work review after approval is only a status transition in `updateTask` (IN_REVIEW: TESTING or IN_PROGRESS); assignees may make status-only updates, so they can move their own work out of review. Only QA has an independence check.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/services/task.service.ts:201-206,217-225`; `engineering.service.ts:2006-2007`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Delivery quality.
- **Business impact:** Review gate can be bypassed.
- **Recommended fix:** Require reviewer/manager (not the assignee) for IN_REVIEW -> TESTING; record the reviewer.
- **Dependencies:** None.
- **Complexity:** S
- **Verification plan:** Assignee PATCH TESTING -> 403.

### SW-049

**SLA escalation scan starves: always the same oldest 100 breached records**

| Field | Value |
|---|---|
| ID | SW-049 |
| Module | Bugs / maintenance SLA |
| Severity | P2 |
| Confidence | CONFIRMED |
| Sources | ENG-003 |

- **Description:** `scanSlaBreaches` takes 100 ordered by reportedAt/createdAt asc, filtered only by status and missed deadline; already-escalated records keep matching, so once 100 open breached items exist, newer breaches are never escalated.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/services/sla-escalation.service.ts:60-102`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Clients with SLAs; on-call managers.
- **Business impact:** Missed escalations.
- **Recommended fix:** Track `escalatedAt`/stage on the record or exclude already-notified stages; paginate with a cursor.
- **Dependencies:** None.
- **Complexity:** S
- **Verification plan:** Unit test with 101 breached rows -> 101st notified.

### SW-050

**Critical-bug alert skips the project's primary manager (project.managerId)**

| Field | Value |
|---|---|
| ID | SW-050 |
| Module | Bugs |
| Severity | P2 |
| Confidence | CONFIRMED |
| Sources | ENG-004 |

- **Description:** `createBug` notifies only projectMember rows with role MANAGER; the PM assigned via project create/edit is stored in `project.managerId` with no membership row, so they learn only via the SLA scan (>= 1 h + up to 15 min later).
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/services/engineering-operations.service.ts:303-318`; `project.service.ts:514-547`; `sla-escalation.service.ts:21-31`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Project managers; clients.
- **Business impact:** Delayed response to critical bugs.
- **Recommended fix:** Include `project.managerId` as `escalate()` does.
- **Dependencies:** None.
- **Complexity:** S
- **Verification plan:** CRITICAL bug on a project with managerId only creates a notification.

### SW-051

**Cancelled engineer account invitation permanently blocks that email**

| Field | Value |
|---|---|
| ID | SW-051 |
| Module | Engineer registration |
| Severity | P2 |
| Confidence | CONFIRMED |
| Sources | ENG-005 |

- **Description:** `cancelEngineerInvitation` sets CANCELLED; re-inviting hits `provisionAccount`, which throws 409 whenever any invitation row exists (`userId @unique`); resend accepts only INVITED/VERIFIED. The project-invite path hits the same code.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/services/engineer-account.service.ts:163-165,233-262,386-389,448-472`; `schema.prisma:1315`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Engineers and admins.
- **Business impact:** Engineer cannot be re-invited without DB edits.
- **Recommended fix:** Allow re-provision when status is CANCELLED (reset the row).
- **Dependencies:** None.
- **Complexity:** S
- **Verification plan:** Cancel then re-invite -> 201.

### SW-052

**GitHub webhook body limit of 256 KB will reject legitimate large deliveries**

| Field | Value |
|---|---|
| ID | SW-052 |
| Module | GitHub |
| Severity | P2 |
| Confidence | SUSPECTED |
| Sources | ENG-008 |

- **Description:** `/api/v1/github/webhooks` uses `express.raw({ limit: "256kb" })`; GitHub deliveries can reach 25 MB and push/PR payloads routinely exceed 256 KB -> 413 before the signature check; state never syncs. Code CONFIRMED; live behaviour BLOCKED.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/app.ts:71-72`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Engineering teams using GitHub sync.
- **Business impact:** Push/PR events lost.
- **Recommended fix:** Raise to ~5-25 MB for this route only (signature check is cheap) or accept and truncate.
- **Dependencies:** GitHub App credentials for live check.
- **Complexity:** S
- **Verification plan:** Signed 1 MB payload -> 202.

### SW-053

**Background jobs are in-process setInterval timers (no BullMQ) running on every API replica; the documented dedicated worker cannot be started from the image**

| Field | Value |
|---|---|
| ID | SW-053 |
| Module | Jobs / notifications |
| Severity | P2 |
| Confidence | CONFIRMED |
| Sources | INF-005, ENG-017 |

- **Description:** `BACKGROUND_WORKERS_ENABLED` defaults to true and `server.ts` starts timers in every API process (email 30 s, SLA 15 min, health probe 5 min, reminders 60 min). `docker-entrypoint.sh` ends with `exec npm start` and ignores `"$@"`, so `npm run worker` cannot be selected without replacing ENTRYPOINT, although docs tell operators to run a separate worker. Email claiming is atomic and deduped (safe), but each process inserts its own SystemHealthCheck row and the alert dedupe key includes `check.id`, so N processes send N duplicate alerts. The 120 s email lease is shorter than a worst-case Resend call plus retry. CLAUDE.md §4/§11 require BullMQ with deterministic jobIds.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/lib/env.ts:38`; `server.ts:17-18`; `background-jobs.ts:57-62`; `docker-entrypoint.sh:12`; `system-health.service.ts:106-144`; `notification-delivery.service.ts:159-167`; `schema.prisma:239`; `docs/COMPLETION_AUDIT.md:52`, `ENGINEERING_PLATFORM.md:32`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Operators; alert recipients.
- **Business impact:** Duplicate alerts and DB rows per replica; no jobs if the API is down.
- **Recommended fix:** Entrypoint `exec "$@"` with default CMD `npm start`; ship worker deployment instructions; default `BACKGROUND_WORKERS_ENABLED=false` on the API once a worker exists; key health alerts on `systemId+status+time bucket`; consider BullMQ repeatable jobs.
- **Dependencies:** Coolify replica topology (BLOCKED).
- **Complexity:** M
- **Verification plan:** Two API processes with health probes produce one alert per transition.
- **Merge note:** INF-005 (P2) and ENG-017 (P3); P2 kept.

### SW-054

**Filesystem storage durability depends on an unverified Coolify volume; storageStatus() reports durable regardless**

| Field | Value |
|---|---|
| ID | SW-054 |
| Module | Storage |
| Severity | P2 |
| Confidence | SUSPECTED |
| Sources | INF-011 |

- **Description:** `storageStatus()` returns `durable: true` whenever `STORAGE_PROVIDER=filesystem` with an absolute path and never checks it is a mount. `/data/uploads` is created in the image layer; a root-owned named volume causes EACCES under `USER node` (-> 503); without a volume every redeploy deletes uploads while the DB still references them. Coolify volume unverifiable.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/lib/storage.ts:35-45,52-55`; `Dockerfile:75`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** All uploaders.
- **Business impact:** Silent loss of uploaded files on redeploy.
- **Recommended fix:** At boot refuse `filesystem` in production unless a volume marker file exists (or compare stat device with `/`); document the volume as mandatory; prefer object storage (ImageKit re-platforming).
- **Dependencies:** Coolify access.
- **Complexity:** S
- **Verification plan:** Coolify shows a persistent volume at `/data/uploads`; upload, redeploy, retrieve.

### SW-055

**A Redis outage takes the whole API down through the healthcheck, although Redis is only a cache**

| Field | Value |
|---|---|
| ID | SW-055 |
| Module | Health |
| Severity | P2 |
| Confidence | CONFIRMED |
| Sources | INF-006 |

- **Description:** `/health` returns 503 when Redis ping fails and the Docker HEALTHCHECK fails on non-2xx; all Redis consumers are best-effort cache wrappers.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/routes/health.routes.ts:15-18`; `Dockerfile:83-84`; `team.service.ts:124-138`, `post.service.ts:288-297`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** All users.
- **Business impact:** A cache blip becomes a full outage.
- **Recommended fix:** Split `/health/live` (process; HEALTHCHECK) from `/health/ready` (Postgres required, Redis reported as degraded).
- **Dependencies:** None.
- **Complexity:** S
- **Verification plan:** Stop Redis on staging; API keeps serving.

### SW-056

**Runtime is Node 20, which reached end-of-life in April 2026; local dev uses Node 22**

| Field | Value |
|---|---|
| ID | SW-056 |
| Module | All images / CI |
| Severity | P2 |
| Confidence | CONFIRMED |
| Sources | INF-003 |

- **Description:** Dockerfiles, `.nvmrc`, CI (`node-version: 20`) and engines use Node 20; local dev runs v22.22.0. `RESEND_EMAIL.md:11` pins resend v5 because production runs Node 20.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `Dockerfile:28,58`; `frontend/Dockerfile:31`; `web/Dockerfile`; `.nvmrc`; `.github/workflows/ci.yml:53`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** All.
- **Business impact:** No runtime security patches; dev/prod mismatch.
- **Recommended fix:** Move images, CI and `.nvmrc` to Node 22 LTS together; set engines `>=22 <23`.
- **Dependencies:** Dependency compatibility.
- **Complexity:** S
- **Verification plan:** CI and image builds on 22.

### SW-057

**Migrations run on every container start with no backup, no deploy ordering and no separation from the app**

| Field | Value |
|---|---|
| ID | SW-057 |
| Module | Deploy |
| Severity | P2 |
| Confidence | CONFIRMED |
| Sources | INF-004 |

- **Description:** The entrypoint runs `prisma migrate deploy` then `exec npm start`. Prisma's advisory lock prevents double application, but during a rolling deploy the new container migrates while the old one serves; no backup is taken; a failed migration crash-loops; a long migration can outlast the 45 s healthcheck start period; any worker built from the image would also migrate.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/docker-entrypoint.sh:11`; `Dockerfile:26,83`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Operators; all users during deploys.
- **Business impact:** Breakage mid-deploy; no recovery point.
- **Recommended fix:** Run migrations as a separate Coolify pre-deploy command or one-shot job after an automated `pg_dump`; enforce expand/contract migrations.
- **Dependencies:** SW-058 (INF-012) backups.
- **Complexity:** M
- **Verification plan:** Staging migration with two replicas; backup artifact exists before migration.

### SW-058

**No backup, restore or monitoring artifacts in the repository**

| Field | Value |
|---|---|
| ID | SW-058 |
| Module | Ops |
| Severity | P2 |
| Confidence | CONFIRMED |
| Sources | INF-012 |

- **Description:** No `pg_dump`/backup scripts, cron or restore runbook; docs only say "back up first". No uptime monitoring, alerting or error tracker; logs only to stdout. Coolify backup state BLOCKED.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** grep for `pg_dump|backup` finds only 2FA backup codes; `SUPER_ADMIN_SETUP.md:51`, `FINANCE_PRODUCTION_REPAIR.md:53`, `RESEND_EMAIL.md:37`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Business.
- **Business impact:** No evidenced recovery point for financial and HR records; outages noticed only by users.
- **Recommended fix:** Coolify scheduled Postgres backups to off-site S3, quarterly restore test, external uptime monitor on `/health` for the 3 hosts, error tracker.
- **Dependencies:** Coolify access (user action).
- **Complexity:** M
- **Verification plan:** Backup artifact listed; restore test recorded; monitor alerts on downtime.

### SW-059

**CI does not gate deploys, run e2e, build the Docker images or audit dependencies**

| Field | Value |
|---|---|
| ID | SW-059 |
| Module | CI/CD |
| Severity | P2 |
| Confidence | CONFIRMED |
| Sources | INF-013 |

- **Description:** `ci.yml` (only workflow) runs install -> migrate -> seed -> typecheck -> lint -> format -> coverage -> build on push to main, with no deploy job, no Playwright, no `docker build` and no `npm audit`. Coolify normally auto-deploys on its own webhook in parallel with CI (SUSPECTED), so a red build can ship; image build failures are found only during Coolify deploys.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `.github/workflows/ci.yml`; root `package.json` `test:e2e`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** All.
- **Business impact:** Untested or broken builds reach production.
- **Recommended fix:** Disable Coolify auto-deploy and trigger the deploy webhook from a CI job that needs `build`; add docker build jobs and Playwright e2e against compose services.
- **Dependencies:** Coolify setting (user action).
- **Complexity:** M
- **Verification plan:** A failing CI run does not deploy.

### SW-060

**Public image route shares the 60 requests/minute public rate limit**

| Field | Value |
|---|---|
| ID | SW-060 |
| Module | Storage / public site |
| Severity | P2 |
| Confidence | CONFIRMED |
| Sources | STO-002 |

- **Description:** `publicRouter.use(publicRateLimiter)` covers `/article-images/:id`; 60/min per IP in memory (probe header `ratelimit: limit=60`). A portfolio item can have a cover plus 20 gallery images; visitors behind carrier NAT share one IP.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/routes/public.routes.ts:20,31`; `middleware/rateLimit.ts:32`; `public.controller.ts:158`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Public visitors.
- **Business impact:** Images return 429 and render broken.
- **Recommended fix:** Exempt GET `/article-images` from the limiter (or raise it) and serve through a CDN/cache.
- **Dependencies:** ImageKit re-platforming may make this moot.
- **Complexity:** S
- **Verification plan:** Load 30 images from one IP within a minute without 429.

### SW-061

**Image URLs are absolute, take their host from the request, and only the id is validated**

| Field | Value |
|---|---|
| ID | SW-061 |
| Module | CMS images |
| Severity | P2 |
| Confidence | CONFIRMED |
| Sources | STO-003 |

- **Description:** `cms.controller.ts` builds `${proto}://${host}/api/v1/public/article-images/${id}` from `x-forwarded-host`/`Host` and stores it. Validation checks only the path and id, so any host passes. Effects: a domain change breaks every stored URL; an editor can point a cover at an attacker host; if Traefik forwards a client-supplied X-Forwarded-Host, the upload response URL can be poisoned (SUSPECTED).
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/controllers/cms.controller.ts:206-212`; `services/articleImage.service.ts:83-101`; `packages/shared/src/schemas/articleImage.ts:18-27`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Public site.
- **Business impact:** Broken or attacker-controlled images.
- **Recommended fix:** Store the image id or a relative path; build the URL from a configured `PUBLIC_API_URL`; check the host.
- **Dependencies:** ImageKit re-platforming.
- **Complexity:** M
- **Verification plan:** Cover URL with a foreign host is rejected.

### SW-062

**Sitemap omits every CMS detail page; canonical URLs differ by trailing slash**

| Field | Value |
|---|---|
| ID | SW-062 |
| Module | SEO |
| Severity | P2 |
| Confidence | CONFIRMED |
| Sources | WEB-003 |

- **Description:** `sitemap-0.xml` lists 17 URLs (static pages plus 4 "tusaale" examples) and no posts, services, portfolio items or careers (SSR routes not discovered). `/sitemap.xml` is 404 (the index is `/sitemap-index.xml`, referenced correctly by robots.txt). The sitemap uses trailing slashes while SSR canonicals omit them; both forms return 200 with self-canonicals, so pages are indexed twice. `web/public/robots.txt` still points at `https://somwave.com/sitemap-index.xml` (the route wins at runtime).
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** Production probes; `web/astro.config.mjs:24-28`; `web/src/layouts/BaseLayout.astro:29`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Search visibility.
- **Business impact:** CMS content not discoverable; duplicate indexing.
- **Recommended fix:** Set `trailingSlash` consistently and normalise canonicals; add a sitemap route from published API slugs; delete `public/robots.txt`.
- **Dependencies:** None.
- **Complexity:** S-M
- **Verification plan:** Sitemap lists published slugs; one canonical per page.

### SW-063

**Locale and i18n contradict the requirements: English default, chrome-only translation, no hreflang**

| Field | Value |
|---|---|
| ID | SW-063 |
| Module | Public website i18n |
| Severity | P2 |
| Confidence | CONFIRMED |
| Sources | WEB-004 |

- **Description:** `DEFAULT_LOCALE = "en"` (CLAUDE.md §17: Somali default); every page serves `<html lang="en" dir="ltr">` with Somali portfolio descriptions; the switcher swaps only `[data-i18n]` chrome strings client-side; Arabic sets `dir=rtl` over English content; no hreflang; og:locale `en_US`.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `web/src/lib/i18n.ts:9`; `web/src/components/LanguageSwitcher.astro:39-52`; production probes.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Somali and Arabic visitors.
- **Business impact:** Spec non-compliance; poor localisation and SEO.
- **Recommended fix:** Product decision on the default locale, then server-side locale routes with hreflang.
- **Dependencies:** Product decision.
- **Complexity:** L
- **Verification plan:** Locale routes render translated body content with hreflang.

### SW-064

**Careers applicants' resume URL is stored but never shown to staff; `javascript:` URLs accepted**

| Field | Value |
|---|---|
| ID | SW-064 |
| Module | Careers / Recruitment |
| Severity | P2 |
| Confidence | CONFIRMED |
| Sources | WEB-007 |

- **Description:** The careers form collects `resumeUrl`, stored and returned by the job service, but no frontend file renders it (grep `resume` in `frontend/src` = 0). There is no CV upload. `job.ts:40` uses `z.string().url()`, which accepts `javascript:alert(1)` (latent stored XSS if rendered as a link).
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `web/src/pages/fursado-shaqo/[slug].astro:72`; `backend/src/services/job.service.ts:79,250,274`; `packages/shared/src/schemas/job.ts:40`; `frontend/src/features/ops/ApplicationsPage.tsx`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** HR / recruiters; applicants.
- **Business impact:** Applications cannot be properly reviewed.
- **Recommended fix:** Restrict to `https:`, render the link with `rel="noopener noreferrer"`, consider a private CV upload.
- **Dependencies:** Shared httpsUrl schema.
- **Complexity:** S
- **Verification plan:** Staff see a safe CV link.

### SW-065

**Task Planning date-time editor shifts saved dates by the UTC offset on every save**

| Field | Value |
|---|---|
| ID | SW-065 |
| Module | Engineering -> Task Planning |
| Severity | P2 |
| Confidence | CONFIRMED |
| Sources | FE-002 |

- **Description:** The edit form fills `datetime-local` with the UTC wall time but parses on save as browser-local time. Reproduced with `TZ=Africa/Mogadishu`: 09:00Z -> 06:00Z -> 03:00Z -> 00:00Z on successive saves. `:215`, `EngineerWorklog.tsx:10` and `EngineeringWorkspacePage.tsx:443` also default "today" from the UTC date.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `frontend/src/features/engineering/TaskPlanningPage.tsx:25-27,210-211,215,321`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Engineers and managers.
- **Business impact:** Each save moves the task 3 hours earlier; SLA/due-date drift.
- **Recommended fix:** Add `toDateTimeInputValue`/`fromDateTimeInputValue` in `lib/date.ts` using date-fns-tz in DISPLAY_TIMEZONE.
- **Dependencies:** SW-067 (FE-010) shared DatePicker.
- **Complexity:** S
- **Verification plan:** Unit round-trip test in TZ=Africa/Mogadishu.

### SW-066

**Destructive actions without a confirm dialog**

| Field | Value |
|---|---|
| ID | SW-066 |
| Module | Projects, Engineering, Finance UI |
| Severity | P2 |
| Confidence | CONFIRMED |
| Sources | FE-004 |

- **Description:** Single-click: remove budget/expense entry, remove project member, cancel invitation, archive document, delete comment, remove task/milestone links, remove availability slot, remove dependency, "Post reversal" (reason field only). Native `window.confirm` used in three places instead of the shared Modal. The correct pattern exists elsewhere.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `ProjectBudgetPanel.tsx:224`; `ProjectTeamPanel.tsx:239,430`; `DocumentationPage.tsx:597,606-610,646,688,700`; `EngineerManagementPage.tsx:153`; `MilestonesPage.tsx:326`; `FinancePage.tsx:1350`; `EngineeringOperationsPage.tsx:870`; `GitHubPage.tsx:127`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Staff.
- **Business impact:** Accidental removal of financial and project records.
- **Recommended fix:** A shared `ConfirmDialog` in `components/ui` naming the target, used everywhere.
- **Dependencies:** None.
- **Complexity:** S-M
- **Verification plan:** Each listed action opens a named confirm dialog.

### SW-067

**Duplicate form controls: raw date inputs, selects, textareas and tables bypass the shared kit**

| Field | Value |
|---|---|
| ID | SW-067 |
| Module | UI kit compliance |
| Severity | P2 |
| Confidence | CONFIRMED |
| Sources | FE-010 |

- **Description:** Shared `DatePicker` used in 5 files vs 33 raw `type="date|datetime-local|month"` inputs in 15 files; 90 raw `<select>`; local `fieldClass` re-implements Input; no shared Textarea (35 raw); 9 raw `<table>`. CLAUDE.md §2: a second date picker is a defect. FE-002 is a direct consequence.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `FinancePage.tsx:37,174,180,673,916,1041,1047`; `ProjectsPage.tsx:265-283`; `TaskPlanningPage.tsx:327,333,562,1091,1098`; and the other files listed in FE-010.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** All staff users.
- **Business impact:** Inconsistent focus, labels and error wiring; timezone bugs.
- **Recommended fix:** Extend DatePicker (date/datetime/month in DISPLAY_TIMEZONE), add Textarea, migrate.
- **Dependencies:** None.
- **Complexity:** M
- **Verification plan:** grep finds no raw date inputs outside the kit.

### SW-068

**Coverage far below the 70% Definition of Done and no threshold enforced; frontend business screens untested**

| Field | Value |
|---|---|
| ID | SW-068 |
| Module | Test infrastructure |
| Severity | P2 |
| Confidence | CONFIRMED |
| Sources | QA-001, FE-022 |

- **Description:** Full run: lines 33.45%, branches 67.6%, functions 45.08% (backend L 52.72, frontend L 9.1, shared L 96.2). `vitest.config.ts` has no `thresholds`. Lowest services: sla-escalation 0, engineering-analytics 0.7, github.service 1.5, system 1.6, engineering-operations 5.6, dashboard 8.5. Frontend features at 0%: cms, finance, github, milestones, ops, profile, reports, tasks, search. 16 FE test files / 55 cases; none for Finance, Invoices/EVC, Tickets, CMS, HR, Dashboard rendering, Modal/DatePicker/Select/Table.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `qa_logs/coverage_analysis.txt`, `qa_logs/11_coverage_full.log`; `vitest.config.ts:26-30`; FE test inventory in 01_frontend.md.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** All releases.
- **Business impact:** Regressions in finance UI, portal, CMS and GitHub ship undetected.
- **Recommended fix:** Add `coverage.thresholds` at the current baseline and ratchet up; prioritise finance and portal frontends and github, dashboard and engineering-operations services.
- **Dependencies:** None.
- **Complexity:** L
- **Verification plan:** `npm run coverage` fails below threshold.
- **Merge note:** QA-001 and FE-022, both P2.

### SW-069

**CI runs zero real-database tests; 48 of 51 backend service test files mock Prisma**

| Field | Value |
|---|---|
| ID | SW-069 |
| Module | CI / backend tests |
| Severity | P2 |
| Confidence | CONFIRMED |
| Sources | QA-002 |

- **Description:** The 3 PostgreSQL integration files (invoice numbering and concurrent overpayment, single-use invitations and reset, finance ledger and role matrix) gate on `FINANCE_TEST_DATABASE_URL`, which `ci.yml` never sets, so all 13 real-DB tests are skipped in CI (~588 passed / 13 skipped there). Mocked tests cannot detect wrong where clauses, missing constraints, transaction bugs or trigger errors.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `.github/workflows/ci.yml:43-47`; `payment.integration.test.ts:8-20`; `user-onboarding.integration.test.ts:22-34`; locally 13/13 pass (`qa_logs/10_integration_qatest.log`).
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Every release.
- **Business impact:** Concurrency and overpayment protections have no regression gate.
- **Recommended fix:** Set `FINANCE_TEST_DATABASE_URL` to a dedicated `somwave_ci_test` DB in ci.yml, create and migrate it, align `DATABASE_URL` for the test step.
- **Dependencies:** SW-070 (QA-003) guard fix.
- **Complexity:** S
- **Verification plan:** CI log shows the 13 tests executed.

### SW-070

**`finance.integration.test.ts` is not re-runnable and writes to any localhost DB, including the dev `somwave` DB**

| Field | Value |
|---|---|
| ID | SW-070 |
| Module | Finance tests |
| Severity | P2 |
| Confidence | CONFIRMED |
| Sources | QA-003 |

- **Description:** Second `npm run test` on the same DB fails: "Accounting period is closed" (`finance.service.ts:252` from `finance.integration.test.ts:105`). The test uses fixed 2020-02 dates and `closePeriod(2020, 2, ...)`, never cleans up, and posted journals are immutable. Its guard accepts any localhost DB name, unlike the other integration files.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `qa_logs/08_test_run2.log:203-216`; `finance.integration.test.ts:30-32,112,147,239,249`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Developers and CI.
- **Business impact:** Flaky suite; permanent writes to developer databases.
- **Recommended fix:** Use the `_test`-suffix guard; unique random year/month or a fresh schema per run, or truncate in `afterAll`.
- **Dependencies:** None.
- **Complexity:** S
- **Verification plan:** Two consecutive runs pass.

### SW-071

**Root Playwright suite: 8 of 33 fail on an empty local DB, no webServer, not in CI**

| Field | Value |
|---|---|
| ID | SW-071 |
| Module | E2E |
| Severity | P2 |
| Confidence | CONFIRMED |
| Sources | QA-004 |

- **Description:** 23 passed, 8 failed, 2 skipped. Four tests fail on desktop and mobile: `internal.spec.ts:4` (expects heading on empty DB, see QA-005), `projects.spec.ts:3` (needs an existing project), `projects.spec.ts:51` and `:288` (strict-mode violation: two "New project" buttons). No `webServer`, no fixtures/seed, no CI job; the seeded SUPER_ADMIN cannot drive `auth.setup.ts` (forced 2FA enrolment); 29 `page.route` mocks across 5 specs, so most passing specs test UI only.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `qa_logs/12_e2e.log`; `qa_logs/pw-results/*/error-context.md`; `frontend/src/features/projects/ProjectsPage.tsx:114,339`; `playwright.config.ts`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Release quality.
- **Business impact:** No working browser regression gate.
- **Recommended fix:** Add a `webServer` and a deterministic e2e seed with a non-2FA test role; scope the locator; add a CI e2e job against a service DB.
- **Dependencies:** SW-059 (INF-013).
- **Complexity:** M
- **Verification plan:** Full suite green on a fresh DB in CI.

### SW-072

**Web unit test and web e2e are not run by CI**

| Field | Value |
|---|---|
| ID | SW-072 |
| Module | Web / CI |
| Severity | P2 |
| Confidence | CONFIRMED |
| Sources | QA-006 |

- **Description:** Root `vitest.config.ts` include covers backend, shared and frontend only, so `web/src/lib/externalUrl.test.ts` never runs in `npm run coverage` (1/1 passes with its own config). `web/e2e/homepage.spec.ts` (9 tests incl. contact form, project-request email verification, uploads) passed 9/9 locally but CI never invokes it.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `vitest.config.ts:12-16`; `qa_logs/13_web_vitest_config.log`, `15_web_e2e.log`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Public website.
- **Business impact:** Website regressions not gated.
- **Recommended fix:** Add `web/src/**/*.test.ts` to the root include and a web e2e CI step.
- **Dependencies:** None.
- **Complexity:** S
- **Verification plan:** CI log shows web tests.

### SW-073

**Cross-tenant 404 proofs are mock-only; one is tautological; no HTTP-level proof**

| Field | Value |
|---|---|
| ID | SW-073 |
| Module | Portal / finance tests |
| Severity | P2 |
| Confidence | CONFIRMED |
| Sources | QA-008 |

- **Description:** "Another client gets 404" tests exist only as mocked-Prisma unit tests. `portal.service.test.ts:70-76` mocks `findFirst` to return null and asserts NOT_FOUND without checking the where clause, so it would pass with the `clientId` filter removed. `invoice.service.test.ts:96-106` does assert the scoped where. No test drives two real clients through `/api/v1/portal/*`; engineer A vs B scoping is mock-only.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `portal.service.test.ts:70`; `invoice.service.test.ts:96,237,282`; `ticket.service.test.ts:51,116`; `document.service.test.ts:53`; `payment.service.test.ts:211`; `project-inquiry-attachment.service.test.ts:166`; `engineering-worklog.service.test.ts:54`; `project.service.test.ts:344`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Clients.
- **Business impact:** A scoping regression would not be caught.
- **Recommended fix:** Assert the scoped where in every mocked test; add real-DB HTTP tests with two clients for portal projects, milestones, documents and invoices.
- **Dependencies:** SW-013 (API-001); SW-069 (QA-002).
- **Complexity:** M
- **Verification plan:** Removing a clientId filter fails a test.

### SW-074

**Critical integrations effectively untested (GitHub, dashboard, SLA, engineering operations)**

| Field | Value |
|---|---|
| ID | SW-074 |
| Module | GitHub / dashboard / ops tests |
| Severity | P2 |
| Confidence | CONFIRMED |
| Sources | QA-009 |

- **Description:** `github.service.ts` (727 lines) at 1.5% with only 2 signature tests; event handling, repo linking and the API client never execute. `sla-escalation.service.ts` 0%; `dashboard.service.ts` 8.5%; `engineering-operations.service.ts` 5.6%.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `qa_logs/coverage_analysis.txt`; `github.service.test.ts:10,17`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Engineering, management.
- **Business impact:** Bugs such as ENG-003/ENG-004/RPT-001 went undetected.
- **Recommended fix:** Unit tests with recorded GitHub payloads; a real-DB dashboard aggregate test.
- **Dependencies:** None.
- **Complexity:** M
- **Verification plan:** Coverage of these services rises above threshold.

### SW-075

**Forgot-password response timing reveals existing accounts**

| Field | Value |
|---|---|
| ID | SW-075 |
| Module | Password reset |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | SEC-013 |

- **Description:** `requestPasswordReset` returns at once for unknown emails but awaits a DB transaction and the Resend API for known ones before responding.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/services/auth.service.ts:372-410`; `auth.controller.ts:102-114`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Account enumeration by timing.
- **Recommended fix:** Enqueue the mail and respond immediately.
- **Dependencies:** None stated.
- **Complexity:** S
- **Verification plan:** Response time independent of account existence.

### SW-076

**Rate limiters use the in-memory store: counters reset on restart, are per replica, and anyone can lock an account out**

| Field | Value |
|---|---|
| ID | SW-076 |
| Module | Rate limiting |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | API-010, SEC-014, INF-010 |

- **Description:** None of the six `rateLimit()` instances sets a `store`. A restart or redeploy resets login and account counters; replicas multiply budgets; the per-account limiter (5 per 15 min keyed on the body email) lets any third party block a known user's login indefinitely. Compounds the shared-bucket hairpin finding.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/middleware/rateLimit.ts:23-51`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Lockout DoS; limits ineffective across restarts.
- **Recommended fix:** `rate-limit-redis` with the existing ioredis client; count only failed attempts for the account key or use a progressive delay.
- **Dependencies:** None stated.
- **Complexity:** S
- **Verification plan:** Counters persist across restart; two replicas share limits.
- **Merge note:** Three agents, all P3.

### SW-077

**Logout does not invalidate the current access token; no "log out all devices"**

| Field | Value |
|---|---|
| ID | SW-077 |
| Module | Auth |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | SEC-015 |

- **Description:** `logout` revokes only the refresh row; the access JWT stays valid up to 15 min. Accepted risk under the 15 m design.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/services/auth.service.ts:348-354`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** Optional Redis `jti` denylist or a per-user `sessionsRevokedAt` bump for "log out everywhere".
- **Dependencies:** None stated.
- **Complexity:** S
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

### SW-078

**No authenticated "change password" and no admin 2FA reset/recovery path**

| Field | Value |
|---|---|
| ID | SW-078 |
| Module | Auth |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | SEC-019 |

- **Description:** Passwords change only through the email OTP reset. An admin who loses both TOTP device and backup codes can be recovered only by editing the DB; disable is forbidden for required roles.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/routes/auth.routes.ts:33-138`; `auth.service.ts:263-265`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** `POST /auth/change-password` (current password + 2FA, revoke other sessions, notify); audited SUPER_ADMIN "reset 2FA" action.
- **Dependencies:** None stated.
- **Complexity:** M
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

### SW-079

**UserInvitation model departs from data-model rules**

| Field | Value |
|---|---|
| ID | SW-079 |
| Module | Migration 20261017090000 |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | SEC-020 |

- **Description:** `status` is free TEXT, `invited_by_id` has no FK or index, `role_ids TEXT[]` has no referential integrity (a deleted role gives 409 on activation), no `deletedAt`.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/prisma/schema.prisma:2308-2321`; migration.sql.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** Enum `InvitationStatus`, FK to users, `@@index([status, expiresAt])`.
- **Dependencies:** None stated.
- **Complexity:** S
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

### SW-080

**Large `page` values likely become 500s; query validation is hand-rolled**

| Field | Value |
|---|---|
| ID | SW-080 |
| Module | Users, projects, tasks, milestones |
| Severity | P3 |
| Confidence | SUSPECTED |
| Sources | API-008 |

- **Description:** `parsePositiveInt` has no upper bound; `?page=99999999999` makes `skip` exceed Prisma's 32-bit Int, likely failing with 500 instead of 400. Finance and reports cap page.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/controllers/user.controller.ts:9-12` and copies in task, milestone, project, public controllers.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** Shared `paginationQuerySchema` in packages/shared applied with a `validateQuery()` middleware.
- **Dependencies:** None stated.
- **Complexity:** S
- **Verification plan:** `GET /users?page=99999999999` -> 400.

### SW-081

**Idempotency-Key missing on message-sending endpoints; public enforcement only checks presence; public form keys regenerate per submit**

| Field | Value |
|---|---|
| ID | SW-081 |
| Module | Users, engineering accounts, tickets, public forms |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | API-009 |

- **Description:** §10 requires an Idempotency-Key for anything that charges money or sends a message. Enforced only on `POST /payments`, `/payments/evc-plus`, `/invoices/:id/send`. Missing on `POST /users`, `/users/invitations/:id/resend`, `/engineering/accounts` and resend, project invitations and resend, `/support-tickets` and replies, `/public/project-inquiries/:id/resend`. Public inquiries and careers check only that the header exists; `KEY_PATTERN` not reused. Payments are safe (DB unique key, scoped replay).
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `controllers/payment.controller.ts:31,52`; `invoice.controller.ts:61`; `public.controller.ts:172-175,246-250`; `lib/idempotency.ts:9`; `schema.prisma:427`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** Apply `readIdempotencyKey` plus the replay cache to the listed endpoints, or record an ADR exception.
- **Dependencies:** None stated.
- **Complexity:** S-M
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

### SW-082

**Webhooks bypass access logging and rate limiting**

| Field | Value |
|---|---|
| ID | SW-082 |
| Module | app.ts |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | API-012 |

- **Description:** Payment and GitHub webhooks are mounted before `pinoHttp` and `apiRateLimiter`, so payment callbacks leave no access-log line and bad-signature bursts are unthrottled (each is cheap, HMAC runs first).
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/app.ts:65-74,84,89`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** Mount `pinoHttp` before the webhook routers; add a dedicated webhook limiter.
- **Dependencies:** None stated.
- **Complexity:** S
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

### SW-083

**`validate()` covers only the request body; query and params have no shared schema**

| Field | Value |
|---|---|
| ID | SW-083 |
| Module | middleware/validate.ts |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | API-013 |

- **Description:** Every list filter and `:id` is parsed by hand three different ways, conflicting with §11.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/middleware/validate.ts:9`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** Add `validate({ body, query, params })` and shared query schemas.
- **Dependencies:** None stated.
- **Complexity:** M
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

### SW-084

**Project documentation routes and screens ignore the project-documentation.* permissions**

| Field | Value |
|---|---|
| ID | SW-084 |
| Module | Project documentation / RBAC |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | API-014, FE-019 |

- **Description:** The 27 routes under `/projects/:projectId/documentation` have no `rbac()`; the service checks membership only. The UI gates documentation on `engineering.read`. `PROJECT_DOCUMENTATION_READ/MANAGE` exist and are seeded but never checked, so toggling them in Roles has no effect.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/routes/project-documentation.routes.ts`; `services/project-documentation.service.ts:25-52`; `packages/shared/src/constants/permissions.ts:73-74`; `frontend/src/app/App.tsx:284-291`; `nav.ts:33-36`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** Add `rbac(PROJECT_DOCUMENTATION_READ/MANAGE)` and use the same keys in the UI, or remove the keys.
- **Dependencies:** None stated.
- **Complexity:** S
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.
- **Merge note:** Same gap from backend and frontend sides; both P3.

### SW-085

**Finance and Reports skip the controller layer**

| Field | Value |
|---|---|
| ID | SW-085 |
| Module | finance.routes.ts, reports.routes.ts |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | API-015 |

- **Description:** Inline route handlers parse queries and call services, including CSV building; Prisma is still confined to services.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/routes/finance.routes.ts:308-337`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** Move handlers to `finance.controller.ts` and `reports.controller.ts`.
- **Dependencies:** None stated.
- **Complexity:** S
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

### SW-086

**The `?sort=` contract is not implemented; project portfolio sorts and paginates in memory**

| Field | Value |
|---|---|
| ID | SW-086 |
| Module | Projects / API contract |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | API-016 |

- **Description:** No endpoint parses `?sort=-createdAt,name`. `GET /projects/portfolio` loads every matching project, sorts in JS by an unvalidated `sortBy`, then slices.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/services/project.service.ts:182-427`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** Shared sort parser with per-endpoint whitelist mapped to Prisma `orderBy`.
- **Dependencies:** None stated.
- **Complexity:** M
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

### SW-087

**X-Request-ID header and the access-log request id differ**

| Field | Value |
|---|---|
| ID | SW-087 |
| Module | Logging |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | API-017 |

- **Description:** `pinoHttp` has no `genReqId` and runs before `withRequestContext`, so pino's incrementing id and the X-Request-ID UUID differ; finance logs use pino's id.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/app.ts:84-85`; `lib/requestContext.ts:18-20`; `finance.routes.ts:29`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** Generate the UUID first and pass it as `genReqId`.
- **Dependencies:** None stated.
- **Complexity:** S
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

### SW-088

**Task review route grants engineering.read as an alternative to engineering.tasks.review**

| Field | Value |
|---|---|
| ID | SW-088 |
| Module | Engineering |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | API-018 |

- **Description:** `rbacAny([ENGINEERING_TASK_REVIEW, ENGINEERING_READ])`; the service's `requireReviewer` narrows it, so no exploit found; docs say `V` only.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/routes/engineering.routes.ts:241-245`; `engineering.service.ts:107-112`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** Use `rbac(ENGINEERING_TASK_REVIEW)` or update docs.
- **Dependencies:** None stated.
- **Complexity:** S
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

### SW-089

**API reference covers less than half the surface**

| Field | Value |
|---|---|
| ID | SW-089 |
| Module | Docs |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | API-019 |

- **Description:** docs/API_REFERENCE.md has 163 rows against 350 endpoints; finance, invoices/payments, tickets, CMS, public, portal, reports, HR, leads/applications/clients, dashboard and search are undocumented; four documentation routes missing even in covered sections.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `docs/API_REFERENCE.md`; endpoint inventory in API_AUDIT.md.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** Generate the reference from the route table or OpenAPI (`zod-to-openapi`).
- **Dependencies:** None stated.
- **Complexity:** M
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

### SW-090

**29 UI-unreachable endpoints and incomplete CRUD**

| Field | Value |
|---|---|
| ID | SW-090 |
| Module | Clients, Employees, Leads, Portal, worklog, GitHub, documentation |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | API-020 |

- **Description:** No caller for `PATCH /clients/:id`, `PATCH /employees/:id` (no edit UI), inquiry attachment list/download (admin and client), time-entry correction and revisions, GitHub task links, 5 documentation-plan routes, documentation attachments/delete, detail reads. No update/delete for draft invoices, clients or leads.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** Inventory rows with Caller = none (API_AUDIT.md).
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** Decide per route: build the UI or remove the route.
- **Dependencies:** None stated.
- **Complexity:** M
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

### SW-091

**Archived projects' tasks/milestones appear for admins; legacy /tasks exposes other engineers' unapproved proposals**

| Field | Value |
|---|---|
| ID | SW-091 |
| Module | Tasks visibility / PM |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | DB-012, PRJ-004 |

- **Description:** `deleteProject` soft-deletes only the project; `projectScope` returns `{}` for SUPER_ADMIN/ADMIN with no `project.deletedAt` filter, so admin task/milestone lists and dashboard counts include archived work (reports are correct). `listTasks`/`getTask` filter by `projectScope` only, so engineers with tasks.read see DRAFT/SUBMITTED/REJECTED proposals that `visibleTask` hides.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/services/project.service.ts:96-101,701,898-904`; `task.service.ts:81-86,103-105`; `milestone.service.ts:103-108`; `dashboard.service.ts:210`; `engineering.service.ts:1772-1782`; contrast `reports.service.ts:355-357`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** Include `deletedAt: null` in `projectScope`; apply the approval visibility rule to legacy task endpoints.
- **Dependencies:** None stated.
- **Complexity:** S
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.
- **Merge note:** Overlapping; both P3.

### SW-092

**Dashboard "upcoming leave" includes soft-deleted leave requests and deleted employees**

| Field | Value |
|---|---|
| ID | SW-092 |
| Module | Dashboard / HR |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | DB-013 |

- **Description:** The where clause has only status and startDate.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/services/dashboard.service.ts:790-794`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** Add `deletedAt: null` and `employee: { deletedAt: null }`.
- **Dependencies:** None stated.
- **Complexity:** S
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

### SW-093

**Schema/migration drift on engineer_progress_reports**

| Field | Value |
|---|---|
| ID | SW-093 |
| Module | Engineering schema |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | DB-014 |

- **Description:** `prisma migrate diff` is not empty: `ALTER TABLE "engineer_progress_reports" ALTER COLUMN "updated_at" DROP DEFAULT;` and an index rename (Postgres truncated the over-long name to 63 chars).
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/prisma/migrations/20261013041000_engineer_progress_reports/migration.sql:22,26`; `schema.prisma:1755,1761`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** Commit a migration with exactly the two diff statements.
- **Dependencies:** None stated.
- **Complexity:** S
- **Verification plan:** `migrate diff` empty.

### SW-094

**Migration directories with impossible hours (24-27)**

| Field | Value |
|---|---|
| ID | SW-094 |
| Module | Migrations |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | DB-015 |

- **Description:** Four `20260828{24..27}0000_*` directories; Prisma orders lexicographically, so they applied in the intended order. No functional impact. Do not rename (breaks `_prisma_migrations` history).
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/prisma/migrations/`; `_prisma_migrations.started_at`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** Convention note: generate migrations with `prisma migrate dev --create-only`.
- **Dependencies:** None stated.
- **Complexity:** S
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

### SW-095

**Unindexed foreign keys, including finance_journal_lines.journal_id; audit_logs has no created_at index**

| Field | Value |
|---|---|
| ID | SW-095 |
| Module | Finance, all schema |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | DB-016 |

- **Description:** 37 single-column FKs have no leading index. The deferred balance trigger sums `finance_journal_lines WHERE journal_id = ...` on every insert, so posting becomes O(total lines). Others: `invoices.project_id`, `support_tickets.project_id`, `payments.recorded_by_id`, finance transaction account ids, timers, github repositories.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** pg_catalog query; `migrations/20261016120000_finance_ledger_foundation/migration.sql:216-246`; `schema.prisma:807-821`; `dashboard.service.ts:825-826`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** One migration adding the indexes.
- **Dependencies:** None stated.
- **Complexity:** S
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

### SW-096

**Invoice OVERDUE status is written on every GET (write-on-read); PARTIAL invoices never become OVERDUE**

| Field | Value |
|---|---|
| ID | SW-096 |
| Module | Finance / Invoices |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | DB-018, FIN-010 |

- **Description:** `markOverdue()` runs an `UPDATE ... WHERE status="SENT" AND due_date < now()` on every list and detail read (including portal) and on the dashboard. Time-based logic in the request path (§11 requires a job); write load and lock contention.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/services/invoice.service.ts:93-111`; `dashboard.service.ts:398-401`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** Nightly scheduled job with a deterministic id covering SENT and PARTIAL.
- **Dependencies:** None stated.
- **Complexity:** S
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.
- **Merge note:** Same defect; both P3.

### SW-097

**Missing DB-level guards on AR tables and finance actor columns**

| Field | Value |
|---|---|
| ID | SW-097 |
| Module | Finance schema |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | DB-019 |

- **Description:** No CHECKs on invoices/invoice_items/payments (`total >= 0`, `paid_amount BETWEEN 0 AND total`, `amount > 0`, `quantity > 0`); finance actor and project/client columns have no FK (a journal with `created_by_id="u"` was accepted); audit_logs not append-only at DB level.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `grep CHECK migrations/*`; FK scan; `schema.prisma:641-720,771-858,913-928`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** Additive migration with CHECKs, `ON DELETE RESTRICT` FKs and an audit_logs immutability trigger.
- **Dependencies:** None stated.
- **Complexity:** S
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

### SW-098

**Convention deviations (informational)**

| Field | Value |
|---|---|
| ID | SW-098 |
| Module | Schema conventions |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | DB-020 |

- **Description:** EngineerProfile uses userId as PK; several link tables use composite PKs; some models lack createdAt/updatedAt; ledger money is Decimal(20,2) vs mandated (12,2); singular table names for uncountables; pgvector required by §4 but unused. No Float columns; all enums conform.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `schema.prisma:342,668,784-821,1338,1564-1626,1936-2010`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** Record accepted deviations in an ADR.
- **Dependencies:** None stated.
- **Complexity:** S
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

### SW-099

**A soft-deleted user's email can never be invited again**

| Field | Value |
|---|---|
| ID | SW-099 |
| Module | Core / users |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | DB-021 |

- **Description:** Invite and accept reject any existing user with that email without a `deletedAt` filter; `users.email` is globally unique.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/services/user-invitation.service.ts:60,155-156`; `schema.prisma:20`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** Partial unique index `WHERE deleted_at IS NULL` (with lower()) plus restore-on-invite.
- **Dependencies:** None stated.
- **Complexity:** S
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

### SW-100

**Portfolio list health differs from project detail health**

| Field | Value |
|---|---|
| ID | SW-100 |
| Module | Projects |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | PRJ-005 |

- **Description:** Portfolio omits blockedDependencies/constrainedEngineers and counts cancelled as remaining; workspace includes both and subtracts cancelled.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/services/project.service.ts:317-326,845-855`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** Share one health computation.
- **Dependencies:** None stated.
- **Complexity:** M
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

### SW-101

**Portal dashboard counts milestones the client cannot see**

| Field | Value |
|---|---|
| ID | SW-101 |
| Module | Portal dashboard |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | PRJ-006 |

- **Description:** Counts milestones not COMPLETED without `clientVisible: true`, whereas portal milestone pages filter on it.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/services/dashboard.service.ts:548-554`; `project.service.ts:717`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** Add `clientVisible: true`.
- **Dependencies:** None stated.
- **Complexity:** S
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

### SW-102

**Project create/update: invalid clientId -> 500; deleted client accepted; PM change not audited or notified; no date ordering**

| Field | Value |
|---|---|
| ID | SW-102 |
| Module | Projects |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | PRJ-007 |

- **Description:** `clientId` never validated (Prisma P2003 -> 500 via the error handler); soft-deleted clients accepted; audit omits managerId/clientId; new PM not notified; no startDate <= dueDate check.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/services/project.service.ts:536,588,592-608`; `middleware/errorHandler.ts:29-38`; `packages/shared/src/schemas/project.ts:55-65`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** Validate client exists and not deleted; audit and notify; refine dates.
- **Dependencies:** None stated.
- **Complexity:** S
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

### SW-103

**Project creation wizard is non-atomic**

| Field | Value |
|---|---|
| ID | SW-103 |
| Module | Projects |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | PRJ-008 |

- **Description:** Project, phases, milestones, tasks and invitations are separate requests; failures leave a partially planned project (reported to the user as a list).
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `frontend/src/features/projects/ProjectCreationWizard.tsx:116-171`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** Server-side composite endpoint with idempotency.
- **Dependencies:** None stated.
- **Complexity:** M
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

### SW-104

**Cache invalidation gaps: dashboard never invalidated; accept-invitation does not refresh /projects**

| Field | Value |
|---|---|
| ID | SW-104 |
| Module | Frontend data layer |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | PRJ-009 |

- **Description:** Dashboard key is not invalidated by any mutation (staleTime 30 s); accept/decline invalidates engineering keys only.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `frontend/src/features/dashboard/hooks.ts:9`; `lib/queryClient.ts:8`; `EngineeringWorkspacePage.tsx:45-48`; `projects/hooks.ts:46-79`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** Invalidate `["dashboard"]` and `["projects"]` in assignment/accept/create flows.
- **Dependencies:** None stated.
- **Complexity:** S
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

### SW-105

**Minor project UI/data issues: Gantt uses createdAt as start; workspace caps tasks at 100 and milestones at 50; portfolio filters in memory**

| Field | Value |
|---|---|
| ID | SW-105 |
| Module | Projects |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | PRJ-010 |

- **Description:** Gantt bars start at task `createdAt` (no startDate); workspace caps without pagination; portfolio loads all projects into memory. (The duplicate-employee part is merged into the employee-record finding.)
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `frontend/src/features/projects/components/ProjectTimeline.tsx:52-57`; `backend/src/services/project.service.ts:182-427,700-733`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** Add task start dates; paginate workspace lists; push filtering into SQL.
- **Dependencies:** None stated.
- **Complexity:** M
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

### SW-106

**Invitation email failure returns 503 but the invitation is saved; retrying returns 409**

| Field | Value |
|---|---|
| ID | SW-106 |
| Module | Assignment invitations |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | ENG-009 |

- **Description:** The 503 is returned after the commit; a re-invite hits the pending check -> 409; user must use resend.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/services/engineering.service.ts:498-506,545-547,561-596`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** Return 202 with `emailQueued:false`, or re-queue the email for an existing pending invitation.
- **Dependencies:** None stated.
- **Complexity:** S
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

### SW-107

**Task dependency cycle check is not atomic**

| Field | Value |
|---|---|
| ID | SW-107 |
| Module | Dependencies |
| Severity | P3 |
| Confidence | SUSPECTED |
| Sources | ENG-010 |

- **Description:** `addTaskDependency` reads edges and inserts outside a transaction; concurrent A->B and B->A can both pass. Edges capped at `take: 10000`.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/services/engineering.service.ts:1950-1971`; contrast `milestone.service.ts:390+`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** Serializable transaction or per-project advisory lock.
- **Dependencies:** None stated.
- **Complexity:** S
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

### SW-108

**Single-active-timer constraint exists only in raw SQL (not representable in schema.prisma)**

| Field | Value |
|---|---|
| ID | SW-108 |
| Module | Time tracking |
| Severity | P3 |
| Confidence | SUSPECTED |
| Sources | ENG-011 |

- **Description:** The partial unique index enforces one active timer and the service maps P2002 -> 409 (race-safe), but a future `prisma migrate dev` diff may propose dropping it.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `migrations/20261013040000_engineering_time_tracking/migration.sql:12`; `engineering-worklog.service.ts:88-91`; `schema.prisma:1689-1703`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** Document and guard with a CI migration-drift check.
- **Dependencies:** None stated.
- **Complexity:** S
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

### SW-109

**Manual task hours: future dates and unlimited daily totals accepted; two time systems unreconciled**

| Field | Value |
|---|---|
| ID | SW-109 |
| Module | Time tracking |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | ENG-012 |

- **Description:** Only date format validated; <= 1440 minutes per entry but any number of entries per day and future dates; HR Timesheet vs TaskTimeEntry not reconciled.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/services/engineering.service.ts:2116-2121`; `packages/shared/src/schemas/engineering.ts:175`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** Reject future dates; cap the per-day sum.
- **Dependencies:** None stated.
- **Complexity:** S
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

### SW-110

**Bug lifecycle gaps: reopen keeps original SLA, severity immutable, no optimistic lock, lists unpaginated**

| Field | Value |
|---|---|
| ID | SW-110 |
| Module | Bugs |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | ENG-013 |

- **Description:** REOPENED keeps `resolutionDueAt` (immediately breached, dedupe key unchanged so no new alert); no re-triage; update by id after a read (TOCTOU); `listBugs`/`listMaintenance` unpaginated.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/services/engineering-operations.service.ts:325-396`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** Reset SLA on reopen; status-guarded updateMany; paginate.
- **Dependencies:** None stated.
- **Complexity:** S
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

### SW-111

**Release gates: PM can mark APPROVED -> DEPLOYED without a deployment record; admin may approve own release**

| Field | Value |
|---|---|
| ID | SW-111 |
| Module | Releases |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | ENG-014 |

- **Description:** `transitionRelease` allows APPROVED->DEPLOYED with manager access only, bypassing `recordDeployment`'s admin + approval check; `approveRelease` does not check `ownerId !== actor.id`.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/services/engineering-operations.service.ts:755-862`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** DEPLOYED only via recordDeployment; separation of duties.
- **Dependencies:** None stated.
- **Complexity:** S
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

### SW-112

**Activity feed omits member/handover/phase/release/deployment audits and shows finance expense events to every project viewer**

| Field | Value |
|---|---|
| ID | SW-112 |
| Module | Project activity |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | ENG-015 |

- **Description:** Only 7 subject types included; route requires only projects.read, so engineers see ProjectExpense audit actions.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/services/project-activity.service.ts:16-39`; `routes/project.routes.ts:24`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** Add missing subject types; gate expense events on invoices.read.
- **Dependencies:** None stated.
- **Complexity:** S
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

### SW-113

**GitHub integration robustness gaps (stuck RECEIVED deliveries, reactivation of suspended installs, token per view, stale CI run)**

| Field | Value |
|---|---|
| ID | SW-113 |
| Module | GitHub |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | ENG-016 |

- **Description:** Verified good: HMAC over raw body with timingSafeEqual, signature before parse, delivery dedup, scoped PR->task links. Gaps: a delivery stuck in RECEIVED is a duplicate forever; non-delete installation events reactivate a SUSPENDED installation; a new installation token is minted on every activity view; a stale SUCCESS check run on an old commit satisfies QA. (Env validation gap merged into the configuration finding.) Live behaviour BLOCKED.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/services/github.service.ts:30-38,477-479,716-748`; `github.client.ts:165`; `engineering.service.ts:2010-2015`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** Lease/timeout for RECEIVED; explicit installation state machine; cache tokens; check head SHA.
- **Dependencies:** None stated.
- **Complexity:** S-M
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

### SW-114

**GitHub (and other) configuration not validated by the Zod env schema; .env.example incomplete**

| Field | Value |
|---|---|
| ID | SW-114 |
| Module | Config |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | INF-015 |

- **Description:** `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET` are read from `process.env` directly (also noted in API-012 and ENG-016), bypassing §13 boot validation. `worker.ts` imports the full env, so it needs JWT_SECRET and CORS_ORIGINS. `.env.example` lists only 6 variables.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/services/github.client.ts:32-33`; `controllers/github.controller.ts:165`; `lib/env.ts`; `backend/.env.example`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** Add the variables to the env schema (all-or-none for GitHub); complete `.env.example`.
- **Dependencies:** None stated.
- **Complexity:** S
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

### SW-115

**API runs TypeScript through tsx in production with no compiled build**

| Field | Value |
|---|---|
| ID | SW-115 |
| Module | API image |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | INF-008 |

- **Description:** `"build": "tsc --noEmit"`, `"start": "tsx src/server.ts"`; tsx and prisma CLI are runtime dependencies; npm is PID 1 (npm -> sh -> tsx -> node).
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/package.json`; `Dockerfile:25`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** Compile to `dist/` and run `node dist/server.js` with tini or `--init`.
- **Dependencies:** None stated.
- **Complexity:** M
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

### SW-116

**Graceful shutdown has no timeout and does not wait for in-flight jobs**

| Field | Value |
|---|---|
| ID | SW-116 |
| Module | API / worker |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | INF-009 |

- **Description:** `server.close(cb)` with no forced-exit timer; `stopBackgroundJobs()` only clears intervals; the worker exits without awaiting iterations. Lease + Resend idempotency mitigate interrupted sends.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/server.ts:20-26`; `background-jobs.ts:67`; `worker.ts:9-13`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** 10-25 s forced-exit timer; track and await in-flight jobs.
- **Dependencies:** None stated.
- **Complexity:** S
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

### SW-117

**index.html has no Cache-Control: a stale shell after deploy can white-screen**

| Field | Value |
|---|---|
| ID | SW-117 |
| Module | Frontend infra |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | INF-017 |

- **Description:** Production `index.html` has etag/last-modified only; a heuristically cached shell can reference deleted hashed assets (404).
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `frontend/nginx.conf:22,43-45`; production probe.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** `add_header Cache-Control "no-cache"` on `location /`.
- **Dependencies:** None stated.
- **Complexity:** S
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

### SW-118

**Healthcheck and documentation inconsistencies; one-level log redaction**

| Field | Value |
|---|---|
| ID | SW-118 |
| Module | Ops docs |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | INF-018 |

- **Description:** `web/Dockerfile:104` says the homepage is prerendered but astro.config says SSR (web healthcheck depends on SSR/API); `/health` is unthrottled; logger redacts only one level (`*.password`).
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `web/Dockerfile:104`; `backend/src/app.ts:87-89`; `lib/logger.ts:13-15`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** Fix docs; deep redaction paths.
- **Dependencies:** None stated.
- **Complexity:** S
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

### SW-119

**Project expenses/budgets are a parallel unapproved cost ledger gated by invoice permissions**

| Field | Value |
|---|---|
| ID | SW-119 |
| Module | Project finance |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | FIN-011 |

- **Description:** Read/write gated by invoices.read/update; ACTUAL expense rows created without approval and never reach the ledger, while project profitability reads only journals; utilization returned as Number; budgets have no currency.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/services/project-finance.service.ts:14-25,76,108-140`; `finance.service.ts:754-812`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** Route actual project costs through FinanceTransaction (EXPENSE/DIRECT_COST with projectId) or reconcile.
- **Dependencies:** None stated.
- **Complexity:** M
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

### SW-120

**Segregation of duties is two-person only; the approver may also post**

| Field | Value |
|---|---|
| ID | SW-120 |
| Module | Approvals |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | FIN-012 |

- **Description:** `reviewTransaction` blocks creator self-approval; `postTransaction` only checks reviewer != creator, so the approver can post. No amount thresholds.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/services/finance.service.ts:417-421,450-456`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** Optionally forbid actor == reviewer on post; configurable thresholds.
- **Dependencies:** None stated.
- **Complexity:** S
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

### SW-121

**Invoice number year uses UTC**

| Field | Value |
|---|---|
| ID | SW-121 |
| Module | Invoices |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | FIN-014 |

- **Description:** Invoices created 00:00-03:00 Mogadishu on 1 January get the previous year's sequence. Numbering is otherwise race-safe.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/services/invoice.service.ts:148,151`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** Use the Mogadishu business year.
- **Dependencies:** None stated.
- **Complexity:** S
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

### SW-122

**Reports export CSV only; no PDF/Excel, scheduled/emailed reports or full financial statements**

| Field | Value |
|---|---|
| ID | SW-122 |
| Module | Reports |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | RPT-002 |

- **Description:** Report CSV (max 5000 rows) and trial-balance CSV (with formula-injection guard); no exceljs/@react-pdf/puppeteer; no scheduler; no P&L, balance sheet or cash flow.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/routes/reports.routes.ts:149-168`; `finance.routes.ts:290-322`; `reports.service.ts:8-22`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** Plan as a reports sub-phase.
- **Dependencies:** None stated.
- **Complexity:** L
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

### SW-123

**Inconsistent date-range semantics (/reports inclusive `to`, /finance exclusive); AR "settled as-of" uses payments.updated_at**

| Field | Value |
|---|---|
| ID | SW-123 |
| Module | Reports |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | RPT-003 |

- **Description:** Reports add a day to an inclusive `to`; finance uses exclusive `to`; receivables aging uses `p.updated_at < to`, which moves on any later update.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/routes/reports.routes.ts:88-100`; `FinancePage.tsx:168-180`; `finance.routes.ts:82-93`; `reports.service.ts:937`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** One convention; a settlement timestamp.
- **Dependencies:** None stated.
- **Complexity:** S
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

### SW-124

**Old images are released only for Articles; other modules leave orphans**

| Field | Value |
|---|---|
| ID | SW-124 |
| Module | Storage / CMS |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | STO-004 |

- **Description:** `releaseArticleImageUrl` is called only from post.service.ts; portfolio, team, testimonial and site-content never release; portfolio uploads in parallel before save; site content uploads immediately. Contradicts GLOBAL_IMAGE_STORAGE.md.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/services/post.service.ts:273,284`; `PortfolioFormModal.tsx:87-90`; `SiteContentAdminPage.tsx:654`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** Release on update/delete everywhere plus a periodic sweep of unreferenced assets.
- **Dependencies:** None stated.
- **Complexity:** S-M
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

### SW-125

**Preview shows while the upload fails; Portfolio partial failures not reported per file**

| Field | Value |
|---|---|
| ID | SW-125 |
| Module | CMS image field |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | STO-005 |

- **Description:** The blob preview renders before upload; on failure the preview stays with an error line (nothing false persisted); portfolio reports only the first error.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `ArticleImageField.tsx:39-47`; `PostFormModal.tsx:136-145`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** Label preview "Not uploaded yet"; per-file status for galleries.
- **Dependencies:** None stated.
- **Complexity:** S
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

### SW-126

**Public forms have no honeypot or captcha; the idempotency key only blocks double-submits**

| Field | Value |
|---|---|
| ID | SW-126 |
| Module | Public forms |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | WEB-006 |

- **Description:** Contact form key is generated per submit, so a retry after a network error duplicates; no honeypot/captcha on contact, careers, subscribe or request-project; subscribe not idempotent and no double opt-in. IP limit 5/hour in memory.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `web/src/pages/nala-soo-xiriir.astro:71-120,106`; `public.controller.ts:172-174`; `rateLimit.ts:35`; `subscriber.service.ts:9`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** Create the key once per form load and reset on success; add a honeypot.
- **Dependencies:** None stated.
- **Complexity:** S
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

### SW-127

**Hardcoded app domain, hardcoded marketing sections, off-palette brand colour and no dark mode on web**

| Field | Value |
|---|---|
| ID | SW-127 |
| Module | Public website |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | WEB-008 |

- **Description:** `https://app.somwave.botandev.com` hardcoded in Header, Footer, request-project and contact pages; why/process/stats/examples/logos from `homeContent.ts`; `--color-brand: #104fdb` plus sky/cyan tokens not in the §8 palette; no `prefers-color-scheme`.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `web/src/components/Header.astro:17`; `Footer.astro:23`; `request-project.astro:88,123`; `nala-soo-xiriir.astro:28`; `web/src/styles/tokens.css:6`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** Use `PUBLIC_APP_URL`; tokenise; decide on dark mode.
- **Dependencies:** None stated.
- **Complexity:** S
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

### SW-128

**Page weight and image optimisation**

| Field | Value |
|---|---|
| ID | SW-128 |
| Module | Web performance |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | WEB-009 |

- **Description:** Homepage 86 KB HTML with 10 scripts; shared `/_astro/api.*.js` 105 KB (Zod + shared package); no astro:assets; `/works/*.png` 1.6-2.0 MB each; og:image 379 KB PNG. No mixed content; all 27 internal links 200.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** Production probes.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** WebP/AVIF via astro:assets; import only needed schemas client-side.
- **Dependencies:** None stated.
- **Complexity:** S-M
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

### SW-129

**Homepage publishing needs two separate administrators (undocumented in the UI)**

| Field | Value |
|---|---|
| ID | SW-129 |
| Module | Website content |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | CMS-002 |

- **Description:** "A different administrator must approve this draft"; approve/publish require ADMIN/SUPER_ADMIN; EDITORs can only submit. With one admin the homepage cannot be published.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/services/site-content.service.ts:75`; `cms.controller.ts:85-93`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** Document it or allow an audited SUPER_ADMIN override.
- **Dependencies:** None stated.
- **Complexity:** S
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

### SW-130

**Newsletter is collection-only (no double opt-in, unsubscribe, export or sending)**

| Field | Value |
|---|---|
| ID | SW-130 |
| Module | Newsletter |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | CMS-003 |

- **Description:** subscriber.service.ts exports only subscribe, list and delete.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/services/subscriber.service.ts`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** Add consent trail, unsubscribe token, export.
- **Dependencies:** None stated.
- **Complexity:** M
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

### SW-131

**Somali text in internal/admin screens and staff-facing system messages**

| Field | Value |
|---|---|
| ID | SW-131 |
| Module | Internal UI i18n |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | FE-005 |

- **Description:** See the full list in FRONTEND_UI_AUDIT.md (client detail status maps, Media empty state, Dashboard retry label, backend error messages shown to staff, hardcoded portal EVC message, shared Somali label maps).
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `frontend/src/features/ops/ClientDetailPage.tsx:55,87,122,157`; `MediaPage.tsx:93,104`; `DashboardPage.tsx:336,560`; `backend/src/services/client.service.ts:82`; `inquiry.service.ts:121`; `controllers/payment.controller.ts:29`; `public.controller.ts:174,249`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** English maps for internal screens; English backend messages on staff routes.
- **Dependencies:** None stated.
- **Complexity:** S
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

### SW-132

**Portal language is mixed English/Somali; no i18n framework**

| Field | Value |
|---|---|
| ID | SW-132 |
| Module | Portal |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | FE-006 |

- **Description:** CLIENT sees Somali in search and tickets, English in projects/milestones/invoices/documents; hardcoded Somali EVC pending message rendered in error red without `role="status"`; `index.html lang="en"` fixed; no `dir` handling.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `PortalProjectsPage.tsx:19-25,37`; `PortalMilestonesPage.tsx:15-19,26`; `InvoicesPage.tsx:43`; `PortalProjectPage.tsx:36`; `InvoiceDetailPage.tsx:241,324`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** Decide portal locale strategy, then one translation table.
- **Dependencies:** None stated.
- **Complexity:** M
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

### SW-133

**No catch-all route: unknown URLs render a blank screen**

| Field | Value |
|---|---|
| ID | SW-133 |
| Module | Router |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | FE-009 |

- **Description:** No `path="*"`; production `GET /does-not-exist` serves index.html and React Router renders nothing.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `frontend/src/app/App.tsx:211-591`; production probe.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** `<Route path="*" element={<EmptyState title="Page not found" .../>} />` inside AppShell.
- **Dependencies:** None stated.
- **Complexity:** S
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

### SW-134

**Palette and dark-mode deviations**

| Field | Value |
|---|---|
| ID | SW-134 |
| Module | Design system |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | FE-011 |

- **Description:** `text-red-700` default palette class; white text on light-blue brand in dark mode (~2:1); off-spec `--color-brand: #015efb` drives nav, focus and links (needs ADR); raw `bg-white/5|10`; theme applied only inside AppShell, so auth pages ignore a saved dark preference and flash light.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `NotificationsPage.tsx:94`; `ProjectDetailPage.tsx:86`; `frontend/src/styles/tokens.css:31-68`; `AppShell.tsx:114-117,162-163,187,228`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** Tokenise; early theme script; ADR on brand blue.
- **Dependencies:** None stated.
- **Complexity:** S
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

### SW-135

**RTL: ~70 physical-direction utilities; Arabic/RTL not wired**

| Field | Value |
|---|---|
| ID | SW-135 |
| Module | i18n / RTL |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | FE-012 |

- **Description:** Physical `ml-/pr-/pl-/text-left/right/left:` usages in Finance (24), Engineering Operations (19), Task Planning (13) and others; no `dir`/`lang` switching; Arabic font token unused.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** Files listed in FE-012 (FRONTEND_UI_AUDIT.md).
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** Replace with logical properties.
- **Dependencies:** None stated.
- **Complexity:** S-M
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

### SW-136

**Modal lacks focus management; user menu lacks arrow-key handling**

| Field | Value |
|---|---|
| ID | SW-136 |
| Module | UI kit a11y |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | FE-013 |

- **Description:** No initial focus, focus trap or restore; `aria-label={title}` instead of `aria-labelledby`; `role="menu"` without arrow keys.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `frontend/src/components/ui/Modal.tsx:13-41`; `AppShell.tsx:296-339`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** Focus first field, trap Tab, restore on close.
- **Dependencies:** None stated.
- **Complexity:** S
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

### SW-137

**Small touch targets: Button size="sm" is 36 px (149 usages)**

| Field | Value |
|---|---|
| ID | SW-137 |
| Module | UI kit |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | FE-014 |

- **Description:** CLAUDE.md §12 requires >= 44 px; shell/nav controls comply.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `frontend/src/components/ui/Button.tsx:15`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** `sm` -> `min-h-11` on coarse pointers or h-11.
- **Dependencies:** None stated.
- **Complexity:** S
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

### SW-138

**Many forms bypass React Hook Form + shared Zod resolver**

| Field | Value |
|---|---|
| ID | SW-138 |
| Module | Forms |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | FE-015 |

- **Description:** 23 files use zodResolver; ~25 create/edit forms in Finance, Engineering, Task Planning, Documentation and others use manual state without client schema validation. Server still validates (UX/consistency, not security).
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** Files listed in FE-015.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** Migrate create/edit forms to RHF + shared schema.
- **Dependencies:** None stated.
- **Complexity:** M
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

### SW-139

**Dates displayed with browser locale/timezone instead of the Africa/Mogadishu helper**

| Field | Value |
|---|---|
| ID | SW-139 |
| Module | Dates |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | FE-016 |

- **Description:** 48 `toLocale*String` calls in 17 files bypass `lib/date.ts`.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `ProjectActivityPanel.tsx:39`; `ProjectBudgetPanel.tsx:217,242`; `ProjectTeamPanel.tsx:449`; `DocumentationPage.tsx:642,777`; others.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** Route through `formatDate/formatLongDate` + a `formatDateTime`.
- **Dependencies:** None stated.
- **Complexity:** S
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

### SW-140

**Large frontend bundles; heavy editor chunk loaded on every project detail view**

| Field | Value |
|---|---|
| ID | SW-140 |
| Module | Performance |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | FE-017, QA-010 |

- **Description:** `ProjectDetailPage.tsx` statically imports `DocumentationPage` (Tiptap, 416-439 kB) and `TaskPlanningPage`, so every project view downloads the editor. No `manualChunks`. Main entry: 441.66 kB (127 kB gz) in the frontend agent's build, matching production `index-MnjbBilE.js` (441,678 B); the QA agent's `npm run build` produced a 699.38 kB `index-*.js` and a Vite >500 kB warning (the two local builds differ; production matches the smaller one). nginx gzip level default (production gzip ~17% larger than Vite's estimate).
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `frontend/src/features/projects/ProjectDetailPage.tsx:7,9`; `vite.config.ts`; `qa_logs/07_build.log`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** `lazy()` the documentation/planning tabs; `manualChunks`; `gzip_comp_level 6` or pre-compressed assets.
- **Dependencies:** None stated.
- **Complexity:** S
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.
- **Merge note:** FE-017 and QA-010, both P3. Bundle sizes differ between the two agents' builds; both figures are reported.

### SW-141

**Client reports unreachable from the UI**

| Field | Value |
|---|---|
| ID | SW-141 |
| Module | Reports / Portal |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | FE-018 |

- **Description:** Backend allows `portal.read`/`invoices.read` and defines `my-projects`/`my-invoices`, but `REPORT_ACCESS_PERMISSIONS` omits them, so CLIENT can never open /reports.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `backend/src/routes/reports.routes.ts:18-31,47-48`; `frontend/src/app/layout/nav.ts:87-97`; `App.tsx:195-207`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** Product decision: expose or remove.
- **Dependencies:** None stated.
- **Complexity:** S
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

### SW-142

**No optimistic updates with rollback anywhere**

| Field | Value |
|---|---|
| ID | SW-142 |
| Module | Data layer |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | FE-020 |

- **Description:** 172 `useMutation`, 0 `onMutate`; invalidate-on-success is correct but not to §11 spec.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** grep; `TaskKanban.tsx:78`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** Optimistic updates with rollback for high-traffic mutations (Kanban first).
- **Dependencies:** None stated.
- **Complexity:** M
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

### SW-143

**Engineering Workspace renders no page h1 in its empty state**

| Field | Value |
|---|---|
| ID | SW-143 |
| Module | Engineering frontend |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | QA-005 |

- **Description:** With no projects only an h2 "No assigned projects" renders; the h1 renders only in the data state. Also why `internal.spec.ts:4` fails.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `EngineeringWorkspacePage.tsx:481`; `pw-results/internal-engineering-modules-load-from-real-APIs-desktop/error-context.md:123-125`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** Render the header above the empty state.
- **Dependencies:** None stated.
- **Complexity:** S
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

### SW-144

**Test config silently overrides DATABASE_URL**

| Field | Value |
|---|---|
| ID | SW-144 |
| Module | Test infrastructure |
| Severity | P3 |
| Confidence | CONFIRMED |
| Sources | QA-011 |

- **Description:** `DATABASE_URL: process.env.FINANCE_TEST_DATABASE_URL ?? ".../somwave"`; a caller's DATABASE_URL is ignored and tests default to the shared dev DB.
- **Reproduction:** No separate steps in the source report; see Evidence for the code path, probe or local reproduction.
- **Expected:** See Description.
- **Actual:** See Description.
- **Evidence:** `vitest.config.ts:20-22`.
- **Root cause:** As described above (source report gives no separate root-cause statement).
- **Affected users:** Not stated in the source report.
- **Business impact:** Not stated separately in the source report; see Description.
- **Recommended fix:** Honour `process.env.DATABASE_URL` first; default to a `_test` DB.
- **Dependencies:** None stated.
- **Complexity:** S
- **Verification plan:** Add a regression test for the described behaviour and re-run the relevant suite.

## Cross-reference: original ID to SW ID

| Original ID | SW ID |
|---|---|
| API-001 | [SW-013](#sw-013) |
| API-002 | [SW-003](#sw-003) |
| API-003 | [SW-024](#sw-024) |
| API-004 | [SW-025](#sw-025) |
| API-005 | [SW-026](#sw-026) |
| API-006 | [SW-015](#sw-015) |
| API-007 | [SW-027](#sw-027) |
| API-008 | [SW-080](#sw-080) |
| API-009 | [SW-081](#sw-081) |
| API-010 | [SW-076](#sw-076) |
| API-011 | [SW-010](#sw-010) |
| API-012 | [SW-082](#sw-082) |
| API-013 | [SW-083](#sw-083) |
| API-014 | [SW-084](#sw-084) |
| API-015 | [SW-085](#sw-085) |
| API-016 | [SW-086](#sw-086) |
| API-017 | [SW-087](#sw-087) |
| API-018 | [SW-088](#sw-088) |
| API-019 | [SW-089](#sw-089) |
| API-020 | [SW-090](#sw-090) |
| CMS-001 | [SW-027](#sw-027) |
| CMS-002 | [SW-129](#sw-129) |
| CMS-003 | [SW-130](#sw-130) |
| CMS-004 | [SW-018](#sw-018) |
| DB-001 | [SW-011](#sw-011) |
| DB-002 | [SW-037](#sw-037) |
| DB-003 | [SW-038](#sw-038) |
| DB-004 | [SW-003](#sw-003) |
| DB-005 | [SW-039](#sw-039) |
| DB-006 | [SW-010](#sw-010) |
| DB-007 | [SW-040](#sw-040) |
| DB-008 | [SW-032](#sw-032) |
| DB-009 | [SW-041](#sw-041) |
| DB-010 | [SW-042](#sw-042) |
| DB-011 | [SW-043](#sw-043) |
| DB-012 | [SW-091](#sw-091) |
| DB-013 | [SW-092](#sw-092) |
| DB-014 | [SW-093](#sw-093) |
| DB-015 | [SW-094](#sw-094) |
| DB-016 | [SW-095](#sw-095) |
| DB-017 | [SW-016](#sw-016) |
| DB-018 | [SW-096](#sw-096) |
| DB-019 | [SW-097](#sw-097) |
| DB-020 | [SW-098](#sw-098) |
| DB-021 | [SW-099](#sw-099) |
| ENG-001 | [SW-012](#sw-012) |
| ENG-002 | [SW-048](#sw-048) |
| ENG-003 | [SW-049](#sw-049) |
| ENG-004 | [SW-050](#sw-050) |
| ENG-005 | [SW-051](#sw-051) |
| ENG-006 | [SW-044](#sw-044) |
| ENG-007 | [SW-028](#sw-028) |
| ENG-008 | [SW-052](#sw-052) |
| ENG-009 | [SW-106](#sw-106) |
| ENG-010 | [SW-107](#sw-107) |
| ENG-011 | [SW-108](#sw-108) |
| ENG-012 | [SW-109](#sw-109) |
| ENG-013 | [SW-110](#sw-110) |
| ENG-014 | [SW-111](#sw-111) |
| ENG-015 | [SW-112](#sw-112) |
| ENG-016 | [SW-113](#sw-113) |
| ENG-017 | [SW-053](#sw-053) |
| FE-001 | [SW-009](#sw-009) |
| FE-002 | [SW-065](#sw-065) |
| FE-003 | [SW-027](#sw-027) |
| FE-004 | [SW-066](#sw-066) |
| FE-005 | [SW-131](#sw-131) |
| FE-006 | [SW-132](#sw-132) |
| FE-007 | [SW-014](#sw-014) |
| FE-008 | [SW-006](#sw-006) |
| FE-009 | [SW-133](#sw-133) |
| FE-010 | [SW-067](#sw-067) |
| FE-011 | [SW-134](#sw-134) |
| FE-012 | [SW-135](#sw-135) |
| FE-013 | [SW-136](#sw-136) |
| FE-014 | [SW-137](#sw-137) |
| FE-015 | [SW-138](#sw-138) |
| FE-016 | [SW-139](#sw-139) |
| FE-017 | [SW-140](#sw-140) |
| FE-018 | [SW-141](#sw-141) |
| FE-019 | [SW-084](#sw-084) |
| FE-020 | [SW-142](#sw-142) |
| FE-021 | [SW-007](#sw-007) |
| FE-022 | [SW-068](#sw-068) |
| FIN-001 | [SW-007](#sw-007) |
| FIN-002 | [SW-010](#sw-010) |
| FIN-003 | [SW-030](#sw-030) |
| FIN-004 | [SW-008](#sw-008) |
| FIN-005 | [SW-031](#sw-031) |
| FIN-006 | [SW-032](#sw-032) |
| FIN-007 | [SW-033](#sw-033) |
| FIN-008 | [SW-029](#sw-029) |
| FIN-009 | [SW-035](#sw-035) |
| FIN-010 | [SW-096](#sw-096) |
| FIN-011 | [SW-119](#sw-119) |
| FIN-012 | [SW-120](#sw-120) |
| FIN-013 | [SW-034](#sw-034) |
| FIN-014 | [SW-121](#sw-121) |
| INF-001 | [SW-004](#sw-004) |
| INF-002 | [SW-006](#sw-006) |
| INF-003 | [SW-056](#sw-056) |
| INF-004 | [SW-057](#sw-057) |
| INF-005 | [SW-053](#sw-053) |
| INF-006 | [SW-055](#sw-055) |
| INF-007 | [SW-014](#sw-014) |
| INF-008 | [SW-115](#sw-115) |
| INF-009 | [SW-116](#sw-116) |
| INF-010 | [SW-076](#sw-076) |
| INF-011 | [SW-054](#sw-054) |
| INF-012 | [SW-058](#sw-058) |
| INF-013 | [SW-059](#sw-059) |
| INF-014 | [SW-023](#sw-023) |
| INF-015 | [SW-114](#sw-114) |
| INF-016 | [SW-006](#sw-006) |
| INF-017 | [SW-117](#sw-117) |
| INF-018 | [SW-118](#sw-118) |
| PRJ-001 | [SW-045](#sw-045) |
| PRJ-002 | [SW-046](#sw-046) |
| PRJ-003 | [SW-047](#sw-047) |
| PRJ-004 | [SW-091](#sw-091) |
| PRJ-005 | [SW-100](#sw-100) |
| PRJ-006 | [SW-101](#sw-101) |
| PRJ-007 | [SW-102](#sw-102) |
| PRJ-008 | [SW-103](#sw-103) |
| PRJ-009 | [SW-104](#sw-104) |
| PRJ-010 | [SW-105](#sw-105) |
| QA-001 | [SW-068](#sw-068) |
| QA-002 | [SW-069](#sw-069) |
| QA-003 | [SW-070](#sw-070) |
| QA-004 | [SW-071](#sw-071) |
| QA-005 | [SW-143](#sw-143) |
| QA-006 | [SW-072](#sw-072) |
| QA-007 | [SW-013](#sw-013) |
| QA-008 | [SW-073](#sw-073) |
| QA-009 | [SW-074](#sw-074) |
| QA-010 | [SW-140](#sw-140) |
| QA-011 | [SW-144](#sw-144) |
| RPT-001 | [SW-036](#sw-036) |
| RPT-002 | [SW-122](#sw-122) |
| RPT-003 | [SW-123](#sw-123) |
| SEC-001 | [SW-001](#sw-001) |
| SEC-002 | [SW-002](#sw-002) |
| SEC-003 | [SW-021](#sw-021) |
| SEC-004 | [SW-015](#sw-015) |
| SEC-005 | [SW-016](#sw-016) |
| SEC-006 | [SW-017](#sw-017) |
| SEC-007 | [SW-018](#sw-018) |
| SEC-008 | [SW-014](#sw-014) |
| SEC-009 | [SW-019](#sw-019) |
| SEC-010 | [SW-020](#sw-020) |
| SEC-011 | [SW-023](#sw-023) |
| SEC-012 | [SW-022](#sw-022) |
| SEC-013 | [SW-075](#sw-075) |
| SEC-014 | [SW-076](#sw-076) |
| SEC-015 | [SW-077](#sw-077) |
| SEC-016 | [SW-025](#sw-025) |
| SEC-017 | [SW-028](#sw-028) |
| SEC-018 | [SW-038](#sw-038) |
| SEC-019 | [SW-078](#sw-078) |
| SEC-020 | [SW-079](#sw-079) |
| SEC-021 | [SW-034](#sw-034) |
| STO-001 | [SW-005](#sw-005) |
| STO-002 | [SW-060](#sw-060) |
| STO-003 | [SW-061](#sw-061) |
| STO-004 | [SW-124](#sw-124) |
| STO-005 | [SW-125](#sw-125) |
| WEB-001 | [SW-006](#sw-006) |
| WEB-002 | [SW-037](#sw-037) |
| WEB-003 | [SW-062](#sw-062) |
| WEB-004 | [SW-063](#sw-063) |
| WEB-005 | [SW-017](#sw-017) |
| WEB-006 | [SW-126](#sw-126) |
| WEB-007 | [SW-064](#sw-064) |
| WEB-008 | [SW-127](#sw-127) |
| WEB-009 | [SW-128](#sw-128) |
