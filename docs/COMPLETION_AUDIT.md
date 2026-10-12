# Somwave remaining-features acceptance audit

Snapshot: 12 October 2026. This is a local implementation review of the 13-workstream request. **Production readiness is not established.** No production migration, environment publication, or deployment was performed.

## Updated gap analysis and acceptance matrix

`COMPLETE` means implemented and locally exercised. `PARTIAL` means useful implementation exists but at least one requested criterion remains. `BLOCKED` means verification requires unavailable external configuration.

| Workstream | Status | Implemented and checked | Remaining acceptance criteria |
| --- | --- | --- | --- |
| 1. English internal experience | PARTIAL | Core internal navigation, modules, common validation errors, and mail templates use English. Client portal retains Somali where intended. | Final copy review of all legacy internal and shared screens, including mixed portal/staff routes and status labels. |
| 2. Documentation | COMPLETE | Rich text/Markdown, attachments, folders/search, owner, comments, task/milestone links, version history, approval, and reviewable task proposals. | Live multi-user collaboration behavior has not been load-tested. |
| 3. Advanced planning | PARTIAL | Phases, epics/subtasks, checklists, dependencies, attachments, dates, deadline view, drag/keyboard Gantt date shifting, workload counts, proposals. | Gantt resize and dependency visualization, capacity-aware calendar, and schedule conflict handling. |
| 4. Engineer management | PARTIAL | Profiles, skills, availability, hours capacity, workload, membership changes/history, audit and notifications. | Dedicated reassignment workflow in management UI and capacity-based assignment recommendations. |
| 5. Engineer workspace | PARTIAL | My projects/tasks, due/overdue/completed, pending reviews, timeline, progress, comments, hours, blockers, attachments, review submission. | Live GitHub activity and maintenance data need an installed App and production integration verification. |
| 6. Task review and QA | COMPLETE | Draft/submit/change/approve/reject, independent review, QA verification, reopen and completion gates, validated task fields. | Role-by-role browser workflow remains part of production acceptance. |
| 7. Updates and releases | PARTIAL | Update and release state machines, task and direct same-project PR links, approval gates, deployment history/logs, rollback status/plan, verification gate. | Externally verified deployment evidence and live PR linkage. |
| 8. Bugs, incidents, maintenance, SLA | PARTIAL | Bug lifecycle, incident/maintenance records, root cause/resolution, scheduled and recurring work, SLA targets, breach scan/notifications. | Automated external health probes and live alert-delivery validation. |
| 9. GitHub App integration | PARTIAL; live verification BLOCKED | Installation/connection UI, repo mapping, remote browsing, signed/deduplicated/retryable webhook processing, task PR/CI links. | Installed App credentials, real webhook deliveries, remote permission audit, CI-to-QA decision workflow. |
| 10. Notifications | PARTIAL | In-app records, preferences, durable email queue, deduplication, retry and delivery statuses, event producers. | Real SMTP delivery and dedicated production worker ownership. |
| 11. Analytics and UI | PARTIAL | Seven requested data-driven chart groups, module pages, mobile navigation, dark mode, loading/empty states. | Consistent advanced filtering, searchable tables, pagination, accessibility and responsive sign-off. |
| 12. Security and API review | PARTIAL | Auth/RBAC/project checks on new routes, cross-project smoke checks, validation, file magic/size limits, webhook HMAC/deduplication, audit records, backend-only GitHub credentials. | Exhaustive legacy endpoint audit, production storage/CORS/secrets review, penetration testing, complete API reference. |
| 13. Testing and production readiness | PARTIAL | Unit suite, local API smoke, migration status, desktop/mobile browser routes, theme checks, build/typecheck/lint. | Full requested 20-step role-based browser workflow, live GitHub/SMTP/S3 checks, production-equivalent staging sign-off. |

## Delivered changes

The main changed areas are Prisma schema and 24 additive migrations, shared validation schemas and RBAC constants, Express engineering/documentation/operations/GitHub/notification routes and services, React engineering/GitHub pages, internal English copy, Playwright browser tests, and this runbook. Important entry points: `backend/src/routes/engineering.routes.ts`, `backend/src/routes/project-documentation.routes.ts`, `backend/src/routes/engineering-operations.routes.ts`, `backend/src/routes/github.routes.ts`, `frontend/src/features/engineering`, `frontend/src/features/github`, and `docs/ENGINEERING_PLATFORM.md`.

The API adds project membership, engineer profile/availability, planning/review/checklist/dependency/progress/attachment/hour, documentation/version/comment/link/proposal, bugs/maintenance/updates/releases/deployments, GitHub connection/activity/webhook, notifications, and analytics endpoints. Request validation lives in `packages/shared/src/schemas`; the route files above are the current endpoint inventory. A complete OpenAPI specification is still needed.

## Verification evidence

- `npm test`: 63 files and 311 tests passing on 12 October 2026.
- `npm run typecheck`, `npm run lint`, and `npm run build`: passing after the engineering implementation edits. The analytics zero-sample response was also checked through the local API.
- `npx prisma migrate status`: 24 migrations found; local schema up to date.
- Local API smoke: passed project isolation, documentation proposal/approval, phase/task review and QA, recurring maintenance, update production gate, release-task and direct PR linking/unlinking, staging deployment record, notifications, and GitHub read endpoints. The direct PR check verified that an engineer and a link from another project are rejected. It used a local database fixture; real GitHub delivery remains blocked. No live external deployment was made.
- Playwright passed 5/5 setup, desktop, and mobile checks across internal engineering routes after the Gantt and copy edits. Engineer-management and analytics screenshots were reviewed at both viewport sizes.
- Local visual check covered desktop/mobile task planning in dark mode. It does not replace an accessibility audit.

## GitHub and external blockers

Live GitHub App authentication is **BLOCKED** until `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, and `GITHUB_WEBHOOK_SECRET` are provided through backend runtime secrets and an authorized organization installs the App. SMTP delivery needs `SMTP_HOST`/`SMTP_FROM` and credentials. Durable production upload storage needs the `S3_*` settings. These values must never be committed. Only local persistence, queue, and webhook code paths have been exercised.

## Deployment readiness checklist

1. Back up production PostgreSQL and validate all 24 migrations on a production-like staging clone.
2. Configure production `DATABASE_URL`, authenticated `REDIS_URL` or `REDIS_PASSWORD`, a unique `JWT_SECRET`, and exact `CORS_ORIGINS`.
3. Configure and verify SMTP, object storage, GitHub App, HTTPS webhook delivery, and network egress. Confirm the production storage guard rejects uploads when S3 is absent.
4. Run one notification/SLA worker owner or move the timers out of horizontally scaled API processes. Monitor retries, SLA queue latency, and failures.
5. Execute the requested 20-step role workflow in staging with manager, engineer, QA, administrator, and client accounts, including a real GitHub PR/check run.
6. Finish endpoint security, accessibility, responsive, and copy reviews; then rerun tests, lint, typecheck, build, API smoke, and browser suite against that staging environment.
7. Obtain explicit approval before publishing cloud environment changes, migrating production, or deploying production.
