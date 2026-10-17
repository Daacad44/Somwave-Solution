# Frontend, UI/UX, Accessibility and SEO Audit

| | |
|---|---|
| Date | 2026-10-17 |
| Repository state | `main` at `4323f55` (PR #86) |
| Scope | React app (169 files under `frontend/src`): routes, guards, UI kit, states, forms, dates, design tokens, dark mode, RTL, accessibility, i18n and bundle; plus the public website UI, SEO and i18n findings from the CMS & Web report. |
| Method | Read-only code inspection with file:line evidence; targeted local test runs; unauthenticated, low-volume GET/HEAD/OPTIONS probes of production. No production credentials, Coolify, Resend, S3 or GitHub App access. |
| Source | Frontend agent report (01), prefix FE-; UI/SEO sections from the CMS & Web report (07) |
| Related | [System audit report](SYSTEM_AUDIT_REPORT.md) · [Bug register](BUG_REGISTER.md) · [Acceptance matrix](ACCEPTANCE_MATRIX.md) · [Remediation roadmap](REMEDIATION_ROADMAP.md) |

Each finding keeps the specialist agent's original ID; the consolidated `SW-` ID from the [bug register](BUG_REGISTER.md) is shown next to it. Severity in the index is the consolidated severity; where duplicates were merged the higher severity was kept, so it can differ from the severity line inside the original finding text.

## Finding index

| Original ID | SW ID | Severity (consolidated) | Confidence | Consolidated title |
|---|---|---|---|---|
| FE-001 | [SW-009](BUG_REGISTER.md#sw-009) | P1 | CONFIRMED | Payment Idempotency-Key is regenerated after a failed or ambiguous request (duplicate-charge risk) |
| FE-002 | [SW-065](BUG_REGISTER.md#sw-065) | P2 | CONFIRMED | Task Planning date-time editor shifts saved dates by the UTC offset on every save |
| FE-003 | [SW-027](BUG_REGISTER.md#sw-027) | P2 | CONFIRMED | Large lists lack search/filter/pagination; backend list endpoints are unbounded or silently capped at 100 with no meta.total |
| FE-004 | [SW-066](BUG_REGISTER.md#sw-066) | P2 | CONFIRMED | Destructive actions without a confirm dialog |
| FE-005 | [SW-131](BUG_REGISTER.md#sw-131) | P3 | CONFIRMED | Somali text in internal/admin screens and staff-facing system messages |
| FE-006 | [SW-132](BUG_REGISTER.md#sw-132) | P3 | CONFIRMED | Portal language is mixed English/Somali; no i18n framework |
| FE-007 | [SW-014](BUG_REGISTER.md#sw-014) | P2 | CONFIRMED | Public website and React app send no security headers (no CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy) |
| FE-008 | [SW-006](BUG_REGISTER.md#sw-006) | P1 | CONFIRMED | API is reached through public-hostname hairpins, so all app users (and all SSR page views) share one rate-limit bucket, including the login limiter |
| FE-009 | [SW-133](BUG_REGISTER.md#sw-133) | P3 | CONFIRMED | No catch-all route: unknown URLs render a blank screen |
| FE-010 | [SW-067](BUG_REGISTER.md#sw-067) | P2 | CONFIRMED | Duplicate form controls: raw date inputs, selects, textareas and tables bypass the shared kit |
| FE-011 | [SW-134](BUG_REGISTER.md#sw-134) | P3 | CONFIRMED | Palette and dark-mode deviations |
| FE-012 | [SW-135](BUG_REGISTER.md#sw-135) | P3 | CONFIRMED | RTL: ~70 physical-direction utilities; Arabic/RTL not wired |
| FE-013 | [SW-136](BUG_REGISTER.md#sw-136) | P3 | CONFIRMED | Modal lacks focus management; user menu lacks arrow-key handling |
| FE-014 | [SW-137](BUG_REGISTER.md#sw-137) | P3 | CONFIRMED | Small touch targets: Button size="sm" is 36 px (149 usages) |
| FE-015 | [SW-138](BUG_REGISTER.md#sw-138) | P3 | CONFIRMED | Many forms bypass React Hook Form + shared Zod resolver |
| FE-016 | [SW-139](BUG_REGISTER.md#sw-139) | P3 | CONFIRMED | Dates displayed with browser locale/timezone instead of the Africa/Mogadishu helper |
| FE-017 | [SW-140](BUG_REGISTER.md#sw-140) | P3 | CONFIRMED | Large frontend bundles; heavy editor chunk loaded on every project detail view |
| FE-018 | [SW-141](BUG_REGISTER.md#sw-141) | P3 | CONFIRMED | Client reports unreachable from the UI |
| FE-019 | [SW-084](BUG_REGISTER.md#sw-084) | P3 | CONFIRMED | Project documentation routes and screens ignore the project-documentation.* permissions |
| FE-020 | [SW-142](BUG_REGISTER.md#sw-142) | P3 | CONFIRMED | No optimistic updates with rollback anywhere |
| FE-021 | [SW-007](BUG_REGISTER.md#sw-007) | P1 | CONFIRMED | "Could not load finance dashboard": the session never gains MFA proof after 2FA enrolment, so privileged users get 403 (old bundle masked the real error) |
| FE-022 | [SW-068](BUG_REGISTER.md#sw-068) | P2 | CONFIRMED | Coverage far below the 70% Definition of Done and no threshold enforced; frontend business screens untested |
| WEB-003 | [SW-062](BUG_REGISTER.md#sw-062) | P2 | CONFIRMED | Sitemap omits every CMS detail page; canonical URLs differ by trailing slash |
| WEB-004 | [SW-063](BUG_REGISTER.md#sw-063) | P2 | CONFIRMED | Locale and i18n contradict the requirements: English default, chrome-only translation, no hreflang |
| WEB-008 | [SW-127](BUG_REGISTER.md#sw-127) | P3 | CONFIRMED | Hardcoded app domain, hardcoded marketing sections, off-palette brand colour and no dark mode on web |
| WEB-009 | [SW-128](BUG_REGISTER.md#sw-128) | P3 | CONFIRMED | Page weight and image optimisation |
| CMS-001 | [SW-027](BUG_REGISTER.md#sw-027) | P2 | CONFIRMED | Large lists lack search/filter/pagination; backend list endpoints are unbounded or silently capped at 100 with no meta.total |
| STO-005 | [SW-125](BUG_REGISTER.md#sw-125) | P3 | CONFIRMED | Preview shows while the upload fails; Portfolio partial failures not reported per file |

## 1. Scope inspected / blocked

**Inspected (all 169 files under `frontend/src`, ~31.6k LOC):** router (`frontend/src/app/App.tsx` — there is no `router.tsx`; routes live in `App.tsx`), `app/layout/{AppShell,nav,GlobalSearch}.tsx`, `components/ui/*`, `components/states/*`, `lib/{apiClient,rbac,date,queryClient}.ts`, every `features/*` page/component/api/hooks file, `styles/tokens.css`, `globals.css`, `tailwind.config.ts`, `index.html`, `nginx.conf`, `Dockerfile`, `vite.config.ts`. Cross-checked `packages/shared/src/constants/permissions.ts`, shared `*_LABELS` maps, `backend/prisma/seed.ts` role grants, and the backend routes/services the screens call.

**Commands run (no repo writes):**
- `npx tsc --noEmit` (frontend) → exit 0.
- `npx eslint frontend/src` → exit 0, no warnings.
- `npx vite build --outDir <scratchpad>/fe_build` → OK in 10.4 s. Built **outside** the repo: `frontend/dist` already existed (created 17:37 by another process, gitignored via `.gitignore:7 dist/`), so it was not touched.
- `TZ=Africa/Mogadishu node -e …` reproduction for FE-002.
- Production (GET/HEAD only, ~14 requests): `https://app.somwave.botandev.com/`, `/login`, `/does-not-exist`, `/healthz`, `/assets/index-MnjbBilE.js`, `/assets/index-DHtZ342t.css`, `/assets/FinancePage-DaGwO4xf.js`, `/api/v1/finance/dashboard`, `/api/v1/auth/me`, `/api/v1/health`.

**BLOCKED:** any signed-in UI walk-through (no production credentials) → no role-by-role click tests, no real responsive screenshots at 375/768/1024/1440, no Lighthouse/axe run. Frontend test suite not executed (reserved for QA agent). Coverage % not measured.

**Production build identity:** prod `FinancePage-DaGwO4xf.js` = 28,843 bytes, identical size to local HEAD build `FinancePage-Coi0RAzZ.js`; prod CSS hash `index-DHtZ342t.css` identical to local → deployed frontend matches HEAD `4323f55` (hash difference in JS comes from `VITE_API_URL=/api/v1` baked by Dockerfile).

## 2. Route / module inventory

Router: `frontend/src/app/App.tsx:209-592`. All feature pages are `React.lazy` (App.tsx:17-175) wrapped in `Suspense` with a skeleton `LoadingState` fallback. Auth pages are eager. Guard = `RequirePermission` (UX only; renders "Permission denied" ErrorState). All app routes sit under `ProtectedRoute` (session + forced 2FA redirect to `/profile?tab=security`) and `AppShell`. **No `path="*"` route** (FE-009).

| Path | Component | Guard (permission) | Lazy | Nav item / group |
|---|---|---|---|---|
| /login, /forgot-password, /reset-password, /activate-account, /activate-engineer | Login/Forgot/Reset/AccountActivation/EngineerActivation | public | no | — |
| /settings/2fa | Navigate → /profile?tab=security | auth | — | — |
| /profile | ProfilePage | auth only | yes | user menu |
| / | DashboardPage | auth only (backend `/dashboard` requireAuth only) | yes | Home |
| /users | UsersPage | users.read | yes | Administration |
| /roles | RolesPage | roles.read | yes | Administration |
| /projects, /projects/:id | ProjectsPage, ProjectDetailPage | projects.read | yes | Operations |
| /engineering | EngineeringWorkspacePage | engineering.read | yes | Operations |
| /engineering/documentation | DocumentationPage | engineering.read (not project-documentation.read, FE-019) | yes | Operations |
| /engineering/planning | TaskPlanningPage | engineering.read | yes | Operations |
| /engineering/operations | EngineeringOperationsPage | engineering.read | yes | Operations |
| /engineering/engineers | EngineerManagementPage | engineering.read | yes | Operations |
| /engineering/engineers/:id | EngineerDetailPage | engineering.manage | yes | (link only, shown to manage+ADMIN) |
| /engineering/analytics | EngineeringAnalyticsPage | engineering.read | yes | Operations |
| /github | GitHubPage | github.read | yes | Operations |
| /tasks | TasksPage | tasks.read | yes | Operations |
| /milestones | MilestonesPage | milestones.read | yes | Project management |
| /timesheets | TimesheetsPage | timesheets.read | yes | Project management |
| /cms/site-content, /cms/services, /cms/posts, /cms/portfolio, /cms/careers, /cms/testimonials, /cms/team, /cms/faqs, /cms/subscribers | *AdminPage (9) | content.read | yes | Website |
| /media | MediaPage | media.read | yes | Website |
| /leads | LeadsPage | leads.read | yes | Operations |
| /applications | ApplicationsPage | applications.read | yes | People |
| /clients, /clients/:id | ClientsPage, ClientDetailPage | clients.read | yes | Operations |
| /finance | FinancePage | finance.read | yes | Finance |
| /reports | ReportsPage | ReportsGuard = any of 9 perms (nav.ts:87-97) | yes | Reports & Analytics |
| /invoices, /invoices/:id, /invoices/:id/print | InvoicesPage, InvoiceDetailPage, InvoicePrintPage | invoices.read | yes | Finance / Portal |
| /tickets, /tickets/:id | TicketsPage, TicketDetailPage | tickets.read | yes | Operations / Portal |
| /portal/projects, /portal/projects/:id, /portal/milestones | PortalProjectsPage, PortalProjectPage, PortalMilestonesPage | portal.read (+ nav requires clientId) | yes | Portal |
| /employees, /attendance, /leave | EmployeesPage, AttendancePage, LeavePage | employees.read / attendance.read / leave.read | yes | People |
| /documents | DocumentsPage | documents.read | yes | Documents / Portal |
| /audit | AuditPage | audit.read | yes | Administration |
| /notifications | NotificationsPage | notifications.read | yes | header bell (AppShell.tsx:263) |

Nav ↔ route permissions are consistent (every nav item's permission equals its route guard; nav.test.ts covers 7 cases). Mismatches found are FE-018 (reports for CLIENT) and FE-019 (documentation permission).

### Module inventory

| Module | Frontend routes | Backend endpoints (called) | Permissions | FE tests | Status |
|---|---|---|---|---|---|
| Auth/2FA/onboarding | /login … /activate-engineer, /profile | /auth/*, /auth/refresh | — | EngineerActivationPage.test, SecureOnboarding.test, loginDestination.test, RequirePermission.test | Implemented |
| Dashboard | / | GET /dashboard?range= | requireAuth | metrics.test (pure fns) | Implemented |
| Users & roles | /users, /roles | /users, /roles, invitations | users.*, roles.* | UserInvitations.test | Implemented |
| Projects | /projects, /projects/:id | /projects/*, workspace, budget, team | projects.* | assignment.test | Implemented, gaps FE-004 |
| Engineering (workspace/docs/planning/ops/engineers/analytics) | /engineering/* | /engineering/*, /projects/:id/documentation/* | engineering.*, project-documentation.* (unused in UI) | EngineerDirectory.test | Implemented, FE-002/004/015 |
| GitHub | /github | /github/* | github.* | none | Implemented |
| Tasks / Milestones / Timesheets | /tasks, /milestones, /timesheets | /tasks, /milestones, /timesheets | tasks.*, milestones.*, timesheets.* | none | Implemented, Timesheets no pagination |
| CMS (W4) | /cms/* (9), /media | /cms/*, /media | content.*, media.* | none | Implemented, no list search/pagination |
| CRM | /leads, /clients, /clients/:id | /leads (take 100), /clients (paged) | leads.*, clients.* | none | Implemented, FE-003 |
| HR | /employees, /attendance, /leave, /applications | /employees, /attendance (take 100), /leave-requests (take 100), /job-applications (take 100) | employees.*, attendance.*, leave.*, applications.* | none | Implemented, FE-003 |
| Finance | /finance, /invoices*, /reports | /finance/*, /invoices*, /payments, /payments/evc-plus, /reports/* | finance.*, invoices.*, payments.* | none (UI) | Implemented, FE-001/021 |
| Tickets | /tickets, /tickets/:id | /support-tickets* | tickets.* | none | Implemented, no pagination |
| Portal | /portal/*, /tickets, /invoices, /documents | /portal/* | portal.read + client scope | nav.test only | Implemented, FE-006 |
| Documents / Audit / Notifications | /documents, /audit, /notifications | /documents (paged), /audit-logs (take 100), /notifications | documents.*, audit.read, notifications.read | none | Implemented, FE-003 |

### Bundle (local HEAD build, `vite build`)
- `index-*.js` **441.66 kB** (gzip 126.99 kB); prod `index-MnjbBilE.js` 441,678 B raw / 148,755 B gzip as served by nginx (gzip level default). CSS 26.78 kB (gzip 6 kB; prod served 7,074 B).
- Largest lazy chunks: `DocumentationPage` **416.28 kB** (gzip 131.74 kB — Tiptap/ProseMirror), `marked.esm` 76.6 kB, `EngineeringWorkspacePage` 36.1 kB, `date` (date-fns-tz) 29.9 kB, `EngineerManagementPage` 29.3 kB, `FinancePage` 28.8 kB, `DashboardPage` 23.6 kB, `TaskPlanningPage` 23.3 kB, `ProjectDetailPage` 21.3 kB. 73 chunks total. No >500 kB warning.
- Prod `/assets/*`: `Cache-Control: public, immutable`, 1-year expires (good). `index.html`: no Cache-Control, ETag only.

### Frontend test files (16 files, 55 `it` cases)
| File | Covers |
|---|---|
| app/layout/nav.test.ts (7) | sidebar grouping per role: client portal-only, missing clientId, editor reports, staff ops, no duplicate invoices, SUPER_ADMIN all, no Security item |
| app/nginx.conf.test.ts (1) | nginx proxies /api/ and SPA fallback (string match) |
| components/states/states.test.tsx (3) | EmptyState render; ErrorState retry/no-retry |
| components/ui/Badge.test.tsx (1), Button.test.tsx (2) | render/tone; click + loading |
| features/auth/EngineerActivationPage.test.tsx (4) | activation token, password rules, legacy password, non-enumerating resend |
| features/auth/RequirePermission.test.tsx (2) | allow/deny |
| features/auth/SecureOnboarding.test.tsx (4) | invitation verify, invalid invite, OTP reset, invalid OTP |
| features/auth/loginDestination.test.ts (3) | role destinations, MFA-first, open-redirect rejection |
| features/dashboard/metrics.test.ts (5) | pure formatting/trend helpers |
| features/engineering/EngineerDirectory.test.tsx (2) | Resend-status messaging |
| features/projects/assignment.test.ts (1) | invite fan-out |
| features/users-roles/UserInvitations.test.tsx (3) | invitation create/failure/resend/cancel |
| lib/apiClient.test.ts (6) | envelope unwrap, 401→refresh→retry, no loop, login no-refresh, INTERNAL_ERROR fallback, network error |
| lib/date.test.ts (6), lib/qr.test.ts (1), lib/rbac.test.ts (4) | Mogadishu formatting; QR svg; hasPermission/hasRole |

**Not covered by any FE test:** Finance, Invoices/Payments (EVC), Tickets, all 9 CMS pages, Media, Documents, Dashboard UI, Projects/Tasks/Milestones pages, HR pages, Reports, Modal, DatePicker, Select, Input, Table, Toast. No a11y, responsive or RTL tests.

## 3. Findings

### FE-001 (SW-009) — Payment Idempotency-Key is regenerated after a failed/ambiguous request (duplicate charge risk)
- Severity: P1 · Confidence: CONFIRMED (frontend behaviour); duplicate-charge outcome SUSPECTED (depends on backend dedupe) · Module: Portal payments (EVC Plus) / manual payments
- Description: the key is held in `useRef` and replaced with a fresh UUID in the `catch` block. A request that reached the server but failed on the way back (timeout, proxy 502, network drop, `INTERNAL_ERROR`) is retried by the user with a **new** key, so the server's idempotency guard can't recognise it as the same charge.
- Evidence: `frontend/src/features/ops/InvoiceDetailPage.tsx:65` `const payKey = useRef(crypto.randomUUID());` · `:244-245` (EVC catch) `payKey.current = crypto.randomUUID();` · `:295-296` (manual payment catch) same. The same applies to send-invoice: `:86`.
- Expected: keep the same key until a definitive success or a definitive non-retryable 4xx; regenerate only when the input (amount/phone/invoice) changes.
- Affected: CLIENT paying with EVC Plus; finance staff recording payments. Impact: possible double EVC push / duplicate Payment rows.
- Fix: regenerate key on success or on form-value change only; disable submit while `isPending` (already done). Complexity S. Verify: unit test that a rejected mutation re-uses the key; backend agent to confirm server dedupe by (invoiceId, key).
- Cross-ref: Finance/Payments agent.

### FE-002 (SW-065) — Task Planning date-time editor shifts saved dates by the UTC offset on every save
- Severity: P2 · Confidence: CONFIRMED (reproduced) · Module: Engineering → Task Planning
- Description: the edit form fills the `datetime-local` input with the **UTC** wall time, but on save parses the value as **browser-local** time.
- Evidence: `frontend/src/features/engineering/TaskPlanningPage.tsx:25-27`
  `const dateInput = (value) => value ? new Date(value).toISOString().slice(0, 16) : '';`
  `const iso = (value) => (value ? new Date(value).toISOString() : null);` used at `:210-211` (state init) and `:321` (save).
  Reproduction (`TZ=Africa/Mogadishu`): 09:00Z → save → 06:00Z → save → 03:00Z → 00:00Z.
- Impact: every task re-scheduled in Mogadishu loses 3 h each time it is saved; SLA/due-date reporting drifts. Also `:215` and `EngineerWorklog.tsx:10`, `EngineeringWorkspacePage.tsx:443` default "today" from the UTC date (wrong between 00:00-03:00 local).
- Fix: format/parse via `date-fns-tz` in `DISPLAY_TIMEZONE` (add `toDateTimeInputValue`/`fromDateTimeInputValue` to `lib/date.ts`). S. Verify: unit test round-trip in TZ=Africa/Mogadishu.

### FE-003 (SW-027) — Large lists without search/filter/pagination, and silent 100-row backend caps
- Severity: P2 · Confidence: CONFIRMED · Module: CRM, HR, Finance, Tickets, CMS, Audit, Notifications
- Description: CLAUDE.md §12 requires search+filter+pagination for any table >10 rows. These views render the whole response with none of them: `InvoicesPage`, `TicketsPage`, `LeadsPage`, `ApplicationsPage`, `LeavePage`, `TimesheetsPage`, `AttendancePage`, `NotificationsPage`, all CMS list pages (Posts, Services, Portfolio, Careers, Testimonials, Team, FAQs, Subscribers), `PortalProjectsPage`, `PortalMilestonesPage`, `RolesPage` (grep for `setSearch|setPage|PAGE_SIZE` = 0 in each). Backend list endpoints behind them are unpaginated or hard-capped with no `meta.total`, so rows after the cap simply never appear:
  - `backend/src/services/inquiry.service.ts:99` leads `take: 100`
  - `backend/src/services/job.service.ts:241` applications `take: 100`
  - `backend/src/services/hr.service.ts:113` attendance `take: 100` (leave similar)
  - `backend/src/services/system.service.ts:8` audit `take: 100` — `AuditPage.tsx:9-25` paginates/searches **client-side** over those 100 only, so older audit entries can't be reached from the UI.
  - `invoice.service.ts:102`, `ticket.service.ts:86`, `timesheet.service.ts:46`, `media.service.ts:20`, `subscriber.service.ts:36` — no `take` at all (unbounded).
  - Frontend calls: `frontend/src/features/ops/api.ts:33,103,147,160,204,274,286,312,324,327`; `features/cms/api.ts:66,90,144,171,195,222,246,264` (all `apiFetch`, not `apiFetchPaged`).
- Good examples to copy: Clients (`api.ts:125` paged), Documents (`api.ts:300`), Employees, Users, Tasks, Milestones, Finance history.
- Fix: server pagination with `meta.total` + shared `?page&pageSize&search&status`, then a shared paginator UI. M. Verify: seed 150 leads, confirm page 2 reachable.

### FE-004 (SW-066) — Destructive actions without a confirm dialog
- Severity: P2 · Confidence: CONFIRMED · Module: Projects, Engineering, Finance
- Evidence (single click, no confirm):
  - `features/projects/components/ProjectBudgetPanel.tsx:224` `onClick={() => remove.mutate(row.id)}` — removes a budget/expense entry (financial history).
  - `features/projects/components/ProjectTeamPanel.tsx:239` remove project member; `:430` cancel invitation.
  - `features/engineering/DocumentationPage.tsx:606-610` Archive document; `:646` delete comment; `:688`, `:700` remove task/milestone link.
  - `features/engineering/EngineerManagementPage.tsx:153` remove availability slot.
  - `features/milestones/MilestonesPage.tsx:326` remove dependency.
  - `features/finance/FinancePage.tsx:1350` "Post reversal" (posts a reversing journal; only a reason field, no confirm).
  - Native `window.confirm` (not the shared Modal, doesn't name the item consistently): `DocumentationPage.tsx:597`, `EngineeringOperationsPage.tsx:870`, `GitHubPage.tsx:127`.
- Correct pattern exists (named target in Modal): `ProjectsPage.tsx:524`, `TasksPage.tsx:243`, all CMS pages, `DocumentsPage.tsx:202`, `MediaPage.tsx:155`, `UsersPage.tsx:340`, `InvoiceDetailPage.tsx:327`, Finance close-period typed confirmation `FinancePage.tsx:681`.
- Fix: a shared `ConfirmDialog` in `components/ui` and use it everywhere. S-M.

### FE-005 (SW-131) — Somali text in internal/admin screens and system messages (internal should be English)
- Severity: P3 · Confidence: CONFIRMED · Module: Internal UI i18n
- Unconditional Somali shown to staff:
  - **Client detail (internal, clients.read)** `features/ops/ClientDetailPage.tsx:55` `CLIENT_STATUS_LABELS` (Firfircoon/Joogsan), `:87` `PROJECT_STATUS_LABELS` (Qorshaynta/Socda/La joojiyay/La dhammeeyay/La baabi’iyay), `:122` `INVOICE_STATUS_LABELS` (Qabyo/La diray/Qayb ahaan/La bixiyay/Dhacay/La buriyay), `:157` `TICKET_STATUS_LABELS` (Furan/Socda/Sugaya/La xalliyay). Source maps: `packages/shared/src/schemas/client.ts:7`, `project.ts:18`, `invoice.ts:7`, `ticket.ts:7`.
  - **Media (internal, Website group)** `features/ops/MediaPage.tsx:93` empty title `"Warbaahin majirto"`; `:104` `'Urur la’aan'` (no collection).
  - **Dashboard (all staff)** `features/dashboard/DashboardPage.tsx:336` and `:560` `retryLabel="Isku day mar kale"` next to an English title.
  - **Backend error messages surfacing in internal UI** (rendered via `ApiError.message`): `backend/src/services/client.service.ts:82` & `controllers/client.controller.ts:55` "Macmiilkan lama helin"; `services/inquiry.service.ts:121` & `controllers/lead.controller.ts:39` "Codsigan lama helin"; `controllers/payment.controller.ts:29` "Isticmaal EVC Plus portal-ka" (FORBIDDEN, staff); `controllers/public.controller.ts:174,249` "Idempotency-Key header ayaa loo baahan yahay". Portal-facing (OK as Somali but inconsistent): `services/portal.service.ts:49,54,56`, `controllers/portal.controller.ts:22` "Mashruuc lama helin".
- Somali gated to CLIENT only (correct for internal; listed for completeness): `app/layout/GlobalSearch.tsx:20-30,79,88,107,118` (`language` = so when role CLIENT, `AppShell.tsx:249`); `features/ops/TicketsPage.tsx:45` & `TicketDetailPage.tsx:43` (`isPortalClient ? somali : english`) incl. `TICKET_PRIORITY_LABELS` (Hoose/Dhexe/Sare/Degdeg); `features/projects/components/ProjectWorkspaceView.tsx:47-72,93…403` and `ProjectTimeline.tsx:37,70-131` (only when `language='so'` — never passed; `PortalProjectPage.tsx:36` passes `language="en"`, ProjectDetailPage defaults en) → effectively dead Somali.
- Dead Somali (t() always returns English): `InvoicesPage.tsx:43`, `InvoiceDetailPage.tsx:59`, `InvoicePrintPage.tsx:20` — but `InvoiceDetailPage.tsx:240-241` hardcodes Somali "Codsiga EVC waa la diray. Sug xaqiijinta telefoonkaaga…" outside `t()` (portal client only branch).
- Shared label maps that are Somali and may leak elsewhere: `APPLICATION_STATUS_LABELS` (job.ts:110), `LEAVE_TYPE_LABELS`/`LEAVE_STATUS_LABELS` (leave.ts:7,18), `MILESTONE_STATUS_LABELS` (milestone.ts:10), `PROJECT_HEALTH_LABELS` (workspace.ts:20). Frontend Applications/Leave pages shadow them with local English maps (`ApplicationsPage.tsx:11`, `LeavePage.tsx:25,31`) — OK today, fragile.
- Shared Zod validation messages: English (no Somali matches).
- Fix: use `lib/internalLabels.ts`-style English maps for ClientDetailPage; translate MediaPage/Dashboard strings; English backend messages for staff routes. S.

### FE-006 (SW-132) — Portal language is mixed English/Somali
- Severity: P3 · Confidence: CONFIRMED · Module: Portal
- CLIENT sees Somali in search and tickets, English in My Projects/Milestones/Invoices/Documents (`PortalProjectsPage.tsx:19-25,37`, `PortalMilestonesPage.tsx:15-19,26`, `InvoicesPage.tsx:43`, `PortalProjectPage.tsx:36` `language="en"`), plus the hardcoded Somali EVC pending message (`InvoiceDetailPage.tsx:241`) rendered in error red (`:324` `text-error`, no `role="status"`). CLAUDE.md §15 asks for correct Somali (or i18n) on user-facing copy. No i18n framework/locale switch exists; `index.html` `lang="en"` fixed; no `dir` handling.
- Fix: decide portal locale strategy (product decision), then one translation table. M.

### FE-007 (SW-014) — No security headers on the dashboard (app.somwave.botandev.com)
- Severity: P2 · Confidence: CONFIRMED (prod probe) · Module: Deploy / nginx
- Evidence: `HEAD https://app.somwave.botandev.com/login` → only `content-type, date, etag, last-modified, server, alt-svc`; no `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options`/`frame-ancestors`, `X-Content-Type-Options`, `Referrer-Policy`. `frontend/nginx.conf:1-47` sets none. The SPA renders CMS HTML (Tiptap/marked + DOMPurify) and auth flows → clickjacking and no CSP backstop.
- Fix: add headers in nginx (`add_header … always`) with a CSP allowing self + Google Fonts. S. Cross-ref Security agent.

### FE-008 (SW-006) — Same-origin API proxy hairpins through the public internet; client IP likely collapses to the VPS IP for rate limiting
- Severity: P2 · Confidence: SUSPECTED · Module: Deploy / auth rate limiting
- Evidence: `frontend/nginx.conf:30-41` `proxy_pass https://api.somwave.botandev.com/api/;` with `X-Forwarded-For $proxy_add_x_forwarded_for`. The request leaves the container, re-enters Traefik on the public hostname; with `trust proxy 1` the backend takes the last hop (the VPS/nginx egress IP), so all dashboard users would share one IP bucket for login/IP rate limits (CLAUDE.md §13). Also adds a TLS round-trip per API call.
- Fix: proxy to the backend's internal Docker hostname (`http://backend:PORT`) and configure trusted proxy hops explicitly. M. Verify: log `req.ip` for a login via app.* (needs server access — BLOCKED for us). Cross-ref Security/Infra agent.

### FE-009 (SW-133) — No catch-all route: unknown URLs render a blank screen
- Severity: P3 · Confidence: CONFIRMED · Module: Router
- Evidence: `frontend/src/app/App.tsx:211-591` has no `path="*"`; prod `GET /does-not-exist` → 200 index.html → React Router matches nothing → empty `#root` (no shell, no message). Same for a mistyped deep link from an email.
- Fix: `<Route path="*" element={<EmptyState title="Page not found" …/>} />` inside AppShell. S.

### FE-010 (SW-067) — Duplicate form controls: second date pickers and selects
- Severity: P2 · Confidence: CONFIRMED · Module: UI kit compliance (CLAUDE.md §2 "a second date picker is a defect")
- Evidence: shared `components/ui/DatePicker.tsx` is used in only 5 files (LeavePage, InvoicesPage, TimesheetsPage, EmployeesPage, ProjectFormModal). **33 raw `type="date|datetime-local|month"` inputs in 15 files**, e.g. `FinancePage.tsx:174,180,673,916,1041,1047`, `ProjectsPage.tsx:265-283`, `TaskFormModal.tsx:131`, `MilestoneFormModal.tsx:156`, `TaskPlanningPage.tsx:327,333,562,1091,1098`, `EngineerManagementPage.tsx:168,175`, `ReportsPage.tsx:288,297`, `ProjectCreationWizard.tsx:225,329,337`, `ProjectTeamPanel.tsx:336,343`, `ProjectBudgetPanel.tsx:169`, `PortfolioFormModal.tsx:295`, `EngineerWorklog.tsx:250`, `EngineeringWorkspacePage.tsx:745,752`, `EngineeringOperationsPage.tsx:528`. **90 raw `<select>`** (EngineerDirectory 12, FinancePage 11, TaskPlanningPage 10, EngineeringOperationsPage 9, DocumentationPage 9, …) vs shared `Select`; local `fieldClass` re-implements Input styling (`FinancePage.tsx:37`). No shared Textarea (35 raw `<textarea>`). 9 raw `<table>` outside `components/ui/Table` (FinancePage ×5).
- Impact: inconsistent focus rings/labels/error wiring; FE-002 is a direct consequence (no shared datetime helper).
- Fix: extend DatePicker (date/datetime/month in DISPLAY_TIMEZONE), add Textarea, migrate. M.

### FE-011 (SW-134) — Palette / dark-mode deviations
- Severity: P3 · Confidence: CONFIRMED · Module: Design system
- Evidence:
  - Default Tailwind palette class: `features/ops/NotificationsPage.tsx:94` `text-red-700` (does not adapt to dark mode).
  - `features/projects/ProjectDetailPage.tsx:86` active tab `bg-brand text-white`; in dark mode `--color-brand` = `#93baff` (`tokens.css:59`) → white on light blue ≈ 2:1 contrast (fails AA).
  - Off-spec brand blue: `tokens.css:33` `--color-brand: #015efb` (plus sidebar/canvas/banner/invoice-purple tokens `:31-40`) is not in the CLAUDE.md §8 palette (navy/amber); it drives active nav, focus rings and links app-wide (`AppShell.tsx:162-163`). Needs a design decision/ADR.
  - `bg-white/5`, `bg-white/10` (`AppShell.tsx:163,187,228`) raw white.
  - Dark mode **exists**: tokens under `:root[data-theme='dark']` (`tokens.css:43-68`), toggle in header (`AppShell.tsx:251-262`), persisted in localStorage. But the theme attribute is only set inside AppShell's effect (`AppShell.tsx:114-117`) → auth pages (/login, /reset-password, activation) never apply a saved dark preference on fresh load, and there is a light flash before AppShell mounts (no inline script in `index.html`).
- No raw hex in components (grep clean); no `blue-/indigo-/violet-/slate-` classes.
- Fix: tokenise red/white, `text-surface` on brand, early theme script. S.

### FE-012 (SW-135) — RTL: physical direction utilities still widespread; Arabic/RTL not wired
- Severity: P3 · Confidence: CONFIRMED · Module: i18n/RTL
- Evidence: ~70 physical-direction usages (`ml-`, `pr-`, `pl-`, `text-left/right`, `left:` inline styles): `FinancePage.tsx` 24 (e.g. `:220,276,302,439-462,494,560-579`), `EngineeringOperationsPage.tsx` 19 (`:404,517,548,644,705-713,795-803`), `TaskPlanningPage.tsx` 13 (`:59,72,92,120,149-152,852,893`), `ProjectTimeline.tsx:88,111,117`, `DocumentationPage.tsx:164,474`, `GitHubPage.tsx:159,169`, `ReportsPage.tsx:464-465`, `UsersPage.tsx:209`, `ProjectInquiriesPanel.tsx:227`, `EngineerDirectory.tsx:406,508`, `EngineerDetailPage.tsx:254`, `EngineerManagementPage.tsx:516`, `EngineeringAnalyticsPage.tsx:290`, `ProjectWorkspaceView.tsx:208`, `ProjectAssignmentFields.tsx:92`. Shell/kit use logical props correctly (`start-0`, `ms-auto`, `end-4`, `text-start`). No `dir`/`lang` switching anywhere; Arabic font token exists but unused.
- Fix: replace with `ms-/me-/ps-/pe-/text-start/end`, `inset-inline-start`. S-M.

### FE-013 (SW-136) — Modal lacks focus management
- Severity: P3 · Confidence: CONFIRMED · Module: UI kit a11y
- Evidence: `components/ui/Modal.tsx:13-41` — Escape + scrim close and `aria-modal` are present, but no initial focus, no focus trap, no focus restore to the trigger; `aria-label={title}` instead of `aria-labelledby`. Every form/confirm in the app uses it. Header user menu (`AppShell.tsx:296-339`) uses `role="menu"` without arrow-key handling.
- Fix: focus first field / trap Tab / restore on close. S.

### FE-014 (SW-137) — Small touch targets: `Button size="sm"` is 36 px (149 usages)
- Severity: P3 · Confidence: CONFIRMED · Module: UI kit
- Evidence: `components/ui/Button.tsx:15` `sm: 'h-9 px-3 text-sm'`; 149 `size="sm"` usages (row actions in tables/lists). Some raw selects `h-10` (`EngineeringWorkspacePage.tsx:819`), inline text buttons (`DocumentationPage.tsx:644` "Delete" link-button). CLAUDE.md §12 requires ≥44 px. Shell/nav controls are compliant (`min-h-11`, `h-11 w-11`).
- Fix: `sm` → `min-h-11` on coarse pointers (`pointer-coarse:` variant) or h-11. S.

### FE-015 (SW-138) — Many forms bypass React Hook Form + shared Zod resolver
- Severity: P3 · Confidence: CONFIRMED · Module: Forms
- Evidence: 23 files use `zodResolver` with shared schemas (CMS modals, Clients, Employees, Invoices, Leave, Tickets, Timesheets, Profile, ProjectFormModal, TaskFormModal, UserFormModal, Login, 2FA). Manual `useState` + `<form onSubmit>` without client-side schema validation in: `FinancePage.tsx` (3 forms incl. transaction and account creation), `EngineeringWorkspacePage.tsx` (7), `TaskPlanningPage.tsx` (9), `EngineeringOperationsPage.tsx` (4), `EngineerManagementPage.tsx` (3), `DocumentationPage.tsx` (4), `EngineerSkillsSchedule.tsx` (2), `ProjectBudgetPanel.tsx` (2), `ProjectTeamPanel.tsx`, `ProjectWorkspaceView.tsx`, `MilestonesPage.tsx`, `EngineerDetailPage.tsx`, `EngineerWorklog.tsx`, `GitHubPage.tsx`. (Some are filter/search forms — fine.) Server still validates, so this is UX/consistency (CLAUDE.md §11), not security.
- Fix: migrate create/edit forms to RHF + shared schema. M.

### FE-016 (SW-139) — Dates displayed with browser locale/timezone instead of Africa/Mogadishu helper
- Severity: P3 · Confidence: CONFIRMED · Module: Dates
- Evidence: 48 `toLocaleString/DateString/TimeString` calls in 17 files bypass `lib/date.ts` (`DISPLAY_TIMEZONE`), e.g. `ProjectActivityPanel.tsx:39`, `ProjectBudgetPanel.tsx:217,242`, `ProjectTeamPanel.tsx:449`, `DocumentationPage.tsx:642,777`, `EngineerDirectory.tsx:455`, `UsersPage.tsx`, `GitHubPage.tsx`, `ReportsPage.tsx`. A staff member on a UTC laptop sees different dates than the Finance page (which uses `financeBusinessDate`).
- Fix: route through `formatDate/formatLongDate` + a `formatDateTime`. S.

### FE-017 (SW-140) — Heavy editor chunk loaded on every project detail view
- Severity: P3 · Confidence: CONFIRMED · Module: Performance
- Evidence: `DocumentationPage` chunk 416 kB (132 kB gz). `features/projects/ProjectDetailPage.tsx:7` statically imports `DocumentationPage` and `:9` `TaskPlanningPage`, so opening any project downloads the Tiptap bundle even if the Documentation tab is never opened. Main entry 442 kB (127 kB gz) includes the whole `@somwave/shared` barrel and Zod; `vite.config.ts` has no `manualChunks`. Note production gzip output (148.8 kB) is ~17% larger than Vite's estimate — nginx `gzip_comp_level` default 1.
- Fix: `lazy()` the documentation/planning tabs; `gzip_comp_level 6` or pre-compressed assets. S.

### FE-018 (SW-141) — Client reports unreachable from the UI
- Severity: P3 · Confidence: CONFIRMED · Module: Reports / Portal
- Evidence: backend `backend/src/routes/reports.routes.ts:18-31` allows `portal.read`/`invoices.read` and defines `my-projects` / `my-invoices` reports (`:47-48`), but frontend `app/layout/nav.ts:87-97` `REPORT_ACCESS_PERMISSIONS` omits both and `App.tsx:195-207` `ReportsGuard` uses it → CLIENT can never open /reports. Either dead backend surface or missing portal feature (product decision).

### FE-019 (SW-084) — Documentation screens gated on `engineering.read`, not `project-documentation.read`
- Severity: P3 · Confidence: CONFIRMED · Module: RBAC
- Evidence: `App.tsx:284-291` and `nav.ts:33-36` use `ENGINEERING_READ`; `PROJECT_DOCUMENTATION_READ/MANAGE` (`packages/shared/src/constants/permissions.ts:73-74`) are granted in `backend/prisma/seed.ts:188` etc. but referenced nowhere in frontend or in `backend/src/routes/project-documentation.routes.ts` (no `rbac()` at all; service checks membership only). Toggling the documentation permission in the Roles UI has no effect. Cross-ref Backend/RBAC agent.

### FE-020 (SW-142) — No optimistic updates with rollback anywhere
- Severity: P3 · Confidence: CONFIRMED · Module: Data layer
- Evidence: 172 `useMutation` usages, 0 `onMutate` (grep). CLAUDE.md §11 requires optimistic mutations with rollback; current pattern is invalidate-on-success (correct but not to spec; not a bug). Kanban status changes (`TaskKanban.tsx:78`) are the most visible lag.

### FE-021 (SW-007) — "Could not load finance dashboard." — source and conditions (cross-ref Finance agent)
- Severity: P3 · Confidence: CONFIRMED (code path); production trigger SUSPECTED · Module: Finance
- Source: `frontend/src/features/finance/FinancePage.tsx:195-205` (identical in prod chunk `FinancePage-DaGwO4xf.js`):
  `dashboard.isError || !dashboard.data ? <ErrorState description={dashboard.error instanceof Error ? dashboard.error.message : 'Could not load finance dashboard.'} …/>`
- Endpoint: `GET /api/v1/finance/dashboard?from=YYYY-MM-DD&to=YYYY-MM-DD` (`features/finance/api.ts:97-98`) → backend `backend/src/routes/finance.routes.ts:339-346` (`rbac(finance.read)`, `finance.financeDashboard(from,to)`). Defaults: from = 1st of current month, to = 1st of next month (`FinancePage.tsx:42-48`). Unauthenticated prod probe via app proxy → 401 `UNAUTHORIZED` (route alive).
- The literal fallback text appears only when there is **no Error object**: i.e. a 2xx response whose `data` is `null`/falsy, or a query paused by TanStack `networkMode: 'online'` while the browser reports offline (status pending, not loading, not error). Any HTTP error shows the server message instead (e.g. "Authentication required", "Your session has expired…", or the bare code `INTERNAL_ERROR` when a proxy returns non-JSON — `lib/apiClient.ts:18,82-87`). If users report this exact sentence, the Finance agent should check whether `financeDashboard` can resolve to `null`/`undefined`. The ErrorState title is the generic "Something went wrong"; the cause is not surfaced.
- Fix: distinguish `!data` from `isError`, show error code + correlation id. S.

### FE-022 (SW-068) — Frontend test coverage is thin for business screens
- Severity: P2 · Confidence: CONFIRMED (file inventory) · Module: QA
- Evidence: 16 FE test files / 55 cases (table in §2); none for Finance, Invoices/EVC payment, Tickets, CMS, HR, Dashboard rendering, Projects/Tasks/Milestones, Modal/DatePicker/Select/Table. CLAUDE.md §15 asks ≥70% coverage and role-by-role RBAC tests; only nav/RequirePermission have role tests. Coverage % not measured (QA agent).

## 4. Acceptance rows (frontend)

| Feature | Status | Evidence |
|---|---|---|
| Frontend typecheck (`tsc --noEmit`) | VERIFIED | exit 0 |
| Frontend lint (`eslint frontend/src`) | VERIFIED | exit 0 |
| Frontend production build | VERIFIED | vite build OK to scratchpad; chunk sizes §2 |
| Production app served & matches HEAD | VERIFIED | GET app.* 200; FinancePage chunk 28,843 B = local; CSS hash identical |
| Static asset caching | VERIFIED | `/assets/*` Cache-Control public, immutable, 1y |
| Security headers on app.* | FAILED | FE-007 |
| Lazy routes | PARTIAL | all feature routes lazy (App.tsx:17-175); heavy tabs statically imported (FE-017) |
| Route permission guards = nav permissions | PARTIAL | consistent; FE-018, FE-019 |
| Unknown route handling | FAILED | FE-009 |
| Four states on data views | PARTIAL | present on all list/detail pages checked (skeleton `LoadingState`, `ErrorState` w/ retry, `EmptyState`); Finance shows misleading copy (FE-021). Not exercised in a browser |
| Skeletons vs spinners | PARTIAL | skeleton bars everywhere, but generic rows not content-shaped (`LoadingState.tsx:14-16`) |
| Forms use RHF + shared Zod | PARTIAL | 23 files yes; ~25 forms manual (FE-015) |
| Tables >10 rows: search/filter/pagination | FAILED | FE-003 (≥16 views) |
| Destructive confirm dialogs | PARTIAL | main CRUD yes; FE-004 gaps |
| Single shared date picker / modal | FAILED | DatePicker in 5 files vs 33 raw inputs (FE-010); Modal unique ✔ |
| fetch only in lib/apiClient.ts | VERIFIED (static) | grep: no fetch/axios/XHR outside `lib/apiClient.ts` |
| No `any`, no ts-ignore/eslint-disable | VERIFIED (static) | grep clean |
| No mock/hardcoded data | VERIFIED (static) | grep clean; dashboard computes from API (`dashboard/api.ts`) |
| Palette: no raw hex / default palette classes | PARTIAL | 1 default class (`text-red-700`), off-spec brand blue token (FE-011) |
| Dark mode | PARTIAL | implemented via tokens + toggle; contrast/auth-page gaps (FE-011) |
| RTL logical properties / Arabic | NOT IMPLEMENTED | ~70 physical classes; no dir switch (FE-012) |
| Responsive 375/768/1024/1440 | NOT TESTED | classes present (drawer < lg, `sm:/md:/lg:/xl:` grids, table overflow-x) — no device run (BLOCKED, no credentials) |
| Touch targets ≥44px | PARTIAL | shell OK; `Button sm` 36 px ×149 (FE-014) |
| Keyboard/focus/aria | PARTIAL | focus-visible rings, labelled icon buttons, aria-live toasts; Modal focus missing (FE-013) |
| Internal screens in English | PARTIAL | FE-005 list |
| Portal copy in Somali | PARTIAL | mixed (FE-006) |
| Payment idempotency (UI side) | FAILED | FE-001 |
| Dates in Africa/Mogadishu | PARTIAL | `lib/date.ts` correct & tested; FE-002 (reproduced drift), FE-016 |
| Optimistic mutations w/ rollback | NOT IMPLEMENTED | FE-020 |
| Frontend tests ≥70% coverage | NOT TESTED | 55 tests, many screens untested (FE-022) |
| Role-by-role UI walkthrough on prod | BLOCKED | no credentials |

## Somali text inventory (internal and portal screens)

The full list of Somali strings found in internal/admin screens, staff-facing backend messages, the portal and shared label maps is recorded under FE-005 (SW-131) and FE-006 (SW-132) above. In summary:

- Internal screens shown unconditionally in Somali: client detail status maps (`ClientDetailPage.tsx:55,87,122,157`, from shared `client.ts:7`, `project.ts:18`, `invoice.ts:7`, `ticket.ts:7`); Media empty state "Warbaahin majirto" and "Urur la’aan" (`MediaPage.tsx:93,104`); Dashboard retry label "Isku day mar kale" (`DashboardPage.tsx:336,560`).
- Backend messages surfacing to staff: "Macmiilkan lama helin" (`client.service.ts:82`, `client.controller.ts:55`), "Codsigan lama helin" (`inquiry.service.ts:121`, `lead.controller.ts:39`), "Isticmaal EVC Plus portal-ka" (`payment.controller.ts:29`), "Idempotency-Key header ayaa loo baahan yahay" (`public.controller.ts:174,249`).
- Portal: Somali in search and tickets only for CLIENT; English elsewhere; hardcoded Somali EVC pending message outside `t()` (`InvoiceDetailPage.tsx:240-241`); dead Somali branches in `ProjectWorkspaceView.tsx`, `ProjectTimeline.tsx`, `InvoicesPage.tsx:43`, `InvoiceDetailPage.tsx:59`, `InvoicePrintPage.tsx:20`.
- Shared Somali label maps that may leak: `APPLICATION_STATUS_LABELS` (`job.ts:110`), `LEAVE_TYPE_LABELS`/`LEAVE_STATUS_LABELS` (`leave.ts:7,18`), `MILESTONE_STATUS_LABELS` (`milestone.ts:10`), `PROJECT_HEALTH_LABELS` (`workspace.ts:20`).
- Public website: Somali content under an English default locale and `lang="en"` (WEB-004 / SW-063, below).

## Public website UI, SEO and i18n (from the CMS & Web report)

### WEB-003 (SW-062): Sitemap leaves out every CMS detail page, and canonical URLs differ by trailing slash
- Severity: P2 · Confidence: CONFIRMED (probe) · Module: SEO
- **Sitemap gaps:** sitemap-0.xml lists 17 URLs: the static pages plus 4 "tusaale" example pages. It has **no** blog posts, services, portfolio items or careers. These SSR routes are not discovered (astro.config.mjs:24-28 only adds `/`). sitemap.xml returns 404; the index lives at /sitemap-index.xml, and robots.txt points there correctly.
- **Trailing-slash mismatch:** the sitemap uses trailing slashes (`/adeegyada/`), but SSR pages declare a canonical without one (`/adeegyada`). Both `/adeegyada` and `/adeegyada/` return 200 with a canonical pointing at themselves (probe), so the same page is indexed twice. Prerendered pages use the slash form (`/ku-saabsan/`); SSR pages do not. BaseLayout.astro:29 builds the canonical from `Astro.url.pathname`.
- **Stale file:** web/public/robots.txt still says `https://somwave.com/sitemap-index.xml`. The robots.txt.ts route wins at runtime, but the public file conflicts with it.
- **Fix:** set `trailingSlash: 'never'` (or `'always'`) and normalise the canonical. Add a sitemap route that reads published slugs from the API. Delete public/robots.txt.
- Complexity: S/M.

### WEB-004 (SW-063): Locale and i18n contradict the requirements: English default, chrome-only translation, no hreflang
- Severity: P2 · Confidence: CONFIRMED · Module: Public website i18n
- **Evidence:**
  - web/src/lib/i18n.ts:9 sets `DEFAULT_LOCALE = 'en'`; CLAUDE.md §17 says Somali is the default.
  - Every page serves `<html lang="en" dir="ltr">` (probe), yet portfolio descriptions are Somali ("Barnaamij mobil oo...").
  - The switcher only swaps `[data-i18n]` chrome strings on the client (LanguageSwitcher.astro:39-52). The body stays English.
  - Arabic sets `dir=rtl` over English content.
  - No hreflang on any page. og:locale is `en_US`.
- **Fix:** a product decision on the default locale, then server-side locale routes with hreflang.
- Complexity: L.

### WEB-008 (SW-127): Hardcoded app domain, unused hardcoded marketing copy, an off-palette brand colour, and no dark mode
- Severity: P3 · Confidence: CONFIRMED · Module: Public website
- **Hardcoded portal URL:** `https://app.somwave.botandev.com` appears in Header.astro:17, Footer.astro:23, request-project.astro:88 and :123, and nala-soo-xiriir.astro:28 instead of a `PUBLIC_APP_URL`.
- **Static sections:** why, process, stats, tusaale projects and trusted logos come from homeContent.ts, not the CMS. Visibility and order are CMS-controlled through `sectionOrder`/`hiddenSections`.
- **Off-system tokens:** tokens.css:6 adds `--color-brand: #104fdb` (blue), plus sky and cyan, which are not in the CLAUDE.md §8 palette.
- **No dark mode:** no `prefers-color-scheme` anywhere in web.
- Complexity: S.

### WEB-009 (SW-128): Page weight and image optimisation
- Severity: P3 · Confidence: CONFIRMED · Module: Performance
- **Page sizes:** the homepage is 86 KB of HTML with 10 script tags. Other pages are 22-31 KB with 5-6 scripts.
- **Shared JS chunk:** `/_astro/api.CztqEqx-.js` is 105 KB, because it bundles Zod plus the shared package for client validation.
- **No asset pipeline:** astro:assets is not used. Images come from plain `/public` files, though they do have width/height and lazy loading (the homepage has 19 imgs, all with width set, 13 lazy).
- **Large PNGs:** `/works/*.png` files are 1.6-2.0 MB each, served on the tusaale pages. The og:image is a 379 KB PNG logo.
- **Mixed content and links:** none found. All 27 internal links and assets returned 200.
- **Fix:** convert to WebP/AVIF through astro:assets and import only the schemas needed on the client.
- Complexity: S/M.

### CMS-001 (SW-027): No CMS list has search, filter or pagination, and backend list endpoints are unbounded
- Severity: P2 · Confidence: CONFIRMED · Module: CMS (all)
- **Frontend:** a grep of every `features/cms/*AdminPage.tsx` found 0 search and 0 pagination controls (the SiteContent "filter" hits are unrelated).
- **Backend:** `listAllPosts`, `listAllPortfolio`, `listSubscribers` and `listMedia` (media.service.ts:19-22, a bare `findMany`) return every row. This violates CLAUDE.md §12 (tables over 10 rows) and §10 (pagination).
- **Fix:** server-side `?page&pageSize&q&status`, plus the shared Table pattern.
- Complexity: M.

### STO-005 (SW-125): The preview can show while the upload fails (expected), and partial failures in Portfolio are not reported per file
- Severity: P3 · Confidence: CONFIRMED · Module: CMS image field
- **The preview is local:** ArticleImageField.tsx:39-47 renders a blob preview from the local `File` before any upload. The upload happens on submit (PostFormModal.tsx:136-145).
- **On failure:** the preview stays and an error line appears. The record is not saved, so nothing false is persisted. A user can still read the preview as "uploaded".
- **Portfolio:** reports only the first error and does not say which gallery file failed.
- **Fix:** label the preview "Not uploaded yet" until the server returns a URL, and keep per-file status for the gallery.
- Complexity: S.
