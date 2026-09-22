# Somwave — Status report

Date: 22 September 2026. Sources: repository, PRs #1–#49, `CLAUDE.md`, current default branch `claude/new-session-o05c30`, and `origin/main`.

The full Somali narrative (what is moving, what is done, what is left) is [WARBIXIN_MASHRUUC.md](./WARBIXIN_MASHRUUC.md). This file is the short English index.

Somwave is three systems on one backend: Public Site (Astro), Internal + CMS (React), Client Portal (React). Mobile is later and must not start before P1–P4.

## Done on the default branch (`claude/new-session-o05c30`)

F0 foundation (auth, RBAC, UI kit, CI). Public site W1–W5 (home, services, about, legal, portfolio, blog, careers, contact, testimonials, team, FAQ, newsletter, SEO + chrome i18n So/En/Ar). CMS for those types. Internal users, roles, projects, tasks, milestones, timesheets. Leads inbox (I5.1). Recruitment inbox (I3.5). Client model, portal shell, client-scoped projects. Invoice list + DRAFT create. Support ticket list + create + status.

## Done on `main` but not on the default branch

Coolify production path: Redis AUTH (#36), frontend deploy (#37), CORS (#38), web Coolify + Astro `send` (#39, #40), production login cookies (#41), homepage UI from the supplied design (#42). Session has platform features (#31) that `main` does not.

## In flight (draft stack, 21 Sep 2026)

Merge order: #48 I4.1 invoice builder → #47 P2.3 portal milestones → #45 ticket replies → #46 2FA + Somali login → #43 CMS cards → #49 SMTP (already merged onto that tip) → #44 I4.2 manual bank transfer.

None of that stack is on `main` or on the default branch tip.

## Remaining (not in the draft stack)

EVC Plus / eDahab / Stripe, HR attendance/leave/payroll, expenses/budgets/accounting, CRM deals/quotations, documents/messages/contracts, S3 uploads, BullMQ jobs, Kanban/Gantt, URL-based i18n, media library, executive BI, Expo mobile. Staging Gate 3 has not been accepted.

The two trunks must be unified before the next production deploy, or each environment is missing the other half.
