# Engineering API reference

This reference covers the implemented engineering, operations, project documentation, GitHub, and notification routes. Paths are relative to the API origin. Request bodies are JSON unless a response is described as a file. The Zod schemas in [`packages/shared/src/schemas`](../packages/shared/src/schemas) are the source of truth for field limits and enum values.

## Authentication, access, and responses

All endpoints below require an authenticated access cookie except `POST /api/v1/github/webhooks`, which requires a valid `X-Hub-Signature-256` HMAC signature over the raw request body and a configured `GITHUB_WEBHOOK_SECRET`. A signed-in user also needs the permission shown in the tables. `R`, `M`, `C`, and `V` below mean `engineering.read`, `engineering.manage`, `engineering.tasks.create`, and `engineering.tasks.review`; `GR` and `GM` mean `github.read` and `github.manage`; `N` means `notifications.read`. `C|M` means either permission. Super admins hold all permissions. Permissions alone do not grant access to another project's data: engineering and operations services check active project membership or project management, with administrator exceptions. Documentation routes use project membership and project role checks in their service rather than route-level engineering permissions.

Successful JSON responses use `{ "data": ... }` (and `{ "meta": { "page", "pageSize", "total" } }` where pagination applies). Errors use `{ "error": { "code": "...", "message": "...", "details"?: ... } }`. Common responses are 400 `VALIDATION_ERROR`, 401 `UNAUTHORIZED`, 403 `FORBIDDEN`, 404 `NOT_FOUND`, and 409 `CONFLICT`. Some invitation setup/email failures return 503 `SERVICE_UNAVAILABLE`. Validation errors may include flattened field details. Creation endpoints generally return 201; consult the controller for the exact status.

Example engineer invitation:

```http
POST /api/v1/engineering/projects/PROJECT_ID/invitations
Content-Type: application/json

{"email":"engineer@example.com","name":"New Engineer","role":"ENGINEER","responsibilities":"API review"}
```

The `name` field is required only when the email has no existing engineer account. Creating that account requires `SMTP_HOST`, `SMTP_FROM`, and `APP_PUBLIC_URL`; the server sends a password setup email. It also queues a required project invitation email. The invitation stays `PENDING` and does **not** grant project membership until its recipient accepts it. An existing account that is inactive or lacks an engineer role cannot be invited through this route. Managers may cancel pending invitations; only the recipient may accept or decline.

## Engineering projects, membership, and profiles

Base path: `/api/v1/engineering`. Body shapes are in [`engineering.ts`](../packages/shared/src/schemas/engineering.ts).

| Method and path | Permission | Purpose / body |
| --- | --- | --- |
| `GET /projects` | R | Projects visible to the current user. |
| `GET /metrics` | R | Engineering overview metrics. |
| `GET /analytics` | R | Aggregated engineering analytics. |
| `GET /invitations/me` | R | Current user's pending project invitations. |
| `POST /invitations/:invitationId/respond` | R | `{ "decision": "ACCEPT" | "DECLINE" }`. Acceptance adds project membership atomically. |
| `GET /engineers/me/profile` | R | Current engineer profile. |
| `PATCH /engineers/me/profile` | R | Optional `headline`, `skills`, `availability`, `weeklyCapacityHours`, `timezone`. |
| `GET /engineers/me/availability` | R | Current user's availability slots. |
| `POST /engineers/me/availability` | R | `startAt`, `endAt` (offset ISO timestamps), `kind` (`WORKING`, `TIME_OFF`, `ON_CALL`), optional `note`. |
| `DELETE /engineers/me/availability/:slotId` | R | Remove owned slot. |
| `GET /projects/:projectId/engineer-profiles` | R | Project engineer profiles with workload and four-week capacity. Non-managers see only this project's task load and their own availability slots; managers see cross-project capacity for staffing. |
| `GET /projects/:projectId/members` | R | Active project members. |
| `GET /projects/:projectId/assignment-history` | M | Assignment and invitation history. |
| `GET /projects/:projectId/eligible-engineers?search=...` | M | Candidate engineers; `search` is optional. |
| `GET /projects/:projectId/invitations` | M | Pending invitations for this project. |
| `POST /projects/:projectId/invitations` | M | `email`, optional `name`, engineer `role` (`ENGINEER`, `LEAD_ENGINEER`, `QA_ENGINEER`), optional `responsibilities`. Email is normalized to lowercase. |
| `DELETE /projects/:projectId/invitations/:invitationId` | M | Cancel a pending invitation. |
| `POST /projects/:projectId/reassign-tasks` | M | `{ "fromUserId": "...", "toUserId": "..." }`; bulk reassign open tasks between active engineers on this project. |
| `POST /projects/:projectId/members` | M | Existing-user `{ "userId": "...", "role": "...", "responsibilities"?: "..." }`. Engineer roles go through the invitation/acceptance flow; `MANAGER` and `VIEWER` are assigned directly. |
| `PATCH /projects/:projectId/members/:userId` | M | Change `role` and/or `responsibilities`; upgrading a non-engineer member to an engineer role requires an invitation instead. |
| `DELETE /projects/:projectId/members/:userId` | M | Remove member. |

