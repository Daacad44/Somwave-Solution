# Finance production repair — 17 October 2026

## Diagnosis and evidence

The affected request is `GET /api/v1/finance/dashboard?from=YYYY-MM-DD&to=YYYY-MM-DD`.
The previous UI replaced every API failure with “Could not load finance dashboard”, obscuring authorization, validation and server errors alike. The actual production exception cannot be established without an authenticated production request and matching Coolify API logs; production access has not been provided. No production database or financial record was changed.

A disposable local PostgreSQL database reproduced a precise authorization failure: a SUPER_ADMIN enrolled in 2FA but whose access token lacks an MFA challenge proof receives HTTP 403. Finance correctly requires both enrollment and session proof. This protection remains enforced. An ENGINEER with an MFA proof receives HTTP 403 for insufficient permissions. A SUPER_ADMIN with valid proof receives HTTP 200 from the same endpoint using real PostgreSQL queries, including an empty historical interval. This is evidence for these local conditions, not a claim about the production cause.

Confirmed defects repaired:

- Dashboard error handling now displays the safe API error and retains Retry, distinguishing missing MFA proof from a server failure.
- Reporting and history date inputs previously used UTC midnight. All finance dashboard, trial-balance, project-profitability and history date filters now use midnight in Africa/Mogadishu (UTC+03), inclusive start and exclusive end. Impossible, reversed, equal, empty and repeated ranges are rejected or prevented in the UI.
- Transaction creation/display/editing now uses that same local date. Editing without changing the date preserves its exact existing timestamp. No historical posted timestamps or accounting-period records are rewritten. Existing accounting-period closing remains based on its established UTC calendar; changing historical period assignment requires a separate accounting migration/review.
- Dashboard now exposes submitted approvals in the selected interval, cumulative asset/liability account balances strictly before the end boundary, and monthly revenue/expense/net-profit trends from finalized journals. Period revenue and expenses retain decimal arithmetic and separate currencies. Reversals are included; legacy invoice payments are never added as a second revenue stream.
- Finance request diagnostics include a request ID, stable endpoint, live user roles, status, duration and safe category. Payloads, amounts, credentials and database exception details are not logged by this middleware.

## Functional coverage audit

| Module | Status | Evidence / remaining work |
| --- | --- | --- |
| Dashboard | PARTIAL | Real PostgreSQL 200, empty results, exact half-open boundaries, decimal sums, monthly trends; production cause/access remains unverified. |
| Transactions / income / expenses | VERIFIED locally for existing workflow | Create/edit/submit/independent approve/post/cancel; pagination and filters; posted history remains immutable. |
| Approvals | VERIFIED locally for existing workflow | Self-approval rejected; submitted approval count; configurable thresholds remain absent. |
| Project finance | PARTIAL | Existing budget revisions and planned/actual expenses; posted project profitability regression passes. Labor/overhead reconciliation remains absent. |
| Chart of Accounts | VERIFIED locally for existing workflow | Account creation/classification; database prevents historical account reclassification. |
| General Ledger | VERIFIED locally for existing workflow | Balanced exact-decimal posting, reversal, closed-period protection and immutable journal database triggers tested. |
| Invoices / payments | PARTIAL | Existing unit regressions pass for partial/full payments, duplication prevention, void restrictions and payment-provider boundaries. Legacy invoice currency metadata and ledger reconciliation remain absent. |
| Accounts receivable | PARTIAL | Existing row-level aging reports remain; invoices have no authoritative currency field, so no fabricated currency total is added to dashboard. |
| Accounts payable | PARTIAL / unimplemented | No vendor-bill and settlement workflow exists in current schema. Liability balances cannot safely substitute for trade payables. |
| Payroll | PARTIAL / unimplemented | No payroll period/approval/posting/payslip workflow exists. Employee records alone do not establish salaries owed. |
| Cash / bank | PARTIAL | Asset balances are real, but account schema has no cash/bank classification. Dashboard labels them as asset/liability balances. No fabricated cash or bank total. |
| Recurring expenses | PARTIAL / unimplemented | No recurrence schedule/generation/deduplication workflow exists. |
| Financial reports | PARTIAL | Trial balance, project profitability, receivables and posted trends exist. Full financial statements and reconciliation remain absent. |
| Financial documents | PARTIAL | Existing protected document storage remains; dedicated finance document links remain absent. |
| Multi-currency | PARTIAL | Ledger preserves and balances each currency separately. No exchange-rate conversion or currency inference for legacy invoices/budgets. |
| Finance RBAC | VERIFIED locally for tested endpoints | Missing MFA proof and ENGINEER denied; SUPER_ADMIN with proof allowed. The explicit role matrix also exercises ADMIN, FINANCE_MANAGER, ACCOUNTANT, PROJECT_MANAGER, ENGINEER and CLIENT with valid MFA proofs against seven company-finance read endpoints. Approver/poster separation is also exercised using nonexistent record IDs: ADMIN may approve/post, FINANCE_MANAGER may approve but cannot post, ACCOUNTANT may post but cannot approve, and nonfinance roles cannot do either. Permission fixtures mirror the existing seed policy; this does not verify production role assignments. Existing finance permission middleware remains unchanged. |
| Finance notifications | PARTIAL | Audit logs preserved; dedicated finance due/approval/budget alerts remain absent. |

## Executed verification

- 17 focused finance schema, balance, history and route unit tests passed.
- 46 existing invoice, payment, project-finance and reports unit tests passed.
- 9 disposable PostgreSQL integration tests passed: refresh-proof regression; balanced posting/reversal/immutability/closed periods and exact half-open dates; actual dashboard HTTP 200/400/403 authorization and empty data; six role-matrix cases covering seven finance read endpoints and approval/posting restrictions.
- 6 desktop/mobile Playwright checks passed for empty data, invalid ranges, MFA error/retry and local-date display/edit round trips. They use intercepted API fixtures, so they verify UI behavior rather than real production connectivity.
- Backend and frontend TypeScript checks and the frontend production build passed. Finance-file ESLint passed.

Database tests require a new disposable local database each run because they intentionally close accounting periods and retain immutable journal history. They never reset or truncate a database. Use `FINANCE_TEST_DATABASE_URL` with the matching `DATABASE_URL` test configuration. No finance migration was needed.

## Production verification / rollback

Required access: existing Coolify API service logs, deployed commit and migration status; a permitted finance account with successful MFA challenge. Capture the request's status/error envelope and request ID, then correlate the API log. Check all existing migrations are applied before deploying regenerated Prisma clients. Never use reset or force-push schema operations.

Back up the production database before any separately coordinated additive auth migration. Verify health, MFA login, dashboard, all six finance tabs and representative existing financial records after deployment. Roll back to the prior application image if verification fails; retain additive schema and all newly written financial records. Never delete or rewrite posted journals to roll back application code.
