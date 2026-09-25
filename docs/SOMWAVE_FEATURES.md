# Somwave — Features-ka saddexda qaybood

| Field | Value |
| --- | --- |
| **Mashruuca** | Somwave |
| **Nooca dukumeentiga** | Liiska features-ka (product catalog) |
| **Taariikhda** | 25 Sebtember 2026 |
| **Ilaha** | `CLAUDE.md`, koodhka repository-ga, `docs/SOMWAVE_PROJECT_REPORT.md` |
| **Luqadda** | Soomaali (magacyada farsamo — Ingiriisi) |

---

## 1. Kooban

Somwave waa **hal madal** oo u adeega **saddex dhagaystayaal**. Mid kasta wuxuu leeyahay bogag, awood, iyo xog u gaar ah, laakiin dhammaantood waxay ku xidhan yihiin **hal backend** (`api.somwave.com`) iyo **hal database**.

| # | Qaybta | Cidda isticmaasha | Domain | Stack |
| --- | --- | --- | --- | --- |
| **1** | **Websaydhka dadweynaha** | Baarayaal, macaamiil cusub, shaqo-doonayaal | `somwave.com` | Astro |
| **2** | **Portal-ka macaamiisha** | Macaamiisha shirkadda (CLIENT) | `app.somwave.com` | React |
| **3** | **Nidaamka gudaha** | Shaqaalaha (STAFF, MANAGER, ADMIN, EDITOR, SUPER_ADMIN) | `app.somwave.com` | React |

**Ujeeddada:** qofku wuxuu qiimeyn karaa shirkadda oo wuxuu la xiriiri karaa (websaydh); macmiilku wuxuu arki karaa mashaariiciisa oo wuxuu bixin karaa qaansheeg **isagoon qof wicin** (portal); shaqaaluhu wuxuu maamuli karaa mashaariic, taageero, iyo maaliyad **hal meel** halkii Excel iyo WhatsApp (gudaha).

Calamada xaaladda:

| Calamad | Macnaha |
| --- | --- |
| ✅ | La dhisay — qof wuu isticmaali karaa koodh ahaan |
| 🟡 | Qayb / aasaas — jira, laakiin silsilad buuxa ma dhammayn |
| ❌ | Qorshe rasmiga ah — lama bilaabin ama lama dhammayn |

---

## 2. Siduu u shaqeeyaa saddexda qaybood

```
Dadweynaha (W)                    Gudaha (I)                     Portal (P)
─────────────                    ──────────                     ──────────
Foom xiriir      ─────────────►  Leads inbox
Codsi shaqo      ─────────────►  Recruitment inbox
CMS ayaa qora content-ka  ◄────  EDITOR / CMS
                                 Projects / milestones  ──────►  Mashaariicayda
                                 Invoice builder        ──────►  Qaansheegyadayda
                                 Ticket assignment      ◄─────►  Taageero
                                 Lacag gacanta / EVC    ◄─────►  Bixi qaansheeg
```

**Xeerka muhiimka ah:** Portal-ku **ma abuuro** mashruuc ama qaansheeg. Waxaas waxaa ka soo baxa nidaamka gudaha; portal-ku wuxuu akhriyaa wuxuuna bixiyaa.

Xeerka fulinta: [`SOMWAVE_MASTER_REQUIREMENT.md`](./SOMWAVE_MASTER_REQUIREMENT.md). Nav-ka React wuxuu u kala baxaa Website / Operations / Portal iyadoo permissions + `clientId` loo eegayo — `CLIENT` ma arko Operations.

---

## 3. Qaybta 1 — Websaydhka dadweynaha

**Yaa u talagalay:** qofka aan soo galin (GUEST).  
**Ujeeddo:** in shirkadda la qiimeeyo, adeegyada la fahmo, lala xiriiro, iyo in shaqo la dalbado.

### 3.1 Bogagga dadweynaha

