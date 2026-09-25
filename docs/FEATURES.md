# Somwave — Features-ka saddexda qaybood

| Field | Value |
| --- | --- |
| **Mashruuca** | Somwave |
| **Nooca dukumentiga** | Liiska features-ka (product catalog) |
| **Taariikhda** | 25 Sebtember 2026 |
| **Qaybaha** | 1. Websaydh dadweynaha · 2. Portal macaamiisha · 3. Nidaamka gudaha |
| **Ilaha** | `CLAUDE.md`, koodhka (`web/`, `frontend/`, `backend/`), `docs/SOMWAVE_PROJECT_REPORT.md` |
| **Luqadda** | Soomaali (magacyada farsamo — Ingiriisi) |

**Calamadaha xaaladda**

| Calamad | Macnaha |
| --- | --- |
| ✅ | Feature la dhisay oo koodhka ku jirta |
| 🟡 | Feature qayb ahaan la dhisay (jira, laakiin dhammayn ma leh) |
| 📋 | Feature qorshaysan — weli lama dhisin |

---

## 1. Kooban

Somwave waa **hal madal** oo u adeega **saddex dhagaystayaal**, halkii Excel, WhatsApp, iyo nidaamyo kala go’an:

| # | Qaybta | Cidda u adeegta | Domain | Stack |
| --- | --- | --- | --- | --- |
| **1** | **Websaydhka dadweynaha** | Baarayaasha / macaamiisha cusub | `somwave.com` | Astro (`web/`) |
| **2** | **Portal-ka macaamiisha** | Macaamiisha jira | `app.somwave.com` | React (`frontend/`) |
| **3** | **Nidaamka gudaha** | Shaqaalaha shirkadda + CMS | `app.somwave.com` | React (`frontend/`) |

Saddexda qaybood waxay wadaagaan **hal API** (`api.somwave.com`) iyo **hal database**. Xogta waxay u socotaa hal jihada: websaydhku wuxuu keenaa leads iyo codsiyo shaqo; guduhu wuxuu abuuraa mashaariic iyo qaansheegyo; portal-ku wuxuu akhriyaa wixii guduhu soo saaro — ma abuuro mashruuc ama invoice.

```
Dadweynaha  →  foom xiriir / shaqo  →  inbox gudaha (leads, applications)
Shaqaalaha  →  mashruuc + invoice    →  portal macmiilka
Macmiilka   →  ticket / lacag        →  gudaha (taageero + reconciliation)
```

---

## 2. Qaybta 1 — Websaydhka dadweynaha

**Ujeeddo:** qofka dibadda jooga wuxuu qiimeeyaa shirkadda, wuxuu akhriyaa shaqooyinka iyo adeegyada, wuxuuna nala soo xiriiraa — **login lama baahna**.

**Cida aragta:** `GUEST` / qof aan saxiixin.

CMS-ka ma aha qayb ka mid ah Astro. Astro wuxuu **soo bandhigaa** wixii EDITOR ka qoro gudaha (`app.somwave.com`).

### 2.1 Bogagga dadweynaha

| Feature | Sharaxaad | Xaalad | URL |
| --- | --- | --- | --- |
| Homepage | Hero, adeegyo, sababta Somwave, habka shaqada, portfolio, tirooyin, marag-fur, maqaallo, CTA | ✅ | `/` |
| Ku saabsan | Taariikhda iyo ujeeddada shirkadda | ✅ | `/ku-saabsan` |
| Adeegyada | Liiska adeegyada (API) | ✅ | `/adeegyada` |
| Faahfaahin adeeg | Bog kasta `slug` | ✅ | `/adeegyada/[slug]` |
| Shaqooyinka (portfolio) | Mashruucyadii hore | ✅ | `/shaqooyinka` |
| Faahfaahin shaqo | Bog kasta `slug` | ✅ | `/shaqooyinka/[slug]` |
| Blog | Maqaallo / warar | ✅ | `/blog` |
| Maqaal | Bog kasta `slug` | ✅ | `/blog/[slug]` |
| Fursadaha shaqo | Liiska shaqooyinka furan | ✅ | `/fursado-shaqo` |
| Faahfaahin shaqo + codsi | Foom CV / codsi → inbox HR | ✅ | `/fursado-shaqo/[slug]` |
| Nala soo xiriir | Foom enquiry → lead gudaha | ✅ | `/nala-soo-xiriir` |
| Kooxda | Xubnaha shirkadda | ✅ | `/kooxda` |
| Marag-furka | Testimonials | ✅ | `/marag-furka` |
| Su’aalaha | FAQ | ✅ | `/su-aalaha` |
| Shuruudaha | Terms of use | ✅ | `/shuruudaha` |
| Asturnaanta | Privacy policy | ✅ | `/asturnaanta` |
| 404 | Bog aan jirin | ✅ | — |

