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

The project includes 24 additive Prisma migrations. Check pending migrations with `npx prisma migrate status --schema backend/prisma/schema.prisma` after setting the backend environment. Back up the production database before running migrations there. The development seed grants engineering roles and permissions; production role mapping must be checked independently.

Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`. For browser checks, provide a local engineer account through `E2E_EMAIL` and `E2E_PASSWORD`, point `CHROMIUM_PATH` to Chromium if needed, then run `npm run test:e2e`. The browser suite checks desktop and mobile module routes, navigation, and theme switching. It does not represent a full production workflow.

## Main workflows

- `/engineering` shows the engineer's accessible projects, tasks, due/overdue work, reviews, maintenance, GitHub activity, and twelve project-scoped metrics.
- `/engineering/documentation` supports Markdown and sanitized rich text, PDF/DOCX/image attachments, folders, filtering, version history, comments, task/milestone links, ownership, review, and approval. Approved text can create **draft** task proposals; the normal independent task review is still required.
- `/engineering/planning` supports project phases, epics, subtasks, checklists, dependencies, scheduled dates, a Gantt timeline with drag and keyboard date shifting, progress reports, blocker notes, task comments, QA verification, work hours, and validated task attachments. Active work is blocked until approval; dependencies/checklists and QA are checked before completion. Time entries require approved tasks.
- `/engineering/engineers` supports engineer profiles, skills, capacity, availability slots, team workload, and assignment history. Project membership changes are audited and notify the assigned engineer.
- `/engineering/operations` supports system updates, releases, bugs, incidents, and maintenance. Updates and releases follow server-enforced transitions and production approval gates. A deployment record documents an **external** deployment; the application never deploys code. Releases can link project tasks and directly link PRs already recorded for the same project. Completing a recurring maintenance request schedules its next occurrence.
- `/github` supports GitHub App installation records, repository selection/mapping, disconnection, and browsing commits, branches, issues, PRs, workflow runs, contributors, and releases. Signed, deduplicated webhooks record PR/CI/issue/release events and update task links. A merged PR never automatically completes a task.
- `/engineering/analytics` charts accessible projects' progress, engineer workload, task completion, bugs, releases, maintenance, and SLA compliance from application records.
- Notification delivery is persisted with preferences, deduplication, status tracking, and retries. The API process polls the pending email queue every 30 seconds and scans SLA breaches every 15 minutes. A single process should own these jobs in a production deployment, or the polling should move to a dedicated worker.

All engineering endpoints require authentication, RBAC, and project-level checks. Uploaded files have type and size checks; the backend stores bytes through the configured storage abstraction. The new API routes are defined in `backend/src/routes/engineering.routes.ts`, `project-documentation.routes.ts`, and `engineering-operations.routes.ts`. Schemas in `packages/shared/src/schemas` document request shapes and validation. Changes to approvals, membership, task transitions, and release decisions write audit records.

## GitHub App setup

Create and install a GitHub App on authorized repositories. Set backend-only `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, and `GITHUB_WEBHOOK_SECRET`. Grant only the repository metadata, pull request, issues, checks/workflow, and releases permissions that the API uses; configure its HTTPS webhook to POST to `/api/v1/github/webhooks`. Subscribe to installation, installation repositories, repository, pull request, issues, check run, release, create, delete, and push events. Allow backend access to `api.github.com`.

After installation, an administrator records the installation in the GitHub connection UI and maps its repositories to authorized projects. Webhook HMAC signatures are checked against the raw request body; delivery IDs are deduplicated and processing status is stored. A PR body line `Somwave-Task: <task ID>` links a PR only when the repository maps to that task's project. GitHub App tokens and private keys stay on the backend. Live App authentication and webhook delivery need an installed App and have not been verified in this workspace.

## Production readiness gaps

The following work remains before calling the full 13-workstream request complete:

1. Expand the Gantt timeline with resize handles, dependency lines, and capacity-aware calendar scheduling; add richer filtering, searchable tables, and pagination throughout the new modules.
2. Connect CI outcomes to explicit QA decisions and verify webhook retry/replay against a live App. Direct release-to-PR links can use only PRs already recorded for a task in the same project.
3. Add an external health probe/integration for automated system checks. Recurring maintenance scheduling and SLA escalation run locally, but alert delivery and worker ownership need deployment validation.
4. Verify SMTP, object storage, GitHub App, and deployment configuration with production-equivalent secrets/services. `SMTP_HOST` and `SMTP_FROM` enable email; `S3_*` is needed for durable production file storage. Never commit their values.
5. Perform the complete requested 20-step browser workflow, including project creation, assignments, QA, GitHub, release, bug, and maintenance actions, with real role accounts. Current automated API smoke and browser route checks cover many pieces but do not exercise a live GitHub connection or production deployment.
6. Conduct a final manual accessibility/responsive review and production security review of all relevant legacy and new endpoints. Recheck existing internal screens for any remaining Somali UI copy. Public/client copy is outside the internal English conversion.

No production migrations, environment publication, or production deployment were performed here.
