# Financial Management — gap analysis and delivery plan

Snapshot: 18 October 2026, branch `feat/enterprise-financial-management`.
Basis: the 17 October system audit (`docs/audit/FINANCE_AUDIT.md` on
`chore/system-audit-2026-10`), a fresh read of the current code and Prisma
schema, and the tests run for this change.

Status values: **VERIFIED** (exercised by a passing automated test against
PostgreSQL or the HTTP route), **PARTIAL** (some of the requirement exists),
**NOT IMPLEMENTED** (no model, endpoint or screen), **BLOCKED** (needs access or
a decision we do not have). Nothing here was verified against production.

## 1. Root cause: "Something went wrong — Could not load finance dashboard."

The dashboard request (`GET /api/v1/finance/dashboard`) passes three gates:
`requireAuth`, `requireFinanceTwoFactor` and `rbac('finance.read')`. The second
gate requires that the _session_ proved two-factor authentication
(`mfaVerifiedAt` on the access/refresh token), not merely that the account has
2FA switched on.

Confirmed in code:

1. Privileged roles are forced to enrol in 2FA right after login. Enrolment
   (`confirmTwoFactorEnrolment`) switched 2FA on but kept the existing session,
   whose `mfaVerifiedAt` is null. Every finance request then returned **403**
   until the user signed out and back in.
2. Sessions created before migration `20261016130000_finance_mfa_session_proof`
   carry a null proof forward on every 30-day refresh, so they never gain access.
3. Before PR #86 the page rendered the fixed text "Could not load finance
   dashboard." for every error, hiding the 403 and its message.

Fixed in this change:

- Enrolment now issues a replacement session with MFA proof
  (`auth.service.ts` `confirmTwoFactorEnrolment`, cookies set by the controller).
- New `POST /api/v1/auth/2fa/step-up` re-verifies a TOTP or backup code for a
  signed-in user and issues a session with MFA proof (rate-limited per IP).
- The finance 403 now carries `details.reason`
  (`FINANCE_MFA_STEP_UP_REQUIRED` or `FINANCE_2FA_NOT_ENROLLED`), and the finance
  page shows a code prompt (or a link to security settings) instead of an error.

Not verifiable here: the exact response production returned to the user
(no production credentials or logs). The error handler now logs the error name,
Prisma code and stack frames for any 500, so a different cause would be visible
in the Coolify logs.

## 2. Other defects fixed in this change

| ID | Defect | Fix | Evidence |
| --- | --- | --- | --- |
| FIN-002 | Unexpected 500s were logged with no error name, code or stack, so production failures could not be diagnosed | `errorDiagnostics()` logs name, Prisma code, model/column/constraint names and stack frames; never the message or values | `errorHandler.test.ts` (5 tests) |
| DB-006 | Prisma unique (P2002) and not-found (P2025) errors returned 500 | Mapped to 409 and 404 | `errorHandler.test.ts` |
| FIN-003 | Accounting periods used the UTC month; an entry dated the 1st (00:00 Mogadishu = 21:00 UTC the day before) went to the previous, possibly closed, period | `periodOf`/`periodBounds` use UTC+03:00; migration `20261018100000_finance_period_business_calendar` replaces the DB guard function (function body only, no data changed) | New integration test: close March, post 1 April, posts successfully |
| FIN-004 | A rejected EVC Plus charge left its PENDING payment reserving the amount forever, blocking the invoice | Explicit provider rejection marks the payment FAILED; network errors/timeouts stay PENDING for the webhook; 20-second request timeout added | `evcplus.gateway.test.ts` (3 tests) |

## 3. The 24 modules