### 2.2 Features-ka suuqgeynta iyo xiriirka

| Feature | Waxa qofku sameeyo | Maxaa gudaha ku dhacaya | Xaalad |
| --- | --- | --- | --- |
| Foomka xiriirka | Magac, email, fariin | `Inquiry` → inbox **Leads** | ✅ |
| Codsiga shaqada | Magac + faahfaahin + CV (qorshe S3) | `JobApplication` → inbox **Applications** | ✅ |
| Newsletter | Email subscribe | `Subscriber` → CMS Newsletter | ✅ |
| Email enquiry | SMTP marka diyaar yahay | Template enquiry shaqaalaha | 🟡 |

### 2.3 CMS (qoraalka websaydhka) — EDITOR

CMS-ku wuxuu ku nool yahay React dashboard-ka, **ma aha** websaydhka. Role `EDITOR` (ama qof leh `content.*`).

| Feature | CRUD | Xaalad |
| --- | --- | --- |
| Adeegyada | Akhri / abuur / wax ka beddel / tirtir | ✅ |
| Maqaallada (posts) | Akhri / abuur / wax ka beddel / tirtir | ✅ |
| Portfolio | Akhri / abuur / wax ka beddel / tirtir | ✅ |
| Fursadaha shaqo | Akhri / abuur / wax ka beddel / tirtir | ✅ |
| Testimonials | Akhri / abuur / wax ka beddel / tirtir | ✅ |
| Kooxda | Akhri / abuur / wax ka beddel / tirtir | ✅ |
| FAQ | Akhri / abuur / wax ka beddel / tirtir | ✅ |
| Newsletter subscribers | Akhri liiska | ✅ |
| Media library (sawirro, faylal) | Upload S3 + MIME verify | 📋 |
| i18n URL buuxa (SO / EN / AR) | Luqad URL + RTL Carabi | 🟡 Aasaas jira |

### 2.4 Features qorshaysan — Website

| Feature | Sababta weli | Xaalad |
| --- | --- | --- |
| Media library | S3 + amniga upload §13 | 📋 |
| i18n saddex luqadood oo URL | Aasaas jira; URL switching ma dhammayn | 🟡 |
| Rebuild static marka la daabaco | Hybrid SSR/static hadda | 📋 |

---

## 3. Qaybta 2 — Portal-ka macaamiisha

**Ujeeddo:** macmiilka wuxuu arkaa mashruuciisa, wuxuu furtaa ticket, wuxuuna bixiyaa qaansheeg — **telefoon / WhatsApp lama baahna**.

**Cida aragta:** role `CLIENT`. Xogta waxay ku xiran tahay `user.clientId`. Qayb kale oo macmiil ah waa `404` (ma aha `403` — si aan loo xaqiijin inay jirto).

**Xadka:** portal-ku **ma abuuro** mashruuc, milestone, ama invoice. Wuxuu **akhriyaa** wixii Internal soo saaro.

### 3.1 Aasaaska portal

| Feature | Sharaxaad | Xaalad |
| --- | --- | --- |
| Login + session | JWT cookies httpOnly; refresh | ✅ |
| Dashboard macmiil | Shell + wixii `portal.read` u oggol yahay | ✅ |
| Scoping macmiil | Query kasta `clientId`; mid kale = 404 | ✅ |
| Multi-user hal shirkad | Dhowr login oo kala oggolaansho | 📋 Go’aan §18 weli furan |

### 3.2 Mashaariic iyo horumar (P2)

