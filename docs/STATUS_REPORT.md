# Somwave — Status report

Date: 22 September 2026. Sources: repository on `claude/new-session-o05c30`, PRs #1–#49, `CLAUDE.md`.

The full narrative (Somali) is [WARBIXIN_MASHRUUC.md](./WARBIXIN_MASHRUUC.md). This file is the short English snapshot.

Somwave is three systems on one backend: Public Site (Astro), Internal + CMS (React), Client Portal (React). Mobile is later and must not start before P1–P4.

## Done on the working branch

**F0** foundation (auth, RBAC, UI kit, CI). **W1–W5** public pages (home, about, services, portfolio, blog, careers, contact, testimonials, team, FAQ, legal) plus CMS for those types. Chrome i18n So/En/Ar + RTL; page bodies remain Somali. **I1** users and roles. **I2** projects, tasks, milestones, timesheets. **I5.1** leads inbox. **I3.5** recruitment inbox. **P1** Client + portal shell. **P2.2** client-scoped projects. **I4.1 / P3.1 / P4.1** are list-and-create only (invoice drafts, ticket list/create, invoice list). Production Dockerfile and `/health` exist.

## In flight (open stacked PRs, 21 September)

Merge order: #48 invoice builder → #47 portal milestones → #45 ticket replies → #46 2FA → #43 CMS UX. #49 SMTP is merged onto the UX branch only. #44 manual payments sits on SMTP.

None of that stack is on `claude/new-session-o05c30` yet. Review and GitHub CI checks are empty (workflow listens to `main` only).

## Remaining

HR attendance/leave/payroll, full accounting, CRM deals/quotations, Kanban/Gantt, S3 uploads, BullMQ jobs, Claude AI, EVC Plus and other live gateways, documents/messages/contracts, executive BI, URL-based i18n, Expo mobile. Staging Gate 3 has not been accepted.

`main` has later Coolify and homepage work (#36–#42) that is not fully on the session branch. Reconcile the two trunks before calling staging stable.

## Visibility

See [FRONTEND_VISIBILITY.md](./FRONTEND_VISIBILITY.md). Hiding a nav item is not authorization.