Project member roles are `MANAGER`, `LEAD_ENGINEER`, `ENGINEER`, `QA_ENGINEER`, and `VIEWER`. Managers control membership. An invitation for an already assigned engineer returns 409. An already answered or cancelled invitation cannot be accepted; a concurrent second response returns 409.

## Engineering planning and tasks

Base path: `/api/v1/engineering`.

| Method and path | Permission | Purpose / body |
| --- | --- | --- |
| `GET /projects/:projectId/phases` | R | Project phases. |
| `POST /projects/:projectId/phases` | M | `title`, optional `description`, offset ISO `startDate`/`dueDate`, `order`. |
| `GET /projects/:projectId/tasks` | R | Project task tree/list. |
| `POST /projects/:projectId/tasks` | C | `title`; optional `description`, `type`, `priority`, `estimatedHours`, `acceptanceCriteria`, `assigneeId`, `milestoneId`, `parentTaskId`, `kind`, `phaseId`, dates, `dependencyIds`, `checklist`. |
| `GET /projects/:projectId/dependencies` | R | Dependency edges for a project timeline. |
| `POST /tasks/:taskId/submit` | C | Submit task for review; no body. |
| `POST /tasks/:taskId/review` | V | `decision`: `START_REVIEW`, `APPROVE`, `REQUEST_CHANGES`, or `REJECT`; `note` is required for the last two. |
| `GET /tasks/:taskId/comments` | R | Task comments. |
| `POST /tasks/:taskId/comments` | C | `{ "body": "..." }`. |
| `GET /tasks/:taskId/progress` | R | Progress entries. |
| `POST /tasks/:taskId/progress` | C | `body`, integer `progressPercent` (0–100), optional nullable `blockedReason`. |
| `GET /tasks/:taskId/checklist` | R | Checklist items. |
| `POST /tasks/:taskId/checklist` | C | `{ "title": "..." }`. |
| `PATCH /tasks/:taskId/checklist/:itemId` | C | `{ "completed": true | false }`. |
| `GET /tasks/:taskId/dependencies` | R | Prerequisites for a task. |
| `POST /tasks/:taskId/dependencies` | M | `{ "dependsOnId": "..." }`; checks project and date ordering. |
| `DELETE /tasks/:taskId/dependencies/:dependsOnId` | M | Remove dependency. |
| `POST /tasks/:taskId/verify-qa` | V | Verify QA gate, including successful linked CI checks; no body. |
| `GET /tasks/:taskId/transitions` | R | Allowed task status transitions. |
| `PATCH /tasks/:taskId/schedule` | M | Nullable offset ISO `startDate` and `dueDate`; optional nullable `phaseId`. Rejects inverted dates or conflicts with dependencies. |
| `GET /tasks/:taskId/hours` | R | Time entries. |
| `POST /tasks/:taskId/hours` | C | `minutes` (1–1440), `date` (`YYYY-MM-DD`), optional `note`; task must satisfy approval rules. |
| `GET /tasks/:taskId/attachments` | R | Attachment metadata. |
| `POST /tasks/:taskId/attachments` | C | `fileName`, allowed `mimeType`, `contentBase64`; validated upload. |
| `GET /tasks/:taskId/attachments/:attachmentId/file` | R | Download attachment bytes. |

