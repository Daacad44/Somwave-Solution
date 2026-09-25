# Somwave — Short implementation plan (alignment slice)

Inspected: `CLAUDE.md`, `docs/SOMWAVE_FEATURES.md`, Prisma schema, API routes, auth/RBAC, UI kit, app routes, seed permissions, homepage.

## What already works

- Website → Lead / Application inboxes (no duplicate systems).
- Internal creates clients, projects, invoices; portal reads them.
- Client isolation on invoices, tickets, portal lists, payments (404 when `clientId` mismatches).
- EVC Plus + manual bank transfer only. CMS is the single content system.

## Gaps to fix (this slice only)

1. Sidebar omitted working modules (invoices, tickets, timesheets, users, roles, portal).
2. `CLIENT` saw Home + Security only — portal pages existed but were not linked.
3. Routes checked login, not permission — a client could open `/projects` shell (API still 403).
4. Client dashboard had no “My projects” card (`portal.read` is not `projects.read`).
5. Dashboard showed invented % deltas.

## Not in this slice

Missing features listed in `SOMWAVE_FEATURES.md` and the master requirement (S3, i18n, documents, Stripe, HR, BI, …).
