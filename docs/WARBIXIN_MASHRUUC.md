# Somwave — Warbixin dhammaystiran

**Taariikh:** 22 Sebtembar 2026  
**Ilo:** kaydka `Daacad44/Somwave-Solution`, `CLAUDE.md`, PRs #1–#49, laamaha GitHub, CI, iyo koodhka hadda ku jira `claude/new-session-o05c30`.  
**Maaha qiyaas:** xaalad kasta hoos ku xusan waa mid laga akhriyay koodh ama GitHub. Haddii wax aan la xaqiijin, waa la sheegay.

---

## 1. Kooban — hal bog

Somwave waa hal platform oo u adeega saddex dhagaystayaal: websayd dadweyne (Astro), dashboard gudaha + CMS (React), iyo portal-ka macaamiisha (React). Mobile (Expo) weli lama bilaabin, waana sida `CLAUDE.md` u xaddiday.

**Hadda:** aasaaska (F0) iyo websaydka (W1–W5) waa la dhisay. Gudaha wuxuu gaadhay isticmaalayaasha, doorarka, mashruucyada, hawlaha, marxaladaha, saacadaha, lead-yada, iyo sanduuqa shaqo-codsiga. Portal-ku waa qolof shaqeynaya: dashboard, mashruucyada macmiilka, liiska biilasha qabyada, iyo tikidho la abuuri karo. Lacag-bixinta tooska ah, HR buuxa, xisaabaadka, CRM-ka heshiisyada, iyo mobile-ku weli ma jiraan.