| Feature | Sharaxaad | Xaalad |
| --- | --- | --- |
| Liiska mashaariicdayda | Mashruucyada `clientId` | ✅ `/portal/projects` |
| Faahfaahin mashruuc | Status, taariikh, sharaxaad | 🟡 Liis jira; detail qoto dheer weli |
| Milestones | Horumar / marxaladaha mashruuca | ✅ `/portal/milestones` |
| Tasks macmiil | Hawlaha la wadaago macmiilka | 📋 |

### 3.3 Taageero (P3)

| Feature | Sharaxaad | Xaalad |
| --- | --- | --- |
| Liiska tickets | Ticket-yadayda | ✅ `/tickets` |
| Fur ticket cusub | Cinwaan + faahfaahin | ✅ |
| Faahfaahin + jawaabo | Wadahadal ticket | ✅ `/tickets/:id` |
| Xaaladda ticket | OPEN / IN_PROGRESS / RESOLVED / iwm. | ✅ |
| Xilsaarid shaqaale | Staff assignment (gudaha) | ✅ |
| SLA + assignment policy | Waqtiga jawaabta, qofka loo xilsaaro | 📋 |

### 3.4 Qaansheegyo iyo lacag (P4)

| Feature | Sharaxaad | Xaalad |
| --- | --- | --- |
| Akhris qaansheeg | Invoice-yadayda (scoped) | 🟡 Wuxuu ku xiran yahay I4.1 |
| Bixin EVC Plus | Gateway online + webhook | 🟡 Adapter/webhook koodh; UAT staging ma dhammayn |
| eDahab | Gateway labaad | 📋 |
| Stripe | Kaarka caalamiga | 📋 |
| Bank transfer gacanta | Shaqaalaha ayaa diiwaangeliya (I4.2) | ✅ Gudaha; portal foom ma aha mid ugu weyn |
| Documents / contracts | Heshiisyo, faylal | 📋 Models qorshaha |
| Fariimaha (messages) | Thread macmiil ↔ shaqaale | 📋 |
| Service requests | Codsi adeeg cusub | 📋 |

### 3.5 Mobile (M) — ka dib portal

Mobile ma aha qayb afraad oo madax-bannaan. Waa **React Native + Expo** oo soo bandhigaysa features-ka portal (P1–P4) marka ay xasilllaan. **Lama bilaabin.**

| Feature | Xaalad |
| --- | --- |
| Login / mashaariic / tickets / invoices mobile | 📋 Blocked: P1–P4 marka hore |
| Push notifications | 📋 |

---

## 4. Qaybta 3 — Nidaamka gudaha (Internal)

**Ujeeddo:** shaqaalaha wuxuu maamulaa mashaariic, dad, iyo lacag **hal meel**.

**Cida aragta:** `STAFF`, `MANAGER`, `ADMIN`, `SUPER_ADMIN` — permission kasta. CMS-ka waa `EDITOR`.

Qaybtan waxay leedahay **lix cutub**: isticmaalayaal, mashaariic, HR, maaliyad, CRM, iyo hanti/warbixin.

### 4.1 Isticmaalayaal, doorar, amniga (I1)

| Feature | Sharaxaad | Xaalad |
| --- | --- | --- |
| Liiska users | Abuur / wax ka beddel / tirtir | ✅ `/users` |
| Doorar & permissions | RBAC `resource.action` (40+ keys) | ✅ `/roles` |
| Login / logout / me | JWT access 15 daqiiqo, refresh 30 maalmood | ✅ |
| 2FA (TOTP) | Diiwaangelin + login laba-tallaabo | ✅ `/settings/2fa` |
| 2FA qasab SUPER_ADMIN / ADMIN / MANAGER | Qorshe §13 | 🟡 Flow jira; enforcement buuxa weli |
| Audit log UI | Taariikhda falalka | 📋 Model qorshe |
| Notifications gudaha | Bell / digest | 📋 |

**Doorarka:** `SUPER_ADMIN`, `ADMIN`, `MANAGER`, `STAFF`, `EDITOR`, `CLIENT`, `GUEST`.

### 4.2 Maamulka mashaariicda (I2)

