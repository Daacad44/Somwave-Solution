# Somwave — Status report

Date: 10 September 2026. Sources: repository, PRs #1–#30, `CLAUDE.md`, `docs/Somwave_Blueprint_v3_2.docx`.

Somwave is three systems on one backend: Public Site (Astro), Internal + CMS (React), Client Portal (React). Mobile is later and must not start before P1–P4.

## Done before this branch

F0 foundation (auth, RBAC, UI kit, CI). Public pages for home, services list, portfolio, blog, careers, contact, testimonials, team, FAQ, newsletter chrome. CMS for those content types. Internal users, roles, projects, tasks, milestones.

## This branch

See [WORKLOG.md](./WORKLOG.md). Adds the date kit, About + service detail + legal pages, role-grouped AppShell, leads and recruitment inboxes, Client + portal shell, timesheets, invoice drafts, and support tickets.

## Remaining

2FA flow, SMTP, S3 uploads, Kanban/Gantt, HR attendance/leave/payroll, full finance/accounting, payment gateways (blocked on a complete I4.1 + P4.1), CRM deals/quotations, documents/assets, executive BI, Expo mobile, Docker/Coolify deploy. Staging Gate 3 has not been accepted.

README previously called workspaces a “shell”; that was stale.