**Lambarka ugu muhiimsan:** labada jirrid (`main` iyo `claude/new-session-o05c30`) way kala tageen. Production-ka Coolify iyo homepage-ka cusub waxay ku jiraan `main`. Portal-ka, biilasha, tikidhada, iyo lead-yadu waxay ku jiraan session-ka. Midna ma haysato waxa kan kale haysto. Lix PR oo draft ah ayaa la iskororyey 21 Sebtembar; SMTP (#49) waa la merge-gareeyay laanta iskororyeysa, laakiin **lama keenin** `main` ama session-ka.

**Gate 3** (staging + aqbal macmiil) weli lama dhaafin.

---

## 2. Waa maxay mashruuca

| Dhagaystayaal | Workspace | Stack | Domain-ka qorshaysan |
| --- | --- | --- | --- |
| Dadweyne / macaamiil-mustaqbal | `web/` | Astro + Tailwind | `somwave.com` |
| Shaqaalaha + CMS + portal | `frontend/` | React 18 + Vite + TanStack Query | `app.somwave.com` |
| API | `backend/` | Node 20 + Express + Prisma | `api.somwave.com` |
| Qandaraasyada la wadaago | `packages/shared/` | Zod + constants | — |

Dockerfile-ka production wuxuu tilmaamayaa `https://api.somwave.botandev.com` — domain-ka Coolify ee hadda, ee aan ahayn `api.somwave.com` ee qoraalka.

Saddexda dusha waxay wadaagaan hal backend, hal Prisma, iyo hal qandaraas API: `{ data, meta? }` ama `{ error: { code, message } }`.

Doorar: `SUPER_ADMIN`, `ADMIN`, `MANAGER`, `STAFF`, `EDITOR`, `CLIENT`, `GUEST`.

---

## 3. Waxa dhex maraayo (hadda, 22 Seb 2026)

### 3.1 Labada jirrid ee kala tagay

`origin/HEAD` waa `claude/new-session-o05c30`. `main` waa jirrid kale.

| Wax | `claude/new-session-o05c30` (default) | `main` |
| --- | --- | --- |
| Platform wave (#31): DatePicker, portal, leads, invoices, tickets | Haa | Maya |
| Dockerfile Coolify (#32 / #35) | Haa | Haa (nuqul #33) |
| Redis AUTH healthcheck (#36) | Maya | Haa |
| Frontend Coolify (#37) | Maya | Haa |
| CORS production (#38) | Maya | Haa |
| Web Coolify + Astro `send` (#39, #40) | Maya | Haa |
| Cookie-yada login production (#41) | Maya | Haa |
| Homepage UI cusub (#42) | Maya | Haa |
| SMTP mailer (#49) | Maya | Maya |

Natiijo: haddii Coolify uu deploy-gareeyo `main`, websaydka iyo login-ka production way ka fiican yihiin, laakiin portal / biilal / tikidho / lead-yo **ma jiraan**. Haddii la deploy-gareeyo session-ka, feature-yadaas way jiraan, laakiin hagaajinta production (cookies, CORS, Redis AUTH, homepage) **way maqan yihiin**.

### 3.2 PRs-ka draft ee iskororyey (21 Seb 2026)

Dhammaantood waa draft, dhammaantood waa `MERGEABLE`, dhammaantood waxaa sameeyay isla wakiilka `Project status report`. Iskororka la rabo:

```
session (#48 I4.1 biilal)
  → #47 P2.3 marxaladaha portal
    → #45 P3 tikidho (faahfaahin, jawaab, assignment)
      → #46 2FA + login Soomaali
        → #43 UX CMS cards + qoraal Soomaali
          → #49 SMTP  [MERGED laanta 43, 21 Seb 12:12 UTC]
            → #44 I4.2 lacag gudbis bangiga (kan ugu dambeeya)
```

| PR | Cinwaan | Xaalad | Maxaa keenaya |
| --- | --- | --- | --- |
| #48 | I4.1 invoice builder: send, void, tax, detail, print | Draft | Biilasha hadda waa liis + qabyo kaliya |
| #47 | P2.3 marxaladaha portal (client-scoped) | Draft | Portal-ku ma arko marxalado |
| #45 | Tikidho: faahfaahin, jawaab, assignment, status | Draft | `TicketReply` model waa jiraa, API/UI ma jiraan |
| #46 | 2FA TOTP + login Soomaali | Draft | 2FA waa qayb schema, ma shaqeyso |
| #43 | CMS cards oo dhan + loading Soomaali | Draft | Dashboard CMS wuxuu muujiyaa adeegyo kaliya |
| #49 | SMTP helper + templates | **Merged** laanta 43 | Lama keenin jirridaha |
| #44 | I4.2 gudbinta bangiga + reconcilation | Draft | `PaymentGateway` interface; EVC Plus lama dhisin |

### 3.3 Agents-ka cloud ee dhowaan

Dhowr wakiil ayaa isla mashruuca ku shaqeeyay: homepage visual QA, walkthrough video, “Ship remaining Somwave slices”, “Rebuild Somwave UI”, iyo warbixinno hore (`Warbixin mashruuc dhamaystiran`, `Project status report`). Saddex wakiil oo isla cinwaankan wata ayaa isla wakhtiga la furay. Warbixintan waxay ku salaysan tahay kaydka iyo GitHub, ee aan ahayn wakiil kale.

### 3.4 CI iyo issues

- Workflow-ka CI wuxuu ordaa **`main` iyo PRs-ka `main` ku socda** keliya. Session-ka iyo PRs-ka draft ee ku dhisan session **kama kiciyaan** CI-gaas.
- CI-gii ugu dambeeyay ee `main` (11 Seb, #42 homepage) waa **success**. Inta ka horreysa ee Coolify (#36, #41) way **fashilmeen**.
- GitHub issues: **0**. Shaqada waxay ku socotaa PRs + `CLAUDE.md`, ee aan ahayn tracker.

### 3.5 Production / Coolify

Sebtembar 10–11 waxaa la isku dayay in API, frontend, iyo web la geeyo Coolify. Dockerfile-ka xidhmada wuxuu ordaa `prisma migrate deploy` marka la bilaabo, wuxuuna dhagaystaa `0.0.0.0:4000`. `/health` wuxuu tijaabiyaa Postgres **iyo** Redis.

Hagaajinada la xaqiijiyay ee `main`: Redis AUTH (NOAUTH → 503), CORS origin-ka frontend, cookies login production, Astro runtime `send`, homepage-ka la sawiray.

**Lama xaqiijin** in staging Gate 3 la aqbalay, ama in `somwave.com` / `app.somwave.com` ay nool yihiin. Domain-ka Dockerfile-ku sheegayo waa `api.somwave.botandev.com`.

---

## 4. Waxa dhammaystay (koodhka default / session)

Xaalad = waxa ku jira `claude/new-session-o05c30` maanta. “Dhammaystiran” halkan macnaheedu waa: schema + service + route + UI + tijaabo ayaa jira. **Maaha** in Gate 2/3 (qof ayaa isticmaalay + staging la aqbalay) la dhaafay — taasi weli waa furan.

### 4.1 F0 — Aasaaska — dhammaystiran

| ID | Wax | Xaalad |
| --- | --- | --- |
| F0.1 | Monorepo npm workspaces, ESLint, Prettier, TypeScript strict | Haa — PR #1 |
| F0.2 | Backend HTTP (helmet, cors, pino, rate-limit, `/health`), Vite, Astro | Haa — #2, #3 |
| F0.3 | Prisma core, JWT login/refresh/logout/me, cookies httpOnly, `apiClient`, login UI | Haa — #4, #5, #7 |
| F0.4 | RBAC, `tokens.css`, UI kit, states, AppShell | Haa — #8–#10 |
| CI | GitHub Actions + Postgres/pgvector + Redis | Haa — #6 (laakiin wuxuu eegaa `main` keliya) |

UI kit-ka: `Button`, `Input`, `Select`, `Badge`, `Skeleton`, `Table`, `Modal`, `Toast`, `DatePicker`. States: `LoadingState`, `EmptyState`, `ErrorState`. Ma jiro Redux/Zustand.

Auth: login IP **iyo** account rate-limit, refresh wuu wareegaa, bcrypt cost 12. 2FA: tiirarka `twoFactorEnabled` / `twoFactorSecret` iyo liiska `TWO_FACTOR_REQUIRED_ROLES` way jiraan; **socodka enrolment / challenge kuma jiro** session-ka (wuxuu ku jiraa PR #46).

### 4.2 W — Websaydka dadweynaha — dhammaystiran (qaybo yaryar ayaa dhiman)

| ID | Bog / feature | URL-ka Astro | CMS |
| --- | --- | --- | --- |
| W1 | Layout, nav, homepage | `/` | — |
| W2.1 | Adeegyada (xog API) | `/adeegyada` | W4.1 |
| W2.2 | Ku saabsan | `/ku-saabsan` | — |
| W2.3 | Faahfaahinta adeeg | `/adeegyada/[slug]` | W4.1 |
| W2.4 | Foomka xiriirka (Inquiry, idempotent) | `/nala-soo-xiriir` | I5.1 inbox |
| W-legal | Asturnaanta + shuruudaha | `/asturnaanta`, `/shuruudaha` | — |
| W3.1 | Portfolio | `/shaqooyinka`, `/shaqooyinka/[slug]` | W4.3 |
| W3.2 | Blog | `/blog`, `/blog/[slug]` | W4.2 |
| W3.3 / W3.4 | Shaqo + codsi | `/fursado-shaqo`, `/fursado-shaqo/[slug]` | W4.4 + I3.5 |
| W4.* | CMS EDITOR (`content.*`) | `/cms/*` ee React | Adeegyo, maqaallo, portfolio, shaqo, marag, koox, FAQ, warside |
| W5.1 | Marag-furka | `/marag-furka` | Haa |
| W5.2 | Kooxda | `/kooxda` | Haa |
| W5.3 | FAQ | `/su-aalaha` | Haa |
| W5.4 | Warside (footer, upsert email) | site-wide | `/cms/subscribers` |
| W5.5 | SEO (OG, Twitter, JSON-LD, robots, 404) + i18n chrome So/En/Ar + RTL | — | — |

Homepage-ka **cusub** ee sawirka la siiyay wuxuu ku jiraa `main` (#42), ee aan ahayn session-ka.

i18n: chrome-ka (nav, footer, warside) waa So/En/Ar + RTL Carabi. Jidhka bogagga weli waa Soomaali. URL-based locale (`/en/...`) lama dhisin.

### 4.3 I — Nidaamka gudaha — qayb ahaan

| ID | Feature | Waxa shaqeeya | Xadka |
| --- | --- | --- | --- |
| I1.1 | Users | CRUD, doorar, RBAC | — |
| I1.2 | Roles & permissions | Tifatiraha rukhsadaha | — |
| I2.1 | Projects | CRUD, status, budget, manager | Kanban/Gantt ma jiraan |
| I2.2 | Tasks | CRUD, status, priority, assignee | — |
| I2.3 | Milestones | CRUD, completion | Portal-ku ma akhriyo (PR #47) |
| I2.4 | Timesheets | Shaqaale + mashruuc, oggolaansho | Employee model waa khafiif |
| I3.5 | Recruitment inbox | Liis + update status | CV/S3 ma jiro; attendance/leave/payroll ma jiraan |
| I4.1 | Invoices | Liis + abuur DRAFT + items | Send/void/tax/print waa PR #48 |
| I5.1 | Leads | Inquiry → inbox + status | Deal/quotation/activity ma jiraan |

Nav-ka AppShell wuxuu u kala baxaa **Websayd / Gudaha / Portal** iyadoo rukhsad lagu xiro. Qarinaanta xiriirku maaha oggolaansho — API-ga ayaa dib u hubiya.

### 4.4 P — Portal-ka macmiilka — qolof

| ID | Feature | Xaalad |
| --- | --- | --- |
| P1 | Client model, `user.clientId`, dashboard, mashruucyo scoped | Haa |
| P2.2 | Mashruucyada portal | Haa — `/portal/projects` |
| P2.3 | Marxaladaha portal | Maya (PR #47) |
| P3.1 | Tikidho liis + abuur + status | Haa; faahfaahin/jawaab/assignment waa PR #45 |
| P4.1 | Biilasha portal | Liis akhris; faahfaahin/print waa PR #48 |
| P4.2 | Lacag-bixin | Maya (interface-ka waa PR #44; EVC Plus weli ma jiro) |

CLIENT wuxuu arkaa portal keliya. EDITOR wuxuu arkaa CMS keliya. SUPER_ADMIN wuxuu arkaa saddexda koox.

Qaanuunka scoping: saf macmiil kale wuxuu soo celiyaa **404**, ee aan ahayn 403.

### 4.5 API-yada ku jira session-ka

`/api/v1`:

- `auth`: login, refresh, logout, me
- `public`: services, portfolio, posts, testimonials, team, faqs, careers + applications, inquiries, subscribers
- `users`, `roles`, `permissions`
- `projects`, `tasks`, `milestones`
- `cms/*`
- `leads`, `job-applications`, `clients`, `timesheets`
- `invoices` — GET list, POST draft
- `support-tickets` — GET, POST, PATCH status/priority
- `portal/projects`

Ma jiraan: `/payments`, `/invoices/:id` send/void, ticket replies, 2FA, documents, messages, contracts, employees CRUD, leave, payroll, expenses, deals.

### 4.6 Xogta (Prisma)

Moodello **jira**: User, Role, Permission, UserRole, RefreshToken, Service, JobOpening, JobApplication, Category, Post, PortfolioItem, Inquiry, Client, Employee, Timesheet, Invoice, InvoiceItem, SupportTicket, TicketReply, AuditLog, Setting, Project, Milestone, Task, Testimonial, TeamMember, Faq, Subscriber.

Moodello **qorshaysan ee maqan**: MediaAsset, Notification, Translation, Page, Payment, Expense, Budget, Account, JournalEntry, Lead (Inquiry ayaa beddelaya hadda), Deal, Activity, Quotation, Asset, Attendance, LeaveRequest, Payroll, ClientDocument, ServiceRequest, Contract, MessageThread, Message.

Lacagta waa `Decimal(12,2)`. Magacyada miisaska waa snake_case. Migrations-ka waa la commit-gareeyay (15 migration). Schema weli waa hal fayl; kala-qaybinta `core/web/portal/hr/finance/crm/pm` waa dib loo dhigay (Prisma 7).

### 4.7 Tijaabooyin iyo tayada

- 36 fayl tijaabo (shared schemas, services, middleware, UI kit, `apiClient`, `date`, `rbac`).
- Commit-yadii W5 waxay sheegeen ~140 test + typecheck/lint/format/build cagaar.
- Coverage 70% waa shuruud `CLAUDE.md` §15; lambarka hadda lama cabbirin warbixintan.
- BullMQ / `backend/src/jobs/`: **fayl ma jiro**. Redis waa jiraa, shaqooyin wakhti-ku-salaysan lama dhisin.
- Claude API / AI prompts: **lama bilaabin**.

---

## 5. Waxa dhiman

U kala saar: (A) koodh diyaar oo draft, (B) qaybaha xiga ee qorshaha, (C) go'aamo furan.

### 5.1 A — Diyaar laakiin lama merge-garayn

1. Isku darka `main` ↔ session (Coolify + homepage + platform). Haddii aan la sameyn, midkasta oo la deploy-gareeyo wuu dhiman yahay.
2. PR #48 — I4.1 / P4.1 buuxa (send, void, tax, detail, print, overdue, `invoices.update`).
3. PR #47 — P2.3 marxaladaha portal.
4. PR #45 — P3 tikidho buuxa (404 scoping waa qayb ka mid ah).
5. PR #46 — 2FA khasab SUPER_ADMIN / ADMIN / MANAGER + login Soomaali.
6. PR #43 — CMS dashboard cards + loading Soomaali.
7. PR #49 — SMTP (invoice-sent.v1, enquiry-notify.v1). Haddii SMTP aan la dejin, send wuu iska dhaafaa, shaqada ma jebinayo.
8. PR #44 — I4.2 gudbis bangiga, `Idempotency-Key`, `PARTIAL`/`PAID`. EVC Plus **kuma jiro**.

Kadib merge: dib u orod `db:seed` si `invoices.update` iyo `payments.*` ay u dhashaan.

### 5.2 B — Weli lama dhisin

**Amniga iyo infra**

- 2FA waa khasab qoraalka; session-ka kuma jiro.
- S3 / object storage: upload-ka (CV, sawir cover, dokumenti) weli waa URL qoraal. Magic-bytes, 25MB, presigned URLs ma jiraan.
- SMTP production (SPF/DKIM/DMARC) — helper-ka waa draft/stack, dejin lama xaqiijin.
- CI inuu ordo session iyo PRs-keeda, ama in session la waafajiyo `main`.
- Docker/Coolify ee **saddexda** adeeg in la xaqiijiyo inay wada nool yihiin isla xogta.
- Domain-yada rasmiga ah (`somwave.com` / `app.` / `api.`) vs `*.botandev.com`.

**Gudaha — HR (I3)**

- Attendance, leave requests, payroll. `Employee` waa jiraa (lambarka, jagada, xaaladda) laakiin ma jiro CRUD HR ama UI.
- Recruitment waa inbox keliya: shortlist/hire kama dhaqaaqo Employee dhab ah.

**Gudaha — Maaliyad (I4)**

- Invoice builder buuxa (A).
- Payment gateways: EVC Plus marka hore, kadib eDahab, Stripe, gudbis gacmeed (A wuxuu keenayaa gacanta keliya).
- I4.2 webhook / reconcilation toos ah (wuxuu ku xiran yahay P4.2).
- Expenses, budgets, accounts, journal entries, accounting reports (I4.5).
- PDF invoice (`@react-pdf/renderer` / puppeteer) — PR #48 wuxuu sheegayaa print view, PDF server-side lama arkin session-ka.

**Gudaha — CRM (I5) iyo wixii ka dambeeya**

- Leads inbox waa jiraa. Deal, Activity, Quotation ma jiraan.
- Assets, reports / BI, settings UI, audit log UI (`AuditLog` iyo `Setting` waa miisaska, ma jiraan shaashado).
- I6 / I7 ma leh slices la merge-gareeyay.

**Portal (P)**

- P2.3 milestones (A).
- P3 replies / assignment / SLA (A qayb; SLA timers si ulakac ah looma been-abuurin).
- P4.1 invoice detail (A) + P4.2 lacag-bixin toos ah.
- P5 / P6: documents, messages, contracts, service requests — lama bilaabin.
- Macmiil hal shirkad = hal user (P1). Multi-user clients waa go'aan furan.

**Websayd**

- Homepage-ka cusub in lagu soo celiyo session, ama session lagu daro `main`.
- i18n URL + tarjumaadda jidhka bogagga.
- Media library CMS (sawirro dhab ah, ee aan ahayn URL).
- Page model / CMS pages (qoraalka wuxuu sheegayaa `Page`; Prisma kuma jiro).

**Mobile (M1–M3)**

- Lama taaban. Gate 1: P1–P4 waa inay jiraan ka hor.

**Shaqooyin background**

- BullMQ: xasuusin, invoice overdue, digests, cleanup — ma jiraan. Qaanuunka: ha isticmaalin timer browser.

**AI**

- Claude API backend-only, prompts versioned — lama bilaabin.

### 5.3 C — Qeexida “dhammaystiran” ee weli dhiman

`CLAUDE.md` §15 iyo Gate 2/3:

- Staging deploy + aqbal mashruuc-maamule — **lama dhaafin**.
- Qof dhab ah ayaa isticmaalay slice kasta — aan la xaqiijin.
- Tijaabo ah in user kale uu helo 404 — qayb ahaan service tests; dhammaan routes ma caddaal.
- RBAC dhammaan doorarka (ogol + diid) — seed + tijaabooyin qaar; ma aha matrix buuxa.
- Responsive 375 / 768 / 1024 / 1440 — qorshe; lama xaqiijin browser-ka warbixintan.
- Coverage ≥ 70% — aan la cabbirin.
- Copy Soomaali dhammaan dusha — qaar (labels biilal/tikidho, nav); login weli wuxuu u baahan yahay PR #46.

---

## 6. Yaa arkaa maxaa (hadda)

| Doorka | Websayd | CMS | Gudaha | Portal |
| --- | --- | --- | --- | --- |
| GUEST | Haa | Maya | Maya | Maya |
| CLIENT | — | Maya | Maya | Dashboard, mashruucyo, tikidho, biilal (liis) |
| EDITOR | — | Dhammaan CMS | Maya | Maya |
| STAFF | — | Maya | Mashruuc / hawl / marxalad / saacado (akhris + qorid xaddidan) | Maya |
| MANAGER | — | Haddii `content.*` | Delivery + leads + applications + timesheets + invoices + tickets + clients | Maya |
| ADMIN | — | Haddii la siiyo | Inta badan; `roles.manage` ma leh default | Maya |
| SUPER_ADMIN | — | Haa | Haa | Haa |

---

## 7. Khataraha ugu waaweyn

1. **Jirridaha kala tagay.** Tani waa khatarta ugu weyn. Merge-la'aan, production iyo feature-yadu way kala yaalaan.
2. **Stack-ga draft wuxuu ku dhisan yahay session, ee aan ahayn `main`.** CI-ga rasmiga ah ma eego. Haddii la merge-gareeyo mid mid, waa in la xalliyo isku-dhacyada Coolify/homepage.
3. **Biilasha qabyada.** Macaamiishu ma bixin karaan. I4.1 buuxa + P4.1 + P4.2 waa silsilad. EVC Plus weli waa qorshe.
4. **2FA ma jirto** doorarka khatarta leh, inkasta oo qoraalka yidhaahdo waa khasab.
5. **Upload-ka waa URL qoraal.** CV iyo sawirro ma aha S3; tani waa amniga iyo xogta.
6. **Email ma baxo** session/main. Lead iyo invoice ma ogeysiinayaan qof.
7. **Jobs ma jiraan.** Invoice OVERDUE, xasuusin, cleanup — gacanta ama weligood ma dhacaan.
8. **Gate 3.** Koodh badan ayaa “dhammaystiran” engineering ahaan, laakiin mashruucu ma aha mid staging la aqbalay.

---

## 8. Go'aamo furan (weli `CLAUDE.md` §18)

1. Hal shirkad macmiil — ma u baahan tahay login-yo badan oo rukhsado kala duwan? Tani waxay beddeshaa `Client` ↔ `User` 1:1 → 1:N.
2. Payroll / accounting — ma u baahan yihiin qaab sharci gaar ah ka hor I4.5?
3. Websaydka — static rebuild marka la daabaco, mise SSR? Hadda waa hybrid.
4. Ma jiraa nidaam xisaabeed kale oo Somwave ay la heshiinayso, mise I4 waa source of truth?
5. Kaydinta diiwaanka shaqaalaha marka uu baxo — shuruud sharci, ee aan ahayn doorasho injineer.
6. 2FA PR #46: login-kii ugu horreeyay wuu dhaafaa, kadib enrolment waa khasab. Ma la xidhayaa login ilaa la diiwaangeliyo?
7. Domain: `somwave.com` vs `*.botandev.com` — kee staging, kee production?
8. Kee jirridka rasmiga ah: `main` mise `claude/new-session-o05c30`? CI wuxuu eegaa `main`; `origin/HEAD` waa session.

---

## 9. Talo — waxa xiga (farsamo, ee aan ahayn wakhti)

Kuwani waa isku xirnaan, ee aan ahayn jadwal.

1. **Doorasho jirrid + merge `main` ↔ session.** Iyada la'aanteed wax kasta oo cusub waa la kala ridi.
2. **CI inuu raaco jirridka rasmiga ah.**
3. **Merge stack-ga draft** (#48 → #47 → #45 → #46 → #43 → SMTP waa ku jiraa 43 → #44) kadib marka jirriddu mid noqoto. Seed dib u orod.
4. **Xaqiiji Coolify** saddexda adeeg + `/health` + cookies + CORS + `VITE_*` buildtime (khaladka ugu caansan ee §14).
5. **P4.2 EVC Plus** marka I4.1 iyo P4.1 ay dhab ahaan nool yihiin — Gate 1.
6. **S3 + SMTP production** ka hor inta aan la odhan “codsi shaqo” ama “biil la diray” ay shaqeeyaan.
7. **HR / accounting / CRM / mobile** ha bilaaban ilaa Gate 1 iyo Gate 3 ee qaybaha ay ku xiran yihiin la dhaafo.

---

## 10. Faylasha iyo tirooyinka (session, maanta)

| Cabbir | Qiime |
| --- | --- |
| PRs la merge-gareeyay (jirridaha) | #1–#33, #35–#42 |
| PRs draft / stack | #43–#48; #49 merged stack keliya |
| Bogag Astro | 17 |
| Shaashado React (`*Page.tsx`) | 22 |
| Adeegyo backend | ~20 + tijaabooyin |
| Zod schemas | 18 feature |
| Migrations Prisma | 15 |
| Faylal tijaabo | 36 |
| Faylal `.ts`/`.tsx` (aan `node_modules`) | ~202 |
| GitHub issues | 0 |

---

## 11. Waxa warbixintan aan sheegin

- In staging ama production ay **dhab ahaan** nool yihiin hadda — Coolify waa la diyaariyey; aqbal Gate 3 lama diiwaangelin kaydka.
- Coverage percent sax ah.
- Tayada QA ee homepage-ka `main` (#42) — wakiillo visual QA ayaa jiray; warbixintan ma ahayn review naqshad.
- In saddexda “Project gaan report” ee isku mar socda ay isku mid noqonayaan.

---

## 12. Xulashada hal jumlad

Somwave waa **websayd iyo aasaas dashboard oo shaqeeya**, **portal iyo biilal oo qolof ah**, iyo **HR / lacag-bixin / mobile oo weli qorshe**. Shaqada ugu muhiimsan maaha feature cusub — waa in labada jirrid la mid dhigo, stack-ga draft la soo dejiyo, iyo in staging la aqbalo.