| Feature | Sharaxaad | Xaalad |
| --- | --- | --- |
| Projects | CRUD, status (PLANNING → CANCELLED), macmiil | ✅ `/projects` |
| Tasks | CRUD, status (TODO → DONE) | ✅ `/tasks` |
| Milestones | CRUD, taariikh dhammaad | ✅ `/milestones` |
| Timesheets | Saacadaha shaqaalaha, mashruuc | ✅ `/timesheets` |
| Clients | Diiwaanka shirkadaha macaamiisha | ✅ `/clients` |
| Kanban board | Drag-and-drop tasks | 📋 |
| Gantt | Jadwalka mashruuca | 📋 |
| Dashboard ops | Tirooyin mashruuc / hawl / ticket / invoice | ✅ `/` |

### 4.3 HR (I3)

| Feature | Sharaxaad | Xaalad |
| --- | --- | --- |
| Inbox codsiyada shaqada | Ka yimaadda websaydhka | ✅ `/applications` |
| Employees | Diiwaanka shaqaalaha | 📋 Model qorshe |
| Attendance | Imaanshaha maalinlaha | 📋 |
| Leave requests | Fasax | 📋 |
| Payroll | Mushahar (USD Decimal; SOS display) | 📋 |

### 4.4 Maaliyadda (I4)

| Feature | Sharaxaad | Xaalad |
| --- | --- | --- |
| Invoice list + draft | Abuur draft | ✅ `/invoices` |
| Invoice builder | Tax, items, send, void, print | ✅ `/invoices/:id` + print |
| Manual payment | Bank transfer + reconciliation (PARTIAL / PAID) | ✅ |
| EVC Plus (staff / webhook) | Charge + callback | 🟡 |
| Accounting / journal | Accounts, journal entries | 📋 |
| Budgets | Miisaaniyad mashruuc / cutub | 📋 |
| Expenses | Kharashaad | 📋 |
| Reports / exports | PDF, Excel | 📋 |

Lacagta waa `Decimal(12,2)`. Currency asaasiga: **USD**; **SOS** waa soo bandhigid.

### 4.5 CRM (I5)

| Feature | Sharaxaad | Xaalad |
| --- | --- | --- |
| Leads inbox | Enquiry-yada websaydhka | ✅ `/leads` |
| Update lead status | Follow-up gudaha | ✅ |
| Deals | Fursad iib | 📋 |
| Quotations | Qiime / soo jeedin | 📋 |
| Activities | Wicitaan, kulam, email | 📋 |

### 4.6 Hanti, settings, warbixin (I6–I7)

| Feature | Sharaxaad | Xaalad |
| --- | --- | --- |
| Assets | Qalabka shirkadda | 📋 |
| Settings | Configuration gudaha | 📋 |
| BI / reports | Warbixino maamul | 📋 |
| AI (Claude, backend only) | Prompts versioned | 📋 |

---

## 5. Cidda maxay aragtaa

Hal React app. Navigation-ka waa permission; API-ga ayaa mar kale hubiya.

| Role | Websaydh dadweynaha | CMS | Gudaha (ops / HR / finance) | Portal macmiil |
| --- | --- | --- | --- | --- |
| **GUEST** | ✅ | — | — | — |
| **CLIENT** | ✅ (sida qof kale) | — | — | ✅ kaliya xogtiisa |
| **EDITOR** | ✅ | ✅ | — | — |
| **STAFF** | ✅ | haddii `content.*` | delivery (projects, tasks, …) | — |
| **MANAGER / ADMIN** | ✅ | haddii `content.*` | modules la siiyay | — |
| **SUPER_ADMIN** | ✅ | ✅ | ✅ | ✅ (maamul) |

Qarinista button **ma aha** oggolaansho. Backend-ku waa inuu mar kale hubiyo.

---

## 6. Sida saddexda qaybood isu xiraan

| Haddii … | Waxay u baahan tahay | Xaalad |
| --- | --- | --- |
| Portal mashaariic | Internal projects (I2.1) | ✅ |
| Portal milestones | Internal milestones (I2.3) | ✅ |
| Portal invoices | Internal invoice builder (I4.1) | ✅ / 🟡 |
| Portal lacag online | Invoice la soo diray + gateway | 🟡 EVC; eDahab/Stripe 📋 |
| Reconciliation invoice | Webhook / payment record | 🟡 Manual ✅; EVC 🟡 |
| Ticket SLA / assignment | Users & roles (I1.2) | ✅ aasaas; SLA 📋 |
| CMS | Users & roles | ✅ |
| Leads gudaha | Foomka xiriirka websaydhka | ✅ |
| Recruitment inbox | Fursadaha shaqo websaydhka | ✅ |
| Mobile | Portal P1–P4 xasilloon | 📋 |

