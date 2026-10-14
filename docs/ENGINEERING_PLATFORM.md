# Somwave engineering platform

The internal engineering platform uses the existing React, Express, Prisma, PostgreSQL, Redis, cookie authentication, and RBAC stack. Public website and client portal routes remain separate. This document describes the current implementation and the production checks still needed.

## Local setup and verification

Use Node 20 and the variables in `backend/.env.example`. From the repository root:

```sh
docker compose up -d --wait
npm ci
npm run prisma:migrate --workspace @somwave/backend
npm run db:seed --workspace @somwave/backend
npm run dev --workspace @somwave/backend
npm run dev --workspace @somwave/frontend
```

The project currently includes 40 Prisma migration directories, including engineer account onboarding, assignment handover, document plans, worklogs, reports, audit context, project review roles, structured skills and weekly schedules, and project health notes. Check pending migrations with `npx prisma migrate status --schema backend/prisma/schema.prisma` after setting the backend environment. Back up the production database and review the new additive migrations before deployment. The development seed grants engineering roles and permissions; production role mapping must be checked independently.

Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`. For browser checks, provide a local administrator account through `E2E_EMAIL` and `E2E_PASSWORD`, point `CHROMIUM_PATH` to Chromium if needed, then run `npm run test:e2e`. The browser suite checks desktop and mobile module routes, navigation, theme switching, directory/form use, and invalid activation links. It does not represent the 28-step multi-role production workflow in the master acceptance request.

## Main workflows

- `/engineering` shows the engineer's accessible projects, tasks, due/overdue work, reviews, maintenance, GitHub activity, and twelve project-scoped metrics.
- `/engineering/documentation` supports Markdown and sanitized rich text, PDF/DOCX/image attachments, folders, filtering, version history, comments, task/milestone links, ownership, review, and approval. Approved text can create **draft** task proposals for independent task review or a reviewable phase → milestone → epic → task → subtask plan. A manager explicitly activates the full plan and approves its tasks in one audited transaction.
- `/engineering/planning` supports project phases, epics, subtasks, checklists, dependencies, scheduled dates, a Gantt timeline with drag, resize, and keyboard adjustments, prerequisite labels, a four-week capacity calendar, progress reports, blocker notes, task comments, QA verification, work hours, and validated task attachments. Schedule edits reject dates that conflict with prerequisites or dependents. Active work is blocked until approval; dependencies/checklists and QA are checked before completion. Time entries require approved tasks.
- `/engineering/engineers` supports an administrative engineer directory, registration and account status controls, dedicated engineer detail, profiles, skills, availability slots, four-week capacity and workload across assigned projects, assignment history, and manager-approved handover records. An administrator can register a new engineer with profile details. A manager can invite an eligible existing engineer or create an invited account by email when `RESEND_API_KEY`, `EMAIL_FROM`, and `APP_PUBLIC_URL` are configured. Verification uses an expiring single-use link; activation assigns the engineer role only after verification and credential setup. Assignment email is queued, and the engineer accepts or declines from the workspace. A pending assignment grants no project membership. Managers can cancel invitations and perform explicit handovers; prior work authorship remains intact.
- `/engineering` also supports daily and weekly progress reports, manager clarification/review, a single active task timer, manual task hours, and corrected time entries with revision history. Reported hours default to persisted time entries; the API permits an explicit reported total for manager review.
- `/engineering/operations` supports system updates, releases, bugs, incidents, and maintenance. Updates and releases follow server-enforced transitions and production approval gates. A deployment record documents an **external** deployment; the application never deploys code. Releases can link project tasks and directly link PRs already recorded for the same project. Completing a recurring maintenance request schedules its next occurrence. Background health checks record response status and latency for active systems whose HTTPS production host is explicitly listed in `HEALTH_PROBE_HOSTS`; status changes notify the project manager and assigned engineer.
- `/github` supports GitHub App installation records, repository selection/mapping, disconnection, and browsing commits, branches, issues, PRs, workflow runs, contributors, and releases. Signed, deduplicated webhooks record PR/CI/issue/release events and update task links. QA verification requires linked CI checks to succeed, and a later failed completed check run clears an existing QA verification for a linked task in testing. A merged PR never automatically completes a task.
- `/engineering/analytics` charts accessible projects' progress, engineer workload, task completion, bugs, releases, maintenance, and SLA compliance from application records.
- Notification delivery is persisted with preferences, deduplication, status tracking, and retries. Project invitation email is required even when optional email alerts are disabled. Background jobs process pending email every 30 seconds, scan SLA breaches every 15 minutes, and probe allowlisted production hosts every 5 minutes. The API runs these jobs by default. For a separately deployed worker, run `npm run worker --workspace @somwave/backend` and set `BACKGROUND_WORKERS_ENABLED=false` on every API replica so one deployment owns the timers. Review queue status and worker logs in the deployed environment.

All engineering endpoints require authentication, RBAC, and project-level checks. Uploaded files have type and size checks; the backend stores bytes through the configured storage abstraction. API paths, request shapes, and access rules are listed in [API_REFERENCE.md](API_REFERENCE.md); the shared schemas are the validation source of truth. Changes to approvals, invitations, membership, task transitions, and release decisions write audit records.

## Engineer onboarding and assignment

1. An administrator opens **Engineer management → Register engineer** and supplies the engineer's unique email and required profile fields. An eligible existing identity is reused; a new identity stays inactive. The server stores only a hash of the expiring invitation token and records delivery status and the actor in the audit log.
2. The engineer opens the emailed `/activate-engineer?token=...` link, verifies the email once, then completes profile/credentials using a short-lived activation token. Existing account holders authenticate with their current password. The role and active status are granted only on successful activation. Expired or invalid links require a resend; resends are throttled.
3. A manager selects an existing or new project, engineer, project role, responsibilities, dates, estimated workload, and priority. The invitation sends email and in-app notice while leaving project access pending. The intended engineer reviews the project summary and accepts or declines in **Engineering Workspace**. Acceptance establishes project membership; declined, cancelled, expired, and suspended cases grant no new access.
4. To move work, the manager records a handover with source, replacement, notes, and explicit transfer choices. The record preserves checklist and counts; completed work and authorship are retained. Removing the source engineer is a separate explicit option.

## Permission matrix

Global permissions and active project membership are both required. An `ADMIN` or `SUPER_ADMIN` can manage engineer accounts; account management APIs enforce the admin role in addition to `engineering.manage`. `MANAGER` below means designated project manager or authorized active project manager. The API reference lists each route's global permission.

| Operation | Admin | Project manager | Accepted engineer | QA engineer | Viewer or pending invitee |
| --- | --- | --- | --- | --- | --- |
| Register, resend, suspend engineer account | Yes | No, unless also admin | No | No | No |
| Invite/accept project assignment | Invite | Invite | Accept or decline own invite | Accept or decline own invite | Review only own invite; no project data before acceptance |
| Read project engineering work and documents | Authorized scope | Yes | Yes, own active project | Yes, own active project | Viewer reads after active membership; pending invitee cannot |
| Create draft tasks and progress reports | Permission plus project scope | Yes | Yes, own active project | According to assigned role/permission | No |
| Approve plans, review work, manage assignment and handover | Authorized scope | Yes | Only explicit review role/permission for work review | QA verification with required permission | No |
| Correct own time / inspect revisions | Authorized scope | Project scope | Own permitted entries | Own permitted entries | No |
| See engineer account activity or cross-project staffing | Yes | Project-scoped staffing only | Own profile and project workload | Own profile and project workload | No |

## Runtime configuration

Keep secrets in deployment configuration, never source control. `DATABASE_URL`, `JWT_SECRET`, and CORS settings support authentication and persistence. Configure Resend with backend-only `RESEND_API_KEY`, `EMAIL_FROM`, and `APP_PUBLIC_URL` for absolute activation links; verify the sender domain and mailbox delivery after deployment. Configure `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY`, and `S3_SECRET_KEY` for durable production uploads. Set a single background-job owner using `BACKGROUND_WORKERS_ENABLED`, a reachable Redis instance, and exact `HEALTH_PROBE_HOSTS` for HTTPS probes. GitHub App settings are only relevant to existing integration and are outside the present assignment. See [MASTER_ACCEPTANCE.md](MASTER_ACCEPTANCE.md) for evidence and remaining gates.

## GitHub App setup

Create and install a GitHub App on authorized repositories. Set backend-only `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, and `GITHUB_WEBHOOK_SECRET`. Grant only the repository metadata, pull request, issues, checks/workflow, and releases permissions that the API uses; configure its HTTPS webhook to POST to `/api/v1/github/webhooks`. Subscribe to installation, installation repositories, repository, pull request, issues, check run, release, create, delete, and push events. Allow backend access to `api.github.com`.

