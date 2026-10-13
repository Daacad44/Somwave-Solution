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

The project includes 27 additive Prisma migrations, including project invitations and system health history. Check pending migrations with `npx prisma migrate status --schema backend/prisma/schema.prisma` after setting the backend environment. Back up the production database before running migrations there. The development seed grants engineering roles and permissions; production role mapping must be checked independently.

Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`. For browser checks, provide a local engineer account through `E2E_EMAIL` and `E2E_PASSWORD`, point `CHROMIUM_PATH` to Chromium if needed, then run `npm run test:e2e`. The browser suite checks desktop and mobile module routes, navigation, and theme switching. It does not represent a full production workflow.

## Main workflows

- `/engineering` shows the engineer's accessible projects, tasks, due/overdue work, reviews, maintenance, GitHub activity, and twelve project-scoped metrics.
- `/engineering/documentation` supports Markdown and sanitized rich text, PDF/DOCX/image attachments, folders, filtering, version history, comments, task/milestone links, ownership, review, and approval. Approved text can create **draft** task proposals; the normal independent task review is still required.
- `/engineering/planning` supports project phases, epics, subtasks, checklists, dependencies, scheduled dates, a Gantt timeline with drag, resize, and keyboard adjustments, prerequisite labels, a four-week capacity calendar, progress reports, blocker notes, task comments, QA verification, work hours, and validated task attachments. Schedule edits reject dates that conflict with prerequisites or dependents. Active work is blocked until approval; dependencies/checklists and QA are checked before completion. Time entries require approved tasks.
- `/engineering/engineers` supports engineer profiles, skills, availability slots, four-week capacity and workload across assigned projects, assignment history, and bulk reassignment of open tasks between active project engineers. A manager can invite an existing engineer by email or create a new engineer account with a name and email when SMTP and `APP_PUBLIC_URL` are configured. The new account receives a password setup link. An invitation email is queued, and the engineer accepts or declines from the engineering workspace. Project membership is granted only after acceptance. Managers may cancel a pending invitation. These actions are audited.
- `/engineering/operations` supports system updates, releases, bugs, incidents, and maintenance. Updates and releases follow server-enforced transitions and production approval gates. A deployment record documents an **external** deployment; the application never deploys code. Releases can link project tasks and directly link PRs already recorded for the same project. Completing a recurring maintenance request schedules its next occurrence. Background health checks record response status and latency for active systems whose HTTPS production host is explicitly listed in `HEALTH_PROBE_HOSTS`; status changes notify the project manager and assigned engineer.
- `/github` supports GitHub App installation records, repository selection/mapping, disconnection, and browsing commits, branches, issues, PRs, workflow runs, contributors, and releases. Signed, deduplicated webhooks record PR/CI/issue/release events and update task links. QA verification requires linked CI checks to succeed, and a later failed completed check run clears an existing QA verification for a linked task in testing. A merged PR never automatically completes a task.
- `/engineering/analytics` charts accessible projects' progress, engineer workload, task completion, bugs, releases, maintenance, and SLA compliance from application records.
- Notification delivery is persisted with preferences, deduplication, status tracking, and retries. Project invitation email is required even when optional email alerts are disabled. Background jobs process pending email every 30 seconds, scan SLA breaches every 15 minutes, and probe allowlisted production hosts every 5 minutes. The API runs these jobs by default. For a separately deployed worker, run `npm run worker --workspace @somwave/backend` and set `BACKGROUND_WORKERS_ENABLED=false` on every API replica so one deployment owns the timers. Review queue status and worker logs in staging.

All engineering endpoints require authentication, RBAC, and project-level checks. Uploaded files have type and size checks; the backend stores bytes through the configured storage abstraction. API paths, request shapes, and access rules are listed in [API_REFERENCE.md](API_REFERENCE.md); the shared schemas are the validation source of truth. Changes to approvals, invitations, membership, task transitions, and release decisions write audit records.

## GitHub App setup

Create and install a GitHub App on authorized repositories. Set backend-only `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, and `GITHUB_WEBHOOK_SECRET`. Grant only the repository metadata, pull request, issues, checks/workflow, and releases permissions that the API uses; configure its HTTPS webhook to POST to `/api/v1/github/webhooks`. Subscribe to installation, installation repositories, repository, pull request, issues, check run, release, create, delete, and push events. Allow backend access to `api.github.com`.

After installation, an administrator records the installation in the GitHub connection UI and maps its repositories to authorized projects. Webhook HMAC signatures are checked against the raw request body; delivery IDs are deduplicated and processing status is stored. A PR body line `Somwave-Task: <task ID>` links a PR only when the repository maps to that task's project. GitHub App tokens and private keys stay on the backend. Live App authentication and webhook delivery need an installed App and have not been verified in this workspace.

## Production readiness gaps

The local implementation includes invitation acceptance, task planning and capacity controls, CI-linked QA checks, and an allowlisted HTTPS health scanner. The following acceptance evidence still requires deployed services or human review:

1. Install a GitHub App and verify live installation authentication, signed webhook delivery/replay, repository mapping, PR links, and CI-to-QA behavior against an authorized repository. Direct release-to-PR links can use only PRs already recorded for a task in the same project.
2. Configure and verify real SMTP delivery for new-account setup links, invitation messages, and notification retries; configure production object storage (`S3_*`) and exercise upload/download from a deployed instance. Keep all credentials outside the repository.
3. Deploy one background worker owner (or a single API instance with background jobs enabled), allowlist intended HTTPS health hosts, and verify probe/alert behavior, retry processing, and SLA scans under staging operations.
4. Run the requested 20-step role-based workflow in production-equivalent staging with real project accounts and the external integrations above; validate all 27 migrations on a staging database clone before any production migration.
5. Complete manual accessibility/responsive review and production security review, including legacy internal endpoints and remaining internal copy. Public/client Somali copy is outside the internal English conversion.

No production migrations, environment publication, or production deployment were performed here.
