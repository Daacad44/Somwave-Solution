# I8 — Project Finance Integration: implementation plan

Status: **DRAFT — awaiting approval.** No I8 code has been written. I8.0 starts only after this plan, and the decisions in §1, are approved.

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
  - Liabilities: 2000 AP, 2100 Accrued Payroll.
  - Revenue: 4000 Project Revenue, 4050 WIP Revenue, 4100 Retainer Revenue, 4900 Credit Notes (contra-revenue).
  - Costs and expenses: 5000 Labour Cost, 5100 Project Expenses, 6000 Overhead Expenses.
  - Seeded by code. If a code is already used by a different account type, the migration fails loudly instead of re-purposing it.
- Insert-only is enforced by a trigger that blocks `UPDATE`/`DELETE` on `finance_journal_lines`, and on `finance_journals` once finalized. The existing code already has no update path.
- `FinancePeriod` is reused as is. "Posting into a CLOSED period moves to the current open period" is **new behaviour**: today `lockOpenPeriod` rejects the posting. For event-driven postings I will date the journal on the first day of the current open period and record the original date in `memo`/metadata. Manual postings keep the existing rejection.

### 3.6 I8.6 — migration `…_i8_6_snapshot`
- `ProjectFinancialSnapshot` (prompt §4.8), `healthStatus` as an enum, plus `@@index([healthStatus])`.

### 3.7 Posting rules — `backend/src/finance/postingRules.ts`
A table-driven map from `(eventType, variant)` to `{ debit: code, credit: code, dimension: 'project'|'client'|'both' }`, exactly as prompt §4.7. Not covered by the prompt, and needing decisions:
- `time.approved` credits **2100 Accrued Payroll**. There is no payroll engine (out of scope), so 2100 grows without bound until payroll exists. Proposed: accept that and document it. Finance reverses 2100 manually through an adjustment when salaries are paid.
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
- Payroll engine, and settlement of 2100 Accrued Payroll.
- Tax filing and VAT.
- Bank feed reconciliation.
- Revenue-recognition schedules.
- Multi-user client permissions (`CLAUDE.md` §18).
- Widening legacy `Decimal(12,2)` columns.
- Dropping `projects.budget`, `timesheets` and `project_expenses` (cleanup PR after I8.9).
- Posting historical (legacy) invoices, payments and expenses into the ledger. That needs a reviewed opening-balance journal, not an automatic backfill.

---

## 9. Decisions requested

1. **C1–C3**: extend the existing ledger instead of adding `LedgerAccount`/`JournalEntry`.
2. **C4**: `Decimal(14,2)` for new money columns, plus the matching `CLAUDE.md` §7 amendment.
3. **C7 / §7**: add `bullmq` (and optionally `fast-check`).
4. **C13**: what happens to timesheets with no project.
5. **§3.1**: whether projects with an existing budget get a DRAFT FIXED_FEE contract.
6. **§3.7**: 2100 Accrued Payroll grows until payroll exists.
7. **§3.5**: event postings into a closed month roll into the first day of the open period.
8. **C15**: confirm `feat/I8.x-*` branches + PRs for the sub-phases.