After installation, an administrator records the installation in the GitHub connection UI and maps its repositories to authorized projects. Webhook HMAC signatures are checked against the raw request body; delivery IDs are deduplicated and processing status is stored. A PR body line `Somwave-Task: <task ID>` links a PR only when the repository maps to that task's project. GitHub App tokens and private keys stay on the backend. Live App authentication and webhook delivery need an installed App and have not been verified in this workspace.

## Production readiness gaps

The local implementation includes invitation acceptance, task planning and capacity controls, CI-linked QA checks, and an allowlisted HTTPS health scanner. The following acceptance evidence still requires deployed services or human review:

1. Install a GitHub App and verify live installation authentication, signed webhook delivery/replay, repository mapping, PR links, and CI-to-QA behavior against an authorized repository. Direct release-to-PR links can use only PRs already recorded for a task in the same project.
2. Configure and verify real Resend delivery for engineer verification/activation, project assignment, and notification retries; configure production object storage (`S3_*`) and exercise upload/download from a deployed instance. Keep all credentials outside the repository.
3. Deploy one background worker owner (or a single API instance with background jobs enabled), allowlist intended HTTPS health hosts, and verify probe/alert behavior, retry processing, and SLA scans in the deployed environment.
4. Review the 28-step role-based workflow with controlled accounts in the deployed environment; take a database backup and review all 40 additive migrations before any production migration.
5. Complete manual accessibility/responsive review and production security review, including legacy internal endpoints and remaining internal copy. Public/client Somali copy is outside the internal English conversion.

No production migrations, environment publication, or production deployment were performed here.