| Feature | Waa maxay | Xaalad |
| --- | --- | --- |
| Bogga hore | Hero, adeegyo, shaqooyin, CTA | ✅ |
| Ku saabsan (`/ku-saabsan`) | Sheekada iyo ujeeddada shirkadda | ✅ |
| Adeegyada (`/adeegyada`, `/adeegyada/[slug]`) | Liiska + faahfaahinta adeeg kasta | ✅ |
| Shaqooyinka / portfolio (`/shaqooyinka`) | Tusaalooyin shaqo la qabtay | ✅ |
| Blog (`/blog`, `/blog/[slug]`) | Maqaallo iyo warar | ✅ |
| Fursadaha shaqo (`/fursado-shaqo`) | Boosaska furan + foomka codsiga | ✅ |
| Nala soo xiriir (`/nala-soo-xiriir`) | Foomka weydiinta (inquiry) | ✅ |
| Kooxda (`/kooxda`) | Xubnaha shaqaalaha la daabacay | ✅ |
| Su'aalaha (`/su-aalaha`) | FAQ | ✅ |
| Marag-furka (`/marag-furka`) | Testimonials | ✅ |
| Shuruudaha / asturnaanta | Bogag legal | ✅ |
| Newsletter | Isku-qor email | ✅ |
| SEO + sitemap + robots | Raadinta Google | ✅ / 🟡 i18n URL buuxa weli |
| Luqadaha Soomaali / English / Arabic | i18n + RTL Carabi | 🟡 Aasaas; URL-based buuxa ma dhammayn |

### 3.2 Foomamka dadweynaha (silsilad gudaha)

| Feature | Waxa dhaca | Xaalad |
| --- | --- | --- |
| Foomka xiriirka | Inquiry → inbox **Leads** ee gudaha; email SMTP haddii diyaar | ✅ |
| Codsiga shaqada | Job application → inbox **Applications** ee gudaha | ✅ |
| Isku-qor newsletter | Email → liiska subscribers (CMS) | ✅ |
| Upload CV (S3, MIME verify) | Faylka CV-ga kaydinta amniga leh | ❌ |

### 3.3 CMS — maamulka content-ka (W4)

CMS-ku **ma aha** qayb ka mid ah Astro. Waa shaashadaha React ee `app.somwave.com`, xaddidan `content.*` (EDITOR iyo kuwa loo oggolaaday). Astro wuxuu **soo bandhigaa** waxa CMS-ku soo saaro.

| Module | Awoodaha | Xaalad |
| --- | --- | --- |
| Adeegyada | Abuur / wax ka beddel / daabac | ✅ |
| Maqaallada (posts) | Qor, daabac, qayb (category) | ✅ |
| Portfolio | Shaqooyin + sawir + nidaam | ✅ |
| Fursadaha shaqo | Boos fur / xidh | ✅ |
| Testimonials | Marag-fur + rating | ✅ |
| Kooxda | Xubin, doorka, bio | ✅ |
| FAQs | Su'aal / jawaab | ✅ |
| Newsletter | Liiska isku-qorayaasha | ✅ |
| Media library | Kayd sawirro / faylal | ❌ |

---

## 4. Qaybta 2 — Portal-ka macaamiisha

**Yaa u talagalay:** isticmaale `CLIENT` oo ku xidhan `clientId`.  
**Ujeeddo:** macmiilku wuxuu arkaa **mashaariiciisa**, wuxuu furtaa **ticket**, wuxuuna **akhriyaa / bixiyaa** qaansheegyadiisa — xogta qof kale waa `404`, ma aha `403`.

### 4.1 Gelitaanka iyo xaddidaadda

| Feature | Sharaxaad | Xaalad |
| --- | --- | --- |
| Login cookie (httpOnly) | JWT access + refresh; production cookies | ✅ |
| Dashboard portal | Kooban mashaariic / tickets / invoices | ✅ |
| Scoping `clientId` | Kaliya xogta shirkaddiisa | ✅ |
| Login-yo badan hal shirkad | 1:N Client ↔ User | ❌ Go’aan furan (`CLAUDE.md` §18) |

### 4.2 Mashaariic iyo horumar

| Feature | Sharaxaad | Xaalad |
| --- | --- | --- |
| Liiska mashaariicayda | Akhris scoped; shaqaaluhu ayaa abuuray | ✅ |
| Milestones | Horumar / taariikhaha dhammaadka | ✅ |
| Faahfaahin mashruuc + documents | Faylal, qandaraadyo, fariimo | ❌ |

### 4.3 Taageero (tickets)

| Feature | Sharaxaad | Xaalad |
| --- | --- | --- |
| Fur ticket cusub | Mawduuc, sharaxaad, mudnaan | ✅ |
| Liis + faahfaahin | Xaalad, taariikh | ✅ |
| Jawaabaha (replies) | Wadahadal macmiil ↔ shaqaale | ✅ |
| SLA + xeerka xilsaarida | Waqti jawaab + auto-assign | 🟡 Assignment jira; SLA ma dhammayn |

### 4.4 Qaansheeg iyo lacag bixin