---

## 7. Features-ka la wadaago (aasaaska)

Kuwani ma aha qayb afraad — waa dhulka saddexda qaybood ku dhisan yihiin.

| Feature | Sharaxaad | Xaalad |
| --- | --- | --- |
| Monorepo + TypeScript strict | `packages/shared`, `web`, `frontend`, `backend` | ✅ |
| Auth cookies | Access + refresh, bcrypt 12 | ✅ |
| RBAC | Permission keys, role matrix | ✅ |
| UI kit | Button, Input, Select, Modal, Table, Skeleton, Badge | ✅ |
| Loading / Empty / Error | Afarta xaaladood ee view kasta | ✅ |
| Design tokens | Navy + amber; Plus Jakarta Sans; 4px spacing | ✅ |
| Timezone | Kayd UTC; soo bandhig `Africa/Mogadishu` | ✅ |
| API envelope | `{ data, meta? }` / `{ error }` | ✅ |
| Pagination & sort | `page`, `pageSize`, `sort` | ✅ |
| Rate limit + CORS | Origins xaddidan; login limit | ✅ |
| Healthcheck | Postgres + Redis | ✅ |
| SMTP | Invoice / enquiry templates | 🟡 Optional env |
| S3 uploads | 25MB, MIME magic bytes, presigned URL | 📋 |
| BullMQ jobs | Reminders, digests, cleanup | 📋 |
| Redis cache (public) | Cache `/api/v1/public/*` | 🟡 Redis jira |

---

## 8. Liis degdeg ah — waa maxay qofku sameeyaa maanta

### Websaydh (`somwave.com`)

1. Akhri homepage, adeegyo, portfolio, blog, koox, FAQ.
2. Dir foom xiriir → shaqaalaha ayaa ku arkaa **Leads**.
3. Codso shaqo → HR ayaa ku arkaa **Applications**.
4. Iska qor newsletter.

### Portal (`app.somwave.com`, CLIENT)

1. Gal akoonka.
2. Eeg mashaariicdaada iyo milestones.
3. Fur ticket, jawaab, raac xaaladda.
4. Eeg qaansheegyada; bixin gacanta / EVC (haddii la shido).

### Gudaha (`app.somwave.com`, staff)

1. Maamul users, doorar, 2FA.
2. Abuur mashruuc, hawl, milestone, timesheet, macmiil.
3. Qor content CMS → wuxuu ka muuqdaa websaydhka.
4. Raac leads iyo applications.
5. Samee invoice, dir, daabac; diiwaangeli lacag.

---

## 9. Waxa ugu weyn ee weli dhiman

Mudnaanta sare (silsiladda lacagta + Gate 3):

1. Staging UAT + aqbalid PM (Gate 3).
2. EVC Plus production + webhook xasilloon.
3. S3 uploads (CV, media CMS).
4. SLA tickets.
5. 2FA qasab doorarka mudnaanta leh.

Marxaladda xigta:

- HR: attendance, leave, payroll.
- Finance: accounting, budgets, expenses.
- CRM: deals, quotations.
- Portal: documents, messages, contracts.
- PM: Kanban, Gantt.
- Mobile Expo.

---

## 10. Tixraac

| Dukumeenti | Ujeeddo |
| --- | --- |
| [`CLAUDE.md`](../CLAUDE.md) | Qorshaha rasmiga ah (stack, gates, conventions) |
| [`SOMWAVE_PROJECT_REPORT.md`](./SOMWAVE_PROJECT_REPORT.md) | Xaaladda mashruuca iyo farqiga |
| [`FRONTEND_VISIBILITY.md`](./FRONTEND_VISIBILITY.md) | Cidda wax aragta role kasta |
| [`STATUS_REPORT.md`](./STATUS_REPORT.md) | Snapshot horumar |

---

*Dukumentigan waa liiska features-ka saddexda qaybood. Cusboonaysii marka slice cusub la dhammeeyo — calamadaha ✅ / 🟡 / 📋.*
