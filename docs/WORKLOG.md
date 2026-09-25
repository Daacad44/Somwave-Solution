# Somwave — Work log

Every slice in this branch is recorded here. Status is about this change set, not the whole platform.

## 2026-09-25 — Master requirement alignment (`cursor/master-requirement-align-9571`)

| Step | Slice | Status |
| --- | --- | --- |
| D1 | `docs/SOMWAVE_MASTER_REQUIREMENT.md` + short alignment plan | ✅ |
| D2 | Nav: Website / Operations / Portal from existing permissions | ✅ |
| D3 | `RequirePermission` on app routes | ✅ |
| D4 | Client dashboard my-projects card; remove invented % deltas | ✅ |

**Not in this slice:** Media Library, i18n URLs, S3, documents, Stripe/eDahab, HR/finance/CRM depth.

## 2026-09-22 — Gate 3 staging prep (B) + P1 EVC Plus (`cursor/p1-evc-plus-ae9d`)

| Step | Slice | Status |
| --- | --- | --- |
| B | `docs/STAGING_UAT_CHECKLIST.md` (Somali + Coolify env tables + UAT script) | ✅ |
| C1 | Shared: `chargeEvcPaymentSchema`, `PaymentGateway` type, webhook payload | ✅ |
| C2 | Prisma: `gateway_ref`, `payer_phone` on `payments` | ✅ |
| C3 | Backend: EVC adapter, `/payments/evc-plus`, webhook, idempotency, client scoping | ✅ |
| C4 | Frontend: portal macmiil — foom EVC on invoice detail | ✅ |
| C5 | Seed: `payments.*` for `CLIENT` role | ✅ |
| C6 | Tests: payment service + EVC client signature | ✅ |

**Verification (local):** `npm run typecheck`, `lint`, `test`, `build` — run on branch before push.

**Pending (not this slice):** S3 uploads, SLA/assignment depth, staging UAT on Coolify (PM).

---

## 2026-09-22 — P0 platform integration (`cursor/p0-platform-integration-ae9d`)

| Step | Slice | Source branch | Status |
| --- | --- | --- | --- |
| 0 | Sync `origin/main` → session base | main (#32–#42 homepage, Coolify, CORS, cookies) | ✅ Merged; conflicts resolved (Docker/.dockerignore, AppShell, web chrome, shared exports) |
| 1 | **I4.1** invoice builder (send, void, tax, detail, print) | `cursor/i41-invoice-builder-90f3` | ✅ Via stack merge |
| 2 | **P2.3** portal milestones | `cursor/p23-portal-milestones-90f3` | ✅ Via stack merge |
| 3 | **P3** ticket detail, replies, assignment, status | `cursor/p3-ticket-replies-90f3` | ✅ Via stack merge |
| 4 | **2FA** enrollment + Somali login challenge | `cursor/auth-2fa-login-so-90f3` | ✅ Via stack merge |
| 5 | **SMTP** + CMS dashboard cards | `cursor/ux-cms-cards-90f3` (#49) | ✅ Single SMTP path; `cursor/smtp-mailer-90f3` **not** merged (duplicate stack) |
| 6 | **I4.2** manual bank transfer + reconciliation | `cursor/i42-manual-payments-90f3` | ✅ Cherry-pick `e51a999` only (after ux-cms SMTP) |
| 7 | Gate 3 staging UAT | — | ⏳ Pending PM / deploy |

**Integration branch:** `cursor/p0-platform-integration-ae9d` (from `claude/new-session-o05c30` + main sync).

**Verification (local, 2026-09-22):**

- `npm run typecheck` — pass
- `npm run lint` — pass
- `npm test` — 232 tests pass (47 files)
- `npm run build` — pass (web, frontend, backend)

**Blockers / notes:**

- No merge blockers remain for P0 code integration.
- Staging UAT not run from this agent (needs Coolify + `SMTP_*` runtime + DB migrate).
- P1 (EVC Plus P4.2, S3 uploads) **not** started per plan.

---

## 2026-09-10 — Parallel platform wave (`cursor/parallel-platform-build-e229`)

| ID | Slice | Surfaces | Status |
| --- | --- | --- | --- |
| DOC-01 | Status report + visibility matrix + README | docs, README | This PR |
| F0.4d | Shared DatePicker, `lib/date.ts` (Africa/Mogadishu), lucide-react, date-fns | frontend kit | This PR |
| W2.2 | About page `/ku-saabsan` | public site | This PR |
| W2.3 | Service detail `/adeegyada/[slug]` | public site + public API | This PR |
| W-legal | Privacy + terms pages | public site | This PR |
| I1-nav | AppShell grouped into Websayd / Gudaha / Portal by permission | dashboard | This PR |
| I5.1 | Leads inbox from website inquiries | internal | This PR |
| I3.5 | Recruitment inbox from job applications | internal | This PR |
| P1 | Client model + portal dashboard + client-scoped projects | portal + internal clients | This PR |
| I2.4 | Timesheets (employee-linked, project-scoped) | internal | This PR |
| I4.1 | Invoice list + draft create (builder foundation) | internal + portal read | This PR |
| P3.1 | Support tickets list + create (client-scoped) | portal + internal | This PR |

Not in this PR (still remaining): 2FA enrolment, SMTP, S3/CV, Kanban, Gantt, payroll, full accounting, payment gateways, mobile, Dockerfile/Coolify, URL-based i18n, media library.
