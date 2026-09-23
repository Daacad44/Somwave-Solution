# Somwave — Cusboonaysiinta Hirgelinta (Implementation Update)

| Field | Value |
| --- | --- |
| **Mashruuca** | Somwave |
| **Nooca warbixinta** | Isbarbardhig warbixintii hore + P0 integration + koodh la gaaray |
| **Taariikhda** | 22 Sebtember 2026 |
| **Laanta isku-darka** | `cursor/p0-platform-integration-ae9d` |
| **Sal dhigga diff** | `claude/new-session-o05c30` → P0 branch (123 files, ~5074 insertions / ~385 deletions) |
| **Warbixintii hore** | `docs/SOMWAVE_PROJECT_REPORT.md` (~55% guud) |
| **Luqadda** | Soomaali (magacyada farsamo — Ingiriisi) |

---

## 1. Kooban (Executive Summary)

Tan iyo **`docs/SOMWAVE_PROJECT_REPORT.md`**, mashruucu wuxuu ka gudbay marxaladda “laamo kala go’an oo sugaya isku-darka” una gudbay **P0 platform integration**: silsiladaha ugu muhiimsan ee macmiilka iyo maaliyadda ayaa hadda **hal laan** ku jira, iyadoo la isku daray **`origin/main`** (homepage, Coolify, CORS, cookies) iyo lix slice feature ah (I4.1, P2.3, P3, 2FA, SMTP/CMS UX, I4.2).

**Waxa isbedelay qiimeynta guud:** qiyaastii **~55%** → **~68%** ee qorshaha buuxa (`CLAUDE.md` scope). Kororku wuxuu ugu badan yahay **Portal (+15 dhibcood qiyaas)**, **Internal (+10)**, **F0 (+5)**, iyo **Deploy (+5)** — ma aha “100% dhammayn”; waa **integration + slices buuxa** oo weli u baahan **Gate 3 (staging UAT)** iyo **P1** (EVC Plus, S3, iwm.).

**Hubinta farsamo (22 Sebtember 2026, laanta P0):**

| Tijaabo | Natiijo |
| --- | --- |
| `npm run typecheck` | ✅ Pass |
| `npm test` | ✅ **232** tests, **47** files |
| `npm run lint` | ✅ Pass (WORKLOG) |
| `npm run build` | ✅ Pass (WORKLOG) |

**Gate 3:** Weli **lama aqbalin** — UAT staging + ansixin PM ayaa dhiman.

---

## 2. Isbarbardhig: Warbixintii hore vs Hadda

| Mowduuc | Warbixintii hore (`SOMWAVE_PROJECT_REPORT`) | Hadda (P0 integrated) |
| --- | --- | --- |
| **Qiimeyn guud** | ~55% | **~68%** (qiyaas farsamo) |
| **Isku-darka laamo** | 7+ laamo `cursor/*` “in-flight”, aan merge | **Isku dar** `cursor/p0-platform-integration-ae9d` |
| **Sync `main`** | Session iyo main kala duwan | ✅ Step 0: merge `origin/main` + xal khilaafaad |
| **I4.1 Invoices** | 🟡 Draft/list kaliya; send/PDF/void ma jiraan | ✅ Builder buuxa: send, void, tax, detail, print |
| **P4.2 / lacag bixin** | ❌ Ma jiraan | 🟡 **I4.2** manual bank transfer + reconciliation (ma aha EVC Plus) |
| **P2.3 Milestones portal** | 🟡 Laan furan | ✅ Liiska milestones scoped macmiil |
| **P3 Tickets** | 🟡 List/create; replies/SLA ma jiraan | ✅ Detail, replies, assignment, status UI |
| **2FA** | ❌ Model fields; flow ma dhammayn | ✅ Enrollment + login challenge (Soomaali) |
| **SMTP** | ❌ | ✅ Mailer + templates (invoice, enquiry); `.env.example` |
| **CMS UX** | — | ✅ Dashboard cards buuxa + loading copy Soomaali |
| **Deploy fixes** | Qaar #32–#41 on main | ✅ Ku jira P0 (Docker, Redis AUTH, CORS, cookies, Astro runtime, homepage #42) |
| **Migrations** | 15 | **+2** (ticket assignee/reply author; payments) |
| **Tijaabooyin** | CI green | **232** tests pass on integration branch |

