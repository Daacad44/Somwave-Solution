# Somwave — Warbixin dhammaystiran ee mashruuca

**Taariikh:** 22 Sebtembar 2026
**Isha:** kaydka (`claude/new-session-o05c30`), `CLAUDE.md`, PRs #1–#49, branches-ka furan, iyo koodhka hadda jira.
**Qoraaga:** warbixin xaaladeed — ma aha qorshe cusub.

---

## 1. Kooban

Somwave waa **hal platform** oo u adeega saddex kooxood:

| Koox | Waxay sameeyaan | App-ka |
| --- | --- | --- |
| Dadka dadweynaha / macaamiisha mustaqbalka | Qiimeeyaan shirkadda, soo xiriiraan, akhriyaan adeegyada | `somwave.com` (Astro) |
| Macaamiisha (clients) | Arag mashruucyadooda, biilasha, tikidhada — telefoon la’aan | `app.somwave.com` (React) |
| Shaqaalaha gudaha | Maamulaan mashruuc, CMS, macaamiil, HR, iyo maaliyad | `app.somwave.com` (React) |
| API | Xogta dhabta ah | `api.somwave.com` (Express) |

**Xaaladda maanta:** aasaaska iyo websaydka dadweynaha waa la dhisay. Qaybaha gudaha (users, roles, projects, tasks, milestones, timesheets, leads, recruitment inbox) iyo qolof-portal (dashboard, mashruucyo, biil qabyo, tikidh) waa la isku daray. **HR-ka buuxa, xisaabaadka, lacag-bixinta tooska ah, mobilada, iyo AI-ga weli lama bilaabin.**

**Qiyaas farsamo (koodhka la isku daray, ma aha “phase complete”):**

| Jid | Qiyaas | Xaalad |
| --- | --- | --- |
| F0 Aasaas | ~100% | Dhammaystiran (auth, RBAC, UI kit, CI) |
| W Websayd dadweynaha + CMS | ~90% | Bogagga iyo CMS-ka waa jiraan; i18n waa chrome kaliya; staging Gate 3 lama aqbalin |
| I Gudaha | ~35% | I1 + I2 + inboxes; HR/finance/CRM intiisa badan weli |
| P Portal | ~30% | Qolof + mashruucyo + liisaska; faahfaahin, 2FA, lacag-bixin waa PRs furan |
| M Mobile | 0% | Lama bilaabin — Gate 1 wuxuu u baahan yahay P1–P4 |

**Lama aqbalin weli:** Gate 3 (deploy staging + aqbalidda maareeyaha). Marka `CLAUDE.md` loo eego, weji lama dhameystirin ilaa taas.

---

## 2. Waa maxay, maxaa loo dhisayaa

Ujeedadu waa in shirkaddu ka baxdo Excel iyo WhatsApp:

- Macaamiilku wuxuu arkaa mashruuciisa oo wuxuu bixiyaa biilka isaga oo aan qof wicin.
- Shaqaaluhu wuxuu hal meel ku maamulaa mashruuc, shaqaale, iyo lacag.
- Dadka dibadda waxay ku qiimeeyaan shirkadda websayd nadiif ah, Soomaali ah.

**Stack-ka ( lama beddeli karo):**

- Frontend portal + gudaha: React 18 + TypeScript + Vite + Tailwind tokens + React Router + TanStack Query
- Websayd: Astro (hybrid static/SSR)
- Backend: Node 20 + Express + Prisma + PostgreSQL 16 + Redis
- Auth: JWT + refresh cookies (httpOnly), bcrypt 12
- Validation: Zod `packages/shared`
- Deploy: Docker + Coolify + Traefik
- Luqadaha: Soomaali (default), Ingiriisi, Carabi (RTL)
- Lacagta: USD (kayd), SOS (bandhig)
- Timezone bandhig: Africa/Mogadishu; kaydka: UTC

---

## 3. Waxa dhammaystay (koodhka la isku daray)

