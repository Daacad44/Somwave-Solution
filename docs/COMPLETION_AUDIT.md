# Somwave remaining-features acceptance audit

Snapshot: 13 October 2026. This is a local implementation review of the 13-workstream request. **Production readiness is not established.** No production migration, environment publication, or deployment was performed. `COMPLETE` refers to locally implemented and verified behavior; external acceptance is tracked separately.

## Updated gap analysis and acceptance matrix

`COMPLETE` means implemented and locally exercised. `PARTIAL` means useful implementation exists but at least one requested criterion remains. `BLOCKED` means verification requires unavailable external configuration.

| Workstream | Status | Implemented and checked | Remaining acceptance criteria |
| --- | --- | --- | --- |
| 1. English internal experience | PARTIAL | Staff-facing project, client, CMS, operations, user, and search copy was updated; portal copy stays Somali where intended. | Final complete browser copy review of every internal route and validation/status label. |
| 2. Documentation | COMPLETE | Rich text/Markdown, attachments, folders/search, owner, comments, task/milestone links, version history, approval, and reviewable task proposals. | Live multi-user collaboration behavior has not been load-tested. |
| 3. Advanced planning | COMPLETE | Phases, epics/subtasks, checklists, dependencies, attachment and proposal gates, Gantt move/resize with keyboard support, dependency display, four-week capacity calendar, prerequisite date conflict checks. | Validate production-scale schedules in staging. |
| 4. Engineer management | COMPLETE | Profiles, skills, availability, workload, audited history, capacity recommendations, bulk task reassignment, and email invitation with acceptance. New accounts get a one-use password setup link. | Live delivery depends on SMTP. |
| 5. Engineer workspace | PARTIAL | My projects/tasks, due/overdue/completed, pending reviews, timeline, progress, comments, hours, blockers, attachments, maintenance, review submission, invitation acceptance. | Live GitHub activity needs an installed App. |
| 6. Task review and QA | COMPLETE | Independent review and completion gates; linked successful CI checks are required for QA, and a later failed check revokes verification. | Role-by-role browser workflow remains part of production acceptance. |
| 7. Updates and releases | PARTIAL | Update and release state machines, task and direct same-project PR links, approval gates, deployment history/logs, rollback status/plan, verification gate. | Externally verified deployment evidence and live PR linkage. |
| 8. Bugs, incidents, maintenance, SLA | PARTIAL | Bug/incident/maintenance lifecycle, root cause/resolution, recurring work, SLA breach scan, allowlisted HTTPS health probes with public DNS pinning, status history and alerts. | Verify scheduled probes and alert delivery with production-like hosts/SMTP. |
| 9. GitHub App integration | PARTIAL; live verification BLOCKED | Installation/connection UI, repo mapping, browsing, signed/deduplicated/retryable webhooks, project-scoped task PR/CI links, CI-to-QA gate. | Installed App credentials, real permission and webhook delivery/replay checks. |
| 10. Notifications | PARTIAL | In-app records, preferences, durable email queue, deduplication, retry/status, required invitation email, standalone worker. | Real SMTP delivery and single production worker owner verification. |
| 11. Analytics and UI | PARTIAL | Seven data-driven chart groups, searchable/filterable/paginated engineering views, paginated client/document lists, module pages, mobile navigation, dark mode, loading/empty states. | Consistent advanced filtering across all modules; accessibility and responsive sign-off. |
| 12. Security and API review | PARTIAL | New route auth/RBAC/project checks, validation, file limits, webhook HMAC, audit logs, exact health-host allowlist with DNS pinning. Fixed role-upgrade and SUPER_ADMIN escalation bypasses, legacy project/task scope leaks, private workload disclosure, cross-project CI QA revocation and S3 document/media reads. API reference added. | Exhaustive legacy endpoint and production storage/CORS review, external penetration testing. |
| 13. Testing and production readiness | PARTIAL | Unit suite, local API smoke, migration status, desktop/mobile browser routes, theme checks, build/typecheck/lint. | Full requested 20-step role-based browser workflow, live GitHub/SMTP/S3 checks, production-equivalent staging sign-off. |

## Engineer invitation and acceptance

