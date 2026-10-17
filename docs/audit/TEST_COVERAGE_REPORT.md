# Test Results and Coverage Report

| | |
|---|---|
| Date | 2026-10-17 |
| Repository state | `main` at `4323f55` (PR #86) |
| Scope | CI pipeline replayed locally (migrate, seed, typecheck, lint, format, coverage, build), second run for flakiness, integration tests on a disposable DB, root and web Playwright suites, per-module test inventory and the 20 critical workflows. |
| Method | Read-only code inspection with file:line evidence; targeted local test runs; unauthenticated, low-volume GET/HEAD/OPTIONS probes of production. No production credentials, Coolify, Resend, S3 or GitHub App access. |
| Source | QA & Integration agent report (09), prefix QA- |
| Related | [System audit report](SYSTEM_AUDIT_REPORT.md) · [Bug register](BUG_REGISTER.md) · [Acceptance matrix](ACCEPTANCE_MATRIX.md) · [Remediation roadmap](REMEDIATION_ROADMAP.md) |

Each finding keeps the specialist agent's original ID; the consolidated `SW-` ID from the [bug register](BUG_REGISTER.md) is shown next to it. Severity in the index is the consolidated severity; where duplicates were merged the higher severity was kept, so it can differ from the severity line inside the original finding text.

## Finding index

| Original ID | SW ID | Severity (consolidated) | Confidence | Consolidated title |
|---|---|---|---|---|
| QA-001 | [SW-068](BUG_REGISTER.md#sw-068) | P2 | CONFIRMED | Coverage far below the 70% Definition of Done and no threshold enforced; frontend business screens untested |
| QA-002 | [SW-069](BUG_REGISTER.md#sw-069) | P2 | CONFIRMED | CI runs zero real-database tests; 48 of 51 backend service test files mock Prisma |
| QA-003 | [SW-070](BUG_REGISTER.md#sw-070) | P2 | CONFIRMED | `finance.integration.test.ts` is not re-runnable and writes to any localhost DB, including the dev `somwave` DB |
| QA-004 | [SW-071](BUG_REGISTER.md#sw-071) | P2 | CONFIRMED | Root Playwright suite: 8 of 33 fail on an empty local DB, no webServer, not in CI |
| QA-005 | [SW-143](BUG_REGISTER.md#sw-143) | P3 | CONFIRMED | Engineering Workspace renders no page h1 in its empty state |
| QA-006 | [SW-072](BUG_REGISTER.md#sw-072) | P2 | CONFIRMED | Web unit test and web e2e are not run by CI |
| QA-007 | [SW-013](BUG_REGISTER.md#sw-013) | P1 | CONFIRMED | No HTTP-level test proves the auth, RBAC and cross-tenant 404 contract for any route |
| QA-008 | [SW-073](BUG_REGISTER.md#sw-073) | P2 | CONFIRMED | Cross-tenant 404 proofs are mock-only; one is tautological; no HTTP-level proof |
| QA-009 | [SW-074](BUG_REGISTER.md#sw-074) | P2 | CONFIRMED | Critical integrations effectively untested (GitHub, dashboard, SLA, engineering operations) |
| QA-010 | [SW-140](BUG_REGISTER.md#sw-140) | P3 | CONFIRMED | Large frontend bundles; heavy editor chunk loaded on every project detail view |
| QA-011 | [SW-144](BUG_REGISTER.md#sw-144) | P3 | CONFIRMED | Test config silently overrides DATABASE_URL |

Raw logs: the QA log directory (`qa_logs/`, kept in the audit scratchpad, not committed) (`summary.txt` has exit codes and durations; `NN_*.log` per step; `coverage_analysis.txt`; `cov_full/coverage-summary.json`; `pw-results/` and `pw-web-results/` Playwright traces).

## 1. Scope and what was BLOCKED

Inspected: `.github/workflows/ci.yml`, root `package.json`, `vitest.config.ts`, `vitest.setup.ts`, `web/vitest.config.ts`, `playwright.config.ts`, `web/playwright.config.ts`, every `*.test.ts(x)` (102 files), `e2e/*.spec.ts` (7 files), `web/e2e/homepage.spec.ts`, plus the code paths behind the failures.

Ran the CI pipeline locally against `somwave_qa`, with the env given in the task plus `FINANCE_TEST_DATABASE_URL=<somwave_qa>`. That variable is needed because `vitest.config.ts:20-22` overwrites `DATABASE_URL` with `FINANCE_TEST_DATABASE_URL ?? …/somwave`. Without it the tests would have connected to the shared `somwave` database.

| # | Step | Exit | Duration | Result |
|---|---|---|---|---|
| 1 | `npm run prisma:migrate -w @somwave/backend` | 0 | 2s | 55 migrations applied to an empty `somwave_qa` |
| 2 | `npm run db:seed -w @somwave/backend` | 0 | 2s | Super admin `admin@somwave.com` created with the dev-default password |
| 3 | `npm run typecheck` | 0 | 53s | shared, frontend and backend `tsc` clean; `astro check` 63 files, 0 errors, 0 warnings, 0 hints |
| 4 | `npm run lint` | 0 | 7s | clean |
| 5 | `npm run format:check` | 0 | 10s | clean |
| 6 | `npm run coverage` | 0 | 33s | **102 files: 100 passed, 2 skipped. 601 tests: 597 passed, 0 failed, 4 skipped** |
| 7 | `npm run build` | 0 | 50s | All workspaces built. Frontend chunk warning (>500 kB) |
| 8 | `npm run test` (second run, for flakiness) | **1** | 26s | **1 failed** / 596 passed / 4 skipped. See QA-003 |
| 9-10 | Migrate a disposable `somwave_qa_test`, run the 3 integration files | 0 | 6s | 13/13 passed (the 4 tests skipped in step 6 run here) |
| 11 | Full coverage on a fresh `somwave_qa_test` (json-summary written to the scratchpad) | 0 | 35s | 102/102 files, **601/601 tests passed** |
| 12 | Playwright root `e2e/` on a local API (:4000) and Vite (:5173) using `somwave_qa` | 1 | 78s | **33 tests: 23 passed, 8 failed, 2 skipped** |
| 15 | Playwright `web/e2e` (own `webServer`, Astro dev on :4731) | 0 | 22s | **9/9 passed** |

Skipped and conditional tests found in the code (no `.only` or `.todo` anywhere):
- `backend/src/services/user-onboarding.integration.test.ts:34` `describe.skipIf(!disposable)` (3 tests). Needs a database named `somwave_*_test`.
- `backend/src/services/payment.integration.test.ts:20` `describe.skipIf(!local)` (1 test). Same requirement.
- `backend/src/services/finance.integration.test.ts:38,268,345` `describe.skipIf(!local)` (9 tests). Accepts any localhost DB.
- `e2e/auth.setup.ts:6` `test.skip` when `E2E_EMAIL`/`E2E_PASSWORD` are unset.
- `e2e/internal.spec.ts:50` `test.skip` when the `E2E_ADMIN_*` and TOTP secret are unset. It was skipped in this run, on both projects.
- In real CI `FINANCE_TEST_DATABASE_URL` is never set, so **all 13 real-DB tests are skipped there** (QA-002).

Flakiness: run 1 and run 2 differ by exactly one test, a state leak rather than nondeterminism (QA-003). Every other test had the same result in both runs.

Playwright notes:
- The pinned `@playwright/test` wants `chromium_headless_shell-1248`, but `/opt/pw-browsers` has 1194. I worked around this with the config's own `CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`; no install was run.
- The seeded SUPER_ADMIN cannot drive `auth.setup.ts`: the login redirects to `/profile?tab=security` for forced 2FA enrolment.
- I therefore created a **local-only** user `e2e.local@example.test` in `somwave_qa`, with role `E2E_LOCAL_ALL` holding all 70 DB permissions. This is not a 2FA-required role name.
- Production was never targeted.

BLOCKED:
- The admin-only e2e (`internal.spec.ts:46`) needs `E2E_ADMIN_TOTP_SECRET`.
- Any e2e against production needs credentials.
- Resend, S3 and the GitHub App have no credentials. Their code is exercised only through mocks.

Cleanup: my run created `coverage/`, `frontend/dist/`, `web/dist/`, `web/.astro/` and `test-results/`. Their birth times (17:34–17:41 UTC) all fall after my run started. All five were deleted, and `git status --porcelain --ignored` (excluding node_modules) is now empty. The disposable DB `somwave_qa_test` was dropped. The local e2e user and role remain in `somwave_qa` (QA-reserved).

## 2. Test inventory per module

Test kinds:
- U = unit test with Prisma mocked.
- I = real PostgreSQL integration test, skipped in CI.
- FE = React component or unit test.
- E2E = Playwright browser test.
- E2E-mock = Playwright with `page.route` API mocks.

| Module | Frontend routes | Backend route file | Tests | Line cov (service) | Status |
|---|---|---|---|---|---|
| Auth / login / 2FA | `/login`, `/profile?tab=security` | auth.routes.ts | U auth.service, tokens, cookies, password*, redisAuth; FE apiClient, loginDestination; E2E auth.setup (passed locally); I finance.integration (2FA across refresh) | — | partial |
| Invitations / activation / reset | `/activate-account`, `/activate-engineer`, `/forgot-password` | auth/user/engineer-account routes | U user-invitation, engineer-account(-delivery); I user-onboarding (3); FE SecureOnboarding, EngineerActivationPage, UserInvitations; E2E-mock auth-recovery, engineer-activation (pass) | engineer-account 51% | partial |
| Projects / assignment | `/projects` | project.routes.ts | U project.service, project-activity; FE assignment; E2E-mock projects.spec (2 pass, 6 fail locally) | — | partial |
| Engineering (tasks, review, worklog, ops, analytics) | `/engineering/*` | engineering*.routes.ts | U engineering.service (submit/review), task, worklog, capacity, reminders, team, skills | engineering 45%, ops 5.6%, analytics 0.7% | weak |
| Portal | `/portal/projects`, `/portal/milestones` | platform.routes.ts (`/api/v1/portal`) | U portal.service only; no FE or E2E | portal 71% | weak |
| CMS / portfolio / media | `/cms/*`, `/media` | cms.routes.ts | U portfolio, post, service, faq, team, testimonial, site-content, media, storage; E2E-mock storage-upload (pass) | media 59% | partial; FE cms 0% |
| Finance / invoices / payments / reports | `/finance`, `/reports` | finance/reports/payment.webhook | U finance, invoice, payment, reports, evcplus; route units finance.routes, reports.routes; I finance.integration (9), payment.integration (1); E2E-mock finance-recovery (pass) | reports 63% | partial; FE finance 0% |
| Notifications | — | — | U notification-delivery, mailer.resend, mail templates | 73% | unit only |
| GitHub | `/github` | github.routes.ts | U github.service (webhook signature only, 2 tests) | **1.5%**, client 10% | code-only |
| Dashboard | `/` | dashboard.routes.ts | U dashboard.service; FE metrics | **8.5%** | weak |
| Public website | Astro pages | public.routes.ts | web unit externalUrl (not in CI); web E2E-mock homepage 9/9 | — | partial |

## 3. Findings

### QA-001 (SW-068) — Coverage far below the 70% Definition of Done, and no threshold enforced
- Severity: P2 · Confidence: CONFIRMED · Module: test infrastructure
- Description: CLAUDE.md §15 requires coverage of at least 70%. `vitest.config.ts:26-30` configures `coverage` with no `thresholds`, so CI passes at any coverage level.
- Actual (full run, 601/601 tests):
  - Overall: **lines 33.45%, branches 67.6%, functions 45.08%, statements 33.45%**.
  - backend: L 52.72 / B 66.96 / F 48.63.
  - frontend: **L 9.1** / B 68.66 / F 35.59.
  - packages/shared: L 96.2 / B 77.39 / F 40.62.
- Lowest-covered services (line %):
  - sla-escalation 0
  - engineering-analytics 0.7
  - github.service 1.5
  - system 1.6
  - engineering-operations 5.6
  - dashboard 8.5
  - github.client 10.2
  - hr 16.3
  - search 26.6
  - project-documentation 32.8
  - system-health 35.2
  - client 38.3
  - document 42.9
  - engineering 45.0
  - engineering-worklog 48.0
  - engineer-account 51.3
- Frontend features at 0% line coverage: cms, finance, github, milestones, ops (portal pages live here), profile, reports, tasks, search. projects 1.0%, engineering 5.7%, dashboard 5.9%.
- Evidence: `qa_logs/coverage_analysis.txt`, `qa_logs/11_coverage_full.log`; `vitest.config.ts:26` `coverage: { provider: 'v8', reporter: ['text','html'], include: [...] }` has no thresholds.
- Business impact: regressions in finance UI, portal, CMS and GitHub ship undetected.
- Recommended fix:
  - Add `coverage.thresholds` set to the current baseline, then ratchet it upward.
  - Prioritise tests for the finance and portal frontends and for the github, dashboard and engineering-operations services.
- Complexity: L
- Verification: `npm run coverage` fails below the threshold.

### QA-002 (SW-069) — CI runs zero real-database tests; 48 of 51 backend service test files mock Prisma
- Severity: P2 · Confidence: CONFIRMED · Module: CI / backend
- Description: The 3 PostgreSQL integration files cover the following, and all three gate on `FINANCE_TEST_DATABASE_URL`, which `ci.yml` never sets:
  - invoice-number uniqueness and concurrent overpayment (`payment.integration.test.ts`)
  - single-use invitations and password reset (`user-onboarding.integration.test.ts`)
  - the finance ledger and finance role matrix over HTTP (`finance.integration.test.ts`)
- In CI these 13 tests are skipped, so CI reports about 588 passed / 13 skipped. Every other backend service test stubs `../lib/prisma` with `vi.fn()`. Mocked tests cannot detect:
  - wrong `where` clauses (unless asserted)
  - missing indexes or constraints
  - transaction or isolation bugs
  - Prisma runtime errors such as the Postgres triggers `Posted journals are immutable`
- Evidence:
  - `.github/workflows/ci.yml:43-47` sets only DATABASE_URL, REDIS_URL, JWT_SECRET and CORS_ORIGINS.
  - `payment.integration.test.ts:8-20` and `user-onboarding.integration.test.ts:22-34` both read `const database = process.env.FINANCE_TEST_DATABASE_URL;` and use `describe.skipIf`.
  - Mock classification: 48 MOCK files vs 3 REAL (grep of `vi.mock('../lib/prisma')`).
  - Locally all 13 pass on a disposable DB (`qa_logs/10_integration_qatest.log`).
- Affected: every release. The concurrency and overpayment protections have no regression gate.
- Recommended fix: in `ci.yml` set `FINANCE_TEST_DATABASE_URL: postgresql://<user>:<password>@localhost:5432/somwave_ci_test`. Create that DB, run `prisma migrate deploy` against it, and make `DATABASE_URL` equal for the test step.
- Complexity: S
- Verification: the CI log shows the 13 tests executed.

### QA-003 (SW-070) — `finance.integration.test.ts` is not re-runnable and writes to any localhost DB, including the dev `somwave` DB
- Severity: P2 · Confidence: CONFIRMED · Module: finance tests
- Reproduction: run `npm run test` twice against the same DB. Run 1 passes; run 2 fails.
- Run 2 failure: `finance ledger integration > posts an approved entry, reverses it, and blocks closed-period writes and mutation` → `AppError: Accounting period is closed` at `finance.service.ts:252`, called from `finance.integration.test.ts:105`.
- Root cause:
  - The test uses fixed dates in 2020-02 (`:112,147,239`) and calls `closePeriod(2020, 2, 'test-manager')` at `:249`.
  - The closed period is never cleaned up, and posted journals are immutable by trigger.
  - Its guard (`:30-32`) accepts any `postgres://…@localhost:<port>/<any db>`, whereas the other two integration files require a `somwave_*_test` name.
  - A developer who sets `FINANCE_TEST_DATABASE_URL` to their local `somwave` DB permanently closes Feb-2020 and inserts posted journals there.
- Evidence: `qa_logs/08_test_run2.log:203-216`.
- Recommended fix:
  - Use the same `_test`-suffix guard as the other files.
  - Use a unique random year/month per run, or a fresh schema per run, or truncate in `afterAll`.
- Complexity: S
- Verification: two consecutive runs both pass.

### QA-004 (SW-071) — Root Playwright suite: 8/33 fail on an empty local DB, has no webServer, and is not in CI
- Severity: P2 · Confidence: CONFIRMED · Module: e2e
- Actual: 23 passed, 8 failed, 2 skipped. Each of the 4 failing tests fails on both desktop and mobile:
  1. `internal.spec.ts:4` "engineering modules load from real APIs": waits for heading `Engineering Workspace`, but on an empty DB the page shows only `No assigned projects` (see QA-005).
  2. `projects.spec.ts:3` "project dashboard and management tabs": expects `article a[href^="/projects/"]` from the real API, so it needs a pre-existing project.
  3. `projects.spec.ts:51` and `:288`: strict-mode violation. `getByRole('button',{name:'New project'})` resolves to 2 elements on an empty list: the header button `ProjectsPage.tsx:114` and the EmptyState action `ProjectsPage.tsx:339`.
- Structural problems:
  - `playwright.config.ts` has no `webServer`, so the suite cannot self-start.
  - Specs depend on whatever data the target DB already contains, and there are no fixtures or seed.
  - `ci.yml` has no e2e job.
  - The seeded SUPER_ADMIN cannot be used for `auth.setup.ts` (forced 2FA enrolment redirect).
  - Most passing specs are `page.route`-mocked: 29 `page.route` calls across 5 specs, so they test the UI, not the integration.
- Evidence: `qa_logs/12_e2e.log`; `qa_logs/pw-results/*/error-context.md`.
- Recommended fix:
  - Add a `webServer` and a deterministic e2e seed with a non-2FA test role.
  - Use `.first()` or scope the locator to the header.
  - Add a CI e2e job against a service DB.
- Complexity: M
- Verification: the full suite is green on a fresh DB in CI.

### QA-005 (SW-143) — Engineering Workspace renders no page `<h1>` in its empty state
- Severity: P3 · Confidence: CONFIRMED · Module: engineering frontend
- Description: With no projects, the view shows only an `h2` "No assigned projects". The `h1` "Engineering Workspace" (`EngineeringWorkspacePage.tsx:481`) renders only in the data state.
- Impact: screen-reader landmark and heading structure is missing for every new engineer. This is also why the e2e in QA-004 fails.
- Evidence: Playwright snapshot `pw-results/internal-engineering-modules-load-from-real-APIs-desktop/error-context.md:123-125`.
- Fix: render the page header above the empty state.
- Complexity: S

### QA-006 (SW-072) — Web unit test and web e2e are not run by CI
- Severity: P2 · Confidence: CONFIRMED · Module: web / CI
- Description: The root `vitest.config.ts:12-16` `include` covers backend, shared and frontend only, so `web/src/lib/externalUrl.test.ts` never runs in `npm run coverage`. It passes only via `npx vitest run --config web/vitest.config.ts` (1/1, `qa_logs/13_web_vitest_config.log`).
- `web/e2e/homepage.spec.ts` (9 tests, which cover the contact form, project-request email verification and file uploads) runs only with `web/playwright.config.ts`. It passed 9/9 locally, but CI never invokes it.
- Fix: add `'web/src/**/*.test.ts'` to the root include, and add a web e2e CI step.
- Complexity: S

### QA-007 (SW-013) — RBAC not tested per role except finance; 18 of 20 route modules have no route-level tests
- Severity: P2 · Confidence: CONFIRMED · Module: authorization
- Description: CLAUDE.md §15 requires "RBAC tested for every role — both what is allowed and what is refused". Actual coverage:
  - `middleware/rbac.test.ts`: 4 generic middleware tests.
  - `frontend/src/lib/rbac.test.ts` and `RequirePermission.test.tsx`: UI-only checks.
  - One HTTP role matrix: `finance.integration.test.ts:345-420`, 6 roles, skipped in CI. It uses permission fixtures written by hand inside the test ("mirror the existing seed policy"), so it cannot detect drift in `prisma/seed.ts`.
  - Route test files exist for finance and reports only. Endpoints that carry `rbac(` (258 occurrences) in auth, cms, engineering, engineering-operations, github, milestone, ops-extra, platform/portal, project, project-documentation, task, user and dashboard have no test asserting allowed vs 403 per role.
- Evidence: `ls backend/src/routes` shows `finance.routes.test.ts` and `reports.routes.test.ts` as the only tests among 20 route files. `finance.integration.test.ts:346` has the comment "Permission fixtures mirror the existing seed policy".
- Fix: a table-driven supertest matrix (role × endpoint) that seeds roles via the real `seed.ts` policy.
- Complexity: M

### QA-008 (SW-073) — Cross-tenant 404 proofs are mock-only; one is tautological; no HTTP-level proof
- Severity: P2 · Confidence: CONFIRMED · Module: portal / finance
- Description: "another client gets 404" tests exist only as mocked-Prisma unit tests:
  - `portal.service.test.ts:70`
  - `invoice.service.test.ts:96,237,282`
  - `ticket.service.test.ts:51,116`
  - `document.service.test.ts:53`
  - `payment.service.test.ts:211`
  - `project-inquiry-attachment.service.test.ts:166`
- `portal.service.test.ts:70-76` mocks `findFirst` to return `null` and asserts NOT_FOUND without checking the `where` clause. It would pass even if the `clientId` filter were removed.
- `invoice.service.test.ts:96-106` does assert `where: { id, deletedAt: null, clientId }`, which is good.
- No test drives two real client users through `/api/v1/portal/*` and expects 404. Engineering and project scoping (engineer A vs B) is likewise unit-mock only (`engineering-worklog.service.test.ts:54`, `project.service.test.ts:344`).
- Fix:
  - Assert the scoped `where` in every mocked test.
  - Add real-DB HTTP tests with two clients for portal projects, milestones, documents and invoices.
- Complexity: M

### QA-009 (SW-074) — Critical integrations effectively untested (GitHub, dashboard, SLA, engineering ops)
- Severity: P2 · Confidence: CONFIRMED · Module: github / dashboard / ops
- Description:
  - `github.service.ts` (727 lines) is at 1.5% coverage. Its only tests are 2 webhook-signature checks (`github.service.test.ts:10,17`). Event handling, repo linking and the API client are never executed.
  - `sla-escalation.service.ts` 0%.
  - `dashboard.service.ts` 8.5%: this is the finance dashboard aggregate; ledger totals are covered separately in finance.integration.
  - `engineering-operations.service.ts` 5.6%.
- Evidence: `qa_logs/coverage_analysis.txt`.
- Fix: unit tests with recorded GitHub payloads; a real-DB dashboard aggregate test.
- Complexity: M

### QA-010 (SW-140) — Large frontend bundles
- Severity: P3 · Confidence: CONFIRMED · Module: frontend build
- Description: `dist/assets/index-*.js` is 699 kB and `DocumentationPage-*.js` is 439 kB, both minified and before gzip. Vite warns that chunks exceed 500 kB.
- Evidence: `qa_logs/07_build.log`.
- Fix: use `manualChunks`, and lazy-load `marked` and other heavy documentation dependencies.
- Complexity: S

### QA-011 (SW-144) — Test config silently overrides `DATABASE_URL`
- Severity: P3 · Confidence: CONFIRMED · Module: test infrastructure
- Description: `vitest.config.ts:20-22` sets `DATABASE_URL: process.env.FINANCE_TEST_DATABASE_URL ?? 'postgresql://<user>:<password>@localhost:5432/somwave'`. A caller's `DATABASE_URL` is ignored and tests default to the shared dev DB.
- In CI the values coincide, so nothing breaks there. Locally, an auditor who points `DATABASE_URL` at an isolated DB is silently redirected.
- Fix: honour `process.env.DATABASE_URL` first, and default to a `_test` DB.
- Complexity: S

Environment note (not a product defect): the `@playwright/test` version and the preinstalled browser revision disagree (1248 vs 1194). `CHROMIUM_PATH` is required to run e2e in this container.

## 4. Critical workflow → test coverage map

Status legend:
- covered-integration: exercised by a real-DB test (CI skips these, QA-002).
- covered-e2e: a Playwright browser test exercises it. Mocked APIs are noted.
- code-only: no meaningful test.
- live-BLOCKED: needs production credentials.

| # | Workflow | Unit | Integration (real DB) | E2E | Status |
|---|---|---|---|---|---|
| 1 | Login (+2FA) | auth.service, tokens, cookies, password, redisAuth, apiClient, loginDestination | finance.integration "2FA across refresh" | auth.setup passed locally (real API) | covered-e2e (local) · live-BLOCKED |
| 2 | Invitation | user-invitation, UserInvitations.test.tsx, shared user schema | user-onboarding "consumes an invitation once" | auth-recovery.spec:11 (mocked API) | covered-integration (CI-skipped) |
| 3 | Email activation | EngineerActivationPage.test, SecureOnboarding, mailer.resend, templates | user-onboarding | engineer-activation.spec, internal.spec:109 (mocked/invalid-token) | covered-unit; Resend delivery live-BLOCKED |
| 4 | Password reset | auth.service, SecureOnboarding | user-onboarding (reset/OTP/session revoke) | auth-recovery.spec:47 (mocked) | covered-integration (CI-skipped) |
| 5 | Engineer registration | engineer-account(.service/-delivery), EngineerDirectory.test | — | internal.spec:46 SKIPPED (needs admin TOTP) | covered-unit · e2e BLOCKED |
| 6 | Project creation | project.service | — | projects.spec:288 FAILED locally (locator) | covered-unit |
| 7 | Engineer assignment | project.service, assignment.test, engineering-team | — | projects.spec:176 passed (mocked); :51 FAILED | covered-unit (+mocked e2e) |
| 8 | Task submission | engineering.service (submit), task.service, worklog | — | none | covered-unit |
| 9 | Manager approval | engineering.service (review, self-approval), task.service, milestone | — | none | covered-unit |
| 10 | Client project tracking (portal) | portal.service (mocked, QA-008) | — | none | covered-unit (weak); FE 0% |
| 11 | Portfolio publishing | portfolio.service, shared portfolio schema, media-references | — | none | covered-unit |
| 12 | Image upload | storage, storage-process, media.service, articleImage | storage-process (real filesystem) | storage-upload.spec (upload failure path, mocked) | covered-unit; S3 live-BLOCKED |
| 13 | Finance dashboard | dashboard.service (8.5%), finance.service | finance.integration "dashboard HTTP diagnostics" | finance-recovery.spec (mocked) | covered-integration (CI-skipped) |
| 14 | Invoice creation | invoice.service, shared invoice schema | payment.integration (unique numbering) | none | covered-integration (CI-skipped) |
| 15 | Payment recording | payment.service, evcplus.client, idempotency | payment.integration (concurrent overpayment) | none | covered-integration (CI-skipped); EVC live-BLOCKED |
| 16 | Financial reporting | reports.service (63%), reports.routes, finance-history | finance.integration (profitability, close period) | none | covered-integration (CI-skipped) |
| 17 | Role permissions | rbac.test, role.service, RequirePermission, rbac (FE), nav.test | finance role matrix only | none | covered-unit (finance HTTP only); see QA-007 |
| 18 | Notifications | notification-delivery, mailer.resend, templates | — | none | covered-unit; Resend live-BLOCKED |
| 19 | GitHub integration | github.service (signature only) | — | none | code-only (1.5%) · live-BLOCKED |
| 20 | Regression suite | 601 tests pass; typecheck/lint/format/build green | 13 real-DB tests (CI-skipped) | 23/33 root and 9/9 web pass locally; neither in CI | PARTIAL |

## 5. Acceptance rows

| Feature | Status | Evidence |
|---|---|---|
| Migrations apply to an empty DB | VERIFIED | `01_migrate.log`, 55 migrations, exit 0 |
| Seed idempotent first run | VERIFIED | `02_seed.log`, exit 0 |
| Typecheck (all workspaces) | VERIFIED | `03_typecheck.log`, exit 0 |
| Lint | VERIFIED | `04_lint.log`, exit 0 |
| Format check | VERIFIED | `05_format.log`, exit 0 |
| Unit and API test suite | VERIFIED | 597/601 pass (4 skipped); 601/601 on a disposable DB |
| Suite re-runnable (no state leak) | FAILED | QA-003, `08_test_run2.log` |
| Coverage ≥ 70% | FAILED | lines 33.45% (QA-001) |
| Build (all workspaces) | VERIFIED | `07_build.log`, exit 0 |
| Real-DB integration tests in CI | FAILED | QA-002 |
| Root Playwright e2e | FAILED | 23 pass / 8 fail / 2 skip (QA-004) |
| Web Playwright e2e | VERIFIED (local, mocked API) | `15_web_e2e.log` 9/9 |
| Per-role RBAC tests | PARTIAL | finance only (QA-007) |
| Cross-tenant 404 test | PARTIAL | mocked unit only (QA-008) |
| E2E against production | BLOCKED | no credentials / TOTP |

## Number reconciliation (checked against the raw logs)

| Figure | Value | Log |
|---|---|---|
| Unit/API suite, run 1 (`npm run coverage` on `somwave_qa`) | 102 files: 100 passed, 2 skipped. 601 tests: 597 passed, 0 failed, 4 skipped | `06_coverage.log` |
| Run 2 (`npm run test`, same DB) | 1 failed, 596 passed, 4 skipped (QA-003) | `08_test_run2.log` |
| Integration files on a disposable `somwave_qa_test` | 3 files, 13/13 passed | `10_integration_qatest.log` |
| Full coverage on a fresh disposable DB | 102/102 files, 601/601 tests passed | `11_coverage_full.log` |
| Coverage (full run, used in this report) | lines 33.45%, branches 67.6%, functions 45.08%, statements 33.45% | `11_coverage_full.log`, `coverage_analysis.txt` |
| Coverage (run 1, integration files skipped) | lines 33.32%, branches 67.03%, functions 45.08% | `06_coverage.log` |
| Root Playwright e2e | 33 tests: 23 passed, 8 failed, 2 skipped | `12_e2e.log` |
| Web Playwright e2e | 9/9 passed | `15_web_e2e.log` |
| Typecheck, lint, format, build | all exit 0 | `summary.txt` |

The raw logs are kept in the audit scratchpad and are not committed.

## Bundle size note

The QA build (`07_build.log`) produced `index-*.js` of 699.38 kB and a Vite warning for chunks over 500 kB. The frontend agent's separate `vite build` produced 441.66 kB, which matches the production file `index-MnjbBilE.js` (441,678 bytes). Both are recorded under SW-140; the cause of the difference between the two local builds was not investigated.
