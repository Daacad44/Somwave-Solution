# Somwave — Warbixin Mashruuc (Project Report)

| Field | Value |
| --- | --- |
| **Mashruuca** | Somwave |
| **Nooca warbixinta** | Xaaladda guud, horumarka, iyo farqiga qorshaha |
| **Taariikhda** | 22 Sebtember 2026 |
| **Ilaha** | Repository-ga, `CLAUDE.md`, `docs/STATUS_REPORT.md`, `docs/WORKLOG.md`, taariikhda Git (PRs #1–#42) |
| **Luqadda farsamada** | Ingiriisi (magacyada koodhka); qoraalka warbixinta — Soomaali |

---

## 1. Kooban (Executive Summary)

Somwave waa **hal madal dhijitaal ah** oo u adeega saddex dhagaystayaal: **dadweynaha** (websaydh suuqgeyn), **macaamiisha** (portal), iyo **shaqaalaha shirkadda** (nidaam gudaha + CMS). Ujeeddadu waa in baaris, xiriir, maamul mashaariic, taageero, iyo maaliyad ay ka dhacaan hal backend halkii Excel, WhatsApp, iyo nidaamyo kala go’an.

**Xaaladda hadda:** Aasaaska farsamo (**F0**) iyo inta badan **websaydhka dadweynaha (W1–W5)** ayaa la dhisay koodh ahaan. **Gudaha (I)** wuxuu leeyahay maamul isticmaale, mashaariic, hawlaha, milestones, timesheets, leads, recruitment inbox, iyo aasaaska qaansheegyada. **Portal (P)** wuxuu leeyahay shell macmiil, mashaariic scoped, tickets, iyo akhris qaansheeg. **Mobile (M)**, **HR buuxa**, **accounting**, **lacag bixin online**, iyo **CRM buuxa** weli ma dhammaan.

**Gate muhiim ah:** Sida qorshaha (`CLAUDE.md` §3), **staging weli lama aqbalin (Gate 3)** — mashruucu wuxuu ku jiraa marxaladda horumar + deploy hore, ma ahan “la dhammeeyay oo la aqbalay”.

**Talo kooban:** Dhammeey staging acceptance; xidh silsiladda **invoice → lacag bixin → reconciliation**; dhammeey **2FA + SMTP + S3**; ka dib portal milestones iyo ticket SLA; ha bilaabin mobile ilaa P1–P4 ay buuxaan.

---

## 2. Ujeeddooyinka mashruuca

| Ujeeddo | Qofka faa’iidaysanaya |
| --- | --- |
| Websaydh xirfad leh oo Soomaali/En/Ar | Dadweynaha, suuqgeyn |
| Foomam xiriir iyo codsiyo shaqo → inbox gudaha | Sales / HR |
| CMS content-ka websaydhka | EDITOR |
| Maamul mashaariic, hawlaha, milestones | STAFF / MANAGER |
| Portal macmiil: mashaariic, tickets, qaansheeg | CLIENT |
| Mustaqbal: lacag bixin (EVC Plus, iwm.), HR, CRM | Shirkadda oo dhan |

**Domain-yada qorshaha:** `somwave.com` (Astro) · `app.somwave.com` (React) · `api.somwave.com` (Express).

---

## 3. Qaab-dhismeedka farsamada

### 3.1 Monorepo

| Workspace | Package | Stack | Door |
| --- | --- | --- | --- |
| `packages/shared` | `@somwave/shared` | Zod, constants, types | Qandaraaska API labada dhinac |
| `web` | `@somwave/web` | Astro (hybrid SSR/static) | Dadweynaha |
| `frontend` | `@somwave/frontend` | React 18, Vite, TanStack Query, RHF + Zod | Gudaha + CMS + Portal |
| `backend` | `@somwave/backend` | Node 20, Express, Prisma | `/api/v1` |

### 3.2 Socodka codsiga (request flow)

1. React → hook → `features/*/api.ts` → `lib/apiClient.ts` (kaliya meesha `fetch` ka jirto).
2. Express: `helmet → cors → cookies → pino → rateLimit → route`.
3. Route: `requireAuth` + `rbac(permission)` + Zod validate → controller → **service** → Prisma.
4. Jawaab: `{ data, meta? }` ama `{ error: { code, message } }`.

### 3.3 Kaydinta

- **PostgreSQL 16** + pgvector (Prisma; 15 migration committed).
- **Redis 7** (local/docker-compose; caching/jobs mustaqbal).
- **Auth:** JWT access + refresh, httpOnly cookies, bcrypt cost 12.

### 3.4 Design system

CSS variables (`tokens.css`): navy primary, amber accent, typography Plus Jakarta Sans, spacing 4px scale. Ma loo isticmaalo Tailwind palette default (`blue-*`, iwm.) sida brand.

---

## 4. Habka dhismaha (phases & gates)

Qaabka rasmiga ah:

```
F0 → W1…W5 (websaydh)
  → I1…I7 (gudaha)
  → P1…P6 (portal)
  → M1…M3 (mobile)
```

**Gates:**

| Gate | Macnaha | Xaaladda |
| --- | --- | --- |
| **0** | F0 dhammayn ka hor W/I/P | F0 ~ dhammay koodh |
| **1** | Internal ka hor portal features (tusaale invoices ← I4.1) | Qaar la raacay; qaar weli xidhnaa |
| **2** | Sub-phase = slice toos ah (schema → migration → API → UI → test) | Badankood waa slices; qaar UI/API qayb |
| **3** | Phase dhammayn = staging + PM aqbal | **Aan la gaarin** |

---

## 5. Horumarka faahfaahsan

### 5.1 F0 — Aasaaska

| Astaamaha | Xaaladda | Faallo |
| --- | --- | --- |
| Monorepo, ESLint, Prettier, TypeScript strict | ✅ | CI waa dhaqaaqaa |
| Docker Compose (Postgres, Redis) | ✅ | Production: Coolify services |
| Prisma, seed, migrations | ✅ | 15 migrations |
| Auth login/refresh/logout/me | ✅ | Production cookie fixes (#41) |
| RBAC + permissions | ✅ | 40+ permission keys hadda |
| UI kit + Loading/Empty/Error | ✅ | |
| AppShell + nav by permission | ✅ | Websayd / Gudaha / Portal |
| DatePicker + timezone Mogadishu | ✅ | PR platform wave |
| 2FA enrollment buuxa | ❌ | Model fields jira; flow ma dhammayn |
| BullMQ jobs | ❌ | Redis jira |
| S3 uploads | ❌ | |

### 5.2 W — Websaydh dadweynaha (Astro)

| Sub-phase | Waxa la gaaray | PR / tixraac |
| --- | --- | --- |
| W2.4 Contact / Inquiry | ✅ | #13 |
| W3.1 Portfolio | ✅ | #14 |
| W3.2 Blog | ✅ | #15 |
| W3.3–3.4 Careers + application | ✅ | #16 |
| W2.2 About, W2.3 Service detail, legal | ✅ | platform wave |
| W4.1–4.4 CMS (services, posts, portfolio, careers) | ✅ | #22–#25 |
| W5.1–5.3 Testimonials, team, FAQ | ✅ | #26–#28 |
| W5.4–5.5 Newsletter, SEO, i18n aasaas | ✅ | #29/#30 |
| Homepage UI production | ✅ | #42 (main) |
| URL-based i18n buuxa | 🟡 | Aasaas jira |
| Media library CMS | ❌ | |

**Bogag dadweynaha (tusaale):** `/`, `/ku-saabsan`, `/adeegyada`, `/shaqooyinka`, `/blog`, `/fursado-shaqo`, `/nala-soo-xiriir`, `/kooxda`, `/su-aalaha`, shuruudaha/asturnaanta.

### 5.3 I — Gudaha

| Sub-phase | Waxa la gaaray | PR |
| --- | --- | --- |
| I1.1 Users | ✅ | #17 |
| I1.2 Roles & permissions | ✅ | #18 |
| I2.1 Projects | ✅ | #19 |
| I2.2 Tasks | ✅ | #20 |
| I2.3 Milestones | ✅ | #21 |
| I2.4 Timesheets | ✅ | platform wave |
| I3.5 Job applications inbox | ✅ | platform wave |
| I5.1 Leads inbox | ✅ | platform wave |
| I4.1 Invoices (list + draft create) | 🟡 | platform wave — builder/PDF/send ma jiraan |
| I3 Attendance, leave, payroll | ❌ | |
| I4 Accounting, budgets, reconciliation | ❌ | |
| I5 CRM deals, quotations | ❌ | Leads kaliya |
| Kanban / Gantt | ❌ | |
| I6–I7 Assets, BI, iwm. | ❌ | |

### 5.4 P — Portal macaamiisha

| Sub-phase | Waxa la gaaray | Faallo |
| --- | --- | --- |
| P1 Client + portal projects | ✅ | `/portal/projects` |
| P3.1 Support tickets (list/create) | ✅ | Replies/SLA ma jiraan |
| P4.1 Invoice read (scoped) | 🟡 | Iyadoo la xiriirto I4.1 |
| P2.2–2.3 Portal projects/milestones UI buuxa | 🟡 | Milestones branch furan |
| P4.2 Payment gateways | ❌ | Blocked on invoice buuxa |
| P5–P6 | ❌ | |
| Documents, messages, contracts | ❌ | Models qorshaha ma jiraan Prisma |

### 5.5 M — Mobile

| | |
| --- | --- |
| React Native + Expo | ❌ Lama bilaabin (Gate: P1–P4 marka hore) |

### 5.6 Deploy & production

| Shaqada | Xaaladda |
| --- | --- |
| Backend Dockerfile + Coolify readiness | ✅ #32–#33, Redis AUTH #36 |
| Frontend Coolify prep | ✅ #37 |
| CORS production | ✅ #38 |
| Web Astro Coolify + runtime fix | ✅ #39–#40 |
| Portal login cookies production | ✅ #41 |
| Staging accepted (Gate 3) | ❌ |
| Traefik + saddex domain production buuxa | 🟡 | Shaqo socota laamo |

---

## 6. Wax-soo-saarka la gaaray (deliverables)

### 6.1 API endpoints (kooban)

- **Public (cached/rate-limited):** services, portfolio, posts, testimonials, team, faqs, careers, inquiry, subscribe, job apply.
- **Auth:** login, refresh, logout, me.
- **Internal:** users, roles, permissions, projects, tasks, milestones, CMS CRUD, leads, applications, clients, timesheets, invoices, support-tickets.
- **Portal:** `GET /api/v1/portal/projects` (scoped).

### 6.2 Prisma models (database hadda)

User, Role, Permission, RefreshToken, Service, JobOpening, JobApplication, Category, Post, PortfolioItem, Inquiry, Client, Employee, Timesheet, Invoice, InvoiceItem, SupportTicket, TicketReply, Project, Task, Milestone, Testimonial, TeamMember, Faq, Subscriber, AuditLog, Setting.

**Ma jiraan weli (qorshaha):** Payment, Expense, Budget, Lead, Deal, ClientDocument, Contract, Message, iwm.

### 6.3 Dashboard React (routes)

Login, dashboard, users, roles, projects, tasks, milestones, CMS (8 modules), leads, applications, clients, timesheets, invoices, tickets, portal/projects.

### 6.4 Tayada koodhka

CI on `main`: `npm ci` → migrate → seed → typecheck → lint → format → coverage → build (Postgres + Redis services).

---

## 7. Shaqo socota (laamo aan isku darin)

| Laan | Ujeeddo |
| --- | --- |
| `cursor/auth-2fa-login-so-90f3` | 2FA + login |
| `cursor/smtp-mailer-90f3` | Email SMTP |
| `cursor/i41-invoice-builder-90f3` | Invoice builder buuxa |
| `cursor/i42-manual-payments-90f3` | Lacag bixin gacanta |
| `cursor/p23-portal-milestones-90f3` | Milestones portal |
| `cursor/p3-ticket-replies-90f3` | Jawaabaha ticket |
| `cursor/*-coolify-*` | Deploy frontend/web |
| `cursor/ux-cms-cards-90f3` | UX CMS |

---

## 8. Farqiga qorshaha (gap analysis)

### 8.1 Waxa dhiman — mudnaanta sare

1. **Gate 3:** Deploy staging + aqbalid PM.
2. **2FA** (SUPER_ADMIN, ADMIN, MANAGER — qasab §13).
3. **SMTP** (xaqiijin, notifications, invoice sent).
4. **S3** + upload security (CV, media).
5. **I4.1 buuxa** → **P4.1** → **P4.2** (EVC Plus marka hore) → **I4.2** reconciliation.
6. **P2.3** milestones macmiilka.
7. **P3.3** ticket assignment + SLA.

### 8.2 Waxa dhiman — marxaladda xigta

- HR: attendance, leave, payroll (I3).
- Finance: accounting, budgets, reports (I4).
- CRM: deals, quotations (I5).
- PM: Kanban, Gantt (I2).
- Portal: documents, messages, contracts (P).
- Mobile (M).
- Media library, i18n URL buuxa (W).

### 8.3 Xidhitaanka silsiladaha (dependencies)

| Portal / feature | Waxay u baahan tahay |
| --- | --- |
| P2.2 portal projects (buuxa) | I2.1 ✅ |
| P2.3 portal milestones | I2.3 ✅ (UI/API portal weli qayb) |
| P4.1 invoices | I4.1 builder |
| P4.2 payments | P4.1 |
| I4.2 reconciliation | P4.2 webhook |
| P3.3 SLA/assignment | I1.2 ✅ |
| W4 CMS | I1 ✅ |
| I5.1 leads | W2.4 ✅ |
| I3.5 recruitment | W3.4 ✅ |

---

## 9. Amniga (security posture)

| Shuruud (qorshaha) | Xaaladda |
| --- | --- |
| Per-user scoping queries | ✅ Pattern la raacay services-ka |
| 404 for others’ rows | ✅ Qorshe |
| httpOnly cookies | ✅ |
| Rate limit login | 🟡 Hubi account + IP wada |
| 2FA privileged roles | ❌ |
| trust proxy | ✅ |
| CORS locked origins | ✅ Production fixes |
| Secrets not in client | ✅ |
| Upload MIME verify + S3 | ❌ |

---

## 10. Khatarta & caqabadaha

| Khatar | Saamaynta | Yaraynta |
| --- | --- | --- |
| Gate 3 aan la gaarin | Feature cusub oo aan la aqbalin | Staging checklist + UAT |
| Invoice/payment half-built | Macmiil ma bixin karo online | Priority silsilad I4/P4 |
| 2FA la’aanta | Compliance §13 | Branch 2FA merge |
| Env vars buildtime vs runtime (VITE_*) | Frontend API broken deploy | Coolify doc §14 |
| Multi-user client undecided | Refactor P1 client↔user | Go’aan hore §18 |

---

## 11. Talooyinka & tallaabooyinka xiga

**Phase 1 — Production-ready core (vertical slices)**

1. Merge + test 2FA, SMTP, S3 aasaas.
2. Dhammeey invoice builder (send, PDF, statuses).
3. Manual payment (I4.2 aasaas) ka hor gateway.
4. EVC Plus (P4.2) + webhook reconciliation.
5. Portal milestones + ticket replies.
6. Staging UAT → Gate 3 sign-off.

**Phase 2 — Operations**

- HR attendance/leave; timesheet approval workflows.
- CRM deals from leads.
- Kanban tasks.

**Phase 3 — Mobile & BI**

- Expo app after P1–P4 stable.

---

## 12. Go’aannada furan (product)

1. Hal shirkad macmiil — hal login mise badan?
2. Payroll/accounting — qaab sharci?
3. Websaydh static vs SSR badan?
4. Nidaam xisaabeed hore oo la isku xiro?
5. Data retention shaqaalaha?

---

## 13. Qiimeynta guud (% qiyaas farsamo)

| Track | Qiyaas dhammayn |
| --- | --- |
| F0 Foundation | 92% |
| W Website + CMS | 85% |
| I Internal | 45% |
| P Portal | 35% |
| M Mobile | 0% |
| Deploy / Ops | 50% |
| **Guud ahaan mashruuca qorshaha buuxa** | **~55%** |

*Tirooyinku ma aha rasmiga PM; waxay ku salaysan yihiin koodhka, migrations, iyo `CLAUDE.md` scope.*

---

## 14. Lifaaq — dukumentiyo kale

| Document | Ujeeddo |
| --- | --- |
| `CLAUDE.md` | Qorshe rasmiga ah (stack, gates, conventions) |
| `docs/STATUS_REPORT.md` | Snapshot 10 Sep 2026 |
| `docs/WORKLOG.md` | Wave platform PR |
| `docs/FRONTEND_VISIBILITY.md` | Cidda wax aragta role kasta |
| `docs/Somwave_Blueprint_v3_2.docx` | Design blueprint |

---

## 15. Saxeex / ansixin

| Role | Magac | Taariikh | Saxeex |
| --- | --- | --- | --- |
| Project Manager | | | |
| Technical Lead | | | |
| Stakeholder | | | |

---

*Warbixintan waxaa soo saaray falanqaynta repository-ga Somwave. Cusboonaysiinta xigta: marka Gate 3 la aqbalo ama phase cusub la dhammeeyo.*
