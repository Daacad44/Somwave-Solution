# Projects, Engineering, Bugs/Maintenance/Releases and GitHub Audit

| | |
|---|---|
| Date | 2026-10-17 |
| Repository state | `main` at `4323f55` (PR #86) |
| Scope | Projects, tasks, milestones, engineering workspace and planning, engineer accounts, operations (systems, bugs, maintenance, releases, deployments), timesheets, analytics, GitHub integration. |
| Method | Read-only code inspection with file:line evidence; targeted local test runs; unauthenticated, low-volume GET/HEAD/OPTIONS probes of production. No production credentials, Coolify, Resend, S3 or GitHub App access. |
| Source | Projects & Engineering agent report (05), prefixes PRJ- and ENG- |
| Related | [System audit report](SYSTEM_AUDIT_REPORT.md) · [Bug register](BUG_REGISTER.md) · [Acceptance matrix](ACCEPTANCE_MATRIX.md) · [Remediation roadmap](REMEDIATION_ROADMAP.md) |

Each finding keeps the specialist agent's original ID; the consolidated `SW-` ID from the [bug register](BUG_REGISTER.md) is shown next to it. Severity in the index is the consolidated severity; where duplicates were merged the higher severity was kept, so it can differ from the severity line inside the original finding text.

## Finding index

| Original ID | SW ID | Severity (consolidated) | Confidence | Consolidated title |
|---|---|---|---|---|
| ENG-001 | [SW-012](BUG_REGISTER.md#sw-012) | P1 | CONFIRMED | QA_ENGINEER role cannot perform QA verification (or comment, log progress or hours) |
| PRJ-001 | [SW-045](BUG_REGISTER.md#sw-045) | P2 | CONFIRMED | Progress counts cancelled tasks; five inconsistent progress formulas across surfaces |
| PRJ-002 | [SW-046](BUG_REGISTER.md#sw-046) | P2 | CONFIRMED | "Unassigned projects" KPI and filter include COMPLETED/CANCELLED projects and projects with pending invitations |
| PRJ-003 | [SW-047](BUG_REGISTER.md#sw-047) | P2 | CONFIRMED | Legacy task path has no lifecycle rules; completedAt never set; assignee can mark DONE directly |
| ENG-002 | [SW-048](BUG_REGISTER.md#sw-048) | P2 | CONFIRMED | Assignee can self-advance IN_REVIEW -> TESTING (code review step not independent) |
| ENG-003 | [SW-049](BUG_REGISTER.md#sw-049) | P2 | CONFIRMED | SLA escalation scan starves: always the same oldest 100 breached records |
| ENG-004 | [SW-050](BUG_REGISTER.md#sw-050) | P2 | CONFIRMED | Critical-bug alert skips the project's primary manager (project.managerId) |
| ENG-005 | [SW-051](BUG_REGISTER.md#sw-051) | P2 | CONFIRMED | Cancelled engineer account invitation permanently blocks that email |
| ENG-006 | [SW-044](BUG_REGISTER.md#sw-044) | P2 | CONFIRMED | Timesheet approval is unscoped and effectively self-approval |
| ENG-007 | [SW-028](BUG_REGISTER.md#sw-028) | P2 | SUSPECTED | Project managers can provision new user accounts and grant the ENGINEER role via project invite (bypassing admin-only onboarding) |
| ENG-008 | [SW-052](BUG_REGISTER.md#sw-052) | P2 | SUSPECTED | GitHub webhook body limit of 256 KB will reject legitimate large deliveries |
| PRJ-004 | [SW-091](BUG_REGISTER.md#sw-091) | P3 | CONFIRMED | Archived projects' tasks/milestones appear for admins; legacy /tasks exposes other engineers' unapproved proposals |
| PRJ-005 | [SW-100](BUG_REGISTER.md#sw-100) | P3 | CONFIRMED | Portfolio list health differs from project detail health |
| PRJ-006 | [SW-101](BUG_REGISTER.md#sw-101) | P3 | CONFIRMED | Portal dashboard counts milestones the client cannot see |
| PRJ-007 | [SW-102](BUG_REGISTER.md#sw-102) | P3 | CONFIRMED | Project create/update: invalid clientId -> 500; deleted client accepted; PM change not audited or notified; no date ordering |
| PRJ-008 | [SW-103](BUG_REGISTER.md#sw-103) | P3 | CONFIRMED | Project creation wizard is non-atomic |
| PRJ-009 | [SW-104](BUG_REGISTER.md#sw-104) | P3 | CONFIRMED | Cache invalidation gaps: dashboard never invalidated; accept-invitation does not refresh /projects |
| ENG-009 | [SW-106](BUG_REGISTER.md#sw-106) | P3 | CONFIRMED | Invitation email failure returns 503 but the invitation is saved; retrying returns 409 |
| ENG-010 | [SW-107](BUG_REGISTER.md#sw-107) | P3 | SUSPECTED | Task dependency cycle check is not atomic |
| ENG-011 | [SW-108](BUG_REGISTER.md#sw-108) | P3 | SUSPECTED | Single-active-timer constraint exists only in raw SQL (not representable in schema.prisma) |
| ENG-012 | [SW-109](BUG_REGISTER.md#sw-109) | P3 | CONFIRMED | Manual task hours: future dates and unlimited daily totals accepted; two time systems unreconciled |
| ENG-013 | [SW-110](BUG_REGISTER.md#sw-110) | P3 | CONFIRMED | Bug lifecycle gaps: reopen keeps original SLA, severity immutable, no optimistic lock, lists unpaginated |
| ENG-014 | [SW-111](BUG_REGISTER.md#sw-111) | P3 | CONFIRMED | Release gates: PM can mark APPROVED -> DEPLOYED without a deployment record; admin may approve own release |
| ENG-015 | [SW-112](BUG_REGISTER.md#sw-112) | P3 | CONFIRMED | Activity feed omits member/handover/phase/release/deployment audits and shows finance expense events to every project viewer |
| ENG-016 | [SW-113](BUG_REGISTER.md#sw-113) | P3 | CONFIRMED | GitHub integration robustness gaps (stuck RECEIVED deliveries, reactivation of suspended installs, token per view, stale CI run) |
| ENG-017 | [SW-053](BUG_REGISTER.md#sw-053) | P2 | CONFIRMED | Background jobs are in-process setInterval timers (no BullMQ) running on every API replica; the documented dedicated worker cannot be started from the image |
| PRJ-010 | [SW-105](BUG_REGISTER.md#sw-105) | P3 | CONFIRMED | Minor project UI/data issues: Gantt uses createdAt as start; workspace caps tasks at 100 and milestones at 50; portfolio filters in memory |

## 1. Scope inspected

Backend services: project.service.ts, task.service.ts, milestone.service.ts, timesheet.service.ts, project-activity.service.ts, project-documentation.service.ts (access + decode), engineering.service.ts (access, invitations, members, tasks, review, QA, dependencies, hours, attachments), engineering-worklog.service.ts (timers), engineer-account.service.ts (provision/activation/suspend/cancel), engineering-analytics.service.ts, engineering-operations.service.ts (systems, updates, bugs, maintenance, releases, deployments), sla-escalation.service.ts, system-health.service.ts, background-jobs.ts, dashboard.service.ts (project/portal widgets), client.service.ts (progress), github.service.ts, github.client.ts, github.controller.ts (webhook).
Routes: project.routes.ts, task.routes.ts, engineering.routes.ts, github.routes.ts, platform.routes.ts (timesheets), app.ts (raw-body mounts). Seed role→permission map (backend/prisma/seed.ts). Migration 20261013040000_engineering_time_tracking.
Frontend: features/projects (ProjectsPage, hooks, api, assignment.ts, ProjectCreationWizard, ProjectEngineerAssignmentModal, ProjectTimeline), features/dashboard (metrics.ts, hooks.ts), features/engineering (EngineeringWorkspacePage invalidation), features/ops/TimesheetsPage, App.tsx routes, lib/queryClient.ts.
Docs: ENGINEERING_PLATFORM.md (claims cross-checked), MASTER_ACCEPTANCE.md (skimmed).

Tests executed (mocked-Prisma unit tests, `npx vitest run <files>` from repo root): project.service, task.service, milestone.service, engineering.service, engineering-worklog.service, engineer-account.service, github.service, system-health.service, timesheet.service, project-activity.service, frontend projects/assignment, dashboard/metrics → **12 files, 112 tests, 112 passed, 0 failed**. Note: github.service.test.ts has only 2 tests (signature helper); webhook processing, dedup, task-link and CI→QA logic have no tests.

Production probes (unauthenticated GET/OPTIONS, 8 requests): `/health` 200; `/api/v1/projects`, `/projects/portfolio`, `/engineering/projects`, `/github/repositories`, `/tasks` all 401 with standard envelope `{"error":{"code":"UNAUTHORIZED",...}}`; OPTIONS `/api/v1/github/webhooks` 204.

BLOCKED: live GitHub App install/token/webhook delivery (no App credentials/secret); Resend email delivery of assignment/activation emails (no Resend access); authenticated production workflows (no credentials); S3 attachment storage; Coolify worker/replica topology (affects background job duplication).

## 2. Module inventory

| Module | Frontend routes | Backend endpoints | Models | Permissions | Tests | Status |
|---|---|---|---|---|---|---|
| Projects | /projects, /projects/:id | /projects (list, portfolio, :id, :id/workspace, :id/activity, :id/health-note, :id/finance, expenses, budget-revisions, POST/PATCH/DELETE) | Project, ProjectMember | projects.* (+invoices.* for finance) | project.service 26 ✓ | Implemented; progress/health/KPI defects |
| Tasks (legacy) | /tasks (table + TaskKanban) | /tasks CRUD | Task, TaskTransition | tasks.* | task.service 13 ✓ | Implemented; review bypass for reviewRequired=false |
| Milestones | /milestones, portal /portal/milestones | /milestones CRUD + dependencies | Milestone, MilestoneDependency | milestones.* | milestone.service 19 ✓ | Implemented; cycle check in txn |
| Engineering workspace / planning | /engineering, /engineering/planning | /engineering/* (projects, invitations, members, phases, tasks, submit, review, comments, progress, checklist, dependencies, verify-qa, schedule, hours, attachments, timers, handovers) | ProjectInvitation, ProjectAssignmentEvent, ProjectPhase, TaskReview, TaskChecklistItem, TaskDependency, TaskTimeEntry, EngineerTaskTimer, TaskAttachment, ProjectHandover | engineering.read/manage/tasks.create/tasks.review | engineering.service 24 ✓, worklog 6 ✓ | Implemented; QA role permission gap |
| Engineer accounts | /engineering/engineers(/:id), /activate-engineer | engineer-account routes | EngineerProfile, EngineerAccountInvitation | admin-only (requireAccountAdmin) + PM via project invite | engineer-account 8 ✓ | Implemented; cancelled-invite dead end |
| Ops: systems/bugs/maintenance/releases | /engineering/operations | engineering-operations routes | ManagedSystem, SystemUpdate, BugReport, MaintenanceRequest, Release, ReleaseTask, ReleasePullRequest, Deployment, SystemHealthCheck | engineering.* + project membership | no service test for engineering-operations.service.ts | Implemented; SLA scan starvation |
| Health checks | (operations page) | background scan | SystemHealthCheck | n/a | system-health 3 ✓ | SSRF controls solid |
| Timesheets | /timesheets | /timesheets GET/POST/PATCH | Timesheet | timesheets.* | timesheet 3 ✓ | Approval control broken |
| Analytics | /engineering/analytics | /engineering/analytics | — | engineering.read | none | Implemented; formula variant |
| GitHub | /github | /github/installations, repositories, activity, tasks/:id/links, POST /github/webhooks | GitHubInstallation, GitHubRepository, GitHubTaskLink, GitHubWebhookEvent | github.read/manage (admins only in seed) | github.service 2 ✓ | Code present; live BLOCKED |
| Dashboard (projects widgets) | /dashboard | /dashboard/overview | — | per-module | metrics 5 ✓ | Stale after mutations (30 s) |

## 3. Findings

### ENG-001 (SW-012) — QA_ENGINEER role cannot perform QA verification (or comment/log progress/hours)
- Severity: P1 · Confidence: CONFIRMED · Module: Engineering QA
- Description: `POST /engineering/tasks/:taskId/verify-qa` requires `engineering.tasks.review`; the seeded QA_ENGINEER role does not hold it. The service (`verifyTaskQa`) explicitly allows project role QA_ENGINEER, and ENGINEERING_PLATFORM.md §permissions says "QA engineer: QA verification". QA_ENGINEER also lacks `engineering.tasks.create`, so comments, progress, checklist, hours routes are 403 for them. Additionally, project-invite activation always grants system role ENGINEER (engineer-account.service.ts:561-589), which also lacks `engineering.tasks.review`, so an engineer invited with project role QA_ENGINEER cannot verify either.
- Evidence: backend/src/routes/engineering.routes.ts:301-305 `rbac(PERMISSIONS.ENGINEERING_TASK_REVIEW), controller.verifyQa`; backend/prisma/seed.ts:146-155 QA_ENGINEER = projects.read, tasks.read, tasks.update, milestones.read, engineering.read, project-documentation.read, github.read, notifications.read; engineering.service.ts:2003-2006 `if (!context.manage && context.role !== 'QA_ENGINEER')`.
- Expected: QA engineers verify QA. Actual: only managers/admins or system LEAD_ENGINEER can; TESTING→DONE requires `qaVerifiedAt` (task.service.ts:245), so tasks stall unless a manager does QA.
- Root cause: seed role map omits `engineering.tasks.review` (and `engineering.tasks.create`) for QA_ENGINEER; activation grants only ENGINEER.
- Affected: QA engineers, delivery throughput. Impact: independent QA gate effectively performed by managers.
- Fix: add `engineering.tasks.review` (+ `engineering.tasks.create` for comments) to QA_ENGINEER in seed and backfill migration; optionally a dedicated `engineering.qa.verify` permission. Complexity S. Verify: route test as QA_ENGINEER → 200; ENGINEER → 403.

### PRJ-001 (SW-045) — Progress excludes nothing: cancelled tasks count against progress; five inconsistent progress formulas
- Severity: P2 · Confidence: CONFIRMED · Module: Projects/Dashboard/Portal
- Description: `deriveProgress(total, done)` uses total including CANCELLED tasks, so a project with 9 DONE + 1 CANCELLED shows 90% and can never reach 100%. The workspace even computes `cancelled` but only uses it for health, not progress; `taskCounts.open = total - done` counts cancelled as open. Formulas differ across surfaces:
  1. Portfolio/list (project.service.ts:291-297, 333): all approval states incl. drafts, cancelled in total, null if no tasks.
  2. Workspace staff (project.service.ts:735-757, 886): same as 1.
  3. Portal project page (getProjectWorkspace clientView): only `approvalStatus: 'APPROVED'` (project.service.ts:738-757) → client sees a different % than staff.
  4. Portal dashboard recent projects (dashboard.service.ts:545, 674-675): all approval states → differs from #3 for the same client.
  5. Milestone progressPercent (milestone.service.ts:57-66): APPROVED only, cancelled in total. Engineering analytics (engineering-analytics.service.ts:52-55, 115): APPROVED only and `percent: 0` when no tasks (others return null).
- Expected: one shared function: done / (total − cancelled), consistent approval filter. Fix: centralize in packages/shared or project.service, use everywhere. Complexity S-M. Verify: unit test 9 DONE + 1 CANCELLED → 100%; compare portal page vs portal dashboard.

### PRJ-002 (SW-046) — "Unassigned projects" KPI and filter include COMPLETED/CANCELLED projects (unactionable) and projects with pending invitations
- Severity: P2 · Confidence: CONFIRMED · Module: Projects portfolio
- Trace: KPI tile click → `showAssignmentGroup('unassigned')` sets `?assignment=unassigned` (frontend ProjectsPage.tsx:47-50, 128-150) → `getProjectPortfolio(assignment)` (project.controller.ts:69-71) → filter `row.assignedEngineers === 0` (project.service.ts:405-406); KPI `unassignedProjects = portfolio.filter(row => row.assignedEngineers === 0)` (project.service.ts:353). No status filter, so completed/cancelled projects are counted and listed, but the "Assign engineer" button is hidden for them (ProjectsPage.tsx: `project.status !== 'COMPLETED' && project.status !== 'CANCELLED'`) and the backend rejects invites (engineering.service.ts:516-517). Projects whose only engineers have pending invitations show assignmentStatus 'PENDING' but are still counted as "Unassigned".
- Impact: inflated KPI, rows that cannot be acted on. Fix: restrict unassigned to status in (PLANNING, ACTIVE, ON_HOLD) and decide whether PENDING counts. Complexity S. Verify: seed completed project w/o engineers → KPI excludes it.

### PRJ-003 (SW-047) — Legacy task path: no lifecycle rules, `completedAt` never set, assignee can mark DONE directly
- Severity: P2 · Confidence: CONFIRMED · Module: Tasks
- Description: Tasks created via `POST /tasks` get `reviewRequired: false` (task.service.ts:162-163). For these, `updateTask` skips the transition table, dependency check, checklist check and QA gate and runs a plain update (task.service.ts:287-299) that never sets `completedAt` or writes a TaskTransition. An assigned engineer (tasks.update) may PATCH `{status:'DONE'}` (allowed status-only edit, task.service.ts:201-206). The project creation wizard creates its initial tasks through this path (ProjectCreationWizard.tsx:155-161).
- Impact: analytics "task completion" (`completed_at` query, engineering-analytics.service.ts:69) under-reports; prerequisite tasks can be completed out of order; no audit trail of transitions. Fix: apply transition/dependency rules and `completedAt` for all tasks; record TaskTransition. Complexity M. Verify: PATCH DONE on legacy task → completedAt set; dependency-blocked IN_PROGRESS → 409.

### ENG-002 (SW-048) — Assignee can self-advance IN_REVIEW → TESTING (code review step not independent)
- Severity: P2 · Confidence: CONFIRMED · Module: Engineering task workflow
- Description: The "review" in `reviewEngineeringTask` is proposal approval (DRAFT→APPROVED). Work review afterwards is just a status transition in `updateTask` (IN_REVIEW: ['TESTING','IN_PROGRESS'], task.service.ts:217-225); the assignee is allowed status-only updates (task.service.ts:201-206), so they can move their own work out of review. Only the QA step has an independence check (engineering.service.ts:2006-2007).
- Fix: require reviewer/manager (≠ assignee) for IN_REVIEW→TESTING; record reviewer. Complexity S. Verify: assignee PATCH TESTING → 403.

### ENG-003 (SW-049) — SLA escalation scan starves: always the same oldest 100 breached records
- Severity: P2 · Confidence: CONFIRMED · Module: Bugs/maintenance SLA
- Description: `scanSlaBreaches` fetches `take: 100` ordered by `reportedAt/createdAt asc`, filtered only by status and missed deadline (sla-escalation.service.ts:60-102). Already-escalated records keep matching (dedupe only suppresses the notification), so once ≥100 open breached bugs (or maintenance) exist, newer breaches are never escalated.
- Fix: track `escalatedAt`/stage on the record or exclude already-notified stages; paginate with cursor. Complexity S. Verify: unit test with 101 breached rows → 101st notified.

### ENG-004 (SW-050) — Critical-bug alert skips the project's primary manager (`project.managerId`)
- Severity: P2 · Confidence: CONFIRMED · Module: Bugs
- Description: `createBug` notifies only `projectMember` rows with role MANAGER (engineering-operations.service.ts:303-318). The PM assigned through project create/edit is stored in `project.managerId` with no membership row (project.service.ts:514-547 creates none). Projects with only `managerId` get no immediate critical alert; the PM learns only via the SLA breach scan (≥1 h + up to 15 min later; sla-escalation.service.ts:21-31 does include managerId).
- Fix: include `project.managerId` (as escalate() does). Complexity S. Verify: create CRITICAL bug on project with managerId only → notification row.

### ENG-005 (SW-051) — Cancelled engineer account invitation permanently blocks that email
- Severity: P2 · Confidence: CONFIRMED · Module: Engineer registration
- Description: `cancelEngineerInvitation` sets status CANCELLED (engineer-account.service.ts:448-472). Re-inviting goes to `provisionAccount`, which throws 409 "An engineer invitation already exists for this email" whenever any invitation row exists (engineer-account.service.ts:163-165; `userId @unique` on EngineerAccountInvitation, schema.prisma:1315). `sendFreshInvitation`/resend only accepts INVITED/VERIFIED (engineer-account.service.ts:386-389). Same path is hit from project invite (`ensureEngineerAccountForProjectInvite`, :233-262).
- Fix: allow re-provision when status CANCELLED (reset row). Complexity S. Verify: cancel then re-invite → 201.

### ENG-006 (SW-044) — Timesheet approval is unscoped and effectively self-approval
- Severity: P2 · Confidence: CONFIRMED · Module: Timesheets
- Description: `GET /timesheets` returns only the caller's own rows (timesheet.service.ts:44-52), and the page shows "Approve" on those rows when the user has timesheets.update (TimesheetsPage.tsx:86-92) — so managers (seed grants `timesheets.*` to MANAGER, seed.ts:84-90) approve their own hours. `updateTimesheetStatus` accepts any id with no ownership/team scope, no self-approval check, no state machine and no audit log (timesheet.service.ts:77-87). `createTimesheet` accepts any existing projectId, not just projects the user belongs to (timesheet.service.ts:58-63), contrary to CLAUDE.md §13.
- Fix: manager approval queue scoped to reports/projects, forbid self-approval, audit, restrict projectId to projectScope. Complexity M. Verify: API test manager approving own row → 403; other-project id → 400/404.

### ENG-007 (SW-028) — Project managers can provision new user accounts and grant the ENGINEER role via project invite
- Severity: P2 · Confidence: SUSPECTED (may be intended; doc describes it) · Module: Engineer registration
- Description: Admin-only `createEngineerAccount` uses `requireAccountAdmin` (engineer-account.service.ts:216-225), but `inviteProjectEngineer` (requires only project manager + engineering.manage) calls `ensureEngineerAccountForProjectInvite`, which calls `provisionAccount` for any email, including existing non-engineer users (e.g., CLIENT accounts). On activation the user is given role ENGINEER (engineer-account.service.ts:561-589). Existing users must confirm with their password, so no takeover, but account creation/role grant authority extends to every PM.
- Fix: restrict new-account provisioning to admins or require admin approval; refuse CLIENT-role emails. Complexity S. Verify: PM invite unknown email → 403 (or pending admin approval).

### ENG-008 (SW-052) — GitHub webhook body limit 256 KB will reject legitimate large deliveries
- Severity: P2 · Confidence: SUSPECTED (code CONFIRMED; live BLOCKED) · Module: GitHub
- Description: `/api/v1/github/webhooks` mounted with `express.raw({ limit: '256kb' })` (backend/src/app.ts:71-72). GitHub deliveries are capped at 25 MB; push events with many commits and PR payloads with long bodies routinely exceed 256 KB → 413 before signature check, delivery marked failed by GitHub; the push/PR state is never synced.
- Fix: raise to ~5-25 MB for this route only (signature check is cheap) or accept and truncate. Complexity S. Verify: signed 1 MB payload → 202.

### PRJ-004 (SW-091) — Legacy `/tasks` endpoints expose other engineers' unapproved task proposals; tasks of archived projects listed for admins
- Severity: P3 · Confidence: CONFIRMED · Module: Tasks visibility
- Description: `listTasks`/`getTask` filter by `project: projectScope(actor)` only (task.service.ts:81-86, 103-105); engineers holding tasks.read see DRAFT/SUBMITTED/REJECTED proposals of colleagues that `visibleTask` hides (engineering.service.ts:1772-1782 returns 404). Workspace task list for staff also has no approval filter (project.service.ts:701). For admins `projectScope` is `{}` and there is no `deletedAt: null` on the project, so tasks of soft-deleted projects appear in `/tasks`.
- Fix: apply the same approval visibility rule and `project.deletedAt: null`. Complexity S.

### PRJ-005 (SW-100) — Portfolio list health differs from project detail health
- Severity: P3 · Confidence: CONFIRMED · Module: Projects
- Description: Portfolio calls `deriveProjectHealthDetails` without blockedDependencies/constrainedEngineers and with `remainingTasks = total - done` (cancelled counted as remaining) (project.service.ts:317-326); workspace passes both and subtracts cancelled (project.service.ts:845-855). A project can show ON_TRACK in the list and AT_RISK on its page.
- Fix: share one health computation. Complexity M.

### PRJ-006 (SW-101) — Portal dashboard counts milestones the client cannot see
- Severity: P3 · Confidence: CONFIRMED · Module: Portal dashboard
- Evidence: dashboard.service.ts:548-554 counts milestones with `status not COMPLETED` for the client's projects without `clientVisible: true`, whereas portal milestone pages filter clientVisible (project.service.ts:717). Leaks internal milestone count; mismatch with list. Fix: add `clientVisible: true`. Complexity S.

### PRJ-007 (SW-102) — Project create/update: invalid clientId → 500; deleted client accepted; PM change not audited/notified
- Severity: P3 · Confidence: CONFIRMED · Module: Projects
- Description: `clientId` is never validated (project.service.ts:536, 588); a non-existent id raises Prisma P2003, which errorHandler maps to 500 INTERNAL_ERROR (middleware/errorHandler.ts:29-38). Soft-deleted clients are accepted. Audit before/after omit managerId/clientId (project.service.ts:592-608), and the newly assigned PM gets no notification. No startDate ≤ dueDate check (packages/shared/src/schemas/project.ts:55-65).
- Fix: validate client exists and not deleted; include managerId/clientId in audit; notify new PM; refine dates. Complexity S.

### PRJ-008 (SW-103) — Project creation wizard is non-atomic
- Severity: P3 · Confidence: CONFIRMED · Module: Projects
- Description: Wizard creates the project, then phases, milestones, tasks, and invitations as separate requests (ProjectCreationWizard.tsx:116-171); failures leave a partially planned project (reported to user as a list). Acceptable but no server-side composite endpoint/idempotency. Complexity M.

### PRJ-009 (SW-104) — Cache invalidation gaps: dashboard never invalidated; accept-invitation does not refresh /projects; no optimistic updates
- Severity: P3 · Confidence: CONFIRMED · Module: Frontend
- Description: Dashboard key `['dashboard','overview',range]` (dashboard/hooks.ts:9) is not invalidated by any mutation (grep of invalidateQueries); with staleTime 30 s (lib/queryClient.ts:8) KPIs lag after assignment/creation. Accept/decline invalidates engineering keys only (EngineeringWorkspacePage.tsx:45-48), not `['projects']`. Project mutations use invalidate-on-success, not optimistic-with-rollback required by CLAUDE.md §11 (projects/hooks.ts:46-79). Fix: invalidate `['dashboard']` and `['projects']` in assignment/accept/create flows. Complexity S.

### ENG-009 (SW-106) — Invitation email failure returns 503 but invitation is saved; "retry the invitation" then returns 409
- Severity: P3 · Confidence: CONFIRMED · Module: Assignment invitations
- Evidence: engineering.service.ts:498-506 (503 after commit at :561-596); re-invite hits `pending` check → 409 "Engineer already has a pending invitation" (:545-547). User must use resend instead; message is misleading. Fix: return 202 with `emailQueued:false`, or have invite re-queue email for an existing pending invitation. Complexity S.

### ENG-010 (SW-107) — Task dependency cycle check not atomic
- Severity: P3 · Confidence: SUSPECTED · Module: Dependencies
- Description: `addTaskDependency` reads edges and inserts outside a transaction (engineering.service.ts:1950-1971); concurrent A→B and B→A can both pass and create a cycle (milestone version uses a transaction, milestone.service.ts:390+). Also edges capped at `take: 10000`. Fix: serializable transaction or advisory lock per project. Complexity S.

### ENG-011 (SW-108) — Single-active-timer constraint exists only in raw SQL (Prisma schema drift)
- Severity: P3 · Confidence: SUSPECTED · Module: Time tracking
- Description: Single active timer per user is correctly enforced by partial unique index `engineer_task_timers_one_active_per_user_idx ... WHERE stopped_at IS NULL` (migrations/20261013040000_engineering_time_tracking/migration.sql:12) and service maps P2002 → 409 (engineering-worklog.service.ts:88-91) — race-safe. But the index is not representable in schema.prisma (model at :1689-1703), so a future `prisma migrate dev` diff may propose dropping it. Fix: document/guard in CI with a migration drift check. Complexity S.

### ENG-012 (SW-109) — Manual task hours: future dates and unlimited daily totals accepted
- Severity: P3 · Confidence: CONFIRMED · Module: Time tracking
- Evidence: `recordTaskHours` validates only date format (engineering.service.ts:2116-2121); minutes ≤1440 per entry (packages/shared/src/schemas/engineering.ts:175) but any number of entries/day and future dates allowed. Two separate time systems (HR Timesheet vs TaskTimeEntry) are not reconciled. Fix: reject future dates, cap per-day sum. Complexity S.

### ENG-013 (SW-110) — Bug lifecycle gaps: reopen keeps original SLA, severity immutable, no optimistic lock
- Severity: P3 · Confidence: CONFIRMED · Module: Bugs
- Evidence: updateBug (engineering-operations.service.ts:325-396) — REOPENED clears resolvedAt but keeps `resolutionDueAt` (immediately breached; and SLA dedupe key unchanged so no new alert); no severity/priority re-triage field; `prisma.bugReport.update({ where: { id } })` after a read (TOCTOU) while maintenance/releases use status-guarded updateMany. `listBugs`/`listMaintenance` unpaginated. Complexity S.

### ENG-014 (SW-111) — Release gates: PM can mark APPROVED→DEPLOYED without a deployment record; admin may approve own release
- Severity: P3 · Confidence: CONFIRMED · Module: Releases
- Evidence: RELEASE_TRANSITIONS allows APPROVED→DEPLOYED via `transitionRelease` with only manager access (engineering-operations.service.ts:780-833), bypassing `recordDeployment`'s admin + approval check (:848-862). `approveRelease` does not check `ownerId !== actor.id` (:755-788). Verification to VERIFIED does require a SUCCEEDED production deployment (good). Fix: DEPLOYED only via recordDeployment; separation of duties. Complexity S.

### ENG-015 (SW-112) — Project activity feed omits member/handover/phase/release/deployment audits; shows finance expense events to every project viewer
- Severity: P3 · Confidence: CONFIRMED · Module: Project activity
- Evidence: project-activity.service.ts:16-39 includes only Task, Milestone, ProjectDocumentation, BugReport, MaintenanceRequest, ProjectExpense, ProjectInvitation subject types; route requires only projects.read (project.routes.ts:24) so engineers see `ProjectExpense` audit actions. Fix: add missing subject types; gate expense events on invoices.read. Complexity S.

### ENG-016 (SW-113) — GitHub integration robustness
- Severity: P3 · Confidence: CONFIRMED (code) · Module: GitHub
- Verified good: HMAC SHA-256 over raw body with `timingSafeEqual` and length check (github.service.ts:30-38; raw mount app.ts:71-72); signature checked before JSON parse (github.controller.ts:159-174); delivery dedup via unique deliveryId with FAILED re-claim (github.service.ts:716-748); unknown installations ignored until admin connect; disconnect not reactivated by webhook; PR→task link only within mapped project; merge never completes task; failed check clears QA.
- Gaps: (a) a delivery stuck in RECEIVED (process crash mid-apply) is treated as duplicate forever (github.service.ts:736-741); (b) `installation` events other than deleted/suspend (e.g. `new_permissions_accepted`) set ACTIVE, reactivating a SUSPENDED installation (:477-479); (c) GITHUB_APP_ID/PRIVATE_KEY/WEBHOOK_SECRET read from `process.env`, not Zod-validated env (github.client.ts:32-33, github.controller.ts:165; lib/env.ts has none) contrary to CLAUDE.md §13; (d) a new installation token is minted on every activity view (github.client.ts:165); (e) CI gate uses specific check-run ids, so a stale SUCCESS run on an old commit satisfies QA (engineering.service.ts:2010-2015). Live behaviour BLOCKED.

### ENG-017 (SW-053) — Background jobs use in-process setInterval, not BullMQ; duplicated per replica
- Severity: P3 · Confidence: CONFIRMED · Module: Ops jobs
- Evidence: background-jobs.ts:57-62; enabled by default on every API process (lib/env.ts:38, server.ts:18). Health probes write duplicate SystemHealthCheck rows per replica (notifications deduped). CLAUDE.md §11 requires BullMQ with deterministic jobIds. Complexity M.

### PRJ-010 (SW-105) — Minor project UI/data issues
- Severity: P3 · Confidence: CONFIRMED · Module: Projects
- Gantt (ProjectTimeline.tsx:52-57) uses task `createdAt` as bar start (AdminTask has no startDate); workspace caps tasks at 100 and milestones at 50 without pagination (project.service.ts:700-733); portfolio loads all projects into memory and filters/paginates in JS (project.service.ts:182-427); `ensureEmployee` creates a duplicate Employee when a soft-deleted one exists → unique violation 500 (timesheet.service.ts:35-42).

Health-check SSRF review (no finding): allowlist of exact hosts via HEALTH_PROBE_HOSTS, https-only, no port/userinfo/IP literals, DNS resolved and every address checked against private/reserved ranges, connection pinned to resolved IP with SNI, no redirect following, 8 s timeout (system-health.service.ts:9-96). Minor: NAT64 (64:ff9b::/96) and 6to4 (2002::/16) not blocked — negligible given exact allowlist.

## 4. Acceptance rows

| Feature | Status | Evidence |
|---|---|---|
| Create/edit/archive project (soft delete, audit) | PARTIAL | project.service.ts:514-613, 898-913; unit tests pass; PRJ-007 |
| Restore archived project | NOT IMPLEMENTED | no restore path in project.service/routes |
| Status/priority/health | PARTIAL | health derivation exists; list/detail mismatch PRJ-005 |
| PM assignment | PARTIAL | assertManagerExists; no notify/audit of change (PRJ-007) |
| Engineer assignment during creation | PARTIAL | wizard → inviteSelectedEngineers (non-atomic, PRJ-008) |
| Engineer assignment on existing project / from list | PARTIAL | ProjectEngineerAssignmentModal → /engineering invite; tested assignment.test.ts ✓ |
| Unassigned KPI → filtered list → assign | PARTIAL | param traced end-to-end; KPI includes completed/cancelled (PRJ-002) |
| Invitation email | BLOCKED | queued via emitNotification requiredEmail; Resend not testable |
| Accept/decline invitation | PARTIAL | race-safe claim, membership on accept (engineering.service.ts:650-789); unit tests ✓ |
| Engineer sees only accepted projects | PARTIAL | projectScope uses active membership (created on accept only); legacy /tasks leaks drafts (PRJ-004) |
| Reassignment/handover | PARTIAL | serializable handover txn + notifications; not exercised |
| Dashboards update after assignment | PARTIAL | ['projects'] invalidated; dashboard not (PRJ-009) |
| Milestones + dependencies (cycle detection) | PARTIAL | transactional cycle check (milestone.service.ts:390-425); tests ✓ |
| Phases/epics/subtasks/checklists | PARTIAL | engineering.service createProjectPhase/createEngineeringTask; not exercised end-to-end |
| Task dependencies (cycle detection) | PARTIAL | DFS present, non-atomic (ENG-010) |
| Attachments (magic bytes, storage) | PARTIAL | decodeProjectFile signature checks; S3 BLOCKED |
| Kanban / Gantt / capacity calendar / workload | PARTIAL | TaskKanban.tsx, ProjectTimeline.tsx, TaskPlanningPage.tsx:734-845 real API data; PRJ-010 |
| Progress calculation | FAILED | cancelled tasks counted; 5 formulas (PRJ-001) |
| Task submission → review → QA | PARTIAL | review self-advance (ENG-002); QA role blocked (ENG-001) |
| Single active timer | PARTIAL | DB partial unique index + P2002 → 409 (race-safe); schema drift risk ENG-011 |
| Daily/weekly progress reports | NOT TESTED | engineering-worklog.service.ts:230-353 present |
| Engineer registration/verification/activation | PARTIAL | token hashing, advisory lock; cancel dead-end ENG-005; email BLOCKED |
| Suspension revokes access | PARTIAL | isActive=false + refresh tokens revoked; requireAuth reloads live context |
| Bugs lifecycle/SLA/escalation | PARTIAL | ENG-003, ENG-004, ENG-013 |
| Maintenance recurrence | PARTIAL | next occurrence created in same txn (engineering-operations.service.ts:540-575); not exercised |
| Health checks (SSRF-safe) | PARTIAL | unit tests 3 ✓; live probe BLOCKED |
| Releases/deployments/approvals | PARTIAL | ENG-014 |
| Timesheets approval | FAILED | ENG-006 |
| Engineering analytics | PARTIAL | formula variant + completedAt gap (PRJ-001, PRJ-003) |
| GitHub install/connect/disconnect | BLOCKED | needs App credentials |
| GitHub webhook HMAC (timing-safe, raw body) | PARTIAL | unit test of signature ✓; live delivery BLOCKED; size limit ENG-008 |
| GitHub delivery dedup | PARTIAL | unique deliveryId code path; no tests |
| GitHub PR/issue/CI/task link, CI→QA | BLOCKED | code reviewed only (ENG-016) |
| Production auth enforcement on project/eng/github APIs | VERIFIED | 5 unauthenticated GETs → 401 envelope |
