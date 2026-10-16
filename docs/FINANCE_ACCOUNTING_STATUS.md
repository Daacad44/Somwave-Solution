# Financial management and accounting — implementation status

Snapshot: 16 October 2026. This is a local implementation review. No production
data, migration, or Coolify deployment was changed. **The 24-module acceptance
request is not complete.** Existing invoices, payments and project expenses
remain in their original tables and are not silently represented as posted
accounting revenue or costs.

Invoice and payment integrity fixes completed in the current implementation are
documented in [FINANCE_BUG_REGISTER.md](FINANCE_BUG_REGISTER.md). They cover
invoice numbering, payment idempotency and authorization, concurrent settlement,
pending balance reservations, void rules and unsupported gateway methods. They
do not reconcile these legacy records into the general ledger.

## Existing system and new foundation

The repository already had client invoices, payment records and gateway
webhooks, basic project budgets and planned/actual project expenses, employee
profiles and timesheets, RBAC, audit logs, notifications and Resend delivery.
It did not have a chart of accounts, a general ledger, period closing, vendor
bills, payroll, bank reconciliation, or financial statements.

The additive migration `20261016120000_finance_ledger_foundation` creates
finance accounts, monthly periods, immutable finalized journals and lines, and
income/expense transactions. It also adds finance permissions and the
`FINANCE_MANAGER` and `ACCOUNTANT` roles without changing existing financial
records. Finance managers manage accounts and approve transactions; accountants
create and post approved transactions. Existing `ADMIN` and `SUPER_ADMIN`
roles retain their administrator privileges. The follow-up additive migration
`20261016130000_finance_mfa_session_proof` records 2FA challenge proof on
refresh sessions. Every finance API request requires a signed session that
passed the 2FA challenge, including requests by administrators. Older sessions
must sign in again through 2FA to access finance.
The third additive migration, `20261016140000_finance_account_metadata_guard`,
prevents historical chart-of-accounts reclassification once an account has
journal lines.

The new workflow is draft/edit/cancel → submit → approval by a different user → posted
balanced journal. Rejections return to the creator. A reversal creates a new
journal in the current open period; posted lines cannot be edited or deleted.
PostgreSQL checks positive single-sided lines and defers the balance check
until commit. Posting and period closing lock the same period row. Every
currency is balanced and reported separately with decimal arithmetic.
Duplicate manual transaction references and source journal pairs are unique.
New finance actions write audit logs.

The Finance screen provides a posted-journal overview, transaction workflow,
approval queue, chart of accounts, project profitability from explicitly
project-linked journals, period trial balance, journal drill-down and CSV
export. Figures are labeled with their scope. A cash transaction does not
establish that external funds have cleared a bank or gateway.

## Requirement-by-requirement gap analysis