Isku darka wuxuu ku yaal laanta shaqada `claude/new-session-o05c30` (tan `origin/HEAD` u tilmaamayo). PRs #1–#32 + #35 ayaa halkan ku jira.

### 3.1 F0 — Aasaaska (dhammaystiran)

| Kood | Waxa la dhisay | PR |
| --- | --- | --- |
| F0.1 | Monorepo npm workspaces, ESLint, Prettier, TypeScript `strict` | #1 |
| F0.2 | Backend HTTP (helmet, cors, cookies, pino, rate-limit, `/health`); Vite + Astro | #2, #3 |
| F0.3 | Prisma core, JWT login/refresh-rotation, seed, `apiClient`, bogga login | #4, #5, #7 |
| F0.4 | Tokens + Tailwind, UI kit, states (loading/empty/error), AppShell, RBAC client | #8, #9, #10 |
| CI | GitHub Actions: Postgres + Redis, migrate, seed, typecheck, lint, test, build | #6 |

**Auth hadda:** email + password → cookies. Refresh wuu wareegaa; token la buriyey oo la isku dayo wuxuu dilaa dhammaan fadhiga. **2FA weli kuma jirto laanta dhexe** (schema-da `twoFactorEnabled` / `twoFactorSecret` waa diyaar; socodka waa PR #46).

### 3.2 W — Websaydka dadweynaha + CMS

**Bogagga dadweynaha** (`web/src/pages/`, Soomaali):

| URL | Ujeedo |
| --- | --- |
| `/` | Bogga guriga |
| `/ku-saabsan` | Ku saabsan |
| `/adeegyada`, `/adeegyada/[slug]` | Adeegyada (xog API) |
| `/shaqooyinka`, `/shaqooyinka/[slug]` | Portfolio |
| `/blog`, `/blog/[slug]` | Maqaallada |
| `/fursado-shaqo`, `/fursado-shaqo/[slug]` | Shaqo + foomka codsiga |
| `/nala-soo-xiriir` | Foomka xiriirka (Inquiry) |
| `/marag-furka` | Marag-furka |
| `/kooxda` | Kooxda |
| `/su-aalaha` | FAQ |
| `/asturnaanta`, `/shuruudaha` | Qarsoodiga iyo shuruudaha |

**CMS** (`frontend`, door `EDITOR`, rukhsad `content.*`):

Adeegyada · Maqaallada · Portfolio · Fursadaha shaqo · Marag-furka · Kooxda · FAQ · Warsidaha (subscribers).

**API dadweynaha** `/api/v1/public/*` — aan login lahayn, rate-limited:

- GET services, portfolio, posts, testimonials, team, FAQs, careers
- POST inquiries, job applications, subscribers (idempotent + rate limit gaar ah)

**W5.5 i18n:** beddelaha luqadda So / En / Ar + RTL chrome (nav, footer). **Jidhka bogga weli waa Soomaali.** URL-based locales (`/en/...`) lama dhisin.

### 3.3 I — Nidaamka gudaha

| Kood | Feature | Waxa qofku sameyn karo |
| --- | --- | --- |
| I1.1 | Users | CRUD, door-siin, RBAC |
| I1.2 | Roles & permissions | Tifaftiraha rukhsadaha |
| I2.1 | Projects | CRUD, xaalad, miisaaniyad, `clientId` |
| I2.2 | Tasks | CRUD mashruuc, xaalad, mudnaan, qof-u-dirid |
| I2.3 | Milestones | CRUD, dhammaystir |
| I2.4 | Timesheets | Saacado shaqaale / mashruuc, ansixin |
| I3.5 | Recruitment inbox | Codsiyada shaqo ee websaydka — liis + xaalad |
| I5.1 | Leads inbox | Inquiry-yada foomka xiriirka — liis + xaalad |
| P1 / I | Clients | Diiwaanka shirkadaha macaamiisha |
| I4.1 qayb | Invoices | Liis + **qabyo-dhis DRAFT kaliya** (tax/send/void/print ma jiraan halkan) |

AppShell-ka wuxuu u kala saaraa **Websayd / Gudaha / Portal** iyadoo rukhsadda lagu saleeyo. API-ga ayaa mar kale hubiya.

### 3.4 P — Portal-ka macaamiisha

| Kood | Feature | Xaalad |
| --- | --- | --- |
| P1 | Model `Client` + dashboard + `user.clientId` | Jira |
| P2.2 | Mashruucyadayda (scoped) | Jira — `GET /api/v1/portal/projects` |
| P3.1 | Tikidho: liis + abuurid | Jira; faahfaahin/jawaab/assignment ma jiraan |
| P4.1 qayb | Biilasha: liis + akhris | Liiska waa jira; faahfaahin/print/send waa PR #48 |

Xogta macmiilka waa `clientId`. Saf kale wuxuu soo celiyaa **404**, ma aha 403.

### 3.5 Deploy iyo tooling

- Dockerfile production (monorepo root) + entrypoint `prisma migrate deploy`
- `docker-compose.yml` local: Postgres 16 + pgvector, Redis 7
- `/health` wuxuu hubiyaa Postgres iyo Redis
- CORS waa liis cad, `*` ma jirto
- Coolify: shaqo dheeraad ah ayaa ku dhacday `main` (#33, #36–#42) — cookies production, Redis AUTH, frontend/web build packs, homepage UI. **Qaar ka mid ah kuma jiraan laantan** (eeg qaybta 7).

### 3.6 Tijaabooyin

~36 fayl tijaabo: Zod schemas, services (projects/tasks/milestones/invoices/tickets/CMS/public), middleware, UI kit. CI wuxuu ordaa coverage. **70% coverage si rasmi ah looma xaqiijin.**

---

## 4. Waxa dhex maraayo (PRs furan — 21 Sebtembar 2026)

Lix PR ayaa **isku xiran** (stacked). Lama isku darin `claude/new-session-o05c30` weli. Mid (#49 SMTP) ayaa la isku daray laanta UX, laakiin taasi weli ma aha laanta dhexe.

**Silsiladda isku xirnaanta (hoos → kor):**

```
claude/new-session-o05c30
  └── #48  I4.1 invoice builder — send, void, tax, detail, print     FURAN
        └── #47  P2.3 portal milestones                               FURAN
              └── #45  P3 ticket detail, replies, assignment          FURAN
                    └── #46  2FA TOTP + login Soomaali                FURAN
                          └── #43  UX: CMS cards + loading Soomaali   FURAN
                                └── #49  SMTP mailer                  LA ISKU DARAY (#43)
                                      └── #44  I4.2 lacag gudbis gacan FURAN
```

| PR | Cinwaan | Maxay keentaa | Lama gelin |
| --- | --- | --- | --- |
| #48 | I4.1 + P4.1 invoice | Send DRAFT→SENT, void, tax/discount, detail, print, overdue, `invoices.update` | Iimayl marka la diro |
| #47 | P2.3 milestones portal | Liis marxalado `clientId` | — |
| #45 | P3 tikidho | Detail, `TicketReply`, assignment, xaalad; 404 macmiil kale | SLA timer |
| #46 | 2FA khasab | TOTP `/settings/2fa` SUPER_ADMIN/ADMIN/MANAGER; login Soomaali | Login-ka in la joojiyo ka hor enrolment (furan) |
| #43 | UX CMS | Kaararka CMS oo dhan dashboard; qoraal Soomaali | — |
| #49 | SMTP | Helper + templates invoice/enquiry | Ma aha laanta dhexe |
| #44 | I4.2 payments | `Payment` + gudbinta bangiga, `PARTIAL`/`PAID`, Idempotency-Key | EVC Plus / eDahab / Stripe |

Dhammaan PRs-kan `mergeable: CLEAN`, review lama sameyn, CI status-ka GitHub kuma qorna (workflow-ku wuxuu ku ordaa `main` oo keliya — eeg khatarta 8.3).

---

## 5. Waxa dhiman (sida `CLAUDE.md` u qoray)

### 5.1 In la isku daro marka hore (PRs-ka furan)

1. #48 invoice builder
2. #47 portal milestones
3. #45 ticket replies
4. #46 2FA
5. #43 UX
6. #44 lacag gacan (ka dib SMTP #49 oo horay u galay laanta)

Kadib: `db:seed` si furayaasha cusub (`invoices.update`, `payments.*`) u dhashaan.

### 5.2 Gudaha — weli lama bilaabin

| Kood | Feature | Sababta ay muhiim u tahay |
| --- | --- | --- |
| I3.1–I3.4 | Attendance, fasax, payroll, shaqaale buuxa | HR waa Excel weli |
| I4.3–I4.5 | Expenses, budget, accounting, journal, warbixinno | I4 ma aha nidaam xisaabeed |
| I5.2+ | Deals, activities, quotations | Lead inbox kaliya ayaa jira |
| I2 UI | Kanban, Gantt | Tasks waa miis, ma aha board |
| I6–I7 | Assets, documents, reports, executive BI | Lama taaban |

### 5.3 Portal — weli

| Kood | Feature | Xannibaad |
| --- | --- | --- |
| P4.2 | Payment gateway (EVC Plus → eDahab → Stripe) | Gate 1: I4.1 + P4.1 ka hor |
| P3.3 | SLA + assignment rasmi | Assignment waa #45; SLA ma jiro |
| P5–P6 | Documents, messages, contracts, service requests | Models-ka (`ClientDocument`, `Message`, `Contract`) lama dhisin |
| P1+ | Multi-user per client | Hadda 1 client ≈ 1 user |

### 5.4 Websayd / CMS — dhimasho

- Tarjumaad buuxda ee jidhka bogagga (hadda chrome kaliya)
- URL-based i18n
- Media library / S3 sawirro (cover, CV, avatar waa URL qoraal)
- Page CMS (`Page` model `CLAUDE.md` — ma jiro)

### 5.5 Aasaas amniga iyo howlaha

| Shay | Xaalad |
| --- | --- |
| 2FA khasab doorarka sare | Schema diyaar; socodka #46 |
| SMTP + SPF/DKIM/DMARC | Helper #49; deegaanka production lama xaqiijin |
| S3 uploads (25MB, MIME, presigned URL) | Lama bilaabin |
| BullMQ shaqooyin (xusuusin, overdue, digest) | Redis waa jira; jobs/ ma jiro |
| Claude AI backend | Lama bilaabin |
| PDF invoice (`@react-pdf` / puppeteer) | Print HTML #48; PDF rasmi ma jiro |
| Excel exports | Lama bilaabin |
| Audit log UI | Model `AuditLog` waa jira; screen ma jiro |
| Notifications, Translation, MediaAsset, Setting UI | Models / meel bannaan |

### 5.6 Mobile (M1–M3)

React Native + Expo. **Waa mamnuuc** ilaa P1–P4 la dhameystiro. Mobile wuxuu soo bandhigaa wax jira, ma abuurayo feature cusub.

### 5.7 Definition of done — weli dhiman xitaa wejiyada “dhameystiran”

`CLAUDE.md` §15 / Gate 2–3:

- [ ] Deploy staging + aqbalidda maareeyaha (Gate 3)
- [ ] Coverage ≥ 70% si la xaqiijiyey
- [ ] Tijaabo 404 macmiil kale **dhammaan** routes-ka lahaan doona
- [ ] RBAC dhammaan doorarka (ogolaansho iyo diidmo)
- [ ] Responsive 375 / 768 / 1024 / 1440 si la tijaabiyey
- [ ] i18n buuxa dusha kasta
- [ ] Prisma schema loo kala qaybiyey `core/web/portal/hr/finance/crm/pm` (hadda hal `schema.prisma`)

---

## 6. Yaa maxaa arkaa

Laba origin. Navigation waa rukhsad; API-ga ayaa go’aanka dhabta ah qaata.

| Door | Wuxuu arkaa |
| --- | --- |
| GUEST | Websayd kaliya. Dashboard ma jiro. |
| CLIENT | Portal: dashboard, mashruucyadayda, tikidho, biilasha. `clientId` kaliya. |
| EDITOR | CMS / websayd. HR, finance, xogta macaamiisha kale ma arko. |
| STAFF | Delivery: mashruuc, hawl, marxalad, saacado (sida loo siiyey). |
| MANAGER / ADMIN | Gudaha + CMS haddii `content.*`. ADMIN ma beddelo SUPER_ADMIN door-maamul ilaa `roles.manage`. |
| SUPER_ADMIN | Saddexda kooxood. |

**Qarinta badhanka ma aha rukhsad.** Backend waa inuu mar kale eego.

---

## 7. Laamaha git iyo khilaafka `main`

- **Laanta shaqada / default:** `claude/new-session-o05c30` ← platform (P1, invoices draft, tickets, leads) + Dockerfile (#32, #35).
- **`main`:** Coolify iyo homepage ka dib Sebtembar 10: Redis AUTH (#36), frontend/web deploy (#37–#40), CORS (#38), cookies production (#41), homepage UI (#42).
- **PRs #43–#48** waxay ka soo kala baxaan session-ka, **ma aha** `main`.

Natiijo: `main` wuxuu leeyahay hagaajinta production; session-ku wuxuu leeyahay features-ka platform. **Laba jid ayaa kala duwan.** Isku darka midba midka kale waa shaqo gaar ah ka hor staging xasilloon.

CI wuxuu ku ordaa `push`/`pull_request` → `main` oo keliya. PRs-ka session ma muuqdaan check-yo GitHub.

---

## 8. Khataraha iyo waxa go’aan u baahan

### 8.1 Furan (`CLAUDE.md` §18) — weli lama jawaabin

1. **Hal macmiil, dhowr login?** Hadda 1:1. Beddelka 1:N waa qaali ka dib P1.
2. **Payroll / accounting format sharci?** Haddii haa, I4.5 wuxuu u baahan yahay spec ka hor dhisid.
3. **Websayd static vs SSR?** Hadda hybrid Astro.
4. **Xisaabaad dibadda vs I4 nidaamka rasmiga?**
5. **Haynta diiwaanka shaqaalaha ka dib bixitaanka?** Waa sharci, ma aha doorasho farsamo.
6. **2FA:** login ugu horreeya ma oggolaanayaa ka hor enrolment? (#46 wuxuu su’aashan waydiiyey.)

### 8.2 Khataro farsamo

| Khatar | Sabab |
| --- | --- |
| Gate 3 waa la jebiyey | Wejiyo badan ayaa socda isku mar; 90% waa la sii waday |
| Invoice I4.1 ma dhamaystirma | Gateway (P4.2) waa xanniban ilaa send/detail la isku daro |
| Uploads ma jiraan | CV iyo sawirro waa URL — production-ready ma aha |
| Email ma jiro laanta dhexe | Inquiry iyo invoice SENT ma tagaan sanduuqa |
| 2FA ma jirto | Doorarka sare waa khasab §13 |
| `main` ≠ session | Deploy iyo features waa kala yaal |
| CI ma eego PRs-ka session | Regression lama arko ka hor merge `main` |
| Prisma waa hal fayl | Qaybinta domain-ka waa deprecation-ka Prisma 7 |

### 8.3 Waxa aan sheegi karin (lama xaqiijin)

- In staging/production ay run-gareeyaan image-ka ugu dambeeya
- In domain-yada `somwave.com` / `app.somwave.com` / `api.somwave.com` ay shaqeeyaan (Dockerfile wuxuu xusaa `api.somwave.botandev.com`)
- Coverage-ka dhabta ah
- In SMTP credentials Coolify ku jiraan

---

## 9. API iyo xogta hadda jirta

**Envelope:** `{ data, meta? }` / `{ error: { code, message, details? } }`

**Routes la isku daray:**

| Hab | Jid |
| --- | --- |
| GET | `/health` |
| POST/… | `/api/v1/auth` (login, refresh, logout, me) |
| CRUD | `/users`, `/roles`, `/permissions` |
| CRUD | `/projects`, `/tasks`, `/milestones` |
| CMS | `/cms/*` |
| Ops | `/leads`, `/job-applications`, `/clients`, `/timesheets` |
| Finance qayb | `/invoices` (GET list, POST draft) |
| Support qayb | `/support-tickets` (list, create, patch status) |
| Portal | `/portal/projects` |
| Public | `/public/services|portfolio|posts|careers|testimonials|team|faqs` + POST inquiries/subscribers/applications |

**Models Prisma hadda:** User, Role, Permission, UserRole, RefreshToken, Service, JobOpening, JobApplication, Category, Post, PortfolioItem, Inquiry, Client, Employee, Timesheet, Invoice, InvoiceItem, SupportTicket, TicketReply, AuditLog, Setting, Project, Task, Milestone, Testimonial, TeamMember, Faq, Subscriber.

**Ma jiraan weli:** Payment, Expense, Budget, Account, JournalEntry, Lead (Inquiry ayaa la isticmaalaa), Deal, Quotation, Attendance, LeaveRequest, Payroll, Asset, MediaAsset, Notification, Translation, Page, ClientDocument, Contract, MessageThread, Message.

Lacagta waa `Decimal(12,2)`. Soft-delete (`deletedAt`) waa kuwa taariikhdu muhiimka u tahay.

---

## 10. Talo — waa maxay xiga

Sida Gate 1 iyo 3:

1. **Isku darka `main` ↔ session** ka hor wax cusub — Coolify + homepage + platform hal laan.
2. **CI u fur** `claude/new-session-o05c30` iyo PRs-keeda.
3. **Isku dar silsiladda #48 → #47 → #45 → #46 → #43 → #44** mid mid, seed dib u orod.
4. **Staging + aqbalid** ka hor I3/I5/I6 ama mobile.
5. **SMTP production** (SPF/DKIM) si inquiry iyo invoice u shaqeeyaan.
6. **S3** ka hor CV iyo sawirro dhab ah.
7. **EVC Plus (P4.2)** marka I4.1 + P4.1 la aqbalo.
8. **I3 HR** iyo **I4 accounting** — kaliya ka dib spec-ka qaybta 8.1.

Ha bilaabin mobile. Ha bilaabin weji cusub iyadoo kan hadda 90% yahay.

---

## 11. Faylasha muhiimka ah

| Fayl | Door |
| --- | --- |
| `CLAUDE.md` | Xeerka rasmiga ah — wuu ka sarreeyaa wax kasta |
| `docs/Somwave_Blueprint_v3_2.docx` | Naqshadda |
| `docs/STATUS_REPORT.md` | Kooban Ingiriisi (la cusboonaysiiyey isla taariikhdaan) |
| `docs/WORKLOG.md` | Diiwaanka laanta Sebtembar 10 |
| `docs/FRONTEND_VISIBILITY.md` | Yaa maxaa arkaa |
| `backend/prisma/schema.prisma` | Xogta |
| `backend/src/app.ts` | Routes |
| `frontend/src/app/App.tsx` | Waddooyinka React |
| `packages/shared/src/` | Zod + permissions |

---

## 12. Xisaabta PRs

- **La isku daray:** #1–#33, #35–#42, #49 (laanta UX, ma aha dhexe)
- **Xiran:** #34 (isku darka `main` oo khilaafay)
- **Furan:** #43, #44, #45, #46, #47, #48

Mashruucu wuxuu ka socday 27 Agoosto 2026. ~ toddobaad aasaas + websayd + I1/I2; Sebtembar 10 platform wave; Sebtembar 11–12 Coolify; Sebtembar 21 lix PR oo isku xiran oo aan weli la isku darin.