Task types: `FEATURE`, `BUG_FIX`, `IMPROVEMENT`, `RESEARCH`, `DESIGN`, `TESTING`, `DOCUMENTATION`, `MAINTENANCE`, `OTHER`. Priorities: `LOW`, `MEDIUM`, `HIGH`, `URGENT`. Task kinds: `EPIC`, `TASK`, `SUBTASK`; a subtask needs a parent. See the schema for size caps and allowed attachment MIME types.

## Operations, health, and releases

Base path: `/api/v1/engineering`. Request schemas are in [`engineeringOperations.ts`](../packages/shared/src/schemas/engineeringOperations.ts). All operations also enforce project/system access. Health probes are background work: creating a system does not immediately probe it. Only configured exact hosts in `HEALTH_PROBE_HOSTS` are eligible; probe URLs must be HTTPS without an IP address, credentials, or custom port.

| Method and path | Permission | Purpose / body |
| --- | --- | --- |
| `GET /projects/:projectId/systems` | R | Managed systems. |
| `POST /projects/:projectId/systems` | M | `name`; optional `description`, `technologyStack`, `productionUrl`, `stagingUrl`, `hostingProvider`, `assignedEngineerId`. |
| `GET /systems/:systemId/health` | R | Up to 50 latest health checks for the system. |
| `GET /systems/:systemId/updates` | R | System updates. |
| `POST /systems/:systemId/updates` | M | `title`, optional `description`, required update `category`. |
| `PATCH /updates/:updateId` | M | `{ "status": "..." }` update workflow transition. |
| `POST /updates/:updateId/production-approval` | M | Record production approval; no body. |
| `GET /systems/:systemId/bugs` | R | Bugs and incidents. |
| `POST /systems/:systemId/bugs` | C\|M | `title`, `description`; optional `severity`, `priority`, `environment`, `reproductionSteps`, `expectedResult`, `actualResult`. |
| `PATCH /bugs/:bugId` | C\|M | `status`; optional `rootCause`, nullable `assigneeId`. |
| `GET /systems/:systemId/maintenance` | R | Maintenance requests. |
| `POST /systems/:systemId/maintenance` | M | `title`, `type`; optional `description`, `scheduledAt`, `recurrenceRule`, `responseDueAt`, `resolutionDueAt`, `assigneeId`. |
| `PATCH /maintenance/:requestId` | C\|M | `status`; optional `scheduledAt`, `assigneeId`, `rootCause`, `resolutionNotes`. |
| `GET /systems/:systemId/releases` | R | Releases. |
| `POST /systems/:systemId/releases` | M | `version`, required `rollbackPlan`, optional `notes`. |
| `POST /releases/:releaseId/tasks` | M | `{ "taskId": "..." }`; attach project task. |
| `DELETE /releases/:releaseId/tasks/:taskId` | M | Detach task. |
| `GET /projects/:projectId/pull-requests` | R | Recorded project PR links eligible for release linking. |
| `POST /releases/:releaseId/pull-requests` | M | `{ "linkId": "..." }`; attach recorded project PR link. |
| `DELETE /releases/:releaseId/pull-requests/:linkId` | M | Detach PR link. |
| `POST /releases/:releaseId/approve` | M | Approve release; no body. |
| `PATCH /releases/:releaseId` | M | `{ "status": "..." }` release workflow transition. |
| `GET /releases/:releaseId/deployments` | R | Recorded deployment results. |
| `POST /releases/:releaseId/deployments` | M | `environment` (`STAGING`/`PRODUCTION`), `status` (`SUCCEEDED`/`FAILED`/`ROLLED_BACK`), optional `notes`. Records an external deployment; does not deploy software. |