| Phase | Status | Remaining acceptance |
| --- | --- | --- |
| 1 Dashboard | PARTIAL | Posted revenue, expense, net profit and balance proof exist per period/currency. Cash/bank, AR/AP, payroll, budget KPIs and requested charts need authoritative integration. |
| 2 Income | PARTIAL | Manual income draft/edit/cancel, category, client/project links, approval and posting exist. Attachments, history filters and invoice/payment reconciliation remain. |
| 3 Expenses | PARTIAL | Manual expense draft/edit/cancel, category, project/client links and approval exist. Vendors, employees, attachments, recurrence, payment states and complete history remain. |
| 4 Project budgets | PARTIAL | Existing budget revisions and planned/actual project expenses remain. Allocations, commitments, approval and thresholds remain. |
| 5 Project tracking | PARTIAL | Posted project-linked direct income/cost report exists. Labor, purchases, infrastructure, overhead and existing project expense reconciliation remain. |
| 6 Client invoices | PARTIAL | Existing invoice issue/send/partial/paid/void and items remain. Ledger posting, currency, credit notes, corrections and PDF/email evidence need review. |
| 7 Payments | PARTIAL | Existing manual/EVC payment flows remain. Multiple allocations, outgoing payments, refunds and settlement verification remain. |
| 8 Receivables | PARTIAL | Existing invoice due dates and paid amounts remain. Aging, reminders, collection history and credit notes remain. |
| 9 Payables | NOT STARTED | Vendor bills, approval, partial settlements and aging. |
| 10 Salaries | NOT STARTED | Salary profiles, payroll periods, approval, posting and payslips. |
| 11 Allowances | NOT STARTED | Bonuses, overtime, reimbursements, deductions and payroll integration. |
| 12 Cash/bank | PARTIAL | Asset accounts and direct journals exist. Transfers, opening balances and reconciliation remain. |
| 13 Transaction history | PARTIAL | Posted journals and manual finance transactions now have server-side pagination and date, account, currency, type/source and search filters. Legacy invoice/payment events are not reconciled into ledger history. |
| 14 Approvals | PARTIAL | Independent income/expense approval exists. Configurable thresholds, levels and other entity approvals remain. |
| 15 Recurring expenses | NOT STARTED | Schedules, draft generation, deduplication and alerts. |
| 16 Profitability | PARTIAL | Direct posted project revenue/costs, gross/net result and margin exist. Labor, overhead, budget variance and legacy record reconciliation remain. |
| 17 Reports | PARTIAL | Period trial balance and project profitability exist. Full statements, AR/AP, cash flow, forecast, salary and reconciliation reports remain. |
| 18 Documents | PARTIAL | Existing protected document/storage module remains. Finance document ownership and links remain. |
| 19 Alerts | NOT STARTED | Finance-specific due-date/approval/budget/recurrence notifications. |
| 20 Audit | PARTIAL | New finance actions are logged. Full before/after coverage, source IP and legacy finance audit remain. |
| 21 Multi-currency | PARTIAL | Three-letter currency per account/transaction/journal and separate decimal-safe totals exist. Rate registry, conversion and FX gain/loss remain. |
| 22 RBAC | PARTIAL | Dedicated finance roles and server checks exist. Payroll/bank-specific scopes and full role penetration tests remain. |
| 23 Export | PARTIAL | Permission-gated, period-filtered trial balance CSV exists. PDF, Excel and print-ready reports remain. |
| 24 Integration | PARTIAL | Transactions link to existing client/project records and reuse auth/audit. Invoice, payment, HR, portal and procurement accounting integration remain. |

Additional accounting criteria: balanced immutable double-entry journals,
chart of accounts and monthly close are implemented locally. Annual close,
bank reconciliation, payroll, credit notes/refunds, forecasting, tax
configuration, FX and full statement reconciliation are outstanding.

## Verification and production gate

The additive migration applied to a fresh local PostgreSQL database. A
disposable integration test covered maker/reviewer separation, exact decimal
posting, reversal, rejection of journal mutation and imbalance, and closed
period posting. The repository suite passed 490 tests (the disposable-database
tests are skipped in ordinary runs); the separate PostgreSQL integration tests,
typecheck, lint, formatting check and production build also passed. Browser
end-to-end testing of the new finance screen remains outstanding.

Prisma's schema comparison on that fresh database still reports two existing
`engineer_progress_reports` differences (an `updated_at` default and an
index name). They are unrelated to the finance migration, but should be
reviewed before production migration as part of the wider schema audit.

Before a production release, back up PostgreSQL, inspect all pending
migrations, deploy the API and frontend from the same commit, and verify the
new role permissions. Use only clearly identified controlled test records.
Post immutable test records should be reversed through the workflow, never
deleted. The operator should confirm a real bank/gateway settlement before
calling a payment reconciled. There is no Coolify access in this workspace,
so production deployment and live financial acceptance are blocked.

Rollback: restore the previous application images if the new UI/API fails.
Do not drop finance tables or reverse migrations after real journals exist;
the old application ignores the additive tables. Use database backup
restoration only under the approved incident process.