---

## 3. Qiimeyn track cusub (% qiyaas)

| Track | Hore | Hadda | Sababta isbeddelka |
| --- | --- | --- | --- |
| F0 Foundation | 92% | **97%** | 2FA flow; weli S3, BullMQ |
| W Website + CMS | 85% | **86%** | Homepage production + minor sync |
| I Internal | 45% | **55%** | I4.1 buuxa + I4.2 manual payments |
| P Portal | 35% | **50%** | P2.3 + P3 buuxa; P4.2 gateway weli |
| M Mobile | 0% | 0% | Lama bilaabin (sida qorshaha) |
| Deploy / Ops | 50% | **55%** | Main sync; UAT ma jiraan |
| **Guud** | **~55%** | **~68%** | P0 vertical slices + deploy track |

---

## 4. Wax-soo-saarka koodhka (deliverables) — koox ahaan

### 4.0 Step 0 — Sync `origin/main` → session

| Commits / PRs | Waxa keentay |
| --- | --- |
| `#33`, `#36–#42`, `#29` | Backend Dockerfile Coolify, Redis AUTH, CORS production, frontend/web Docker, portal cookies, Astro runtime, homepage UI, W5.4/W5.5 |

**Khilaafaad la xaliyay:** `Dockerfile`, `.dockerignore`, `AppShell`, web chrome, `packages/shared` exports.

---

### 4.1 I4.1 — Invoice builder (Internal + portal read)

**Backend**

- `backend/src/services/invoice.service.ts` (+ tests)
- `backend/src/controllers/invoice.controller.ts`
- `packages/shared/src/schemas/invoice.ts` (+ tests)
- Seed / schema cusbooneysiin haddii loo baahdo `backend/prisma/schema.prisma`

**Frontend**

- `frontend/src/features/ops/InvoicesPage.tsx`
- `frontend/src/features/ops/InvoiceDetailPage.tsx`
- `frontend/src/features/ops/InvoicePrintPage.tsx`
- `frontend/src/features/ops/api.ts`, `hooks.ts`

**Awoodaha:** abuur/draft, tax, dirid (send), void, detail, print view.

---

### 4.2 P2.3 — Portal milestones

**Backend**

- `backend/src/services/portal.service.ts` (+ tests)
- `backend/src/controllers/portal.controller.ts`
- `backend/src/routes/platform.routes.ts`

**Frontend**

- `frontend/src/features/ops/PortalMilestonesPage.tsx`

**Awoodaha:** milestones scoped `clientId` (macmiil portal).

---

### 4.3 P3 — Support tickets (detail, replies, assignment)

**Backend**

- Migration: `backend/prisma/migrations/20260921140000_ticket_assignee_and_reply_author/migration.sql`
- `backend/src/services/ticket.service.ts` (+ tests)
- `backend/src/controllers/ticket.controller.ts`
- `packages/shared/src/schemas/ticket.ts`

**Frontend**

- `frontend/src/features/ops/TicketsPage.tsx`
- `frontend/src/features/ops/TicketDetailPage.tsx`

**Awoodaha:** faahfaahin ticket, jawaabaha, xilsaarid, beddelka xaaladda.

---

### 4.4 2FA — Enrollment + login (F0 / §13)

**Backend**

- `backend/src/services/auth.service.ts` (+ tests)
- `backend/src/controllers/auth.controller.ts`
- `backend/src/routes/auth.routes.ts`
- `backend/src/lib/totp.ts`, `backend/src/lib/tokens.ts` (+ tests)
- `packages/shared/src/schemas/auth.ts` (+ tests)

**Frontend**

- `frontend/src/features/auth/TwoFactorSetupPage.tsx`
- `frontend/src/features/auth/LoginPage.tsx`, `hooks.ts`, `api.ts`, `ProtectedRoute.tsx`
- `frontend/src/app/App.tsx` (routes)

