# Engineering management master acceptance

Snapshot: 14 October 2026. This matrix covers the engineering and project operations master request. `COMPLETE` means implemented and supported by local code/tests; `PARTIAL` means implementation or verification is incomplete; `BLOCKED` means a deployed service, credential, or approval is needed; `FAILED` means a check has failed. A local status does not certify production readiness. GitHub integration is explicitly excluded from this assignment and existing behavior is preserved.

## Architecture and reused records

The React internal application calls an Express API using cookie authentication and organization-level RBAC. Prisma and PostgreSQL persist users, projects, tasks, documents, notifications, engineering work, and audit records; Redis supports background delivery. The public site and client portal remain separate. This work extends existing `User`, `Project`, `Task`, project membership, documentation, and notification records. It adds engineer invitation/profile metadata, assignment history/handover, document plan proposals, progress reports, timers, time revisions, and request correlation context rather than creating parallel user or project systems. Schema changes are additive; historical project membership is preserved and is not silently relabeled as accepted invitation data.

## Feature status

| Requested area | Status | Evidence and outstanding acceptance |
| --- | --- | --- |
| Internal English copy | PARTIAL | Core engineering and administration screens use English. A route-by-route copy and validation-error review across every legacy internal module remains. Public/client language choices are preserved. |
| Engineer email registration and identity reuse | PARTIAL | Admin account API, directory/form, uniqueness and existing-identity handling are implemented. Resend acceptance is recorded with a provider message ID; live mailbox delivery still needs verification. |
| Email verification, token expiry, resend, activation | PARTIAL | Hashed single-use verification/activation tokens, rate limits, expiry handling, resend, role activation and account status transitions are implemented with service tests. Live click-through with a real mailbox remains. |
| New and existing project assignments | PARTIAL | Project invitations capture role, description, responsibilities, dates, workload, priority and manager notes; pending membership is separate from active access. Existing projects are supported. Full multi-account staged acceptance remains. |
| Assignment email, in-app notice, accept/decline | PARTIAL | Required email is queued and decisions are authenticated and transactional; cancellation/expiry/suspension are checked server-side. External Resend delivery needs production verification. |
| Engineer management dashboard and detail | PARTIAL | Directory, search/filter, ten server-calculated organization KPIs, account actions, dedicated engineer page, project assignments, workload, activity and status are present. Validate each requested detail section and role across desktop/mobile. |
| Skills, availability and capacity | PARTIAL | Structured skill categories/levels/years, primary and secondary specialization, weekly local-time schedule with overlap validation, availability slots, four-week capacity, leave and workload estimates are implemented. Multi-user staged capacity verification remains. |
| Project roles and authorization | PARTIAL | Organization RBAC combines with accepted project membership and manager, lead, engineer, reviewer, QA, contributor and viewer roles. Role-by-role and cross-project staged penetration checks remain. |
| Project documentation | COMPLETE | Existing Markdown/rich text, folders, search, comments, versions, approval, file attachments and task/milestone links are reused with project scope. |
| Documentation-to-plan activation | PARTIAL | New document plan proposals validate phase/milestone/epic/task/subtask relationships and manager activation. Browser and multi-user review of generated proposals remains. |
| Scheduling, Kanban, calendar, Gantt | PARTIAL | Existing task planning, dependency checks, phase schedule and Gantt/capacity views work locally. Full requested calendar, scale, keyboard/accessibility and hierarchy acceptance remains. |
| Engineer workspace and task creation | PARTIAL | Workspace exposes accepted projects and authorized task/document actions. Full end-to-end task workflow with engineer, manager and QA accounts remains. |
| Task review and QA | COMPLETE | Approval and QA gates are enforced by services and existing tests; CI-related behavior belongs to the preserved GitHub implementation. |
| Daily/weekly progress reports | PARTIAL | Project-scoped reports, history and manager review/clarification are implemented. Multi-account browser validation remains. |
| Time tracking | PARTIAL | Manual entries, one active timer, stop/discard, and reasoned corrections with revision history are implemented. Staging checks for concurrency and long-running timers remain. |
| Updates, releases, bugs, maintenance | PARTIAL | Existing workflow gates, health checks, bug/incident records, recurrence, SLA scans and deployment history are reused. Live probes, operational alerts and deployment evidence need staging validation. |
| Project and engineer analytics | PARTIAL | Project health uses persisted overdue milestones/tasks, blockers, dependencies, capacity and deadline context with manager notes; staffing and workload charts exist. Validate analytics accuracy against realistic staged data. |
| Notification preferences, retries, reminders | PARTIAL | Durable notification queue, deduplication, preferences and background jobs exist; reminder work is included. Verify a single worker owner and live Resend delivery/retry behavior. |
| Reassignment and handover | PARTIAL | Manager-approved handover snapshots and selected transfer of open responsibilities retain authorship/history. Browser and multiple-role verification remains. |
| Audit and request correlation | PARTIAL | Invitation, assignment, handover and work actions write audit records; request context records correlation data. Complete coverage audit of legacy mutations remains. |
| Backend security | PARTIAL | New routes validate inputs and enforce authentication, RBAC and project access; upload limits and account status checks exist. Full legacy endpoint review and external security testing remain. |
| Automated tests | COMPLETE | The integrated unit suite passed: 430 tests in 78 files. Typecheck, lint, formatting and build passed. |
| Browser end-to-end tests | PARTIAL | Seven Playwright checks passed on desktop/mobile against a fresh local API and React app. Two administrator directory/registration checks were skipped because this workspace has no browser Super Admin login with a TOTP secret; component tests cover Resend readiness in the registration form. The requested 28-step live role workflow is not yet automated/executed. |
| Existing feature regression | PARTIAL | Public website, client portal and GitHub code are preserved. Complete staging regression and accessibility review remain. |

