# Finance, Accounting, Reports and Analytics Audit

| | |
|---|---|
| Date | 2026-10-17 |
| Repository state | `main` at `4323f55` (PR #86) |
| Scope | Finance ledger, invoices, payments (manual and EVC Plus), project finance, finance dashboard incident, reports and main-dashboard KPIs. |
| Method | Read-only code inspection with file:line evidence; targeted local test runs; unauthenticated, low-volume GET/HEAD/OPTIONS probes of production. No production credentials, Coolify, Resend, S3 or GitHub App access. |
| Source | Finance agent report (06), prefixes FIN- and RPT- |
| Related | [System audit report](SYSTEM_AUDIT_REPORT.md) · [Bug register](BUG_REGISTER.md) · [Acceptance matrix](ACCEPTANCE_MATRIX.md) · [Remediation roadmap](REMEDIATION_ROADMAP.md) |

Each finding keeps the specialist agent's original ID; the consolidated `SW-` ID from the [bug register](BUG_REGISTER.md) is shown next to it. Severity in the index is the consolidated severity; where duplicates were merged the higher severity was kept, so it can differ from the severity line inside the original finding text.

## Finding index

| Original ID | SW ID | Severity (consolidated) | Confidence | Consolidated title |
|---|---|---|---|---|
| FIN-001 | [SW-007](BUG_REGISTER.md#sw-007) | P1 | CONFIRMED | "Could not load finance dashboard": the session never gains MFA proof after 2FA enrolment, so privileged users get 403 (old bundle masked the real error) |
| FIN-002 | [SW-010](BUG_REGISTER.md#sw-010) | P1 | CONFIRMED | Central error handler discards the error; Prisma known errors (P2002/P2025/P2034) become HTTP 500 |
| FIN-003 | [SW-030](BUG_REGISTER.md#sw-030) | P2 | CONFIRMED | Accounting-period assignment uses the UTC month while dates are Mogadishu midnight: first-of-month transactions land in the previous period |
| FIN-004 | [SW-008](BUG_REGISTER.md#sw-008) | P1 | CONFIRMED | EVC Plus charge leaves an orphaned PENDING payment whenever the provider call fails (always, while EVC is unconfigured) |
| FIN-005 | [SW-031](BUG_REGISTER.md#sw-031) | P2 | CONFIRMED | Webhook overpayment path rolls back and returns 409 forever; captured money is never recorded |
| FIN-006 | [SW-032](BUG_REGISTER.md#sw-032) | P2 | CONFIRMED | Invoice line totals are not rounded before summing (subtotal can disagree with stored lines); large values overflow to 500 |
| FIN-007 | [SW-033](BUG_REGISTER.md#sw-033) | P2 | CONFIRMED | Invoices and payments are outside the ledger: revenue exists in two unreconciled systems; invoices have no currency |
| FIN-008 | [SW-029](BUG_REGISTER.md#sw-029) | P2 | CONFIRMED | Invoice and payment endpoints bypass finance hardening: no MFA proof, no approval, no audit log; MANAGER can record payments |
| FIN-009 | [SW-035](BUG_REGISTER.md#sw-035) | P2 | CONFIRMED | Payroll, salaries, bonuses, allowances, AP, recurring expenses, bank reconciliation and FX are not implemented |
| FIN-010 | [SW-096](BUG_REGISTER.md#sw-096) | P3 | CONFIRMED | Invoice OVERDUE status is written on every GET (write-on-read); PARTIAL invoices never become OVERDUE |
| FIN-011 | [SW-119](BUG_REGISTER.md#sw-119) | P3 | CONFIRMED | Project expenses/budgets are a parallel unapproved cost ledger gated by invoice permissions |
| FIN-012 | [SW-120](BUG_REGISTER.md#sw-120) | P3 | CONFIRMED | Segregation of duties is two-person only; the approver may also post |
| FIN-013 | [SW-034](BUG_REGISTER.md#sw-034) | P2 | CONFIRMED | EVC Plus client is a generic placeholder contract; webhook has no replay window and no amount reconciliation |
| FIN-014 | [SW-121](BUG_REGISTER.md#sw-121) | P3 | CONFIRMED | Invoice number year uses UTC |
| RPT-001 | [SW-036](BUG_REGISTER.md#sw-036) | P2 | CONFIRMED | Main dashboard "Revenue collected" KPI ignores the selected range; trend is misleading; USD assumed |
| RPT-002 | [SW-122](BUG_REGISTER.md#sw-122) | P3 | CONFIRMED | Reports export CSV only; no PDF/Excel, scheduled/emailed reports or full financial statements |
| RPT-003 | [SW-123](BUG_REGISTER.md#sw-123) | P3 | CONFIRMED | Inconsistent date-range semantics (/reports inclusive `to`, /finance exclusive); AR "settled as-of" uses payments.updated_at |

## 1. Scope inspected / blocked

Inspected (read-only):
- Backend: `services/finance.service.ts`, `invoice.service.ts`, `payment.service.ts`, `payments/paymentCore.ts`, `payments/evcplus.client.ts`, `payments/gateways/{evcplus,manualBank}.gateway.ts`, `project-finance.service.ts`, `reports.service.ts`, `dashboard.service.ts`, `hr.service.ts` (payroll grep), `routes/finance.routes.ts`, `routes/reports.routes.ts`, `routes/payment.webhook.routes.ts`, `routes/platform.routes.ts` (invoices/payments), `controllers/{invoice,payment,payment.webhook}.controller.ts`, `middleware/{auth,rbac,errorHandler}.ts`, `lib/{http,tokens}.ts`, `services/auth.service.ts` (session/MFA proof), `app.ts`, `docker-entrypoint.sh`, `Dockerfile`.
- Prisma: `schema.prisma` finance/invoice/payment/project-expense/employee models; migrations `20261016120000_finance_ledger_foundation`, `20261016130000_finance_mfa_session_proof`, `20261017090000_secure_user_invitations_reset_otp`; `prisma/seed.ts` role policy.
- Shared: `schemas/finance.ts`, `schemas/invoice.ts`, `schemas/payment.ts`, `constants/permissions.ts`, `constants/roles.ts`, `schemas/auth.ts`.
- Frontend: `features/finance/{FinancePage.tsx,api.ts}`, `features/dashboard/*`, `features/reports/*`, `lib/apiClient.ts`, `lib/queryClient.ts`, `components/states/ErrorState.tsx`, `app/App.tsx` route guard.
- Docs: `FINANCE_ACCOUNTING_STATUS.md`, `FINANCE_BUG_REGISTER.md`, `FINANCE_PRODUCTION_REPAIR.md`.
- Git history of the dashboard error string (`git log -L`).

Production probes (unauthenticated GET/HEAD/OPTIONS only, 12 requests):
- `GET api…/api/v1/finance/dashboard` → 401 `{"error":{"code":"UNAUTHORIZED","message":"Authentication required"}}`. `/finance/accounts` 401, `/finance/nonexistent-xyz` 401 (router-level `requireAuth` → 401 does not prove the dashboard route exists, only that `/api/v1/finance` router is mounted). `/reports` 401. `/health` 200 `{"status":"ok","checks":{"redis":true,"postgres":true}}`. `/api/v1/health` 404.
- `OPTIONS /api/v1/finance/dashboard` with app origin → 204 (CORS preflight OK).
- `GET app…/` → `assets/index-MnjbBilE.js` → `assets/FinancePage-DaGwO4xf.js`. The deployed finance chunk contains the **post-#86** code: `h.isError||!h.data?…description:h.error instanceof Error?h.error.message:"Could not load finance dashboard."`. Index `last-modified: Sat, 17 Oct 2026 13:12:57 GMT` (no `cache-control` on index; assets `max-age=31536000, immutable`).

Tests executed:
- Unit (vitest, 11 files): finance.service, finance-history.service, invoice.service, payment.service, project-finance.service, reports.service, dashboard.service, finance.routes, reports.routes, evcplus.client, shared finance schema → **73 passed / 0 failed**.
- Integration on **disposable** local DBs I created and dropped afterwards (`somwave_finaudit`, `somwave_finaudit_test`; all 45 migrations applied via `prisma migrate deploy`; `somwave_qa` NOT touched because these tests close accounting periods and leave immutable journals): `finance.integration.test.ts` **9 passed**; `payment.integration.test.ts` **1 passed** (requires `somwave_*_test` DB name).
- SQL demonstrations on the disposable DB: `0.025::numeric(12,2)` → `0.03`; `(100000.00*100000.00)::numeric(12,2)` → `ERROR: numeric field overflow`.

BLOCKED: authenticated production request to `/finance/dashboard` and Coolify API logs (no credentials) — the exact production status/error envelope for the reported incident cannot be observed. Backend deployed commit cannot be identified unauthenticated. Live EVC Plus provider not available.

## 2. Module inventory

| Module | Frontend route | Backend endpoints | Models | Permissions | Tests | Status |
|---|---|---|---|---|---|---|
| Finance dashboard | `/finance` (Overview tab) | `GET /finance/dashboard?from&to` | FinanceJournal, FinanceJournalLine, FinanceAccount, FinanceTransaction | `finance.read` + 2FA enrolled + session MFA proof | unit + integration (200/400/403) | Works locally; production cause unverified |
| Transactions (income/expense) | `/finance` Transactions | `GET/POST /finance/transactions`, `PATCH /:id`, `POST /:id/{submit,cancel}` | FinanceTransaction | `finance.read`/`finance.create` | unit + integration | Implemented |
| Approvals | `/finance` Approvals | `POST /:id/{approve,reject}` | FinanceTransaction | `finance.approve` | integration (self-approval blocked) | Implemented (2-person rule only) |
| Posting / GL | `/finance` General Ledger | `POST /:id/post`, `GET /journals`, `POST /journals/:id/reverse`, `GET /trial-balance(.csv)`, `POST /periods/close` | FinanceJournal(+Line), FinancePeriod | `finance.post`/`finance.manage` | integration | Implemented; period assignment bug FIN-003 |
| Chart of accounts | `/finance` Chart of Accounts | `GET/POST /finance/accounts` | FinanceAccount | `finance.read`/`finance.manage` | integration | Implemented (no edit/deactivate endpoint) |
| Project profitability | `/finance` Projects | `GET /finance/project-profitability` | journal lines w/ projectId | `finance.read` | integration | Ledger-only |
| Project budget/expenses | project detail | project-finance routes | ProjectExpense, ProjectBudgetRevision | `invoices.read`/`invoices.update` (+ADMIN) | unit | Separate from ledger (FIN-011) |
| Invoices | `/invoices`, portal | `GET/POST /invoices`, `GET /:id`, `POST /:id/{send,void}` | Invoice, InvoiceItem | `invoices.*` | unit + integration | No edit, no currency, no ledger posting |
| Payments | invoice detail / portal | `GET/POST /payments`, `POST /payments/evc-plus`, `POST /payments/webhooks/evc-plus` | Payment | `payments.*`; webhook HMAC | unit + integration | Manual works; EVC orphan risk FIN-004 |
| AR | Reports | `GET /reports/receivables-aging` | Invoice, Payment | `finance.read` + MFA proof | unit | Row-level only |
| AP / vendor bills | — | — | — | — | — | NOT IMPLEMENTED |
| Payroll / salaries / bonuses | — | — | (Employee has no salary fields) | — | — | NOT IMPLEMENTED |
| Recurring expenses / BullMQ | — | — | — | — | — | NOT IMPLEMENTED (no bullmq dependency, no `backend/src/jobs`) |
| Multi-currency / FX | — | per-currency grouping only | `currency` on ledger only | — | — | No exchange-rate storage |
| Reports & analytics | `/reports` | `GET /reports`, `/reports/overview`, `/reports/:key`, `/reports/:key.csv` | many | per-report permission | unit | CSV only; no PDF/Excel; no scheduled/email |
| Main dashboard KPIs | `/dashboard` | `GET /dashboard` | Invoice etc. | per-module perms | unit | Revenue KPI wrong (RPT-001) |

## 3. Findings

### FIN-001 (SW-007) — Root cause of "Something went wrong — Could not load finance dashboard."
- Severity: P1 · Confidence: CONFIRMED (mechanism) / SUSPECTED (which branch hit production) · Module: Finance dashboard
- Description: The frontend string is at `frontend/src/features/finance/FinancePage.tsx:197-205`. It calls `financeApi.dashboard(from,to)` → `apiFetch('/finance/dashboard?from=…&to=…')` (`features/finance/api.ts`), served by `financeRouter.get('/dashboard', rbac(FINANCE_READ), …finance.financeDashboard)` (`backend/src/routes/finance.routes.ts:338-345`), after router-wide `requireAuth` (`:52`) and `requireFinanceTwoFactor` (`:53-68`).
- Key evidence about the literal string:
  - Before PR #86 the component rendered `description="Could not load finance dashboard."` for **every** error (introduced in #84 `99dcb08`, replaced in #86 `4323f55`; confirmed by `git log -L`). `docs/FINANCE_PRODUCTION_REPAIR.md` also states this.
  - After #86 (which IS deployed — production chunk `FinancePage-DaGwO4xf.js` contains the new ternary), any `ApiError` shows its server message (`ApiError` always has a message: `super(message ?? code)`, `lib/apiClient.ts:12-20`). TanStack Query 5.102.7 turns an `undefined` payload into `Error("… data is undefined")`, which is also an `Error`. Therefore in the current bundle the literal fallback can only appear when `isError=false && !data` (e.g. a paused/offline query, or a 200 `{"data":null}` that this handler never sends).
  - Conclusion: the reported text was produced by the **pre-#86 bundle** (frontend redeployed 2026-10-17 13:12:57 UTC per `last-modified`; users with tabs opened before that keep running the old chunk). It masked the real status.
- Ranked probable underlying causes (what the masked error actually was):
  1. **HTTP 403 from `requireFinanceTwoFactor` — session lacks MFA proof** (most probable for SUPER_ADMIN/ADMIN/FINANCE_MANAGER). CONFIRMED code paths that produce it for a legitimately privileged user:
     a. User enrolls 2FA in the current session: `confirmTwoFactorEnrolment` (`backend/src/services/auth.service.ts:222-244`) sets `twoFactorEnabled: true` but does not re-issue the session; the access/refresh token keep `mfaVerifiedAt = null`. The frontend **forces** these roles to enroll right after login (`frontend/src/features/auth/ProtectedRoute.tsx:17`, `loginDestination.ts:4`), so the very first visit to `/finance` after enrolment always gets 403 "Sign out and sign in with your two-factor code…" until they log out/in.
     b. Sessions created before migration `20261016130000_finance_mfa_session_proof` have `refresh_tokens.mfa_verified_at = NULL`; `refreshSession` copies that null forward (`auth.service.ts:327`), so a 30-day refresh chain never gains finance access.
     c. User without 2FA at all → 403 "Enable two-factor authentication…". All finance roles (SUPER_ADMIN, ADMIN, FINANCE_MANAGER, ACCOUNTANT) are in `TWO_FACTOR_REQUIRED_ROLES` (`packages/shared/src/constants/roles.ts:22-29`) but enforcement of enrolment is frontend-only (ProtectedRoute redirect), so this case requires bypassing the redirect; low likelihood.
     Integration test reproduces 403 for missing proof and 200 with proof (ran locally: 9/9 pass).
  2. HTTP 403 "Insufficient permissions" — low probability: `/finance` is wrapped in `<Guarded permission={FINANCE_READ}>` (`frontend/src/app/App.tsx:461-466`), and SUPER_ADMIN bypasses via `holdsPermission` (`packages/shared/src/constants/permissions.ts:87`). Migration grants `finance.*` to ADMIN/FINANCE_MANAGER/ACCOUNTANT only (`20261016120000…/migration.sql:265-290`); MANAGER has no finance permission (seed `backend/prisma/seed.ts:78-104`) so they would not see the page.
  3. HTTP 500 from missing tables/columns (P2021/P2022) — low: `docker-entrypoint.sh` runs `prisma migrate deploy` under `set -eu` before `npm start`, so a migration failure prevents the new container from starting; `/health` is green. Cannot exclude a manual/partial deploy. If it happened, it is undiagnosable from logs (FIN-002).
  4. Network/CORS/`VITE_API_URL` — low: CORS preflight 204 from app origin; would have shown "Network error" in new UI.
  5. Decimal serialization / empty ledger — ruled out: all Decimals are `.toFixed(2)` strings (`finance.service.ts:638-745`); empty ledger returns 200 with `currencies: []` → EmptyState (integration test covers empty interval).
- Recommended fix: (a) in `confirmTwoFactorEnrolment` (and after successful 2FA re-verification) re-issue session cookies with `mfaVerifiedAt = now` since a TOTP was just verified; (b) add a `POST /auth/2fa/step-up` that verifies TOTP and upgrades the current session instead of forcing logout; (c) in FinancePage, pre-check `user.twoFactorEnabled` and branch on `error.code === 'FORBIDDEN'` with a dedicated CTA; (d) obtain the authenticated production envelope + request ID to close the investigation.
- Dependencies: auth service. Complexity: S–M. Verification: integration test "enroll 2FA then GET /finance/dashboard → 200 without re-login"; production authenticated probe with request-ID correlation.

### FIN-002 (SW-010) — Unexpected server errors are logged without the error itself
- Severity: P1 · Confidence: CONFIRMED · Module: error handling / diagnostics
- Evidence: `backend/src/middleware/errorHandler.ts:26-38` logs only `{requestId, errorCategory:'UNEXPECTED_ERROR', httpStatus:500}` and `'Unhandled request failure'`; no `err.name`, Prisma `code` (P2021/P2022/P2010), or stack. `finance.routes.ts:26-50` logs status only.
- Impact: any 500 on finance (or anywhere) cannot be root-caused from Coolify logs — exactly why FIN-001 could not be closed. Contradicts CLAUDE.md §5 ("logs the full detail server-side").
- Fix: log `err.name`, `err.code` (Prisma known errors), `err.meta?.table/column` and a stack (server-side only, redact values). Complexity S. Verify: unit test that a Prisma P2021 produces a log with `prismaCode`.

### FIN-003 (SW-030) — Accounting-period assignment uses UTC month while dates are Mogadishu midnight → first-of-month transactions land in the previous period
- Severity: P2 · Confidence: CONFIRMED · Module: General ledger / period close
- Evidence: frontend sends `parseFinanceBusinessDate(date).toISOString()` (`FinancePage.tsx:825-828`), which is `YYYY-MM-DD 00:00 +03:00` = previous day 21:00Z (`packages/shared/src/schemas/finance.ts` `parseFinanceBusinessDate`). `periodOf` uses `getUTCFullYear/getUTCMonth` (`finance.service.ts:55-57`); `closePeriod` counts pending by UTC month (`:597-604`); DB trigger `finance_open_period_guard` uses `EXTRACT(MONTH FROM occurred_on)` on UTC timestamps (`20261016120000…/migration.sql:249-262`). Reproduced arithmetic: `2026-11-01` → `2026-10-31T21:00:00.000Z` → period 10.
- Impact: a 1 November transaction is assigned to October: posting it fails with "Accounting period is closed" once October is closed; closing October is blocked by November-1 pending items; period totals disagree with the dashboard (which uses Mogadishu boundaries). The repair doc acknowledges period close was left UTC.
- Fix: compute period from `financeBusinessDate(occurredOn)` in service AND trigger (`EXTRACT(… FROM occurred_on + interval '3 hours')`), plus data review of existing first-day rows. Complexity M. Verify: integration test posting a 1st-of-month entry after closing the previous month.

### FIN-004 (SW-008) — EVC Plus charge leaves an orphaned PENDING payment when the provider call fails (always, while EVC is unconfigured in production)
- Severity: P1 · Confidence: CONFIRMED (code) / SUSPECTED (production EVC config) · Module: Payments
- Evidence: `payments/gateways/evcplus.gateway.ts:52-75` commits a `PENDING` payment, then `:77` calls `initiateEvcCharge`, which throws `PAYMENT_FAILED 502 'EVC Plus is not configured'` in production when env is missing (`payments/evcplus.client.ts:29-33`) or on any provider error (`:56-62`). No catch marks the payment FAILED; no cleanup job exists. `isEvcPlusConfigured()` (`evcplus.client.ts:24`) is never used to hide/disable the EVC button.
- Impact: the PENDING amount is reserved forever (`assertAmountWithinBalance` adds pending sums, `paymentCore.ts` + `manualBank.gateway.ts:36-40`), so staff cannot record the real bank payment ("Payment exceeds the outstanding balance") and the invoice cannot be voided (`invoice.service.ts:228-232`). If the provider succeeded but the `gatewayRef` update (`evcplus.gateway.ts:83`) failed, the webhook returns 404 (unknown transaction) → money collected but never applied.
- Fix: wrap provider call; on failure mark payment `FAILED` in a transaction; expose EVC availability to the UI; add a BullMQ job (deterministic jobId) to expire stale PENDING without `gatewayRef`; make `gatewayRef` unique. Complexity M. Verify: unit test with throwing provider → payment FAILED and balance free.

### FIN-005 (SW-031) — Webhook overpayment path rolls back and returns 409 forever; captured money is never recorded
- Severity: P2 · Confidence: CONFIRMED (code) · Module: Payments/webhook
- Evidence: `services/payment.service.ts:103-104` throws `PAYMENT_FAILED 409` inside the transaction when `paidAmount + payment.amount > total` (possible if a manual payment was recorded with a reservation bypass, or invoice total changed). Payment stays PENDING, provider retries receive 409, no alert/notification.
- Fix: record the payment as COMPLETED with an `overpaid`/credit flag or `NEEDS_REVIEW` status and alert finance; never discard a settled provider charge. Complexity M.

### FIN-006 (SW-032) — Invoice line totals are not rounded before summing; subtotal can disagree with stored lines; large values crash with 500
- Severity: P2 · Confidence: CONFIRMED · Module: Invoices
- Evidence: `invoice.service.ts:137` `lineTotal: quantity.mul(unitPrice)` (up to 4 dp) stored into `Decimal(12,2)` (Postgres rounds), while `subtotal` sums unrounded values (`:140`). Demonstrated: two lines 0.25×0.10 store `0.03` each (sum 0.06) but subtotal stores `0.05`. Validation allows `quantity`/`unitPrice` up to 9,999,999,999.99 each (`packages/shared/src/schemas/invoice.ts` `moneyString`) → product overflows `Decimal(12,2)`: demonstrated `numeric field overflow`, surfacing as generic 500. No `dueDate >= issueDate` check.
- Fix: `toDecimalPlaces(2, ROUND_HALF_UP)` per line before summing; bound quantity×price and total server-side; add date ordering refine. Complexity S. Verify: unit tests for rounding and overflow → 400.

### FIN-007 (SW-033) — Invoices and payments are outside the ledger; revenue exists in two unreconciled systems
- Severity: P2 · Confidence: CONFIRMED · Module: AR / ledger
- Evidence: no invoice/payment service writes `financeJournal` (grep: only `finance.service.ts` creates journals); finance dashboard basis string says so (`finance.service.ts:727-731`). Main dashboard "Revenue collected" uses `invoice.paidAmount` (`dashboard.service.ts:404-413`), finance dashboard uses posted journals. No double counting inside the ledger (CONFIRMED: payments never post), but two different "revenue" figures are shown to users. Invoice has no `currency` column (`schema.prisma:641-666`).
- Fix: post invoice issue (Dr AR / Cr Revenue) and payment (Dr Cash / Cr AR) journals; add `currency` to Invoice. Complexity L.

### FIN-008 (SW-029) — Invoice/payment endpoints bypass the finance hardening (no MFA proof, no approval, no audit log, MANAGER can record payments)
- Severity: P2 · Confidence: CONFIRMED · Module: Invoices/Payments RBAC
- Evidence: `routes/platform.routes.ts:115-126, 200-213` use only `requireAuth`+`rbac(invoices.*|payments.*)`; MANAGER holds `invoices.` and `payments.` prefixes (`seed.ts:78-104`). Manual payment is immediately `COMPLETED` (`manualBank.gateway.ts:42-58`) with no second approver and no `auditLog` (no auditLog calls in `invoice.service.ts`/`payment.service.ts`/gateways). No payment reversal/refund endpoint exists.
- Impact: a single MANAGER can mark invoices paid without 2FA and without trace beyond `recordedById`.
- Fix: require finance MFA proof for money-moving routes, audit-log create/send/void/payment, add reversal workflow. Complexity M.

### FIN-009 (SW-035) — Payroll, salaries, bonuses, allowances, AP, recurring expenses, bank reconciliation and FX not implemented
- Severity: P2 · Confidence: CONFIRMED · Module: HR/Finance scope
- Evidence: `Employee` model has no salary/bank fields (`schema.prisma:537-555`); grep for `salary|payroll` finds only a limitation string in `finance.service.ts`; no `bullmq` in any package.json and no `backend/src/jobs`; no vendor/bill/exchange-rate models. Docs correctly mark these PARTIAL/unimplemented.
- Fix: separate sub-phases (I3.x payroll, I4.x AP/recurring/FX). Complexity L.

### FIN-010 (SW-096) — Invoice OVERDUE status is written during GET requests (write-on-read), not by a scheduled job
- Severity: P3 · Confidence: CONFIRMED · Module: Invoices
- Evidence: `invoice.service.ts:93-98` `markOverdue()` called from `listInvoices`/`getInvoice` (`:101,:111`) and `dashboard.service.ts:398-401`. CLAUDE.md requires time-based work in BullMQ. Invoice list has no pagination (`invoice.service.ts:100-108`).
- Fix: BullMQ daily job with deterministic jobId; paginate list. Complexity S.

### FIN-011 (SW-119) — Project expenses/budgets are a parallel unapproved cost ledger gated by invoice permissions
- Severity: P3 · Confidence: CONFIRMED · Module: Project finance
- Evidence: `project-finance.service.ts:14-25` read/write gated by `invoices.read`/`invoices.update`; `ProjectExpense` ACTUAL rows are created directly with no approval (`:108-140`) and never reach the ledger, while `projectProfitability` reads only journals (`finance.service.ts:754-812`). `utilizationPercent` returned as `Number(...)` (`:76`). Project budget has no currency.
- Fix: route actual project costs through FinanceTransaction (EXPENSE/DIRECT_COST with projectId) or reconcile. Complexity M.

### FIN-012 (SW-120) — Segregation of duties is two-person only; approver may also post
- Severity: P3 · Confidence: CONFIRMED · Module: Approvals
- Evidence: `reviewTransaction` blocks creator self-approval (`finance.service.ts:417-421`); `postTransaction` only checks `reviewedById !== createdById` (`:450-456`), so an ADMIN who approved may post the same entry; creator may post after another's approval. No amount thresholds.
- Fix: optionally forbid `actorId === reviewedById` on post; configurable thresholds. Complexity S.

### FIN-013 (SW-034) — EVC Plus client is a generic placeholder API contract
- Severity: P2 · Confidence: SUSPECTED · Module: Payments
- Evidence: `evcplus.client.ts:36-48` posts to `${PAYMENT_EVC_API_URL}/charges` with Bearer key and expects `{transactionId}`; webhook expects `X-EVC-Signature` HMAC-SHA256 hex of the raw body (`:66-82`), payload `{transactionId,status,reference}` (`packages/shared/src/schemas/payment.ts:56-60`). No evidence this matches the real provider (Hormuud/WaafiPay) contract; no timestamp/replay window (replays are harmless because non-PENDING returns early, `payment.service.ts:88`). Signature check itself is correct (timing-safe, raw body via `express.raw`, `app.ts:66-67`).
- Fix: implement against the provider's documented API in a sandbox. BLOCKED: no provider credentials.

### FIN-014 (SW-121) — Invoice number year uses UTC
- Severity: P3 · Confidence: CONFIRMED · Module: Invoices
- Evidence: `invoice.service.ts:148` `new Date().getUTCFullYear()`; invoices created 00:00–03:00 Mogadishu on 1 January get the previous year's sequence. Numbering is otherwise race-safe (advisory lock `:151`, MAX over all rows incl. soft-deleted, `@unique` number; integration test passed).

### RPT-001 (SW-036) — Main dashboard "Revenue collected" KPI ignores the selected range and trend is misleading; USD assumed
- Severity: P2 · Confidence: CONFIRMED · Module: Dashboard
- Evidence: current value = all-time `SUM(paidAmount)` of non-void invoices (`dashboard.service.ts:404-407`), "previous" = same sum for invoices *created* before `from` (`:408-411`) — current always includes previous, so trend is always ≥ 0 and is attributed by invoice creation date, not payment date. Series sums use JS floats `Number(row.total)` (`:449-450`). Frontend formats every amount as USD with 0 decimals (`frontend/src/features/dashboard/metrics.ts:45-53`) although invoices have no currency.
- Fix: sum COMPLETED `payments.amount` by `createdAt` within range; Decimal sums serialized as strings; display currency from data. Complexity S.

### RPT-002 (SW-122) — Reports exports are CSV only; no PDF/Excel, no scheduled/emailed reports, no full financial statements
- Severity: P3 · Confidence: CONFIRMED · Module: Reports
- Evidence: `routes/reports.routes.ts:149-168` (`/:key.csv`, max 5000 rows), `finance.routes.ts:290-322` (trial-balance CSV with formula-injection guard). No `exceljs`, `@react-pdf/renderer`, `puppeteer` in backend/frontend package.json; no scheduler. Report catalog (`reports.service.ts:8-22`): projects, tasks, engineers, clients, inquiries, project-inquiries, bugs, portfolio, articles, audit, trial-balance, receivables-aging, my-projects, my-invoices. No P&L/balance sheet/cash-flow.

### RPT-003 (SW-123) — Inconsistent date-range semantics between /reports (inclusive `to`) and /finance (exclusive `to`); AR "settled as-of" uses `payments.updated_at`
- Severity: P3 · Confidence: CONFIRMED · Module: Reports
- Evidence: `reports.routes.ts:88-100` adds one day to an inclusive `to`; finance UI/API use exclusive `to` (`FinancePage.tsx:168-180`, `finance.routes.ts:82-93`). Receivables aging uses `p.updated_at < to` as the settlement time (`reports.service.ts:937`), which moves on any later update. Both Mogadishu boundaries are otherwise correct (`+3h` arithmetic).

## 4. Acceptance rows

| Feature | Status | Evidence |
|---|---|---|
| Finance dashboard loads (privileged user with MFA proof) | VERIFIED (local) | finance.integration.test 200/empty data on disposable PG |
| Finance dashboard in production | BLOCKED | no credentials; unauth probe 401; deployed UI is post-#86 |
| Dashboard error shows real cause | VERIFIED (code+prod bundle) | production chunk contains `error.message` branch |
| MFA gate (403 without proof) | VERIFIED (local) | integration test; but enrolment flow does not grant proof (FIN-001) |
| Finance RBAC role matrix (ADMIN/FM/ACCOUNTANT/PM/ENGINEER/CLIENT) | VERIFIED (local) | integration test logs: PM/ENGINEER/CLIENT 403 on 7 endpoints |
| Income/expense create→submit→approve→post | VERIFIED (local) | integration test |
| Self-approval prevented | VERIFIED (local) | integration test |
| Journals balanced (service + DB deferred trigger) | VERIFIED (local) | `assertBalanced` + `finance_journal_balanced` trigger; integration test |
| Journal immutability / reversal | VERIFIED (local) | integration test |
| Period close | PARTIAL | works, but UTC period assignment (FIN-003) |
| Trial balance + CSV | PARTIAL | unit/integration; CSV only |
| Project profitability (ledger) | VERIFIED (local) | integration test |
| Project budget/expenses | PARTIAL | unit tests; not ledger-linked (FIN-011) |
| Invoice numbering race-safe | VERIFIED (local) | payment.integration.test concurrent invoices |
| Invoice totals = sum(items) in Decimal | FAILED | rounding mismatch + overflow (FIN-006) |
| Tax/discount | PARTIAL | absolute amounts only, discount ≤ total enforced |
| Partial/full payment, overpayment block, status PARTIAL/PAID | VERIFIED (local) | payment.integration.test concurrent payments |
| Idempotency-Key on payments | VERIFIED (unit) | payment.service.test replay/mismatch |
| EVC Plus webhook signature + dedup | PARTIAL | HMAC verified in unit test; provider contract unverified (FIN-013) |
| EVC failure handling | FAILED | orphan PENDING (FIN-004) |
| Reconciliation invoice↔ledger | NOT IMPLEMENTED | FIN-007 |
| AR aging | PARTIAL | row-level, no currency |
| AP | NOT IMPLEMENTED | — |
| Payroll/salaries/bonuses/allowances | NOT IMPLEMENTED | FIN-009 |
| Cash/bank accounts | PARTIAL | ASSET balances only, no cash/bank classification |
| Recurring expenses (BullMQ) | NOT IMPLEMENTED | no bullmq |
| Multi-currency/FX (USD/SOS) | NOT IMPLEMENTED | per-currency grouping only |
| Financial audit logs | PARTIAL | ledger actions audited; invoices/payments not (FIN-008) |
| Financial notifications | NOT IMPLEMENTED | only invoice-sent email |
| Soft-delete of financial records | PARTIAL | `deletedAt` on Invoice/Payment/ProjectExpense; journals immutable; no delete endpoints |
| Reports catalog + CSV export | PARTIAL | unit tests; no PDF/Excel/scheduled |
| Main dashboard revenue KPI | FAILED | RPT-001 |

Test counts: unit 73/73 pass (11 files); integration finance 9/9 pass, payment 1/1 pass (disposable DBs created and dropped).

## Note on the migration count

Section 1 above says "all 45 migrations applied". The repository at `4323f55` contains **55** migration directories, which the database and QA agents applied; the finance integration results are unaffected (`prisma migrate deploy` applies every directory present).