Managers can invite an existing engineer by email, or create a new engineer account with name and email when `SMTP_HOST`, `SMTP_FROM` and `APP_PUBLIC_URL` are configured. A new account receives a one-use password setup link. An existing engineer receives a required queued assignment email. The invitation stays `PENDING` until its intended authenticated user accepts; acceptance creates or upgrades project membership and a decline grants none. Managers can cancel or resend invitations. Direct VIEWER-to-engineer role updates are rejected to prevent bypassing acceptance. Local API smoke verified that a pending invitation grants no engineering access, an email is queued, and acceptance grants membership. No live email was sent here because SMTP is absent.

## Delivered changes

The main changed areas are Prisma schema and 27 additive migrations, shared validation schemas and RBAC constants, Express engineering/documentation/operations/GitHub/notification routes and services, React engineering/GitHub pages, internal English copy, Playwright browser tests, and this runbook. This branch adds `20261012010000_project_invitations` and `20261012020000_system_health_checks`. Important entry points: `backend/src/routes/engineering.routes.ts`, `backend/src/routes/project-documentation.routes.ts`, `backend/src/routes/engineering-operations.routes.ts`, `backend/src/routes/github.routes.ts`, `frontend/src/features/engineering`, `frontend/src/features/github`, and `docs/ENGINEERING_PLATFORM.md`.

The API adds project invitations/acceptance, membership, engineer profiles/availability/reassignment, planning/review/checklist/dependency/progress/attachment/hour, documentation/version/comment/link/proposal, bugs/maintenance/updates/releases/deployments/health, GitHub connection/activity/webhook, notifications, and analytics endpoints. Request validation lives in `packages/shared/src/schemas`; `docs/API_REFERENCE.md` documents the current endpoint inventory. An OpenAPI machine-readable specification is still needed.

## Verification evidence

- `npm test`: 67 files and 357 tests passed on 13 October 2026, including storage-reader regression tests.
- `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`, and `git diff --check` passed. Astro needed `XDG_CONFIG_HOME=/tmp/somwave-xdg ASTRO_TELEMETRY_DISABLED=1` because its default config directory is outside this cloud workspace.
- `npx prisma migrate status`: 27 migrations found; local schema up to date.
- Local API smoke: passed project isolation, invitation pending/acceptance and queued email, documentation proposal/approval, phase/task review and QA, recurring maintenance, update production gate, release-task and direct PR linking/unlinking, staging deployment record, notifications, and GitHub read endpoints. Fixtures were removed; real email/GitHub delivery remains blocked. No live external deployment was made.
- Playwright passed 5/5 setup, desktop, and mobile checks against a production frontend build and local API on 13 October 2026. Engineer-management and analytics screenshots were captured at both viewport sizes; task planning was inspected in mobile dark mode. This does not replace an accessibility audit.

## GitHub and external blockers

Live GitHub App authentication is **BLOCKED** until `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, and `GITHUB_WEBHOOK_SECRET` are provided through backend runtime secrets and an authorized organization installs the App. SMTP delivery needs `SMTP_HOST`/`SMTP_FROM` and credentials. Durable production upload storage needs the `S3_*` settings. These values must never be committed. Only local persistence, queue, and webhook code paths have been exercised.

## Deployment readiness checklist

1. Back up production PostgreSQL and validate all 27 migrations on a production-like staging clone.
2. Configure production `DATABASE_URL`, authenticated `REDIS_URL` or `REDIS_PASSWORD`, a unique `JWT_SECRET`, and exact `CORS_ORIGINS`.
3. Configure and verify SMTP, object storage, GitHub App, HTTPS webhook delivery, `HEALTH_PROBE_HOSTS`, and network egress. Confirm the production storage guard rejects uploads when S3 is absent.
4. Run one background worker with `npm run worker --workspace @somwave/backend` and set `BACKGROUND_WORKERS_ENABLED=false` on API replicas. Monitor retries, SLA/health scans, and failures.
5. Execute the requested 20-step role workflow in staging with manager, engineer, QA, administrator, and client accounts, including a real GitHub PR/check run.
6. Finish endpoint security, accessibility, responsive, and copy reviews; then rerun tests, lint, typecheck, build, API smoke, and browser suite against that staging environment.
7. Obtain explicit approval before publishing cloud environment changes, migrating production, or deploying production.