## Permission and access rules

An administrator (`ADMIN` or `SUPER_ADMIN`) with `engineering.manage` can register, resend, suspend, reactivate, and inspect engineer accounts. A project manager with `engineering.manage` can invite project engineers, inspect staffing, manage membership and record handovers for an authorized project. An invited engineer can verify and activate their own account through one-use tokens; a signed-in recipient can accept or decline only their own project invitation. Pending, expired, declined, cancelled or suspended assignments cannot open confidential project documents. Active engineers need `engineering.read` plus project membership to read; `engineering.tasks.create` enables permitted draft tasks/worklogs, while `engineering.tasks.review` and the project role govern review/QA actions. QA engineers and viewers receive only their allowed project scope. Account activity and cross-project staffing are restricted to authorized administrators. See [ENGINEERING_PLATFORM.md](ENGINEERING_PLATFORM.md#permission-matrix) and [API_REFERENCE.md](API_REFERENCE.md) for the route matrix.

## Deployment gates and external blockers

1. **Resend live delivery — BLOCKED:** Set backend-only `RESEND_API_KEY`, `EMAIL_FROM`, and `APP_PUBLIC_URL` in Coolify and verify `botandev.com` in Resend. Verify engineer and assignment emails, expiry, resend, bounce/failure and retry in a real mailbox. Provider acceptance is not proof of receipt.
2. **Production storage — BLOCKED:** Set `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` and verify protected upload/download through the deployed backend.
3. **Migrations and multi-role verification — BLOCKED:** Back up production data, review all pending migration directories, check role mapping, and execute the 28-step workflow with administrator, manager, engineer, QA and viewer/client accounts. Verify cross-project and revoked access. No staging environment is required by the current deployment plan.
4. **Operations — PARTIAL:** Set secure `DATABASE_URL`, Redis configuration, `JWT_SECRET`, exact `CORS_ORIGINS`, one `BACKGROUND_WORKERS_ENABLED` owner, and `HEALTH_PROBE_HOSTS`. Verify queues, probes, alerts, log correlation, and restart recovery in the deployed environment.
5. **Review — PARTIAL:** Complete internal English audit, responsive/accessibility review, legacy authorization review, and final tests/build against integrated code. Deploy through the authorized production workflow.

Earlier local SMTP-sink verification covered one-use verification/activation, pending project isolation, and authenticated assignment acceptance. This change replaces that transport with Resend; automated tests mock its API. No live Resend mailbox receipt has been verified in this workspace.

No production deployment or migration is included in this acceptance snapshot.