| Feature | Sharaxaad | Xaalad |
| --- | --- | --- |
| Liiska qaansheegyada | Kaliya kuwa `clientId` u gaar ah | ✅ |
| Faahfaahin + daabacaad | Xaalad: DRAFT/SENT/PARTIAL/PAID/OVERDUE/VOID | ✅ |
| EVC Plus | Bixi telefoon; webhook + idempotency | ✅ |
| Bank transfer gacanta | Shaqaaluhu wuu diiwaangeliyaa (gudaha) | ✅ |
| eDahab / Stripe | Gateway-yo xiga | ❌ |
| Service requests | Codsi adeeg cusub | ❌ |
| Documents / contracts / messages | Faylal, qandaraad, fariimo | ❌ Models qorshaha; ma jiraan |

---

## 5. Qaybta 3 — Nidaamka gudaha

**Yaa u talagalay:** shaqaalaha. Nav-ku wuxuu u kala baxaa **Website / Operations / Portal** iyadoo RBAC loo eegayo. Button-ka qarinta **ma aha** oggolaansho — API-gu wuu dib u hubiyaa.

### 5.1 Aasaaska (F0) — dhammaan saddexda qaybood

| Feature | Sharaxaad | Xaalad |
| --- | --- | --- |
| Auth login / refresh / logout / me | Cookies httpOnly, bcrypt 12 | ✅ |
| 2FA (TOTP) | Qasab SUPER_ADMIN / ADMIN / MANAGER | ✅ |
| RBAC + permissions | 40+ furayaal `resource.action` | ✅ |
| UI kit + Loading / Empty / Error | `components/ui`, `components/states` | ✅ |
| AppShell + nav by permission | Website / Operations / Portal | ✅ |
| DatePicker + timezone Africa/Mogadishu | Hal picker wadaag | ✅ |
| SMTP | Invoice sent, enquiry notify | ✅ Optional env |
| S3 uploads | Media / CV | ❌ |
| BullMQ jobs | Xasuusin, digest, cleanup | ❌ Redis jira |

### 5.2 Isticmaalayaal iyo doorka (I1)

| Feature | Sharaxaad | Xaalad |
| --- | --- | --- |
| Users CRUD | Abuur, beddel, jooji | ✅ |
| Roles & permissions | Doorka nidaamka + furayaal | ✅ |
| Roles: SUPER_ADMIN, ADMIN, MANAGER, STAFF, EDITOR, CLIENT, GUEST | Seed + RBAC | ✅ |

### 5.3 Mashaariic (I2)

| Feature | Sharaxaad | Xaalad |
| --- | --- | --- |
| Projects | Abuur, xaalad, macmiil, maamule, miisaaniyad | ✅ |
| Tasks | Assignee, mudnaan, xaalad (TODO → DONE) | ✅ |
| Milestones | Taariikh, nidaam, dhammayn | ✅ |
| Timesheets | Saacado, mashruuc, billable, approval | ✅ |
| Kanban / Gantt | Muuqaal board / jadwal | ❌ |

### 5.4 HR iyo qorista (I3)

| Feature | Sharaxaad | Xaalad |
| --- | --- | --- |
| Recruitment inbox | Codsiyada websaydhka; NEW → HIRED | ✅ |
| Employee record | Xidhiidh User; timesheets | 🟡 Model + timesheets; HR UI ma buuxa |
| Attendance | Imaanshaha maalinlaha | ❌ |
| Leave requests | Fasax | ❌ |
| Payroll | Mushahar | ❌ |

### 5.5 Maaliyad (I4)

| Feature | Sharaxaad | Xaalad |
| --- | --- | --- |
| Invoice builder | Draft, tax, items, send, void, print | ✅ |
| Manual payment + reconciliation | Bank transfer → PARTIAL / PAID | ✅ |
| EVC Plus (staff / client) | Charge + webhook | ✅ |
| Expenses | Kharashyada | ❌ |
| Budgets | Miisaaniyad vs dhab | ❌ |
| Accounting / journal | Xisaabaad buuxa | ❌ |
| Reports / Excel export | Warbixin maaliyadeed | ❌ |

### 5.6 CRM (I5)

| Feature | Sharaxaad | Xaalad |
| --- | --- | --- |
| Leads inbox | Inquiries websaydhka; NEW / READ / ARCHIVED | ✅ |
| Clients | Shirkad macmiil, email, taleefan, xaalad | ✅ |
| Deals | Fursad iib | ❌ |
| Quotations | Qiimeyn rasmi | ❌ |
| Activities | Wicitaan / kulan | ❌ |