Maintenance recurrence uses `FREQ=DAILY`, `FREQ=WEEKLY`, or `FREQ=MONTHLY` with optional `;INTERVAL=n`, and requires `scheduledAt`. Workflow transitions and production approval gates are checked on the server; callers cannot jump directly to arbitrary terminal states.

## Project documentation

Base path: `/api/v1/projects/:projectId/documentation`. Body schemas are in [`projectDocumentation.ts`](../packages/shared/src/schemas/projectDocumentation.ts). Active project members may read. Project `ENGINEER`, `LEAD_ENGINEER`, and `MANAGER` may write; only `MANAGER` may approve. The project's designated manager and admins have corresponding access. QA engineers and viewers have read access through their membership.

| Method and path suffix | Access | Purpose / body |
| --- | --- | --- |
| `GET /` | Read | List; optional `search`, `category`, `folder`, `status` query parameters. |
| `GET /folders` | Read | Folder names. |
| `PATCH /folders/rename` | Write | `{ "from": "...", "to": "..." }`. |
| `POST /` | Write | `title`, `format` (`MARKDOWN`, `RICH_TEXT`, `FILE`); optional `category`, `folder`, `ownerId`; text needs `content`, file needs `fileName`, `mimeType`, `contentBase64`. |
| `GET /:documentId` | Read | Document metadata/content. |
| `PATCH /:documentId` | Write | Changes plus required positive integer `expectedVersion` for optimistic concurrency. |
| `DELETE /:documentId` | Write | Soft-delete document. |
| `GET /:documentId/versions` | Read | Version history. |
| `GET /:documentId/file?version=n` | Read | Download current or selected file version; binary response. |
| `GET /:documentId/comments` | Read | Comments. |
| `POST /:documentId/comments` | Read | `{ "body": "..." }`; project access required. |
| `PATCH /:documentId/comments/:commentId` | Read + author | Change own comment body. |
| `DELETE /:documentId/comments/:commentId` | Read + author | Remove own comment. |
| `GET /:documentId/links` | Read | Linked task and milestone IDs. |
| `POST /:documentId/propose-tasks` | Write | Create draft task proposals from approved text documentation. |
| `POST /:documentId/links/:target` | Write | `{ "targetId": "..." }`; target is `task` or `milestone` in this project. |
| `DELETE /:documentId/links/:target/:targetId` | Write | Unlink task/milestone. |
| `PATCH /:documentId/status` | Write or approve | `{ "status": "...", "expectedVersion": n }`; `APPROVED` needs manager approval. |

Status transitions are `DRAFT` → `IN_REVIEW` → `APPROVED` → `ARCHIVED`; `IN_REVIEW` may return to `DRAFT`. Archived documents cannot be edited. A stale `expectedVersion` returns 409. File uploads are base64 JSON with server-side type and size checks.

## GitHub App

Base path: `/api/v1/github`; schemas in [`github.ts`](../packages/shared/src/schemas/github.ts). Administrator connection requires a configured GitHub App and installation; repository reads and task links remain project-scoped.