**Awoodaha:** diiwaangelinta TOTP, login laba-tallaabo ah, copy Soomaali.

---

### 4.5 SMTP + CMS dashboard UX

**Backend**

- `backend/src/lib/mailer.ts` (+ tests)
- `backend/src/mail/templates.ts` (+ tests)
- `backend/src/services/inquiry.service.ts` (email on enquiry haddii SMTP diyaar)
- `backend/src/lib/env.ts` — SMTP optional vars
- `backend/.env.example` — dokumenti SMTP runtime

**Frontend**

- `frontend/src/features/dashboard/DashboardPage.tsx` — CMS cards buuxa
- `frontend/src/components/ui/Button.tsx` — loading copy Soomaali

**Qoraal:** `cursor/smtp-mailer-90f3` **lama merge** — stack SMTP duplicate; hal path oo `#49` / ux-cms.

---

### 4.6 I4.2 — Manual bank transfer + reconciliation

**Backend**

- Migration: `backend/prisma/migrations/20260921150000_add_payments/migration.sql`
- `backend/src/services/payment.service.ts` (+ tests)
- `backend/src/controllers/payment.controller.ts`
- `packages/shared/src/schemas/payment.ts`
- `backend/src/lib/idempotency.ts` (+ tests) — Idempotency-Key

**Frontend**

- Ops flows ku xiran `frontend/src/features/ops/*` (invoice/payment UI)

**Awoodaha:** diiwaangelin lacag gacanta, isku dhejin invoice status (PARTIAL/PAID).

---

### 4.7 Deploy, CORS, cookies, Redis (main sync)

| Fayl / module | Fix |
| --- | --- |
| `backend/src/lib/cors.ts`, `app.cors.test.ts` | Production frontend origin |
| `backend/src/lib/cookies.ts`, `cookies.test.ts` | Portal login cookies production |
| `backend/src/lib/redisAuth.ts`, `redis.ts` | Redis AUTH Coolify healthcheck |
| `frontend/Dockerfile`, `nginx.conf`, `frontend/.env.example` | Coolify React |
| `web/Dockerfile`, `web/astro.config.mjs`, `web/package.json` | Astro production |
| `Dockerfile`, `.dockerignore` (root/backend) | Backend image |

---

### 4.8 Websaydh dadweynaha (homepage & assets)

- `web/src/pages/index.astro` + components `web/src/components/home/*`
- `web/src/lib/homeContent.ts`, `BrandLogo.astro`, Header/Footer/Hero cusbooneysiin
- Assets: `web/public/brand/`, `web/public/images/*`

---

### 4.9 Shared & permissions

- `packages/shared/src/constants/permissions.ts` — keys cusub (tickets, payments, 2FA, iwm.)
- `packages/shared/src/index.ts` — exports
- `frontend/src/lib/rbac.test.ts`, `AppShell.tsx` — navigation

---

## 5. Hagaajinta & xalinta dhibaatooyinka

