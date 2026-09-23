# Somwave — Super Admin (SUPER_ADMIN)

Warbixintan waxay sharaxaysaa sida loo abuuro isticmaale **Super Admin** oo maamula dhammaan qaybaha nidaamka (Website/CMS, Internal, Portal) iyadoo la raacayo seed-ka Prisma.

## SUPER_ADMIN vs ADMIN

| Doorka | Rukhsadaha |
|--------|------------|
| **SUPER_ADMIN** | Dhammaan rukhsadaha (`permissions` seed) — **oo ay ku jirto** `roles.manage` (maamulka doorka iyo rukhsadaha). Lama beddeli karo UI-ga (`RolePermissionsModal`). |
| **ADMIN** | Ku dhowaad dhammaan rukhsadaha **marka laga reebo** `roles.manage`. Ma aha beddelka SUPER_ADMIN haddii aad u baahan tahay maamulka doorka. |

Seed-ku wuxuu mar walba cusboonaysiiyaa xiriirka doorka ↔ rukhsadaha; isticmaale Super Admin waxaa lagu xiraa doorka `SUPER_ADMIN` iyadoo la isticmaalayo `UserRole`.

## Sirta iyo amniga

- **Ha gelin** sirta dhabta ah ee production repo-ga, `.env` la commit gareeyay, ama log-yada.
- **Production / staging:** deji **runtime** (Coolify) labadan:
  - `SEED_SUPER_ADMIN_EMAIL`
  - `SEED_SUPER_ADMIN_PASSWORD` (sirta adag, gaar ah deegaanka)
- **Local dev:** haddii aadan dejin `SEED_SUPER_ADMIN_PASSWORD` oo `NODE_ENV` uusan ahayn `production`, seed wuxuu isticmaalaa sirta dev **kaliya** `changeme` — beddel isla markiiba gelitaanka koowaad ama deji env var.
- Horey waxaa jiray magacyo legacy: `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` — weli waa la aqbalaa, laakiin doorbso `SEED_SUPER_ADMIN_*`.

Super Admin waa mid ka mid ah doorka **2FA qasab** (`TWO_FACTOR_REQUIRED_ROLES`). Ka dib gelitaanka, shid 2FA `/settings/2fa`.

## Local — Postgres + seed

```bash
# 1) Infra
docker compose up -d

# 2) Backend env (tusaale)
cp backend/.env.example backend/.env
# Hagaaji JWT_SECRET (≥32 chars) haddii loo baahdo

# 3) Migrate + seed
npm run prisma:migrate --workspace @somwave/backend
npm run db:seed --workspace @somwave/backend
```

**Dev default (kaliya local, haddii env aan la dejin):**

| Email | Password |
|-------|----------|
| `admin@somwave.com` | `changeme` |

Si aad u beddesho:

```bash
export SEED_SUPER_ADMIN_EMAIL=you@example.com
export SEED_SUPER_ADMIN_PASSWORD='your-strong-local-password'
npm run db:seed --workspace @somwave/backend
```

Seed waa **idempotent**: mar kale oo la ordayo wuxuu cusboonaysiiyaa hash-ka sirta haddii env la bixiyo, wuxuuna hubiyaa in `UserRole` uu xiro `SUPER_ADMIN`.

## Staging / production

1. Backup database.
2. Deploy image cusub.
3. `npx prisma migrate deploy` (ama `npm run prisma:migrate --workspace @somwave/backend` container-ka gudahiisa).
4. Deji runtime env:
   - `SEED_SUPER_ADMIN_EMAIL`
   - `SEED_SUPER_ADMIN_PASSWORD`
5. Ordi seed **hal mar** (ama marka super admin cusub loo baahdo):

   ```bash
   npm run db:seed --workspace @somwave/backend
   ```

6. Ka saar ama ha ku tiirin `SEED_SUPER_ADMIN_PASSWORD` env-ka joogtada ah haddii aad rabto in seed mar dambe uusan dib u qorin sirta — seed-ku wuxuu cusboonaysiiyaa hash-ka marka var-ku jiro marka seed la ordo.

## Gelitaanka app-ka

React dashboard (local): `http://localhost:5173` — geli email/sirta kor ku xusan ama kuwa aad env uga dejisay.

Haddii 2FA la qasbo, raac tilmaamaha UI-ga kadib gelitaanka guusha leh.
