# Somwave — Liiska Hubinta Staging (Gate 3)

Dukumeentigan wuxuu u taagan yahay **PM / DevOps / QA** si loo xaqiijiyo in isku-darka P0 + P1 (EVC Plus) uu diyaar u yahay UAT ka hor inta aan la ansixin production.

## Aqoonsiga adeegyada Coolify

| Adeeg | Nooca env (Coolify) | Furaha / tusaale (placeholder kaliya) |
| --- | --- | --- |
| **backend** | **Runtime** | `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `CORS_ORIGINS`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_NOTIFY_TO`, `PAYMENT_EVC_API_URL`, `PAYMENT_EVC_API_KEY`, `PAYMENT_EVC_MERCHANT_ID`, `PAYMENT_EVC_WEBHOOK_SECRET` |
| **frontend** (`app.*`) | **Buildtime** | `VITE_API_URL=https://api.somwave.com/api/v1` (ama domain staging) |
| **web** (Astro) | **Buildtime** | `PUBLIC_API_URL=https://api.somwave.com/api/v1` |

> **Xusuusin:** Haddii `VITE_*` ama `PUBLIC_*` loo dhigo Runtime, bundle-ka ma heli doono — dib u build frontend/web.

## Tallaabooyinka deploy

| # | Tallaabo | Mas'uul | Agent wuxuu sameyn karaa? |
| --- | --- | --- | --- |
| 1 | Backup Postgres ka hor migrate | PM / DevOps | ❌ Ma jiro gelitaanka Coolify |
| 2 | `npx prisma migrate deploy` (backend container) | DevOps | ❌ |
| 3 | Hubi `GET /health` → Postgres + Redis OK | DevOps / QA | ❌ (curl gudaha VPS kaliya) |
| 4 | Hubi `CORS_ORIGINS` in ay ku jiraan `https://app…` iyo `https://somwave…` | DevOps | ❌ |
| 5 | Hubi cookies: `Secure`, `SameSite=Lax`, domain app staging | DevOps | ❌ |
| 6 | Webhook EVC: `POST /api/v1/payments/webhooks/evc-plus` + `X-EVC-Signature` | DevOps + gateway | ❌ |

## UAT — script tijaabo (Somali)

| # | Goob | Tallaabo | Natiijo la filayo |
| --- | --- | --- | --- |
| U1 | Auth | Staff `SUPER_ADMIN` / `ADMIN` / `MANAGER` — geli 2FA | Gelitaan guul, refresh cookie |
| U2 | Internal | Abuur biil → dir email (`SMTP_*` run) | Macmiil wuxuu helaa email |
| U3 | Portal | Macmiil: arag biil, bixi **EVC Plus** (staging sandbox) | `PENDING` → webhook → `PAID` / `PARTIAL` |
| U4 | Portal | Marxalado (`/portal/milestones`) | Liiska client-scoped |
| U5 | Portal | Ticket + jawaab | Assignment staff, macmiil arki karo |
| U6 | Internal | Manual bank payment (I4.2) | Reconciliation invoice |
| U7 | Email | Foomka xiriirka website → lead inbox | SMTP notify |

## Waxa agent-ku **sameyn karin**

- Gelitaanka Coolify, DNS, TLS, Traefik
- Dejinta runtime secrets dhab ah
- Wacitaanka webhook EVC dhab ah (waxay u baahan tahay merchant staging)
- Ansixin PM / Gate 3

## Waxa agent-ku **sameeyay**

- Code + docs + CI (typecheck, lint, test, build) branch `cursor/p1-evc-plus-ae9d`
- `.env.example` placeholders (ma jiraan sirro)
