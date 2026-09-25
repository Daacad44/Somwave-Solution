# Somwave — Master Product Implementation Requirement

Somwave is **one platform** with **three connected interfaces**. Do not treat them as three unrelated products.

| Interface | URL | Audience |
| --- | --- | --- |
| Public website | `somwave.com` | Visitors, prospects, job seekers |
| Client portal | `app.somwave.com` | `CLIENT` |
| Internal operations | `app.somwave.com` | `STAFF`, `MANAGER`, `ADMIN`, `EDITOR`, `SUPER_ADMIN` |

**Data flow (must be preserved):**

```
Public website
      ↓
Leads / job applications
      ↓
Internal operations
      ↓
Clients / projects / invoices
      ↓
Client portal
      ↓
Client view / support / payment
```

| Source | Responsibility |
| --- | --- |
| This document | Implementation constitution |
| [`SOMWAVE_FEATURES.md`](./SOMWAVE_FEATURES.md) | Product requirements (current vs planned) |
| Repository + schema + migrations | Engineering source of truth |
| [`CLAUDE.md`](../CLAUDE.md) | Stack, gates, conventions |

Do not invent undocumented business rules. Do not silently change terminology, roles, permissions, or ownership. Do not migrate the stack. Reuse existing code.

---

## 1. Public website

**Purpose:** Attract → Inform → Convert (leads, contact requests, job applications, newsletter).

**Current pages:** Home, About, Services, Portfolio, Blog, Careers + application, Contact, Team, FAQ, Testimonials, Terms, Privacy, Newsletter.

**CMS (8 modules, React, not Astro):** Services, Articles, Portfolio, Careers, Testimonials, Team, FAQ, Subscribers.

Contact form → **Lead** (internal inbox). Job application → **Application** (recruitment inbox). Do not create a second lead or application system.

**Missing (do not pretend they exist; do not build unless asked):** Media Library, full URL i18n (`/so`, `/en`, `/ar` + Arabic RTL), CV upload to S3.

**Homepage structure (do not add or remove sections):** Header, Hero, Trusted Companies, Services, Why Somwave, How We Work, Portfolio, Statistics, Testimonials, Articles, Final CTA, Footer. Trusted Companies is logo-only when that is the approved design.

## 2. Client portal

**Purpose:** View → Communicate → Pay. A client works without calling staff.

`CLIENT` is not an internal employee role. Do not expose internal operations to `CLIENT`.

The portal **does not create** projects or invoices. Those originate in Internal.

**Current:** Login, 2FA, dashboard, projects, milestones, tickets (create / list / reply / assignment), invoices (view / print), EVC Plus, manual bank transfer.

**Missing (do not fake as complete):** Documents, Messages, Contracts, eDahab, Stripe, full SLA, multiple logins per company.

**Isolation (mandatory, server-side):** every client resource is scoped to `authenticatedUser.clientId`. Cross-client access returns **404**, never 403. Do not rely on hidden UI.

**Portal nav (only supported features):** Dashboard, My Projects, Milestones, Tickets, Invoices. Payments happen on the invoice detail (no standalone payments module). Do not add a Payments item until a payments page exists.

## 3. Internal operations

**Purpose:** Manage → Deliver → Invoice → Support. Replaces Excel / WhatsApp.

**Current:** Auth, 2FA, RBAC, UI kit, SMTP; users / roles / permissions; projects / tasks / milestones / timesheets; recruitment inbox; invoice builder (draft / send / void / print); manual payments; EVC Plus; leads inbox; clients.

**Missing (do not fake; do not add unless asked):** Attendance, leave, payroll, expenses, budgets, accounting, deals, quotations, Kanban, Gantt, assets, BI, S3, BullMQ, documents, contracts, messages, media library, AI chatbot, WhatsApp.

**Internal nav:** Dashboard, Security, Website CMS modules, Projects, Tasks, Milestones, Clients, Leads, Applications, plus existing finance/support that already works (timesheets, invoices, tickets, users, roles). Do not add unfinished modules to enlarge the sidebar.

## 4. Roles and RBAC

Internal: `STAFF`, `MANAGER`, `ADMIN`, `EDITOR`, `SUPER_ADMIN`. External: `CLIENT`.

Use the existing permission keys (`projects.read`, `invoices.create`, …). Do not invent a second permission system. Do not authorize with `if (user.email === …)`. Do not check role names throughout the frontend when a permission exists. `SUPER_ADMIN` uses the same permission model; do not auto-expose future features.

Hiding a nav item is not authorization. Every protected request must validate authentication, permission, and ownership on the server.

## 5. Domain flows

| Flow | Path | Rule |
| --- | --- | --- |
| Lead | Website contact → Lead → internal inbox | One lead system |
| Application | Careers → Application → recruitment inbox | Not a CRM lead |
| Project | Internal creates project / tasks / milestones / timesheets → portal reads | CLIENT cannot create projects |
| Invoice | Internal draft → send → portal view → payment | EVC Plus + manual bank only |
| Payment | Existing gateway / staff record | No fictional success; no Stripe / eDahab |
| Support | Client ticket → assign → reply → client sees response | Own tickets only |

Use the canonical `Client` model. Do not add Customer / PortalClient duplicates.

## 6. Security, API, data

- Validate input. Safe error messages. No stack traces, SQL, or secrets in responses.
- Public endpoints must not leak internal fields.
- Cross-client leakage is forbidden in API, URLs, search, downloads, and print views.
- Preserve login, 2FA, sessions, bcrypt, cookies. No hardcoded admin credentials.
- Secrets stay in existing env configuration. Never in frontend code.
- File uploads (when later requested): MIME + size checks, safe names, private storage, signed URLs. S3 is not available today.
- SMTP: use the existing mailer. Do not add a second email stack.
- Do not run destructive migrations or `prisma migrate reset` against production.
- Prefer 404 for another client’s row. 401 unauthenticated. 403 missing permission on a resource the user may know exists (internal RBAC). Client isolation still uses 404.

## 7. UI

One Somwave brand across all three surfaces. Use the official logo asset — do not recreate, recolor, crop, or replace it with text.

Reuse `components/ui` and `components/states`. Four states on data views: loading, error, empty, success. Empty copy must be real (“No invoices yet”), never fake rows. Responsive at 375 / 768 / 1024 / 1280 / 1440.

**Current vs planned:** if a feature is incomplete, hide it or mark it planned. Never ship fake functionality to make the UI look finished. Do not manufacture dashboard numbers.

## 8. Workflow

Inspect → understand → find the existing implementation → smallest safe change → implement → test permissions and ownership → responsive check → lint / type / build.

Test roles: public, CLIENT A, CLIENT B, STAFF, MANAGER, ADMIN, EDITOR, SUPER_ADMIN.

Ecosystem test: website contact → lead; job apply → application; staff creates client + project + invoice; client sees only their own; supported payment remains visible internally.

---

## 9. This slice (25 September 2026)

Inspected the repository against this constitution. **Not implemented here** (explicitly out of scope): Media Library, i18n URLs, S3/CV, Documents, Messages, Contracts, eDahab, Stripe, SLA, multi-user clients, HR/finance/CRM depth, Kanban/Gantt, BI, BullMQ.

**Alignment implemented:** persist this constitution; expose only **existing** nav destinations for Website / Operations / Portal; keep `CLIENT` off the Operations heading; permission-gate app routes; show portal projects on the client dashboard; stop manufactured dashboard percentages.
