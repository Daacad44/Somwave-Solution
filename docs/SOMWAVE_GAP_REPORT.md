# Somwave — Gap report (complete except payment)

**Date:** 25 September 2026  
**Base:** `origin/claude/new-session-o05c30` (`#60` alignment merged)  
**Payment:** frozen — EVC Plus and manual bank transfer must not change.

Audit only. Engineering source of truth is the repository. Product source of truth is `docs/SOMWAVE_FEATURES.md` and `docs/SOMWAVE_MASTER_REQUIREMENT.md`.

---

## 1. Already working

| Area | What works |
| --- | --- |
| Public site | Home (approved sections), About, Services + detail, Portfolio + detail, Blog + detail, Careers + apply, Contact → Inquiry, Team, FAQ, Testimonials, Terms, Privacy, Newsletter, 404, sitemap/robots |
| CMS | 8 modules: services, posts, portfolio, careers, testimonials, team, FAQ, subscribers (CRUD + publish) |
| Auth | Login, logout, refresh cookies, `/me`, 2FA enroll + challenge (mandatory SUPER_ADMIN / ADMIN / MANAGER) |
| RBAC | Permission keys, seed roles, `RequirePermission` on app routes, server `rbac()` |
| Delivery | Projects, tasks, milestones, timesheets (list/create/update) |
| CRM foundation | Clients, leads inbox (from contact), recruitment inbox (from careers) |
| Finance (non-gateway) | Invoice draft / send / void / print; existing payment **read/record** only |
| Support | Tickets create/list/detail/reply/assign; client-scoped 404 |
| Portal | My projects, milestones, tickets, invoices; CLIENT off Operations nav |
| Isolation | Invoices, tickets, portal lists, payments scoped by `clientId` |
| SMTP | Optional mailer; invoice-sent + enquiry-notify templates |

## 2. Partially working

| Area | Gap |
| --- | --- |
| 2FA | No backup codes, no recovery path besides TOTP |
| Website SEO | Sitemap/robots exist; no CMS page-level SEO / OG controls |
| Blog / portfolio | Content exists; no tags, search, related posts, share, filters |
| Contact | Rate limit + validation; no honeypot |
| Job apply | `resumeUrl` is a URL string — no CV file upload |
| Invoice | Print view exists; no generated PDF file |
| Timesheets | Create/update; no weekly grid, submit/approve workflow UI |
| Tasks | Table only — no Kanban / Gantt / subtasks / dependencies |
| Employee | Model exists for timesheets only — no directory UI |
| AuditLog / Setting | Models exist — no API/UI writers or screens |
| Dashboard | Real counts where permitted; no activity feed or CRM depth |
| Ticket codes | Unique `code` exists; format/SLA/rating not implemented |

## 3. Missing (must build, except payment)

**Auth / system:** forgot + reset password; 2FA backup codes; client invite/onboarding; profile; email template CMS; BullMQ jobs; in-app notifications.

**Website / CMS:** Media Library; Pages; Menu Builder; SEO settings; URL i18n `/so` `/en` `/ar` + Arabic RTL; CV → private storage.

**HR:** Employee directory; attendance; leave; payroll (records only — no gateway).

**Finance non-payment:** expenses; budgets; accounting (CoA, journal, P&L, exports); reconciliation UI (read existing payments only).

**CRM:** lead score/assignee/notes/activity; deals; quotations.

**Ops:** documents + versions; assets; procurement; announcements; internal messages; calendar.

**Portal:** documents; messages; contracts; service requests; approvals; SLA; ticket rating; reports; client profile.

**Analytics:** executive dashboard; report picker; OKRs; Gantt; team load.

**Storage:** S3-compatible private objects + signed/authenticated download.

## 4. Broken / misleading

- Search box and notification bell in AppShell do not perform search or list notifications.
- No other payment/UI fakes found after the alignment slice (invented % deltas removed).

## 5. Payment — do not touch

| Path | Rule |
| --- | --- |
| `backend/src/payments/**` | Frozen |
| `backend/src/services/payment.service.ts` | Frozen |
| `backend/src/controllers/payment.controller.ts` | Frozen |
| `backend/src/routes/payment.webhook.routes.ts` | Frozen |
| `packages/shared/src/schemas/payment.ts` | Frozen |
| Invoice detail EVC / bank forms | Frozen |

May **display** existing payment rows. Must **not** add Stripe, eDahab, or a new gateway.

## 6. This branch (wave 1)

Implemented: password reset, 2FA backup codes, task Kanban, S3/memory storage, media library, employees/attendance/leave, client-scoped documents, audit list, in-app notifications. Payment files were not touched.

**Still later:** URL i18n `/so|/en|/ar`, deals/quotations, expenses/budgets/accounting, portal messages/contracts/SLA/ratings/onboarding, Gantt, BullMQ, payroll records, CMS pages/menus/SEO settings.

A feature ships only with schema + migration + service + route + UI four-states + permission + tests. No fake APIs.