| Method and path | Permission | Purpose / body |
| --- | --- | --- |
| `GET /installations` | GM | Connected App installations. |
| `POST /installations` | GM | `{ "installationId": "123456" }`; GitHub's positive numeric ID as a string. |
| `DELETE /installations/:installationId` | GM | Disconnect installation. |
| `GET /repositories` | GR | Accessible connected repositories. |
| `GET /repositories/:repositoryId/activity/:kind` | GR | One bounded activity page; `kind` is `commits`, `branches`, `issues`, `pulls`, `runs`, `contributors`, or `releases`. |
| `PATCH /repositories/:repositoryId` | GM | `{ "projectId": "..." | null }`; map or unmap repository. |
| `GET /tasks/:taskId/links` | GR | Task's GitHub links. |
| `POST /tasks/:taskId/links` | GM | `repositoryId`, `kind`, `externalId`, `url`; optional `title`, positive `number`. |
| `DELETE /tasks/:taskId/links/:linkId` | GM | Remove task link. |
| `POST /webhooks` | Signed webhook | Raw JSON with `X-Hub-Signature-256`, `X-GitHub-Delivery`, `X-GitHub-Event`; deduplicated deliveries return `{ "data": { "status": "..." } }` (202 accepted, 200 duplicate). |

Link kinds are `ISSUE`, `BRANCH`, `COMMIT`, `PULL_REQUEST`, `CHECK_RUN`, and `RELEASE`. The server verifies the repository maps to the task's project; webhook PR references must pass the same check. A webhook or merged PR does not itself approve or complete a task.

## Notifications

Base path: `/api/v1/notifications`. All methods require `N`. The current user can see only their own notifications, preferences, and email deliveries.

| Method and path | Purpose / body |
| --- | --- |
| `GET /` | List in-app notifications. |
| `POST /:id/read` | Mark an owned notification read. |
| `GET /preferences` | List per-event in-app/email preferences. |
| `PUT /preferences/:eventKey` | `{ "inApp": true | false, "email": true | false }`; event key must be supported. |
| `GET /deliveries` | Up to 100 recent email delivery records, including channel, status, attempts, timestamp, and error. |

Event keys: `project.assignment`, `task.assignment`, `task.review`, `task.deadline`, `bug.assignment`, `bug.critical`, `github.pr`, `github.ci`, `release.approval`, `deployment.complete`, `maintenance.schedule`, `sla.breach`, `system.update`, `system.health`. Project invitation email is transactional and required even if optional email alerts are disabled. Delivery uses a durable retry queue; a pending record means delivery has been queued, not that an external mailbox has received it.

## Legacy management routes relevant to project and account security

These routes also require an access cookie and the named global permission. Project read access is limited to the designated manager, active members or administrators; changing or deleting a project requires its designated manager, active `MANAGER` membership, or administrator role. Portal project reads require the authenticated client's matching `clientId`. Direct approved task creation and deletion require project manager or administrator access; engineers can propose tasks through the engineering routes above.

| Method and path | Global permission | Additional rule |
| --- | --- | --- |
| `GET /api/v1/projects/:id/workspace` | `projects.read` | Project read scope; returns project, tasks, milestones, progress. |
| `PATCH /api/v1/projects/:id` | `projects.update` | Project manager scope. |
| `DELETE /api/v1/projects/:id` | `projects.delete` | Project manager scope; soft-deletes. |
| `POST /api/v1/tasks` | `tasks.create` | Project manager scope; creates a directly approved task. |
| `DELETE /api/v1/tasks/:id` | `tasks.delete` | Project manager scope; soft-deletes. |
| `GET /api/v1/clients?page=1&pageSize=20&search=...` | `clients.read` | Bounded pagination, maximum 100 rows per page. |
| `GET /api/v1/documents?page=1&pageSize=20&search=...` | `documents.read` | Bounded pagination; client accounts are scoped to their own documents. |
| `POST /api/v1/users` and `PATCH /api/v1/users/:id` | `users.create` / `users.update` | Only a current `SUPER_ADMIN` may assign that role or edit another super administrator. |
| `DELETE /api/v1/users/:id` | `users.delete` | Only a current `SUPER_ADMIN` may remove another super administrator; self-removal is rejected. |

Client document and media downloads use the same storage reader as uploads, including S3-compatible production storage. The API returns file bytes only after record access checks.
