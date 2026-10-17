# Integrated website, finance and reporting status

Latest production bug-fix acceptance (17 October 2026):
[PRODUCTION_FIX_ACCEPTANCE.md](PRODUCTION_FIX_ACCEPTANCE.md). It supersedes the
storage/onboarding/date-handling details below and records live-production
verification deferred to the user's configuration.

Snapshot: 16 October 2026. This document describes code and local validation for
the website, inquiry, finance and reports change. It is **not** a production acceptance or
deployment record. Existing project, account, engineering and accounting data
were preserved; no production database or Coolify service was changed.

## Task 1 — website, portfolio and client requests

- The existing Astro homepage remains CMS-driven and English-first. It now
  includes company introduction, delivery process and contact content. The
  existing accessible company-logo carousel and other public sections remain.
  CMS editors can reorder or hide homepage sections in a private draft.
  Publication requires submission, independent administrator approval and an
  audited publish action; the previous public content remains live until then.
- The existing portfolio CMS now manages technologies, features, gallery,
  completion date, status, featured/archive state, SEO text and validated live
  demo/case-study URLs. Public listing and detail pages read published records
  from the API. Demo clicks increment an anonymous aggregate counter; no
  visitor identifiers are stored for that event.
- A visitor can submit a portfolio-linked project request. The backend stores
  a pending inquiry, sends a six-digit code with Resend, hashes and expires the
  code, limits retries/resends, and requires a separate short-lived activation
  proof before password creation. Existing account holders sign in and link a
  verified request matching their email. New accounts receive only the CLIENT
  role. Requests remain distinct from projects.
- After email verification, visitors may upload up to three supporting PDF,
  JPEG or PNG files of 5 MB each. A short-lived verification proof authorizes
  public upload but never download. Linked clients and permitted staff have
  scoped download routes. Retry deduplicates identical file content.
- Admins can review, send a proposal, reject or convert an inquiry. The client
  approves the proposal first; only then may an authorized admin create the
  linked project, optionally selecting a project manager. The Client Portal
  lists requests, approvals, projects,
  calculated task progress, visible milestones and approved shared documents.
  Portal project/invoice surfaces touched in this increment use English.

New public routes: `POST /api/v1/public/project-inquiries`, `/:id/resend`,
`/:id/verify`, `/:id/activate`, and portfolio `/:id/demo-click` under
`/api/v1/public`. New authenticated routes: `GET
/api/v1/portal/project-inquiries`, `/unlinked`, `POST /:id/link`,
`POST /:id/approve-proposal`, and admin `GET
/api/v1/leads/project-inquiries`, `PATCH /:id/review`, `POST /:id/convert`.

Migrations `20261016150000_portfolio_project_inquiries`,
`20261016160000_portfolio_demo_clicks` and
`20261016170000_project_inquiry_attachments` are additive. The first migration's
checksum was preserved after local application; the second carries later
activation-token and click-counter additions.

**Remaining Task 1 acceptance:** portfolio view counts; full project team/milestone setup
after conversion; wider client feedback/approval flows. A live Resend send and
mailbox receipt have not been verified because this cloud environment lacks
`RESEND_API_KEY` and `EMAIL_FROM`. The sender required by the code is
`Somwave Solution <noreply@botandev.com>`. S3 credentials/bucket for persistent
attachments are also absent. Local uploads use temporary in-memory storage;
production attachment persistence requires S3 configuration.

## Task 2 — finance

The existing finance foundation provides chart of accounts, immutable balanced
posted journals, period controls, approval separation, project-linked posted
profitability and trial balance. This increment fixed seven confirmed
invoice/payment integrity defects, including duplicate invoice numbering,
unsafe idempotency replays, concurrent overpayment, duplicate webhook
settlement, pending EVC overbooking, voiding after collection and unsupported
gateway methods marked paid. [The finance bug register](FINANCE_BUG_REGISTER.md)
records each cause and regression test. Invoice and portal billing pages touched
in this increment now display English. Finance transaction and posted-journal
history now have server-side pagination and validated date, account, currency,
type/source and search filters.

**Remaining Task 2 acceptance:** authoritative invoice/payment-to-ledger
posting and reconciliation, vendor bills/AP, payroll, bank reconciliation,
credit notes/refunds, FX rates, complete statements, PDF/email delivery
evidence and many of the 24 requested finance workflows. The detailed gap
matrix remains in [FINANCE_ACCOUNTING_STATUS.md](FINANCE_ACCOUNTING_STATUS.md).
No invoice payment is represented as posted revenue merely because a gateway
record exists.

## Task 3 — Reports & Analytics

An RBAC-gated Reports & Analytics navigation page now queries 14 reports backed
by existing records, including projects, tasks, engineers, clients, project
requests, operations, CMS, audit, trial balance and client-scoped projects and
issued invoices. An MFA-gated receivables aging report uses unpaid legacy
invoices, due-date buckets and database pagination. Because those invoices
lack a currency field and reliable settlement history, it shows per-invoice
balances and labels historical figures as estimates; it does not add unknown
currencies together or treat invoices as posted ledger revenue.
Date/status/search filters and server-side pagination are applied at the API;
CSV uses the same access and filters. The executive overview
shows permitted real metrics, previous-period comparisons for flow metrics and
per-currency posted finance figures. Finance reports require the established
challenge-verified 2FA session. Portfolio demo clicks are recorded aggregate
events; page views are explicitly unavailable.

New routes: `GET /api/v1/reports/catalog`, `/overview`, `/:key` and
`/:key.csv`. The detailed reports are scoped to the actor at the query layer.

**Remaining Task 3 acceptance:** requested report families not yet represented,
PDF/Excel exports, scheduled reports with Redis/Resend delivery, richer charts,
website page-view instrumentation and infrastructure/GitHub metrics when those
integrations are configured. No missing metric is substituted with a fabricated
number.

## Validation and release gate

- Local PostgreSQL and Redis started from the repository's Docker Compose
  file. All 54 migrations applied; `/health` returned HTTP 200 with both checks
  healthy. Public portfolio returned 200 and unauthenticated reports returned
  401. A local inquiry POST returned 503 because Resend is unconfigured, and
  created **zero** inquiry records.
- The monorepo test suite passed; three disposable-database tests are skipped
  in the ordinary run. Separate disposable PostgreSQL finance/payment
  concurrency tests passed before the current increment. Typecheck, lint,
  formatting and production build passed. Nine website Playwright tests passed
  on desktop/mobile configurations. Focused attachment, CMS, reports and
  finance-history tests passed.
- The complete real-email, client activation, payment-provider and production
  browser journey remains unverified. This environment has no Resend key,
  verified sender evidence, payment-provider credentials or Coolify access.

Before production deployment: back up PostgreSQL, inspect and deploy migrations
in order, deploy API/web/frontend from the same commit, configure and verify
Resend sender and durable object storage, run controlled account/payment
journeys, and check live monitoring. Roll back application images to the prior
commit if the release fails. The migrations are additive; after real inquiries
or journals exist, do not drop their tables as an application rollback. Restore
the database only through the approved backup/incident process.
