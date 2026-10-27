# I8 — Project Finance Integration: implementation plan

Status: **APPROVED 27 October 2026** with the decisions recorded in §9. Where §9 differs from §1–§8, §9 wins.

Snapshot: 27 October 2026, `main` at `403ab19`.

Files read for this plan: `CLAUDE.md`, `backend/prisma/schema.prisma`, `packages/shared/src/constants/{permissions,roles}.ts`, `backend/prisma/seed.ts`, `backend/src/{server,worker,background-jobs}.ts`, `backend/src/services/{payment,invoice,timesheet,engineering,engineering-worklog,finance,project-finance}.service.ts`, `backend/src/payments/**`, `backend/src/lib/{audit,idempotency,env}.ts`, `backend/src/routes/finance.routes.ts`, `docs/COMPLETION_AUDIT.md`, `docs/FINANCE_ACCOUNTING_STATUS.md`, `docs/FINANCE_BUG_REGISTER.md`.

---

## 1. Conflicts between the I8 prompt and the codebase (decisions needed)

The prompt was written against an older picture of the repo. These conflicts need a ruling before I start. Each one has a recommendation. **I will follow the recommendations unless you say otherwise.**

| # | Prompt says | Codebase reality | Recommendation |
|---|---|---|---|
| C1 | New ledger models: `LedgerAccount`, `JournalEntry`, `JournalLine`, `AccountingPeriod` | A double-entry ledger is already in production code (migration `20261016120000_finance_ledger_foundation`): `FinanceAccount`, `FinanceJournal`, `FinanceJournalLine`, `FinancePeriod`. It already has DB-level checks for positive single-sided lines, a deferred balance check at commit, period locking, reversals, a trial balance, a finance dashboard, project profitability, and a 2FA-gated `/api/v1/finance` router. | **Extend the existing ledger. Do not add a second one.** Two ledgers would give two trial balances. I8.5 adds the missing fields to the existing models (§3.5). The prompt's names stay as concepts only. |
| C2 | `JournalEntry.eventId @unique` for idempotency | `FinanceJournal` has `@@unique([sourceType, sourceId])`. That only allows one journal per source, but `time.approved` posts two (cost and WIP) and `invoice.issued` posts two (AR/revenue and WIP reversal). | Add `eventId String? @unique` and `postingRule String?`. Replace the unique key with `@@unique([sourceType, sourceId, postingRule])`. Existing rows get `postingRule = 'LEGACY'`. |
| C3 | Ledger lines in base currency (USD) with `fxAmount` | Existing journals have one `currency String` each and are balanced per currency. There is no base-currency conversion. | Post I8 journals with `currency = 'USD'` (base). Add `fxCurrency`/`fxAmount` columns to the lines for the original-currency amount. Leave existing non-USD manual journals as they are. Report them separately, the way the trial balance already does. |
| C4 | Money columns `Decimal(14,2)` | `CLAUDE.md` §7 says `Decimal(12,2)`. The existing ledger uses `Decimal(20,2)`; invoices and payments use `(12,2)`. | `CLAUDE.md` wins on conventions, but `(12,2)` caps out at 9,999,999,999.99, which is enough. **Recommendation: new I8 money columns use `Decimal(14,2)` as the prompt says, and `CLAUDE.md` §7 gets a one-line amendment.** Existing columns are not widened in I8. Rates `(12,4)` and FX `(18,8)` are new and don't conflict. **This needs your explicit OK because it amends `CLAUDE.md`.** |
| C5 | `Expense` model, new | `ProjectExpense` (PLANNED/ACTUAL, no approval, no currency) already feeds `GET /projects/:id/finance`. `FinanceTransaction` (type EXPENSE) is the manual expense workflow with approval and posting. | Add `Expense` as the single source for actual costs. Migrate `ProjectExpense` ACTUAL rows into it as `APPROVED`, flagged `legacy = true` and **not posted** to the ledger (matching the existing rule that legacy records are not silently posted). PLANNED rows become budget lines on the contract (§3.2). `project_expenses` becomes read-only. `FinanceTransaction` stays for non-project manual income/expense and becomes the backing for `POST /ledger/adjustments`. |
| C6 | I8.0 §3.1: "`applyEvcWebhook` reads `PENDING` outside the transaction" | Already fixed (FIN-04 in `FINANCE_BUG_REGISTER.md`). The invoice row is locked `FOR UPDATE` and the payment is re-read inside the transaction. A parallel-callback test exists in `payment.integration.test.ts`. | Keep the fix. Add the prompt's guarded `updateMany({ where: { id, status: 'PENDING' } })` claim and `paidAmount: { increment }` as defence in depth in both the EVC and manual gateways. Keep the existing test and add a parallel duplicate-webhook case if one is missing. Small change. |
| C7 | I8.0 §3.2: "create `backend/src/worker.ts`" | `worker.ts` exists. It runs `startBackgroundJobs()` (`setInterval` timers: notifications, SLA, health, reminders). `server.ts` also runs them unless `BACKGROUND_WORKERS_ENABLED=false`, which defaults to `true`. **BullMQ is not installed.** | Add `bullmq` to `backend` (it is in the `CLAUDE.md` §4 stack, so it isn't a stack change, but §2 says to ask before adding a package: **please confirm**). Convert the four loops to BullMQ repeatable jobs in `worker.ts`. Remove `startBackgroundJobs` from `server.ts` and drop `BACKGROUND_WORKERS_ENABLED`. |
| C8 | `AuditLog` gets `before`, `after`, `metadata`, `ip` | `before`, `after`, `correlationId` already exist. `writeAudit()` uses the global client, not a transaction. | Add `metadata Json?` and `ip String?`. Add `recordAudit(tx, …)` next to `writeAudit` in `lib/audit.ts`. |
| C9 | Schedules in Africa/Nairobi | `CLAUDE.md` §17 and the ledger's period logic use Africa/Mogadishu. Both are UTC+3 with no DST. | Use **Africa/Mogadishu** for consistency. The firing times are identical either way. |
| C10 | Schema files `backend/prisma/schema/<domain>.prisma` (`CLAUDE.md` §6) | The repo uses one `backend/prisma/schema.prisma`. | Keep the single file, add a `// ── Finance (I8) ──` section, and don't restructure. |
| C11 | Permissions list includes `finance.read` | Exists already, along with `finance.create/approve/post/manage`, roles `FINANCE_MANAGER`, `ACCOUNTANT` and `PROJECT_MANAGER`, and 2FA for all of them. | Add only the new keys (§5) and map them onto the existing roles. |
| C12 | `Project.budget` → `ProjectContract.budgetAmount` | `ProjectBudgetRevision` audits budget changes and is shown in the UI. | Migrate `budget` into `budgetAmount`. Future revisions write `ProjectBudgetRevision` against the contract. `Project.budget` stays as a read-only column until a cleanup PR. |
| C13 | Timesheet → TaskTimeEntry migration | `Timesheet` is keyed by `employeeId`. `TaskTimeEntry` is keyed by `userId` and `taskId`. Engineers already correct time through `TaskTimeEntryRevision`. | Map `employee.userId`. Corrections stay allowed only while the entry is `DRAFT`/`REJECTED`, and the revision trail is kept. Timesheets without a `projectId` can't be attached to a task: they stay in `timesheets` (read-only) and are listed in the migration report. **Decision: is that acceptable, or do you want an internal "Company overhead" project for them?** |
| C14 | PR size ≤ 400 LOC (`CLAUDE.md` §16) | I8.4, I8.5 and I8.7 will each exceed that. | Split each into stacked PRs, e.g. `I8.4a` invoices + credit notes and `I8.4b` retainers. Proposed splits are in §6. |
| C15 | Branch per sub-phase `feat/I8.x-…` | This session is configured to develop on `main`. | This plan is committed to `main`. **Confirm whether I8.x work should go on `feat/I8.x-*` branches with PRs, as the prompt says.** |

---

## 2. Event catalogue

Events are written with `emitEvent(tx, type, aggregateId, projectId, payload)` in the same transaction as the change. Handlers dedupe on `DomainEvent.id`.

| Type | Emitted by (file) | Payload (minimum) |
|---|---|---|
| `time.approved` | `time-entry.service.ts` approve / bulk-approve | `entryId, projectId, userId, minutes, billable, costRate, billRate, currency` |
| `time.rejected` | same | `entryId` (no posting; notify only) |
| `milestone.accepted` | `milestone.service.ts` (verified + all tasks QA'd) and the portal client-accept path | `milestoneId, projectId, acceptedById, via: 'QA' \| 'CLIENT'` |
| `expense.approved` | `expense.service.ts` | `expenseId, projectId?, baseAmount, billable` |
| `expense.paid` | `expense.service.ts` mark-paid | `expenseId, cashAccountCode` |
| `invoice.issued` | `invoice.service.ts` issue | `invoiceId, projectId?, clientId, source, baseTotal, timeEntryIds[]` |
| `payment.completed` | EVC webhook + manual gateway | `paymentId, invoiceId, method, amount, baseAmount` |
| `credit_note.issued` | `credit-note.service.ts` | `creditNoteId, invoiceId, baseAmount` |
| `project.status_changed` | `project.service.ts` | `projectId, from, to` |
| `budget.threshold_crossed` | snapshot handler (derived) | `projectId, threshold: 75 \| 90 \| 100, burnPercent` |

Handlers per event follow prompt §5.2 exactly. Notifications go through the existing `lib/notify.ts` and the `NotificationDelivery` queue.

---

## 3. Models and migrations

All new tables use `cuid` ids, `createdAt`/`updatedAt`, snake_case `@map` and `@@map`, and index every filter column. Enums are used where the prompt wrote `String` status fields: `ContractStatus`, `ScheduleItemStatus`, `ScheduleTrigger`, `TimeEntryStatus`, `ExpenseStatus`, `ExpenseCategory`, `InvoiceSource`, `InvoiceItemSource`, `RetainerStatus`. This follows `CLAUDE.md` §7.

### 3.0 I8.0 — migration `20261028010000_i8_0_outbox_audit`
- `AuditLog`: add `metadata Json?` and `ip String?`.
- `DomainEvent`: as in prompt §5.1, plus `status` (`PENDING|PUBLISHED|FAILED|DEAD`), `handledAt`, and `@@index([type, aggregateId])`.
- `DomainEventHandling`: `(eventId, handler) @@unique`. Each handler's completion is recorded, so one event that fans out to four handlers retries only the failed one.

### 3.1 I8.1 — migration `…_i8_1_currency_contracts`
- `enum Currency { USD SOS }`, `ExchangeRate`, `NumberSequence` (prompt §4.1).
  - Allocation: `INSERT … ON CONFLICT (key) DO UPDATE SET next_val = number_sequences.next_val + 1 RETURNING next_val - 1`, inside the caller's transaction.
  - The migration seeds `INVOICE:<year>` from the current `MAX(number)`, so the existing advisory-lock allocator in `invoice.service.ts` can be swapped without colliding with existing numbers.
- `Client`: add `billingEmail`, `address`, `taxId`, `defaultCurrency`, `paymentTermsDays`.
- `ProjectContract`, `BillingScheduleItem` (prompt §4.2), plus:
  - `ProjectContract.createdById`, and status as enum `ContractStatus`.
  - `BillingScheduleItem`: a DB `CHECK` that exactly one of `percent`/`amount` is set.
- Data step: `INSERT INTO project_contracts` for every project with a non-null `budget`: `billingModel = FIXED_FEE`, `status = DRAFT`, `budgetAmount = budget`. A PM must confirm the billing model before activating. **Decision: is DRAFT/FIXED_FEE the right default, or should those projects get no contract row?**
- `ProjectBudgetRevision`: add a nullable `contractId`.

### 3.2 I8.2 — migration `…_i8_2_rates_time`
- `CostRate`, `BillRate` (prompt §4.3), plus:
  - `BillRate`: a `CHECK` that `userId` and `memberRole` are not both null.
  - `BillRate`: a unique key on `(projectId, userId, memberRole, effectiveFrom)` with `NULLS NOT DISTINCT` (Postgres 16).
- `TaskTimeEntry`: add the fields from prompt §4.4, using the `TimeEntryStatus` enum.
  - Add `projectId` (denormalised from the task, indexed) so project finance queries don't join through tasks.
  - Add `submittedAt`, `rejectedReason`, and `@@index([projectId, status, billable])`.
- Data step (Timesheet → TaskTimeEntry):
  - For each project that has timesheets, create a task `"General / unallocated"` (`kind TASK`, `approvalStatus APPROVED`) if one doesn't exist.
  - Insert entries with `minutes = round(hours*60)`, `billable = is_billable`, and status `PENDING → SUBMITTED`, `APPROVED → APPROVED`, `REJECTED → REJECTED`.
  - Rates on migrated APPROVED entries stay null and are marked `legacy = true`. They are not posted to the ledger (C5 rule).
  - Add `legacyTimesheetId @unique` so the migration is re-runnable.
- `timesheets` becomes read-only. `timesheet.service.ts` reads and writes `TaskTimeEntry`. Endpoints and the `AdminTimesheet` shape are unchanged.

### 3.3 I8.3 — migration `…_i8_3_expenses`
- `Vendor` (+ `deletedAt`), and `Expense` (prompt §4.5) with:
  - enums for `category`/`status`, `deletedAt` (financial: soft delete only), `rejectedReason`, `paidAt`, `paidFromAccountId`, `legacy Boolean @default(false)`, `legacyProjectExpenseId @unique`.
  - `@@index([projectId, status])` and `@@index([submittedById])`.
- Data step: copy `ProjectExpense` ACTUAL rows (C5). `exchangeRate = 1`, currency USD, because all existing amounts are implicitly USD (`CLAUDE.md` §17).
- Receipts use the existing `lib/storage.ts` with magic-byte MIME checks, 25 MB, and a private key served through a presigned/streamed route.

### 3.4 I8.4 — migration `…_i8_4_invoicing`
- `Invoice` gets the prompt §4.6 fields, `source` as the `InvoiceSource` enum, and `draftedById`. A DB `CHECK (source = 'MANUAL' OR project_id IS NOT NULL)`.
- Existing invoices are backfilled with `currency USD`, `exchangeRate 1`, `baseTotal = total`, `source MANUAL`, and `issuedAt = created_at` for non-DRAFT invoices.
- `InvoiceItem` gets `sourceType`, `sourceId`, `projectId`, and `@@index([sourceType, sourceId])`.
- `CreditNote` (prompt §4.6) with `currency`, `exchangeRate`, `baseAmount`, `idempotencyKey @unique`. `CreditNoteSequence` uses `NumberSequence` `CN:<year>`.
- `RetainerAgreement` (prompt §4.6) with a `CHECK billing_day BETWEEN 1 AND 28`.
  - The idempotency guard is a separate `RetainerInvoice (retainerId, period) @@unique` row created in the same transaction as the draft invoice. A single `lastInvoicedPeriod` column can't express "billed exactly once" under concurrency. `lastInvoicedPeriod` is kept as a denormalised display field.
- Issued invoices are frozen by a Postgres trigger that rejects `UPDATE` of items, totals or currency when status ≠ DRAFT. This is enforced in the service and tested.

### 3.5 I8.5 — migration `…_i8_5_ledger_extensions` (extends the existing ledger, per C1–C3)
- `FinanceJournal`: add `eventId String? @unique` and `postingRule String?`. Swap the unique key to `(sourceType, sourceId, postingRule)`. Backfill `postingRule = 'LEGACY'`.
- `FinanceJournalLine`: add `fxCurrency String?` and `fxAmount Decimal(20,2)?`. `projectId`/`clientId` already exist.
- `FinanceAccount`: seed the I8 accounts if absent:
  - Assets: 1000 Cash, 1010 EVC Wallet, 1100 AR, 1200 Unbilled WIP.
  - Liabilities: 2000 AP. (No 2100 Accrued Payroll; see §9 D6.)
  - Revenue: 4000 Project Revenue, 4050 WIP Revenue, 4100 Retainer Revenue, 4900 Credit Notes (contra-revenue).
  - Costs and expenses: 5000 Labour Cost, 5100 Project Expenses, 5900 Labour Cost Allocated (contra-expense), 6000 Overhead Expenses.
  - Seeded by code. If a code is already used by a different account type, the migration fails loudly instead of re-purposing it.
- Insert-only is enforced by a trigger that blocks `UPDATE`/`DELETE` on `finance_journal_lines`, and on `finance_journals` once finalized. The existing code already has no update path.
- `FinancePeriod` is reused as is. "Posting into a CLOSED period moves to the current open period" is **new behaviour**: today `lockOpenPeriod` rejects the posting. For event-driven postings I will date the journal on the first day of the current open period and record the original date in `memo`/metadata. Manual postings keep the existing rejection.

### 3.6 I8.6 — migration `…_i8_6_snapshot`
- `ProjectFinancialSnapshot` (prompt §4.8), `healthStatus` as an enum, plus `@@index([healthStatus])`.

### 3.7 Posting rules — `backend/src/finance/postingRules.ts`
A table-driven map from `(eventType, variant)` to `{ debit: code, credit: code, dimension: 'project'|'client'|'both' }`, exactly as prompt §4.7. Not covered by the prompt, and needing decisions:
- `time.approved` posts Dr 5000 Labour Cost (project) / Cr 5900 Labour Cost Allocated. Time on the Company Overhead project posts Dr 6000 instead of 5000 (§9 D4, D6).
- An overhead expense (no `projectId`) debits 6000.
- `payment.completed` uses 1010 for `EVC_PLUS` and 1000 otherwise.
- Retainer invoices credit 4100. All other sources credit 4000.

---

## 4. Existing files that will change

| File | Sub-phase | Change |
|---|---|---|
| `backend/package.json`, `package-lock.json` | I8.0 | add `bullmq` (needs confirmation, C7) |
| `backend/src/server.ts`, `background-jobs.ts`, `worker.ts`, `lib/env.ts` | I8.0 | timers → BullMQ repeatables in the worker; the API runs none |
| `Dockerfile`, `docker-compose.yml`, `docs/COMPLETION_AUDIT.md` (deploy checklist) | I8.0 | `worker` service / Coolify notes |
| `backend/src/lib/audit.ts` | I8.0 | `recordAudit(tx, …)`, `metadata`, `ip` |
| `backend/src/services/payment.service.ts`, `payments/gateways/manualBank.gateway.ts` | I8.0, I8.7 | guarded claim + `increment`; later emit `payment.completed` |
| `backend/prisma/schema.prisma` | all | new section per §3 |
| `backend/prisma/seed.ts` | I8.0, I8.1, I8.5 | new permissions, role mapping, ledger accounts |
| `packages/shared/src/constants/permissions.ts` | I8.1 | new keys (§5) |
| `packages/shared/src/schemas/*` | each | new `contract.ts`, `rate.ts`, `timeEntry.ts`, `expense.ts`, `creditNote.ts`, `retainer.ts`, `ledger.ts`, `projectFinancials.ts`; extend `invoice.ts` and `client.ts` |
| `backend/src/services/invoice.service.ts` | I8.1, I8.4 | `NumberSequence`; `issueInvoice` (replaces `sendInvoice` semantics, keeps the route as an alias); freeze rules |
| `backend/src/services/timesheet.service.ts` | I8.2 | repoint to `TaskTimeEntry` |
| `backend/src/services/engineering.service.ts` (`recordTaskHours`, `listTaskHours`), `engineering-worklog.service.ts` | I8.2 | set `projectId`; block edits unless DRAFT/REJECTED; engineers never get rate fields |
| `backend/src/services/project-finance.service.ts`, `GET /projects/:id/finance` | I8.6 | reads the snapshot; ProjectExpense read path becomes the legacy view |
| `backend/src/services/finance.service.ts` | I8.5 | shared `postJournal(tx, rule, …)` used by both the manual workflow and event handlers; `assertBalanced` reused |
| `backend/src/services/milestone.service.ts`, `project.service.ts` | I8.7 | emit `milestone.accepted`, `project.status_changed` |
| `backend/src/app.ts` | each | register new routers |
| `frontend/src/features/projects/ProjectDetailPage.tsx` | I8.1, I8.6 | Contract and Financials tabs |
| `frontend/src/features/finance/*`, `frontend/src/app/router.tsx`, `app/layout/nav.ts` | I8.2–I8.8 | approval queue, expenses, drafts inbox, dashboard, reports |

New backend files: `services/{exchange-rate,number-sequence,contract,rate,time-entry,expense,vendor,credit-note,retainer,ledger,project-financials,domain-event}.service.ts` with matching controllers and routes; `backend/src/finance/{postingRules,money,fx}.ts`; `backend/src/jobs/{queues,outboxRelay,retainerInvoice,tmInvoice,invoiceOverdue,fxReminder,snapshotReconcile}.ts`; `backend/src/events/handlers/*.ts`.

---

## 5. Permissions and role mapping

New keys: `finance.rates.manage`, `finance.contracts.manage`, `time.approve`, `expenses.create`, `expenses.approve`, `invoices.issue`, `credit-notes.issue`, `ledger.read`, `ledger.adjust`, `periods.close`, `finance.reports.read`, `finance.events.read` (dead-letter view; not in the prompt's list, added for least privilege).

| Role | Grants |
|---|---|
| `ENGINEER`, `LEAD_ENGINEER`, `QA_ENGINEER`, `STAFF` | `expenses.create`. Own time only. No money fields in any response (serializer strips them, tested) |
| `PROJECT_MANAGER` | + `time.approve` (scoped in service to projects they manage), budget burn % only |
| `ACCOUNTANT` | + `finance.read`, `ledger.read`, `ledger.adjust`, `invoices.issue`, `credit-notes.issue`, `finance.reports.read` |
| `FINANCE_MANAGER` | all of the above + `finance.rates.manage`, `finance.contracts.manage`, `expenses.approve`, `periods.close`, `finance.events.read` |
| `ADMIN` / `SUPER_ADMIN` | unchanged rule (all) |
| `CLIENT` | unchanged; portal shows only issued invoices, payments and credit notes |

Segregation is enforced in services and tested:
- expense submitter ≠ approver;
- time logger ≠ approver;
- manual drafter ≠ issuer for MANUAL invoices;
- adjustment creator ≠ period closer for that month.

New `/finance/*` routes sit behind the existing 2FA session-proof middleware.

---

## 6. Sub-phase PR plan

| PR | Scope | Est. size |
|---|---|---|
| I8.0a | BullMQ worker, timers moved out of the API | ~300 |
| I8.0b | `recordAudit`, outbox + relay, webhook guard hardening + test | ~350 |
| I8.1a | Currency, FX rates, NumberSequence, client billing fields | ~350 |
| I8.1b | ProjectContract, schedule, Contract UI | ~400 |
| I8.2a | Rates + resolution | ~300 |
| I8.2b | Time status/approval/snapshots, approval queue UI | ~400 |
| I8.2c | Timesheet migration + repoint + count/total test | ~250 |
| I8.3 | Vendors, expenses, receipts, ProjectExpense migration | ~400 |
| I8.4a | Invoice source/issue/freeze, credit notes | ~400 |
| I8.4b | Retainers + drafts inbox | ~350 |
| I8.5a | Ledger extensions, posting rules, insert-only triggers | ~350 |
| I8.5b | Event-driven posting + closed-period roll-forward | ~300 |
| I8.6 | Snapshot + Financials tab | ~400 |
| I8.7a/b | Event handlers / scheduled jobs | ~400 each |
| I8.8a/b | Dashboard / reports + CSV | ~400 each |
| I8.9 | E2E matrix, worker load test, staging sign-off | tests only |

Gates follow prompt §9. I'll report per §12 after each one.

---

## 7. Test plan additions

Every test in prompt §10. Implementation notes:
- The property test uses `fast-check`. **That's a new dev dependency: please confirm.** The fallback is a seeded generator loop with no new package.
- Concurrency tests run against the real Postgres used by the existing `*.integration.test.ts`.
- The Playwright scenario mocks EVC at the `evcplus.client.ts` boundary.
- Coverage gate ≥ 85 % on `backend/src/finance/**` and the finance services is added to `vitest.config.ts` thresholds for those paths.

---

## 8. Out of scope (follow-ups, per prompt §11)

- Xero/QuickBooks export.
- Payroll engine.
- Tax filing and VAT.
- Bank feed reconciliation.
- Revenue-recognition schedules.
- Multi-user client permissions (`CLAUDE.md` §18).
- Widening legacy `Decimal(12,2)` columns.
- Dropping `projects.budget`, `timesheets` and `project_expenses` (cleanup PR after I8.9).
- Posting historical (legacy) invoices, payments and expenses into the ledger. That needs a reviewed opening-balance journal, not an automatic backfill.

---

## 9. Decisions (approved 27 October 2026)

| # | Decision | Effect on this plan |
|---|---|---|
| D1 | Extend the existing `FinanceAccount`/`FinanceJournal`/`FinanceJournalLine`/`FinancePeriod` ledger. No second ledger. | C1–C3 and §3.5 as written. |
| D2 | Keep `Decimal(12,2)` for **all** money columns. `Decimal(18,8)` for exchange rates only. No `CLAUDE.md` change. | Supersedes C4 and every `Decimal(14,2)` in the prompt. Rates stay `(12,4)`. Existing ledger lines stay `(20,2)` and are not narrowed; new I8 columns, including `fxAmount`, are `(12,2)`. |
| D3 | Add `bullmq` (dependency) and `fast-check` (devDependency). | Both added in I8.0. |
| D4 | Create an internal **Company Overhead** project (`isInternal = true`, non-billable, hidden from the client portal and from profitability rankings). Migrate project-less timesheets into it. Its labour cost posts to 6000. | Supersedes C13. I8.2 adds `Project.isInternal Boolean @default(false)`, seeds the project idempotently, and filters `isInternal` out of portal queries and the profitability ranking. |
| D5 | Auto-create DRAFT contracts for projects with a budget, carrying `budgetAmount` only. `contractValue` and `billingModel` stay null while DRAFT; the PM sets them before ACTIVE. Add a "contracts needing setup" list. | Supersedes §3.1's data step. `ProjectContract.billingModel` and `currency` become nullable, with a service check (and test) that ACTIVE requires both plus `contractValue` where the model needs it. I8.1 adds `GET /finance/contracts?status=DRAFT&needsSetup=true` and a list screen. |
| D6 | Do **not** accrue to 2100. Use cost allocation: Dr 5000 Labour Cost (project) / Cr 5900 Labour Cost Allocated (contra-expense). | Replaces the `time.approved` cost rule in §3.7. **Before implementing I8.2**, I check how salaries are recorded in `FinanceTransaction` today, and the I8.2 PR confirms that salary cost is not counted twice in the P&L. Net company labour = salary expense + 5000 − 5900, so 5000 and 5900 cancel at company level and only redistribute cost to projects. |
| D7 | Automatic postings into a closed month roll to the first day of the open period. The original event date is kept in metadata, and they are listed as "late postings" in the period report. Manual postings stay rejected. | §3.5 as written, plus the late-postings list in I8.5. |
| D8 | `feat/I8.x-*` branches, one PR each. Never commit I8 code directly to `main`. | Supersedes C15. The stacked `a`/`b` splits in §6 become separate branches only if a sub-phase would exceed 400 lines; otherwise one PR per sub-phase. |

---

## 10. I8.B — Historical backfill and project finance dashboard

Status: **DRAFT — awaiting approval.** No I8.B code has been written. The order becomes `I8.0 → I8.B → I8.1 …`.

Files read for this section: `backend/src/services/{finance,project-finance,payment,invoice}.service.ts`, `backend/src/payments/**`, `frontend/src/features/finance/*`, `frontend/src/features/reports/*`, `frontend/src/features/dashboard/charts.tsx`, migrations `20261016120000_finance_ledger_foundation`, `20261016140000_finance_account_metadata_guard` and `20261018100000_finance_period_business_calendar`, and `docs/FINANCE_BUG_REGISTER.md`.

### 10.1 What the codebase constrains

These facts shape the design. Each one either needs a decision (§10.10) or is handled below.

| # | Fact | Consequence |
|---|---|---|
| B-F1 | The ledger is guarded **in PostgreSQL**, not only in the service. Triggers: `finance_open_period_before_post` rejects any journal insert dated in a CLOSED period; `finance_journal_immutable` allows a journal update only to finalize it; `finance_line_immutable` blocks changes to lines and appending to a finalized journal; deferred `finance_journal_balanced` enforces balance at commit. | The closed-period path for backfill (prompt §5.3.4) has to be a **trigger change**, not just a service branch. See §10.5. The immutability trigger must also cover the new journal columns. |
| B-F2 | `FinanceJournal @@unique([sourceType, sourceId])`. A reversal is a separate journal with `sourceType = 'REVERSAL'`, `sourceId = <original id>`. | Commit-twice idempotency works as the prompt says. But after a run is reversed, a **new run cannot re-post the same legacy row**: the original journal still holds its `(LEGACY_INVOICE, id)` key. This contradicts the prompt's "a new run can then be started". See D-B1. |
| B-F3 | The currency lives on the journal (`FinanceJournal.currency String`, any 3-letter code), not on lines. Accounts may be currency-scoped (`FinanceAccount.currency`). Posting rejects an account whose currency differs from the journal's. | Account-role mapping must be **per currency**: a USD-only cash account can't take an SOS payment. See §10.3. |
| B-F4 | The I8 plan (§3.1) planned `enum Currency { USD SOS }` for I8.1. The existing ledger and `FinanceTransaction` use `String` with `financeCurrencySchema`. | Recommendation: new currency columns are `String`, validated by a shared `SUPPORTED_CURRENCIES = ['USD','SOS']`. I8.1 builds on that instead of adding an enum. See D-B2. |
| B-F5 | `Payment` has no completion timestamp. Manual payments are created `COMPLETED`. An EVC payment's last update is the webhook that completed it, because a COMPLETED payment is never updated again. | Payment date = `createdAt` for manual and bank payments, `updatedAt` for `EVC_PLUS`. Recorded per row in the run summary. |
| B-F6 | `Payment` stores no currency or EVC currency metadata (only `gatewayRef`, `payerPhone`, `reference`). | The prompt's "EVC metadata shows a different currency → NO_CURRENCY" check has nothing to read. Payments always inherit the invoice currency. `NO_CURRENCY` is raised only when the invoice's currency can't be resolved, which won't happen while a default exists. Stated here rather than faked. |
| B-F7 | FIN-07: before the fix, the manual gateway recorded `STRIPE` and `EDAHAB` payments as `COMPLETED` with no settlement gateway. | New exception reason **`UNSETTLED_METHOD`** for COMPLETED payments with method `STRIPE` or `EDAHAB`. Posting them as cash would be a guess. |
| B-F8 | FIN-05: before the fix, `PARTIAL` invoices could be voided after money was recorded. | `VOID_WITH_PAYMENTS` is a real legacy case, not hypothetical. |
| B-F9 | `Invoice.total = subtotal + tax − discount`. There is no tax account. | The prompt credits revenue with `total`, which counts collected tax as revenue. See D-B3. |
| B-F10 | `ProjectExpense` has no `clientId` and a free-text `category`. Approved plan C5 said legacy project expenses would be migrated to `Expense` in I8.3 **unposted**. | I8.B now posts ACTUAL rows, which supersedes that part of C5. I8.3 must mark migrated rows as already posted (link by `legacyProjectExpenseId` to the `LEGACY_PROJECT_EXPENSE` journal) and never post them again. Line `clientId` comes from `project.clientId`. |
| B-F11 | `sendInvoice()` updates the status and then sends mail, with no transaction. `createProjectExpense` already runs in a transaction. | B2 wraps the status change and `emitEvent` in one transaction. Mail stays outside it. |
| B-F12 | No ledger line knows which invoice it settles. | AR ageing and the "AR per invoice = total − payments" check would have to join through the source tables. Recommendation: add `FinanceJournalLine.invoiceId` (nullable, indexed), so AR is a pure ledger sub-ledger. See D-B4. |
| B-F13 | I don't have access to production data or a copy of it. | Prompt §12 asks for migration results and a dry-run summary from a copy of production. **I can't produce these.** B1 ships the dry run. Options: you run it on staging/production after deploy (it posts nothing), or you give me a sanitized dump. |

### 10.2 Models and migrations

Ledger tables keep their existing types. New money columns on ledger tables are `Decimal(20,2)` (prompt §11). Others are `Decimal(12,2)` (D2).

**B1 — `…_i8_b1_backfill_foundation`**
- `Invoice.currency String?`, `Payment.currency String?`, `ProjectExpense.currency String?`, `Client.defaultCurrency String?`.
  - Nullable in the database.
  - **Required on create** in the shared Zod schemas: invoice create takes `currency`, defaulting in the form to the client's default, then USD.
  - A payment copies the invoice currency in the service.
  - A project expense defaults to the client's currency, then USD.
- `enum FinanceAccountRoleKey { ACCOUNTS_RECEIVABLE PROJECT_REVENUE CASH EVC_WALLET BANK DIRECT_COST LEGACY_EXPENSE_CLEARING TAX_PAYABLE }`. `TAX_PAYABLE` only if D-B3 is accepted.
- `FinanceAccountRole { id, role, currency String?, accountId → FinanceAccount (Restrict), updatedById, timestamps }`, unique `(role, currency) NULLS NOT DISTINCT`. See §10.3.
- `FinanceBackfillRun`, as in prompt §5.1, with these changes:
  - `status` is an enum `DRY_RUN_RUNNING | DRY_RUN | AWAITING_APPROVAL | COMMITTING | COMMITTED | REVERSING | REVERSED | FAILED`. The prompt's five statuses aren't enough: the DB trigger in §10.5 keys on `COMMITTING`, and a crashed commit must be resumable.
  - Add `revision Int` (D-B1), `lastDryRunAt`, `failureReason`.
  - A partial unique index allows only one run outside `REVERSED`/`FAILED`.
- `FinanceBackfillException`, as in prompt §5.1, with:
  - `reason` as an enum, adding `UNSETTLED_METHOD` (B-F7) and `TAX_UNMAPPED` (if D-B3).
  - Add `stale Boolean`: set when a re-run no longer finds the condition. Resolutions are kept across re-runs.
- `FinanceJournal`:
  - add `origin FinanceJournalOrigin @default(LIVE)` (`LIVE | BACKFILL`), `backfillRunId String?` (FK, Restrict), `revision Int @default(0)` and `originalOccurredOn DateTime?` (the D7 late-posting date);
  - change the unique key to `(sourceType, sourceId, revision)`;
  - add `@@index([origin])` and `@@index([backfillRunId])`.
  - The immutability trigger is extended to the new columns.
  - A new trigger rejects a second **unreversed** journal for the same `(sourceType, sourceId)`, so `revision` can't be used to double-post. See D-B1.
- `FinanceJournalLine`: add `invoiceId String?` (D-B4) and `category String?`, which carries the legacy `ProjectExpense.category` so "costs by category" works for legacy rows. Add `@@index([projectId, accountId])` and `@@index([invoiceId])`.
- Permission `finance.backfill.manage`, seeded to `FINANCE_MANAGER` (and ADMIN/SUPER_ADMIN by the existing rule).

**B2 — `…_i8_b2_backfill_commit`**
- Replace `finance_open_period_guard()` (§10.5).
- Seed nothing: the chart of accounts stays user-managed.

### 10.3 Account mapping: `FinanceAccountRole` table, not `Setting`

I'm choosing a table over a `finance.accountMap` JSON setting because:
1. **Referential integrity.** A foreign key with `Restrict` means a mapped account can't disappear. A JSON id can point at nothing.
2. **Per-currency mapping** (B-F3). The lookup is `(role, currency)` first, then `(role, NULL)` for a currency-agnostic account. The target account's own currency must match the journal's or be null; this is checked on save and again at post time.
3. **Typed roles and audited changes.** Each change is recorded with `recordAudit(tx)`, including before and after values.
4. **One resolver for both paths.** Live and backfill postings call the same `resolveAccount(tx, role, currency)` (prompt §4).

Account types are enforced on save:

| Role | Account type |
|---|---|
| AR, CASH, EVC_WALLET, BANK | `ASSET` |
| PROJECT_REVENUE | `REVENUE` |
| DIRECT_COST | `DIRECT_COST` |
| LEGACY_EXPENSE_CLEARING, TAX_PAYABLE | `LIABILITY` |

"Create suggested account" calls the existing `createAccount()` with a proposed code and the correct type, under `finance.manage`. A run, and every live posting, fails with `VALIDATION_ERROR` naming the unmapped role or currency.

Payment method to cash role:

| Method | Role |
|---|---|
| `EVC_PLUS` | EVC_WALLET |
| `BANK_TRANSFER` | BANK |
| `MANUAL` | CASH |
| `STRIPE`, `EDAHAB` | exception `UNSETTLED_METHOD` (B-F7) |

### 10.4 Rules, beyond prompt §3

- **Scope.** A legacy row is in scope only if no `LIVE` journal exists for its live successor. That means no `INVOICE` journal for that invoice, and no `PAYMENT` journal for that payment. Rows touched after B2's live posting is switched on are therefore never posted twice.
- **Invoice amount.** If D-B3 is accepted: credit Revenue with `total − tax` and credit `TAX_PAYABLE` with `tax`. Otherwise credit Revenue with `total`, as the prompt says. Discount is already netted into `total`.
- **Exception resolutions.** Each resolution is stored on the exception; the legacy row is never edited.

  | Reason | Allowed resolutions |
  |---|---|
  | `NO_PROJECT` | `ASSIGN_PROJECT` (project of the same client) · `POST_AS_IS` (client-level, `projectId` null) · `SKIP` |
  | `VOID_WITH_PAYMENTS` | `POST_AS_IS` (post invoice and payments as if not void; finance follows up with a credit note) · `SKIP` (skip the invoice **and** its payments) |
  | `OVERPAID` | `POST_AS_IS` (AR ends in credit, i.e. a customer credit) · `SKIP` (pick the payments to exclude) |
  | `POSSIBLE_DUPLICATE` | `MERGE_WITH_TRANSACTION` (don't post; link to the `FinanceTransaction`) · `POST_AS_IS` · `SKIP` |
  | `NO_CURRENCY` | `POST_AS_IS` with a currency override |
  | `CLOSED_PERIOD` | `POST_AS_IS` (explicit consent to post into that closed month) · `SKIP` |
  | `UNSETTLED_METHOD` | `POST_AS_IS` with a chosen cash role · `SKIP` |
  | `TAX_UNMAPPED` | map `TAX_PAYABLE`, then re-run |

- **Possible duplicate.** The match is a `FinanceTransaction` of type `EXPENSE`, status `POSTED`, `APPROVED` or `SUBMITTED`, same `projectId`, same amount, `occurredOn` within ±3 days of `expenseDate ?? createdAt`.
- **Segregation.** The approver must differ from `startedById` **and** from every user who resolved an exception with `POST_AS_IS`, `ASSIGN_PROJECT` or `MERGE_WITH_TRANSACTION`. This extends the prompt; see D-B5.

### 10.5 The single closed-period path

The trigger is replaced so it allows a closed-period insert only when all of the following hold:
- `NEW.origin = 'BACKFILL'`,
- `NEW.backfill_run_id` names a run whose status is `COMMITTING`,
- `NEW.source_type` is a `LEGACY_*` type.

Everything else is rejected, as today. Only `commitBackfillRun()` sets `origin = BACKFILL`, and it moves the run to `COMMITTING` under a row lock. A `recordAudit` row is written for each journal posted into a closed month.

Tests prove that each of these is rejected **at the database**, even with direct SQL:
- a BACKFILL insert for a run that is not COMMITTING;
- a LIVE insert into a closed period;
- a manual `postTransaction` into a closed period.

### 10.6 Flow (prompt §5.3), concretely

1. **Dry run.** `POST /finance/backfill/runs` enqueues `finance.backfill.dry-run` on a new BullMQ queue `somwave-finance`. The API only enqueues, so the API still runs no timers.
   - The worker reads every legacy row, writes `summary` (counts and totals by source × project × currency, plus skipped lists) and upserts exceptions. It posts nothing.
   - Re-running updates the same run while its status is `DRY_RUN` or `AWAITING_APPROVAL`.
   - The run moves to `AWAITING_APPROVAL` once no exception is unresolved.
2. **Commit.** `POST /runs/:id/commit` requires `Idempotency-Key`, 2FA and the segregation check, then enqueues the commit job.
   - The job posts one transaction per project, each journal finalized.
   - Journals are dated with the original date, use `revision = run.revision`, and set `invoiceId` on AR lines.
   - The commit is resumable: an already-posted source is skipped thanks to the unique key.
3. **Reconcile** (prompt §5.4), all run from ledger SQL:
   - the trial balance balances per currency;
   - per invoice, ledger AR equals `total − completed payments` (via `invoiceId`);
   - per project, revenue and direct cost equal the posted sources;
   - the count and total of posted journals equal the dry-run summary.
   - Any failure sets `REVERSING`, reverses every journal in the run, then sets `FAILED` with `failureReason`.
4. **Reverse.** `POST /runs/:id/reverse` (2FA, audit) posts reversal journals in the open period, using the existing `reverseJournal` logic factored into a tx-level helper. Reversals inherit `origin = BACKFILL`, so the "Legacy" filter nets to zero.
5. **New run after reversal.** It gets `revision + 1` (D-B1).

### 10.7 Live posting (B2, prompt §6)

Events are emitted with `emitEvent(tx)` in the same transaction as the business change. Handlers live in `backend/src/events/handlers.ts`.

| Event | Emitted from | Handler | Journal |
|---|---|---|---|
| `invoice.issued` | `sendInvoice` (DRAFT→SENT/OVERDUE) | `ledger.invoice.v1` | `INVOICE`: Dr AR / Cr Revenue (+ tax per D-B3), dated `issueDate` |
| `invoice.voided` | `voidInvoice` | `ledger.invoice-void.v1` | reverses the invoice's journal, whether `INVOICE` or `LEGACY_INVOICE`. If none exists (backfill not yet committed), it records nothing; the backfill then skips the void invoice. |
| `payment.completed` | manual gateway, EVC webhook | `ledger.payment.v1` | `PAYMENT`: Dr cash role / Cr AR (`invoiceId` set) |
| `project_expense.recorded` | `createProjectExpense` (ACTUAL) | `ledger.project-expense.v1` | `PROJECT_EXPENSE`: Dr Direct Cost / Cr Expense Clearing, line `category` set |
| `project_expense.removed` | expense soft-delete | `ledger.project-expense-void.v1` | reversal of whichever journal exists |

- Dates in a closed period roll to the first day of the next open period, with `originalOccurredOn` set (D7). They appear in the "late postings" list.
- An unmapped role makes the handler fail. It retries and is then parked `FAILED`. This pulls forward a minimal `GET /finance/events?status=failed` and `POST /finance/events/:id/retry` from I8.7, shown on the data-health panel.
- Every posting bumps the Redis key `finance:cache-version` after commit. Dashboard cache keys include it, which handles invalidation.
- I8.4/I8.5 replace these handlers with the posting-rules table. The `(sourceType, sourceId)` unreversed-journal trigger guarantees they can't double-post.
- **Cutover.** Payments on legacy invoices made after B2 and before the backfill commit leave that invoice's AR negative until the commit. Reconciliation still holds afterwards, because it sums live and legacy journals. **Recommendation: deploy B2 and commit the backfill in the same maintenance window.**

### 10.8 Dashboard and project finance (B3, B4)

- **Money figures come from ledger SQL only.**
  - Source tables are joined for attributes only: invoice `dueDate` for ageing and overdue, client and project names, milestone dates.
  - Non-posted figures are labelled as such: budget, planned cost, and hours from `TaskTimeEntry`/`Timesheet`. Labour cost shows "rates not set".
  - Overdue and ageing use AR lines grouped by `invoiceId`, with the due date from the invoice.
  - Cash and bank use the CASH, BANK and EVC_WALLET role accounts.
- **Currencies.** Totals are per currency only. B3 adds no FX-converted "all in USD" view, because there are no exchange rates until I8.1.
- **Charts** extend the existing SVG approach in `features/dashboard/charts.tsx`. No new chart library.
- **Caching.** Redis, 5 minutes, keyed by filters plus `finance:cache-version`.
- **Performance.** `backend/scripts/seed-finance-perf.ts` generates 50,000 lines in a disposable database. A test records p95 for each endpoint, with a target under 500 ms.
- **Access.** PMs see their own projects' financial page via `projectManageScope`. Any other project, and any non-finance user, gets 404. Clients have no route.

### 10.9 PR split

| PR | Scope | Est. lines (non-test) |
|---|---|---|
| B1a | Migration, currency columns + shared schemas + forms, `FinanceAccountRole` API + settings screen | ~400 |
| B1b | Dry-run job, rules, exceptions + resolve API | ~400 |
| B1c | Historical data screen (summary, exceptions, resolutions) | ~350 |
| B2a | Commit, closed-period trigger, reconciliation, reverse | ~400 |
| B2b | Live posting handlers + events retry + limitation removal | ~350 |
| B3-0 | `FinancePage.tsx` split: move-only, no behaviour change (large diff, zero logic) | move |
| B3 | Dashboard API, cache, perf seed, dashboard UI | ~400 (may split API/UI) |
| B4a | Projects list/detail/timeline/lines/ageing APIs + CSV | ~400 |
| B4b | Projects finance list, project page, Financials tab | ~400 |

Each PR goes on its own `feat/I8.B*-*` branch per D8, and meets §15 of `CLAUDE.md`. The Playwright scenario from prompt §10 lands in B4b, once every screen exists.

### 10.10 Decisions requested for I8.B

1. **D-B1 Re-running after reversal.** Add `FinanceJournal.revision` and change the unique key to `(sourceType, sourceId, revision)`, plus a trigger allowing only one *unreversed* journal per source. The alternative is to forbid any new run once a run has been committed and reversed. *Recommended: revision.*
2. **D-B2 Currency type.** Currency columns are `String` validated against `SUPPORTED_CURRENCIES ['USD','SOS']`, matching the ledger. I8.1 drops its planned `Currency` enum. *Recommended.*
3. **D-B3 Tax.** Split invoice tax to a `TAX_PAYABLE` liability (required only if any legacy invoice has `tax > 0`), or credit `total` to revenue as the prompt says. *Recommended: split.*
4. **D-B4** Add `FinanceJournalLine.invoiceId` so AR ageing and per-invoice reconciliation are pure ledger queries. *Recommended.*
5. **D-B5** The approver must also differ from anyone who resolved exceptions that allow posting. *Recommended.*
6. **D-B6** Payment date = `createdAt` (manual and bank) or `updatedAt` (EVC), per B-F5. *Recommended.*
7. **D-B7 Production evidence (B-F13).** Who runs the dry run against production or a sanitized copy, and when? Until then, I can only report results from fixture data.
8. **D-B8 Cutover.** Deploy B2 and commit the backfill in the same window (§10.7). *Recommended.*