| # | Module | Status | What exists | What is missing |
| --- | --- | --- | --- | --- |
| 0 | Accounting foundation | **VERIFIED** (core) | `FinanceAccount` (ASSET, LIABILITY, EQUITY, REVENUE, DIRECT_COST, EXPENSE), `FinanceJournal`/`Line`, `FinancePeriod`; balanced journals enforced in service and by deferred DB trigger; posted journals immutable; reversal entries; period close; idempotent posting | Bank reconciliation; account edit/deactivate endpoint |
| 1 | Financial dashboard | **PARTIAL** | Posted-ledger totals by currency, pending approvals, account balances for a date range; 2FA access fixed here | Cash vs bank split, AR/AP totals, budget utilisation, trend and cash-flow charts, alerts |
| 2 | Income management | **PARTIAL** | `FinanceTransaction` type INCOME with category, project, client, reference, approval and posting | Income sources list, payment method, attachments, search across all fields |
| 3 | Expense management | **PARTIAL** | Type EXPENSE with DRAFT → SUBMITTED → APPROVED/REJECTED → POSTED; self-approval blocked | Vendor link, receipt upload, recurring link |
| 4 | Project budgets | **PARTIAL** | `Project` budget plus `ProjectBudgetRevision` history; `ProjectExpense` | Budget categories, commitments, approval workflow, alerts; budgets are not in the ledger |
| 5 | Project financial tracking | **PARTIAL** | Ledger-based project profitability report; project finance service | Labour/engineer cost from timesheets, receivables per project |
| 6 | Client invoices | **PARTIAL** | Draft, unique invoice numbers (per-year lock), items, tax, discount, send, void, partial payments, overdue | Currency field, line rounding fix (FIN-006), payment terms, PDF, Resend delivery, ledger posting |
| 7 | Payments | **PARTIAL** | Manual and EVC Plus payments, idempotency key, overpayment lock, webhook HMAC; FAILED handling added here | Outgoing payments, refunds, reversals, reconciliation, ledger posting |
| 8 | Accounts receivable | **PARTIAL** | Receivables-aging report from invoices and payments | Client balance view, collection history, reminders |
| 9 | Accounts payable | **NOT IMPLEMENTED** | — | Vendor, vendor bill, payable aging, scheduling |
| 10 | Engineer salaries / payroll | **NOT IMPLEMENTED** | `Employee` record without salary fields | Salary profile (encrypted), pay runs, deductions, advances, payslips, approval |
| 11 | Allowances and bonuses | **NOT IMPLEMENTED** | — | Models, approval, payroll integration |
| 12 | Cash and bank accounts | **PARTIAL** | ASSET ledger accounts can represent cash/bank | Opening balances, transfers, statements, reconciliation, masked bank details |
| 13 | Transaction register | **PARTIAL** | Paginated transaction and journal history with filters; trial balance CSV | Amount/currency/reference filters, combined register, export permissions |
| 14 | Financial approvals | **PARTIAL** | Two-person rule on transactions | Thresholds, levels, return for revision, comments, other document types |
| 15 | Recurring expenses | **NOT IMPLEMENTED** | Jobs are in-process `setInterval` timers; no BullMQ | Schedule model, idempotent draft generation, pause/resume |
| 16 | Project profitability | **PARTIAL** | Ledger revenue and cost per project | Labour cost, allocated overhead, budget variance, forecast vs actual |
| 17 | Financial reports | **PARTIAL** | Trial balance, receivables aging, project profitability, general ledger | Income statement, balance sheet, cash flow, budget vs actual, salary, AP |
| 18 | Financial documents | **NOT IMPLEMENTED** for finance | Private storage and ImageKit adapter exist | Attachments on transactions, invoices and bills |
| 19 | Notifications and alerts | **PARTIAL** | Durable notification queue with dedup and Resend | Finance-specific alert rules |
| 20 | Financial audit log | **PARTIAL** | `AuditLog` written for postings, reversals and period close | Coverage of invoice/payment mutations, masking, finance audit view |
| 21 | Multi-currency | **PARTIAL** | Currency stored per ledger account and transaction; totals grouped by currency | Exchange-rate table, base-currency conversion, FX gain/loss |
| 22 | Financial RBAC | **PARTIAL** | `finance.read/create/approve/post/manage`; FINANCE_MANAGER and ACCOUNTANT roles; 2FA gate | MANAGER project-level view, salary/bank-specific permissions, per-role HTTP tests for invoices/payments |
| 23 | Export and print | **PARTIAL** | CSV for trial balance and reports | PDF, Excel, print views |
| 24 | Cross-module integration | **PARTIAL** | Projects and clients linked on transactions and invoices | Invoices/payments → ledger, HR → payroll, procurement and sales do not exist as modules |

## 4. Delivery plan

The project rules (CLAUDE.md §16) cap a pull request at about 400 lines and
require each sub-phase to be a full vertical slice (schema → migration →
service → route → UI → tests). The work is therefore split:

| PR | Scope | Depends on |
| --- | --- | --- |
| **F0 (this PR)** | Dashboard root cause, error diagnostics, period calendar, EVC failure handling, this gap analysis | — |
| F1 | Invoices and payments post to the ledger (AR control account); invoice currency; line rounding fix | F0 |
| F2 | Vendors, vendor bills, payable aging, outgoing payments | F1 |
| F3 | Exchange-rate table, rate persisted on each posting, base-currency reporting | F1 |
| F4 | Financial documents on transactions, invoices and bills (private storage, ImageKit for images) | F0 |
| F5 | Income statement, balance sheet, cash flow, budget vs actual; Excel and PDF export | F1–F3 |
| F6 | Approval thresholds and levels across finance documents | F2 |
| F7 | Recurring expense schedules with idempotent job runner | F2, F6 |
| F8 | Payroll: encrypted salary profiles, pay runs, allowances, bonuses, payslips | F6; needs decisions below |
| F9 | Dashboard KPIs and charts over the completed ledger; finance alerts | F1–F8 |

## 5. Decisions needed before payroll and accounting reports

1. Is there a statutory payroll or accounting report format to follow
   (open question in CLAUDE.md §18)?
2. Base currency: CLAUDE.md assumes USD with SOS for display. Confirm USD as the
   ledger base and the source for USD/SOS rates (manual entry or a provider).
3. Which roles may see salaries and bank details? The current policy gives
   ADMIN no automatic access; confirm.
4. Is `I4` the system of record, or must it reconcile with an external
   accounting system?