| Dhibaato | Xalka |
| --- | --- |
| Session branch ka horeeysa `main` (deploy) | Merge `origin/main` step 0 |
| Khilaafaad Docker / AppShell / web / shared | Gacanta lagu xaliyay integration commit |
| CORS production | `cors.ts` + tests |
| Cookies portal production | `cookies.ts` + #41 |
| Redis healthcheck Coolify | `redisAuth.ts` |
| Astro runtime production | `web/package.json` / config (#40) |
| SMTP laba stack | Kaliya ux-cms/#49 path; smtp-mailer branch la iska dhaafay |
| I4.2 kadib SMTP | Cherry-pick `e51a999` si aan loo duubin |

---

## 6. Dukumentiyo la qoray / la cusboonaysiiyay

| Dukumeenti | Xaaladda |
| --- | --- |
| `docs/SOMWAVE_IMPLEMENTATION_UPDATE.md` | **Cusub** — warbixintan |
| `docs/WORKLOG.md` | Cusboonaysi P0 (22 Sep 2026) |
| `docs/SOMWAVE_PROJECT_REPORT.md` | Hore — snapshot ~55%; weli tixraac taariikh |
| `docs/SOMWAVE_BUILD_PLAN.md` | Ku jira laan `cursor/somwave-build-plan-ae9d` (qorshe ansixin) |
| `docs/STATUS_REPORT.md` | La cusboonaysiinayaa → taariikh 22 Sep + tilmaam halkan |
| `docs/FRONTEND_VISIBILITY.md` | Weli sax ah; hubi routes cusub marka UAT |

---

## 7. Waxa weli dhiman (P1, Gate 3, iwm.)

### 7.1 Gate 3 (mudnaan sare)

- Deploy staging (Coolify): migrate, `SMTP_*` runtime, `VITE_*` **buildtime**
- UAT: invoice send → manual payment → portal milestones/tickets → 2FA roles mudnaanta leh
- Ansixin PM

### 7.2 P1 — ka dib P0 (qorshaha)

| Slice | Sharaxaad |
| --- | --- |
| **P4.2 EVC Plus** | Gateway online; webhook → I4.2-style reconciliation |
| **S3 uploads** | CV, media; MIME verify §13 |
| **P3.3 SLA** | Assignment policies + SLA metrics |
| **BullMQ** | Reminders, digests |
| **P1 multi-user client** | Go’aan §18 |
| **HR / CRM / Kanban / Mobile** | Sida `SOMWAVE_PROJECT_REPORT` §8.2 |

### 7.3 Lama bilaabin P0

- EVC Plus, eDahab, Stripe
- Accounting buuxa, payroll, attendance
- Documents, messages, contracts (portal models)

---

## 8. Caddeyn tijaabo (test evidence)

```
Test Files  47 passed (47)
Tests       232 passed (232)
```

**Moodooyin muhiim ah:** `auth.service.test.ts`, `invoice.service.test.ts`, `payment.service.test.ts`, `ticket.service.test.ts`, `portal.service.test.ts`, `mailer.test.ts`, `templates.test.ts`, `idempotency.test.ts`, shared schema tests, frontend `apiClient.test.ts`, `Button.test.tsx`.

---

## 9. Taariikhda Git (P0 branch, kooban)

```
97e7cce chore(backend): document optional SMTP runtime vars in .env.example
749eedd docs: record P0 integration progress in WORKLOG
b89a2d0 feat(payments): I4.2 manual bank transfer with invoice reconciliation
4c41be1 feat(p0): integrate I4.1, P2.3, P3 tickets, 2FA, CMS UX, SMTP (#49)
1971fe7 chore: sync origin/main into session (P0 step 0)
… (+ feature commits from stacked branches)
```

**Isku-darka asalka ah:** `claude/new-session-o05c30` + 19 commits (ilaa HEAD P0).

---

## 10. Tixraacyada Pull Request

| PR / laan | Ujeeddo |
| --- | --- |
| **`cursor/somwave-full-update-report-ae9d`** | Dukumentiyo + warbixin (PR cusub) |
| **`cursor/p0-platform-integration-ae9d`** | Koodhka P0 oo dhan (base: `claude/new-session-o05c30`) |
| `#49` | SMTP / integration stack (tixraac taariikh) |
| `#42`, `#36–#41`, `#33`, `#38–#40` | Main deploy & homepage |

**Isbarbardhig koodh:**  
https://github.com/Daacad44/Somwave-Solution/compare/claude/new-session-o05c30...cursor/p0-platform-integration-ae9d

*(URL-ka PR cusub waxaa lagu dari doonaa body-ga PR ka dib `gh pr create`.)*

---

## 11. Soo koobid tallaabo xiga

1. **Merge** laanta P0 ama PR warbixinta + P0 → `claude/new-session-o05c30`.
2. **Staging UAT** — Gate 3 checklist (`CLAUDE.md` §15).
3. **P1:** EVC Plus + S3 + SLA — vertical slices sida §16.

---

*Warbixintan waxay isbarbardhig u tahay `docs/SOMWAVE_PROJECT_REPORT.md` waxayna ku salaysan tahay diff Git, `docs/WORKLOG.md`, iyo tijaabooyinka maxalliga ah ee 22 Sebtember 2026.*