### 5.7 Hanti, warbixin, iyo nidaam (I6–I7)

| Feature | Sharaxaad | Xaalad |
| --- | --- | --- |
| Assets | Qalab / hanti | ❌ |
| Reports / BI | Dashboard qoto dheer | ❌ |
| Settings | Habayn shirkadeed | 🟡 Model `Setting` jira |
| Audit log | Raad falalka | 🟡 Model jira; UI ma jiro |
| Notifications | Ogeysiis gudaha | ❌ |
| Translations | Qoraalluqad | ❌ |

---

## 6. Cidda wax aragta (role → qayb)

| Doorka | Websaydh dadweynaha | CMS | Gudaha | Portal |
| --- | --- | --- | --- | --- |
| GUEST (aan soo galin) | ✅ | — | — | — |
| CLIENT | ✅ (sidii dadweynaha) | — | — | ✅ kaliya xogtiisa |
| EDITOR | ✅ | ✅ | — | — |
| STAFF | ✅ | haddii `content.*` | mashaariic / tasks / timesheets | tickets haddii loo oggolaaday |
| MANAGER / ADMIN | ✅ | haddii `content.*` | modules-ka loo siiyay | maamul tickets / invoices |
| SUPER_ADMIN | ✅ | ✅ | ✅ | ✅ |

Faahfaahin: [`docs/FRONTEND_VISIBILITY.md`](./FRONTEND_VISIBILITY.md).

---

## 7. Features wadaag (platform)

Kuwaan ma aha qayb saddexaad; waa aasaaska saddexda qaybood wadaagaan.

| Feature | Sharaxaad | Xaalad |
| --- | --- | --- |
| API envelope `{ data, meta }` / `{ error }` | Qandaraas mid ah | ✅ |
| Zod schemas `packages/shared` | Isla xeerka client + server | ✅ |
| Pagination + sort | `page`, `pageSize`, `sort` | ✅ |
| Rate limit | Public + login | ✅ / 🟡 IP **iyo** account waa in la xaqiijiyaa |
| CORS locked origins | Ma aha `*` | ✅ |
| Design tokens (navy / amber) | `tokens.css`, ma palette default | ✅ |
| Luqad UI Soomaali | Login, CMS, invoices, errors | ✅ Qayb badan |
| Mobile app (Expo) | M1–M3 — **ma kordhiso** features cusub | ❌ Gate: P1–P4 marka hore |

---

## 8. Jadwalka xaaladda (kooban)

| Qaybta | Features la dhisay | Features qorshaha ah ee ugu weyn |
| --- | --- | --- |
| **1. Websaydh** | Bogag, foomam, CMS 8 modules, SEO aasaas | Media library, i18n URL buuxa, S3 CV |
| **2. Portal** | Projects, milestones, tickets + replies, invoices, EVC Plus | Documents, messages, contracts, eDahab/Stripe, SLA, multi-user client |
| **3. Gudaha** | Users/roles, PM, leads, recruitment, invoices, payments, clients, timesheets | Attendance, leave, payroll, accounting, deals, Kanban/Gantt, assets, BI |

**Mobile** waa track afraad (`M*`). Lama tirsado saddexda qaybood ee hadda; wuxuu soo bandhigayaa features-ka portal-ka ee jira.

---

## 9. Tixraac

| Dukumeenti | Ujeeddo |
| --- | --- |
| [`CLAUDE.md`](../CLAUDE.md) | Qorshe rasmiga ah — stack, gates, conventions |
| [`SOMWAVE_PROJECT_REPORT.md`](./SOMWAVE_PROJECT_REPORT.md) | Warbixin horumar (~55% snapshot) |
| [`SOMWAVE_IMPLEMENTATION_UPDATE.md`](./SOMWAVE_IMPLEMENTATION_UPDATE.md) | Cusboonaysiin P0 / P1 |
| [`FRONTEND_VISIBILITY.md`](./FRONTEND_VISIBILITY.md) | Cidda wax aragta |
| [`STAGING_UAT_CHECKLIST.md`](./STAGING_UAT_CHECKLIST.md) | Hubinta staging |

---

*Dukumeentigan waa liiska features-ka saddexda qaybood. Xaaladda calamadaha waxay ku salaysan tahay koodhka `claude/new-session-o05c30` (25 Sebtember 2026). Warbixin horumar iyo % dhammayn — eeg warbixinnada xaaladda, ee ma ahan dukumeentigan.*
