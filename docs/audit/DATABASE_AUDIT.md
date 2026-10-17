# Database and Data Integrity Audit

| | |
|---|---|
| Date | 2026-10-17 |
| Repository state | `main` at `4323f55` (PR #86) |
| Scope | Prisma schema (91 models, 51 enums), 55 migrations, seed, service-layer transactions, locking and soft-delete; migration replay and drift check on a local database. |
| Method | Read-only code inspection with file:line evidence; targeted local test runs; unauthenticated, low-volume GET/HEAD/OPTIONS probes of production. No production credentials, Coolify, Resend, S3 or GitHub App access. |
| Source | Database agent report (03), prefix DB- |
| Related | [System audit report](SYSTEM_AUDIT_REPORT.md) · [Bug register](BUG_REGISTER.md) · [Acceptance matrix](ACCEPTANCE_MATRIX.md) · [Remediation roadmap](REMEDIATION_ROADMAP.md) |

Each finding keeps the specialist agent's original ID; the consolidated `SW-` ID from the [bug register](BUG_REGISTER.md) is shown next to it. Severity in the index is the consolidated severity; where duplicates were merged the higher severity was kept, so it can differ from the severity line inside the original finding text.

## Finding index

| Original ID | SW ID | Severity (consolidated) | Confidence | Consolidated title |
|---|---|---|---|---|
| DB-001 | [SW-011](BUG_REGISTER.md#sw-011) | P1 | CONFIRMED | A fresh production DB is unusable without the dev seed: migrations create only 15 of 70 permissions and 3 of 13 roles |
| DB-002 | [SW-037](BUG_REGISTER.md#sw-037) | P2 | CONFIRMED | Seeded demo content is live in production as real testimonials, team, portfolio, careers and posts |
| DB-003 | [SW-038](BUG_REGISTER.md#sw-038) | P2 | CONFIRMED | Re-running the seed overwrites admin-edited role permissions and resets the super-admin password |
| DB-004 | [SW-003](BUG_REGISTER.md#sw-003) | P1 | CONFIRMED | HR endpoints trust employeeId from the request body (IDOR): any STAFF can check in/out or file leave for any employee and read everyone's HR records |
| DB-005 | [SW-039](BUG_REGISTER.md#sw-039) | P2 | CONFIRMED | Email uniqueness is case-sensitive at the DB level; app-level case-insensitive checks are racy |
| DB-006 | [SW-010](BUG_REGISTER.md#sw-010) | P1 | CONFIRMED | Central error handler discards the error; Prisma known errors (P2002/P2025/P2034) become HTTP 500 |
| DB-007 | [SW-040](BUG_REGISTER.md#sw-040) | P2 | CONFIRMED | Support-ticket codes come from count()+1 without a lock; concurrent creates collide (500) |
| DB-008 | [SW-032](BUG_REGISTER.md#sw-032) | P2 | CONFIRMED | Invoice line totals are not rounded before summing (subtotal can disagree with stored lines); large values overflow to 500 |
| DB-009 | [SW-041](BUG_REGISTER.md#sw-041) | P2 | SUSPECTED | `sendInvoice` is not locked or status-guarded and can resurrect a VOID invoice |
| DB-010 | [SW-042](BUG_REGISTER.md#sw-042) | P2 | CONFIRMED | Employee records are created non-transactionally and implicitly (including on GET /timesheets) and break for soft-deleted employees |
| DB-011 | [SW-043](BUG_REGISTER.md#sw-043) | P2 | CONFIRMED | Cascading deletes on HR, financial and time records (latent data-loss risk) |
| DB-012 | [SW-091](BUG_REGISTER.md#sw-091) | P3 | CONFIRMED | Archived projects' tasks/milestones appear for admins; legacy /tasks exposes other engineers' unapproved proposals |
| DB-013 | [SW-092](BUG_REGISTER.md#sw-092) | P3 | CONFIRMED | Dashboard "upcoming leave" includes soft-deleted leave requests and deleted employees |
| DB-014 | [SW-093](BUG_REGISTER.md#sw-093) | P3 | CONFIRMED | Schema/migration drift on engineer_progress_reports |
| DB-015 | [SW-094](BUG_REGISTER.md#sw-094) | P3 | CONFIRMED | Migration directories with impossible hours (24-27) |
| DB-016 | [SW-095](BUG_REGISTER.md#sw-095) | P3 | CONFIRMED | Unindexed foreign keys, including finance_journal_lines.journal_id; audit_logs has no created_at index |
| DB-017 | [SW-016](BUG_REGISTER.md#sw-016) | P2 | CONFIRMED | TOTP secrets stored in plaintext; backup codes are unsalted SHA-256 over 32 bits |
| DB-018 | [SW-096](BUG_REGISTER.md#sw-096) | P3 | CONFIRMED | Invoice OVERDUE status is written on every GET (write-on-read); PARTIAL invoices never become OVERDUE |
| DB-019 | [SW-097](BUG_REGISTER.md#sw-097) | P3 | CONFIRMED | Missing DB-level guards on AR tables and finance actor columns |
| DB-020 | [SW-098](BUG_REGISTER.md#sw-098) | P3 | CONFIRMED | Convention deviations (informational) |
| DB-021 | [SW-099](BUG_REGISTER.md#sw-099) | P3 | CONFIRMED | A soft-deleted user's email can never be invited again |

## 1. Scope inspected / blocked

Inspected:
- `backend/prisma/schema.prisma` (2321 lines, **91 models, 51 enums**), all **55 migrations** in `backend/prisma/migrations/`, `backend/prisma/seed.ts` (497 lines), `backend/docker-entrypoint.sh`, root `Dockerfile`, `docs/SUPER_ADMIN_SETUP.md`.
- Service-layer transaction, locking and soft-delete usage: `invoice`, `payment` + `payments/*`, `finance`, `hr`, `timesheet`, `ticket`, `project`, `task`, `milestone`, `dashboard`, `reports`, `user-invitation`, `project-inquiry`, `auth`, `role`, `engineer-account`, `engineering-operations` services; `middleware/errorHandler.ts`.
- Scripted checks (scripts in scratchpad `db/`): per-model standard fields, every `onDelete`, money types, FK columns with no index, `*_id` columns with no FK, soft-delete queries missing `deletedAt`, non-transactional multi-write functions.

Executed against **local `somwave_dbaudit` only**:
| Step | Result |
|---|---|
| `prisma migrate deploy` from an empty DB | **Success**: all 55 migrations applied, 0 failed, **2.29 s** (a second clean run into an isolated schema `?schema=migonly` took 2.70 s; that schema was dropped afterwards). `migrate status`: "Database schema is up to date". |
| `prisma migrate diff --from-url … --to-schema-datamodel prisma/schema.prisma --script` | **Not empty**. There is a small drift (DB-014). Output verbatim: `ALTER TABLE "engineer_progress_reports" ALTER COLUMN "updated_at" DROP DEFAULT;` and `ALTER INDEX "engineer_progress_reports_project_id_author_id_period_period_st" RENAME TO "engineer_progress_reports_project_id_author_id_period_perio_key";` |
| pgvector | Not installed locally (`pg_available_extensions` has no `vector`). **No migration or model uses it** (grep `vector` in `prisma/`: 0 hits). Migrations apply cleanly without it. |
| `npm run db:seed` twice | **Idempotent**: run 1 took 1.8 s and run 2 took 2.1 s. The row counts were identical after both runs (permissions 70, roles 13, users 1, user_roles 1, clients 1, services 3, projects 2, posts 2, faqs 2, team 2, testimonials 2, job_openings 2, portfolio 2). A row-level guard on the counts holds, but the side effects shown in DB-003 still happen on every run. |
| Ledger triggers (SQL test, rows cleaned up) | Finalizing an unbalanced journal (10 / 9) is **rejected** ("Finance journal must have at least two balanced lines"). A non-finalized unbalanced draft does persist. |
| Case-variant duplicate email (SQL test, rolled back) | `Case@x.com` and `case@x.com` **both insert** (DB-005). |
| Rounding arithmetic | Reproduced (DB-008). |

Production probes: 3 unauthenticated GETs (`/api/v1/public/testimonials`, `/team`, `/careers`), used for DB-002.

**BLOCKED:** production DB contents, row counts and migration history. There are no credentials. I can't confirm which migrations or seeds ran in prod, beyond what the public API returns.

## 2. Inventory (data layer)

| Domain | Key models (count) | Migrations | Soft-delete (`deletedAt`) | Notable constraints | Tests touching | Status |
|---|---|---|---|---|---|---|
| Core/auth/RBAC | User, Role, Permission, UserRole, RefreshToken, PasswordResetToken, TwoFactorBackupCode, UserInvitation, AuditLog, Setting, Notification* (12) | init_core, platform_foundation, ops_except_payment, completion_models, audit_context, secure_user_invitations_reset_otp | User only | email unique (case-sensitive), token hashes unique | auth/user-invitation tests (mocked) | PARTIAL: DB-001/003/005/017/021 |
| Website/CMS | Service, Post, Category, PortfolioItem, JobOpening, JobApplication, Testimonial, TeamMember, Faq, Subscriber, Inquiry, ProjectInquiry(+Attachment), MediaAsset (14) | 20260828xxxx series, portfolio_* | none (hard delete, guarded for JobOpening) | slug unique, inquiry idempotency_key unique | service tests | PARTIAL: DB-002 |
| Portal | Client, SupportTicket, TicketReply, ClientDocument (4) | platform_foundation, ticket_assignee… | Client, SupportTicket, ClientDocument | ticket code unique | ticket tests | PARTIAL: DB-007 |
| HR | Employee, Attendance, LeaveRequest, Timesheet (4) | platform_foundation, ops_except_payment | Employee, Leave, Timesheet; **not Attendance** | employee userId/employeeNo unique; attendance (employee,date) unique | — | FAILED scoping: DB-004/010/011 |
| Finance (AR) | Invoice, InvoiceItem, Payment (3) | platform_foundation, add_payments, payment_gateway_fields | Invoice, Payment | number unique, idempotency_key unique, Restrict on client/invoice | invoice/payment tests | PARTIAL: DB-008/009/018/019 |
| Finance ledger | FinanceAccount, FinancePeriod, FinanceJournal, FinanceJournalLine, FinanceTransaction (5) | finance_ledger_foundation, finance_mfa_session_proof, finance_account_metadata_guard | immutable via triggers | CHECKs, balance constraint trigger, period guard, Restrict everywhere | finance tests | GOOD (DB-016 index only) |
| PM/engineering | Project, Milestone(+Dependency), ProjectPhase, Task + ~40 engineering/doc/release/GitHub models | 20261010–20261015 series | Project, Milestone, Phase, Task, docs, comments, ManagedSystem | many composite uniques; github delivery_id unique | engineering tests | PARTIAL: DB-011/012 |

## 3. Findings

### DB-001 (SW-011) — Fresh production DB is unusable without the dev seed: migrations create only 15 of 70 permissions and 3 of 13 roles
- Severity: **P1** · Confidence: CONFIRMED · Module: Core/RBAC, deployment
- Description: `docker-entrypoint.sh` runs only `prisma migrate deploy`. The migrations insert just the finance and engineer permissions and the ENGINEER/FINANCE_MANAGER/ACCOUNTANT roles. SUPER_ADMIN, ADMIN, MANAGER, STAFF, EDITOR, CLIENT, GUEST and 55 permissions (`users.*`, `invoices.*`, `clients.*`, `content.*`, `tickets.*`, `portal.read`…) exist **only** if `seed.ts` is run. Production therefore has to run the dev seed, which also writes demo data and resets roles (DB-002, DB-003). Every permission added later in `packages/shared` again needs either a hand-written migration or a seed re-run.
- Reproduction: `DATABASE_URL=…somwave_dbaudit?schema=migonly npx prisma migrate deploy` gives `permissions` = 15 rows. Roles with grants: ACCOUNTANT=3, ENGINEER=9, FINANCE_MANAGER=4. The 55 missing keys include `users.read`, `roles.manage`, `invoices.create`, `portal.read`, `content.create`.
- Evidence: `backend/docker-entrypoint.sh:11`; `backend/prisma/migrations/20261014020000_ensure_engineer_system_role/migration.sql` ("Production may have run migrations without the development seed"); `20261016120000_finance_ledger_foundation/migration.sql` (same pattern); `docs/SUPER_ADMIN_SETUP.md:55-68` tells operators to run the seed in staging/production.
- Root cause: reference/RBAC data is created by the seed script rather than by versioned migrations.
- Affected: every new environment, and every release that adds a permission. Business impact: a fresh deploy has no admin role, and new features return 403 until someone runs the seed.
- Fix: add a migration (or a separate idempotent `rbac-sync` script with no demo data) that upserts all `PERMISSIONS`/`ROLES` and default grants with `ON CONFLICT DO NOTHING` (additive, never `set`). Move demo content into a separate `seed-demo.ts` that only runs locally/CI. Dependencies: DB-003. Complexity: M. Verification: run migrate-only into an empty schema and assert 70 permissions and 13 roles.

### DB-002 (SW-037) — Seed demo content is live in production (fabricated testimonials, demo job openings)
- Severity: **P2** · Confidence: CONFIRMED (prod probe) · Module: Website/CMS
- Description: `seed.ts` creates sample testimonials, team members, FAQs, posts, job openings, portfolio items, services, a sample client `client@example.com` ("Macmiil Tusaale") and two sample projects with budgets, each "when none exist". Production serves the seeded testimonials with the same text (named people "Faadumo Cabdi" / "Axmed Nuur", rating 5) and the seeded careers `naqshadeeye-uiux`, `horumariye-frontend`. Fabricated reviews shown as genuine on a public marketing site are a legal/consumer-protection risk. The sample client and projects most likely also exist in the production internal DB (SUSPECTED, no access).
- Evidence: `backend/prisma/seed.ts:222-225` (client), `:348-367` (projects), `:370-394` (testimonials), `:339` (jobs). Probe: `GET https://api.somwave.botandev.com/api/v1/public/testimonials` returns `{"author":"Faadumo Cabdi","role":"Maamulaha Guud","company":"Iskuul Gaar ah",…}`. `/careers` returns the 2 seeded openings.
- Side note (not DB): the production `/team` entry `photoUrl`/`linkedinUrl` point at a hot-linked `imgs.search.brave.com` image.
- Fix: delete or replace the demo rows in production through the CMS (after a backup). Split the seed as in DB-001. Complexity: S. Verification: the public endpoints return only real content.

### DB-003 (SW-038) — Re-running the seed silently overwrites admin-edited role permissions and resets the super-admin password
- Severity: **P2** · Confidence: CONFIRMED · Module: Core/RBAC
- Description: every seed run does `role.update({ permissions: { set: … } })` for SUPER_ADMIN, EDITOR, ADMIN, FINANCE_MANAGER, ACCOUNTANT, MANAGER, the engineering roles, STAFF and CLIENT. That replaces whatever an admin configured through `PUT /roles/:id/permissions` (`role.service.ts:46-76`, which allows editing every role except SUPER_ADMIN). `user.upsert` also sets `passwordHash` on every run whenever `SEED_SUPER_ADMIN_PASSWORD` is set, so a password the admin changed reverts. Because DB-001 makes seed re-runs necessary, this happens in practice.
- Evidence: `backend/prisma/seed.ts:31-34, 40-43, 48-57, 68-78, 158-167, 190-199, 211-219` (`set:`); `:478-481` (`update: { name: 'Super Admin', passwordHash }`); `docs/SUPER_ADMIN_SETUP.md:70` acknowledges the password rewrite.
- Fix: grant defaults additively (`connect` / `ON CONFLICT DO NOTHING`) only when a role is first created. Never update `passwordHash` of an existing user unless an explicit `--reset-password` flag is passed. Complexity: S. Verification: customise a role, re-run the seed, and assert the grants are unchanged.

### DB-004 (SW-003) — Attendance and leave are not scoped to the employee: STAFF can read everyone's HR records and check in, check out or file leave for any employee
- Severity: **P1** · Confidence: CONFIRMED (code path) · Module: HR
- Description: STAFF holds `attendance.read`, `attendance.create`, `leave.read` and `leave.create`. `checkIn`/`checkOut`/`createLeave` take `employeeId` from the request body, and `listAttendance`/`listLeaveRequests` return all rows with no owner filter. This breaks the §7/§13 per-user scoping rule and the integrity of HR records: anyone can falsify attendance for a colleague, and leave reasons (possibly medical) are visible to everyone.
- Evidence: `backend/src/controllers/ops-extra.controller.ts:116-117, 125-126, 134, 142`; `backend/src/services/hr.service.ts:110-115` (attendance `findMany` with no where), `:129-146`, `:186-191`, `:208-222`; `backend/src/routes/ops-extra.routes.ts:38-66`; `backend/prisma/seed.ts:181-184` (STAFF grants).
- Affected: all employees. Business impact: payroll/attendance fraud and an HR privacy breach.
- Fix: derive `employeeId` from `req.user` for self-service. Split the permissions into `attendance.manage`/`leave.approve` for HR, and filter lists by the actor's employee unless they hold the manage permission. Return 404 for other employees' rows. Complexity: M. Verification: an API test where STAFF A posts check-in with employee B's id and gets 404, and A's list contains only A's rows.

### DB-005 (SW-039) — Email uniqueness is case-sensitive at the DB level; app-level case-insensitive checks are racy
- Severity: **P2** · Confidence: CONFIRMED (DB repro), race SUSPECTED · Module: Core/auth, Portal onboarding
- Description: `users.email` has a plain btree unique index. The services look users up with `mode: 'insensitive'` (`loadActiveUser`) and do check-then-insert inside READ COMMITTED transactions. Two concurrent registrations, or an invitation plus a project-inquiry conversion with different casing, can both create accounts. Login then uses `findFirst` and may resolve to either one. `project-inquiry.service.ts` stores `current.email` without lowercasing. `clients.email` is not unique at all, so inquiry→client matching (`findFirst` insensitive) can attach to an arbitrary duplicate.
- Evidence: SQL `insert … ('Case@x.com'), ('case@x.com')` gave 2 rows. `\d users`: `"users_email_key" UNIQUE, btree (email)`. `backend/prisma/schema.prisma:20`; `backend/src/services/auth.service.ts:102-108`; `user-invitation.service.ts:155-169`; `project-inquiry.service.ts:308-343`.
- Fix: a migration adding `CREATE UNIQUE INDEX users_email_lower_key ON users (lower(email))` after deduplicating, or switch the column to `citext`. Normalise to lowercase in the shared Zod schema. Complexity: S. Verification: the duplicate insert fails, and a concurrent-invite test returns one 201 and one 409.

### DB-006 (SW-010) — Prisma constraint and serialization errors surface as HTTP 500
- Severity: **P2** · Confidence: CONFIRMED · Module: Backend platform
- Description: the central `errorHandler` handles only `AppError` and body-parser errors. P2002 (unique), P2025 (record not found on update) and P2034 (serialization failure) all become `500 INTERNAL_ERROR`. Six `Serializable` finance transactions have no retry, so concurrent finance actions fail with 500 rather than retrying or returning 409. Only a few services catch P2002 locally (github, project-inquiry, notification-delivery, engineering-worklog).
- Evidence: `backend/src/middleware/errorHandler.ts:27-38`. `grep -rn P2034` returns 0 hits. `finance.service.ts` uses `isolationLevel: Serializable` (e.g. posting at ~`:520`, `reverseJournal`, `closePeriod`).
- Fix: map P2002 to 409 CONFLICT, P2025 to 404 and P2034 to retry (wrapper with 3 attempts) or 409. Complexity: S. Verification: unit tests on the error handler plus a concurrent ticket-create test.

### DB-007 (SW-040) — Support-ticket codes come from `count()+1` without a lock, so concurrent creates collide (500)
- Severity: **P2** · Confidence: CONFIRMED (code path) · Module: Portal tickets
- Description: `code = TKT-${year}-${count+1}` uses the count of *all* tickets (every year) with no lock. Two clients opening tickets at the same moment get the same code and the second create hits `support_tickets_code_key`, which becomes a 500 via DB-006. The year prefix is misleading because the sequence never resets. Compare invoices, which use `pg_advisory_xact_lock` correctly.
- Evidence: `backend/src/services/ticket.service.ts:115-117`; contrast `invoice.service.ts:149-155`.
- Fix: reuse the invoice pattern (advisory lock + `MAX(split_part)` per year) or a Postgres sequence. Complexity: S. Verification: a parallel create test producing unique codes.

### DB-008 (SW-032) — Invoice line totals are not rounded before summing, so stored subtotal/total can disagree with the stored lines
- Severity: **P2** · Confidence: CONFIRMED (arithmetic repro) · Module: Finance/Invoices
- Description: `lineTotal = quantity × unitPrice`, where both are allowed 2 dp, so the product has up to 4 dp. The subtotal is summed from the unrounded products in JS. Postgres then rounds each `line_total` and the `subtotal` independently to `numeric(12,2)`. Example: 3 lines of qty 1.5 × 0.33. Each stored line is 0.50, so the lines sum to **1.50**, but the stored subtotal is **1.49**. The printed invoice and the client's payable balance won't reconcile.
- Evidence: `backend/src/services/invoice.service.ts:137, 140-143`. psql: `select (1.5*0.33)::numeric(12,2), 3*((1.5*0.33)::numeric(12,2)), (3*(1.5*0.33))::numeric(12,2)` gives `0.50|1.50|1.49`. Also qty and price are both capped at 10 integer digits (`packages/shared/src/schemas/invoice.ts:16`), so the product can overflow `Decimal(12,2)`, giving a 500.
- Fix: `lineTotal = quantity.mul(unitPrice).toDecimalPlaces(2, ROUND_HALF_UP)`, sum the rounded lines, and validate that `lineTotal ≤ 9,999,999,999.99`. Complexity: S. Verification: a unit test with the example above.

### DB-009 (SW-041) — `sendInvoice` is not locked or status-guarded and can resurrect a VOID invoice
- Severity: **P2** · Confidence: SUSPECTED (race; code path confirmed) · Module: Finance/Invoices
- Description: `sendInvoice` reads the invoice, then `update({ where: { id } , data: { status: nextStatus } })` with no `FOR UPDATE` and no status predicate. `voidInvoice` does lock. If a void commits between the read and the update, the invoice flips VOID→SENT and is emailed to the client.
- Evidence: `backend/src/services/invoice.service.ts:179-199` (update at `:195-197`) vs `:220-243`.
- Fix: `updateMany({ where: { id, status: 'DRAFT' } })` and treat count 0 as 409, or wrap the send in a transaction with `FOR UPDATE`. Complexity: S.

### DB-010 (SW-042) — Employee records are created non-transactionally and implicitly, and break for soft-deleted employees
- Severity: **P2** · Confidence: CONFIRMED (code path) · Module: HR/Timesheets
- Description: (a) `createEmployee` does `employee.create` and then a separate `user.update({employeeId})` with no transaction. (b) `GET /timesheets` calls `ensureEmployee`, which **creates an Employee row on read** for any user (bypassing HR, no audit, `users.employee_id` not set). (c) Both check `deletedAt: null` but `employees.user_id` / `employee_no` are globally unique, so a soft-deleted employee can't be re-hired and their timesheet page fails with a unique violation, which is a 500 (DB-006). (d) `users.employee_id` has **no FK** and duplicates the real `employees.user_id` relation, so the two links can drift.
- Evidence: `backend/src/services/hr.service.ts:59-76`; `backend/src/services/timesheet.service.ts:35-42, 44-45, 58`; `backend/prisma/schema.prisma:30, 539`. The FK scan lists `users.employee_id` among columns with no FK.
- Fix: one transaction; drop `users.employee_id`, using the `Employee.userId` relation; reactivate soft-deleted rows instead of creating new ones; remove creation from the GET path. Complexity: M.

### DB-011 (SW-043) — Cascading deletes on HR, financial and time records (latent data-loss risk)
- Severity: **P2** · Confidence: CONFIRMED (schema), exploit path SUSPECTED · Module: HR, Finance, PM
- Description: deleting a `User` cascades to `Employee`, which cascades to `Attendance`, `LeaveRequest` and `Timesheet`. Deleting a `Project` cascades to `ProjectExpense`, `ProjectBudgetRevision` (financial audit), `Milestone`, `Task`, and from `Task` to `TaskTimeEntry`/`TaskTimeEntryRevision` (billable time). `Attendance` has no `deletedAt`. Today no service hard-deletes User/Project/Employee (they are soft-deleted at `user.service.ts:224` and `project.service.ts:904`), so this is latent. A single manual `DELETE`, admin-tool action or future refactor would silently wipe statutory HR and financial history, contrary to §7 ("financial and HR records are never hard-deleted").
- Evidence: `backend/prisma/schema.prisma:549, 566, 599, 624, 1017, 1032, 1062, 1187, 1680, 1718`.
- Fix: change these to `onDelete: Restrict`, add `deletedAt` to Attendance, and keep Cascade only for pure join/child tables (tokens, links). Complexity: S (migration). Verification: `DELETE FROM users` on a user with an employee fails.

### DB-012 (SW-091) — Archiving a project does not hide its tasks or milestones for admins
- Severity: **P3** · Confidence: CONFIRMED (code path) · Module: PM
- Description: `deleteProject` soft-deletes only the project. Task and milestone lists filter `deletedAt: null` on the child plus `project: projectScope(actor)`, and `projectScope` returns `{}` for SUPER_ADMIN/ADMIN, with no `project.deletedAt` filter. Admin task and milestone lists and dashboard counts therefore include work from archived projects. Reports are correct because they use `accessibleProject`, which adds `deletedAt: null`.
- Evidence: `backend/src/services/project.service.ts:96-101, 898-904`; `task.service.ts:81-86`; `milestone.service.ts:103-108`; `dashboard.service.ts:210`; contrast `reports.service.ts:355-357`.
- Fix: include `deletedAt: null` inside `projectScope`, or add `project: { deletedAt: null, ... }`. Complexity: S.

### DB-013 (SW-092) — Dashboard "upcoming leave" includes soft-deleted leave requests and deleted employees
- Severity: P3 · Confidence: CONFIRMED · Module: Dashboard/HR
- Evidence: `backend/src/services/dashboard.service.ts:790-794`. The where clause has only `status` and `startDate`, with no `deletedAt: null` and no `employee: { deletedAt: null }`. Fix: add both. Complexity: S.

### DB-014 (SW-093) — Schema/migration drift on `engineer_progress_reports`
- Severity: P3 · Confidence: CONFIRMED (`migrate diff`) · Module: Engineering
- Description: the hand-written migration declares `updated_at … DEFAULT CURRENT_TIMESTAMP` (the schema has `@updatedAt`, no DB default). It also uses an over-long unique index name that Postgres truncated to 63 chars (`…_period_period_st`), while Prisma expects `…_perio_key`. The next `prisma migrate dev` will generate a corrective migration; if a developer runs `db push` against a shared DB it will also alter things.
- Evidence: `backend/prisma/migrations/20261013041000_engineer_progress_reports/migration.sql:22,26`; `schema.prisma:1755,1761`; diff output in §1.
- Fix: commit a migration with exactly the two diff statements. Complexity: S.

### DB-015 (SW-094) — Migration directories with impossible hours (24–27)
- Severity: P3 · Confidence: CONFIRMED · Module: Migrations
- Description: `20260828240000_add_testimonials`, `…250000_add_team_members`, `…260000_add_faqs` and `…270000_add_subscribers` have hours 24–27. Prisma only orders migrations lexicographically by directory name and does not parse the timestamp, so they are accepted and applied in the intended order (verified in `_prisma_migrations.started_at`: …230000 → …240000 → … → …270000 → 20260910120000). There is no functional impact. Do **not** rename them: renaming breaks `_prisma_migrations` history in production. Treat it as a convention note: generate future migrations with `prisma migrate dev --create-only`.

### DB-016 (SW-095) — Unindexed foreign keys, including `finance_journal_lines.journal_id`
- Severity: P3 · Confidence: CONFIRMED · Module: Finance, all
- Description: 37 single-column FKs have no leading index. The most relevant is `finance_journal_lines.journal_id`: the deferred balance trigger runs `SELECT SUM … FROM finance_journal_lines WHERE journal_id = …` on **every** line insert and journal update, and trial-balance reports join on it. Each post becomes O(total lines) as the ledger grows. Others: `invoices.project_id`, `support_tickets.project_id`, `payments.recorded_by_id`, `finance_transactions.cash_account_id/offset_account_id`, `engineer_task_timers.task_id`, `github_repositories.installation_id`, and author/actor columns. `audit_logs` has no `created_at` index although the dashboard orders by it (`dashboard.service.ts:825-826`).
- Evidence: pg_catalog query (§1 scripts); `migrations/20261016120000_finance_ledger_foundation/migration.sql:216-246`; `schema.prisma:807-821`.
- Fix: one migration adding `@@index([journalId])`, `@@index([projectId])` on invoices/support_tickets, `@@index([createdAt])` on audit_logs, and so on. Complexity: S.

### DB-017 (SW-016) — TOTP secrets stored in plaintext
- Severity: **P2** · Confidence: CONFIRMED · Module: Core/auth
- Description: `users.two_factor_secret` is plain `text`, and `startTwoFactorEnrolment` writes the raw base32 secret. A DB dump or read-only SQL leak therefore lets an attacker generate 2FA codes for every SUPER_ADMIN/ADMIN/MANAGER, defeating mandatory 2FA. §13 requires sensitive columns to be encrypted at rest. There is no encryption helper anywhere in `backend/src/lib`.
- Evidence: `backend/prisma/schema.prisma:27`; `backend/src/services/auth.service.ts:199-202`. `grep createCipheriv` in `backend/src` returns 0 hits.
- Fix: AES-256-GCM envelope encryption with a key from env, plus a migration that re-encrypts existing secrets. Complexity: M.

### DB-018 (SW-096) — Invoice overdue status is written on every GET, and PARTIAL invoices never become OVERDUE
- Severity: P3 · Confidence: CONFIRMED · Module: Finance/Invoices
- Description: `markOverdue()` runs an `UPDATE … WHERE status='SENT' AND due_date < now()` on every list and detail read, including portal reads. That is time-based logic in the request path rather than a BullMQ job (§11), and it adds write load and lock contention. A `PARTIAL` invoice past its due date stays PARTIAL.
- Evidence: `backend/src/services/invoice.service.ts:93-98, 101, 111`. Also `listInvoices` is unpaginated (`:100-108`).
- Fix: a nightly BullMQ job with a deterministic jobId, covering both SENT and PARTIAL. Complexity: S.

### DB-019 (SW-097) — Missing DB-level guards on AR tables and finance actor columns
- Severity: P3 · Confidence: CONFIRMED · Module: Finance
- Description: the ledger tables have CHECKs and triggers, but `invoices`/`invoice_items`/`payments` have none: `total >= 0`, `paid_amount BETWEEN 0 AND total`, `payments.amount > 0` and `quantity > 0` are enforced only in services. `finance_journals.created_by_id`, `finance_transactions.created_by_id/reviewed_by_id`, `finance_periods.closed_by_id` and `finance_journal_lines.project_id/client_id` have **no FK**, so they can reference non-existent users or projects (verified: a journal insert with `created_by_id='u'` was accepted). `audit_logs` is not append-only at the DB level (no trigger).
- Evidence: `grep CHECK migrations/*` (only finance and engineer_skills); FK scan list; `schema.prisma:641-720, 771-858, 913-928`.
- Fix: additive migration with CHECKs, FKs `ON DELETE RESTRICT`, and an audit_logs immutability trigger. Complexity: S.

### DB-020 (SW-098) — Convention deviations (informational)
- Severity: P3 · Confidence: CONFIRMED
- `EngineerProfile` uses `userId` as its PK (no cuid `id`, no `createdAt`). The link tables `DocumentTaskLink`, `DocumentMilestoneLink`, `DocumentAttachmentLink`, `TaskDependency`, `SystemUpdateTask`, `ReleaseTask` and `ReleasePullRequest` use composite PKs. `Category`, `InvoiceItem`, `FinanceJournal`, `FinanceJournalLine`, `ProjectAssignmentEvent`, `SystemHealthCheck` and `GitHubWebhookEvent` lack `createdAt`/`updatedAt`; many append-only tables lack `updatedAt`, which is acceptable. The ledger money columns are `Decimal(20,2)` rather than the mandated `(12,2)`, which is fine for capacity, but a ledger amount can exceed what an invoice can hold. No `Float` columns, and every money column is Decimal (`grep Float`: 0). All tables use `@@map` snake_case (plural except the uncountables `attendance`, `engineer_weekly_schedule`, `engineer_availability`, `project_documentation`). All 51 enums are PascalCase with SCREAMING values. pgvector is required by §4 but unused.
- Evidence: `schema.prisma:1338, 1564-1626, 1936-2010, 342, 668, 784-821`.

### DB-021 (SW-099) — A soft-deleted user's email can never be invited again
- Severity: P3 · Confidence: CONFIRMED (code path) · Module: Core/users
- Description: user deletion is soft (`user.service.ts:224`). The invite and accept flows reject any existing user with that email, without a `deletedAt` filter, and `users.email` is globally unique. Re-onboarding a returning employee or client with the same email is impossible without manual SQL.
- Evidence: `backend/src/services/user-invitation.service.ts:60, 155-156`; `schema.prisma:20`.
- Fix: a partial unique index `WHERE deleted_at IS NULL` (with DB-005 lower()), plus restore-on-invite. Complexity: S.

### Positive controls verified (no finding)
- The ledger is strong: balanced-journal deferred constraint trigger (repro-tested), immutability triggers, period-close guard, account-history guard, Restrict FKs, Serializable posting with `lockOpenPeriod … FOR UPDATE`, and maker-checker (`finance.service.ts:455-520`).
- Payments: invoice row `FOR UPDATE` on both manual and webhook paths, `payments.idempotency_key` unique with a replay check, a pending-amount check, and `Restrict` from payment to invoice and from invoice to client (`manualBank.gateway.ts:15-60`, `payment.service.ts:75-119`).
- Invoice numbers: per-year advisory lock (`invoice.service.ts:149-155`). `github_webhook_events.delivery_id` unique. `notification_deliveries.dedupe_key` unique. Job openings with applications can't be hard-deleted (`job.service.ts:210-226`).
- Migrations: no `DROP COLUMN`/`DROP TABLE`, no `NOT NULL` column added without a default, and every `ALTER TYPE` is an additive `ADD VALUE`. The data backfills (`legacy_task_approval`, `backfill_engineer_profiles`, `portfolio_categories`, `portfolio_project_inquiries`) are small, idempotent and set-based. Note: `20261016150000` sets `featured=true` on **all** published portfolio items, which is a content side effect on production.

## 4. Database risk assessment

| ID | Risk | Likelihood | Impact | Severity | Fix effort |
|---|---|---|---|---|---|
| DB-004 | HR attendance/leave forgery and exposure by STAFF | High (any staff) | High | P1 | M |
| DB-001 | RBAC data exists only via dev seed; new perms need a seed | Certain on fresh env / new perms | High | P1 | M |
| DB-003 | Seed re-run wipes role customisations / resets admin password | Medium | Medium-High | P2 | S |
| DB-002 | Fake testimonials and demo data in production | Certain (observed) | Medium (legal/brand) | P2 | S |
| DB-017 | Plaintext TOTP secrets | Low (needs DB leak) | High | P2 | M |
| DB-011 | Cascade wipes HR/financial history on hard delete | Low today | Very high | P2 | S |
| DB-008 | Invoice subtotal ≠ Σ lines | Medium (fractional qty) | Medium | P2 | S |
| DB-005 | Case-variant duplicate accounts | Low-Medium | Medium | P2 | S |
| DB-006 | Unique/serialization errors become 500 | Medium | Medium | P2 | S |
| DB-007 | Ticket code collision | Low-Medium | Low-Medium | P2 | S |
| DB-009 | VOID invoice resurrected by send race | Low | Medium | P2 | S |
| DB-010 | Employee rows created on GET / not transactional | Medium | Low-Medium | P2 | M |
| DB-016 | Ledger trigger seq-scans, unindexed FKs | Grows with data | Low→Medium | P3 | S |
| DB-012/013 | Archived/soft-deleted rows in admin lists/dashboard | High | Low | P3 | S |
| DB-018/019/021 | Write-on-read, missing CHECKs/FKs, email reuse | Medium | Low | P3 | S |
| DB-014/015/020 | Drift, odd timestamps, conventions | — | Low | P3 | S |

## 5. Acceptance rows

| Feature | Status | Evidence |
|---|---|---|
| Migrations apply from scratch | VERIFIED | 55/55 applied in 2.29 s on `somwave_dbaudit` (and 2.70 s on an isolated schema) |
| Schema ↔ migrations in sync | PARTIAL | `migrate diff` is non-empty (2 statements, DB-014) |
| Seed idempotent | VERIFIED (row counts) / PARTIAL (side effects) | identical counts after 2 runs; DB-003 |
| Migrations alone produce a usable RBAC | FAILED | 15/70 permissions, 3/13 roles (DB-001) |
| pgvector dependency | VERIFIED not required | 0 references; applies without the extension |
| Money stored as Decimal | VERIFIED | 0 Float; Decimal(12,2) for AR, (20,2) for ledger |
| Ledger journals must balance (DB-enforced) | VERIFIED | unbalanced finalize rejected by trigger |
| Invoice + items atomic, numbered safely | VERIFIED (code) / PARTIAL | `$transaction` + advisory lock; rounding defect DB-008 |
| Payment + invoice status atomic, idempotent | VERIFIED (code review) | row lock + unique idempotency key; not executed end-to-end |
| Case-insensitive unique email | FAILED | duplicate insert succeeded (DB-005) |
| HR records owner-scoped | FAILED | DB-004 |
| Financial/HR never hard-deleted | PARTIAL | soft-delete in services; Cascade FKs remain (DB-011) |
| Soft-delete filtering consistent | PARTIAL | DB-012, DB-013 |
| Unique constraints (invoice no., idempotency key, webhook delivery id) | VERIFIED | `invoices_number_key`, `payments_idempotency_key_key`, `github_webhook_events_delivery_id_key` |
| Production DB state / migration history | BLOCKED | no credentials |
